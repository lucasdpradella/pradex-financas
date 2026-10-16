-- 2026-10-16 — Excluir conta (exigência da App Store: guideline 5.1.1(v)).
--
-- Quem chama: a edge function `excluir-conta`, com service role, depois de validar o
-- JWT do próprio usuário. Esta função prepara o banco; a edge function apaga o login
-- em seguida (auth.admin.deleteUser) e o ON DELETE CASCADE leva o resto: fp_*,
-- categorias, orcamentos, dividas, livro_membros, trial_lembretes, profiles...
--
-- Decisões do Lucas (2026-10-16):
--   * Casal: o que é do Livro (lançamentos, cartões, bancos, metas) FICA com o parceiro.
--     Só os dados pessoais e o login somem.
--   * Assinatura paga ativa: exclui na hora e avisa o Lucas no WhatsApp para cancelar
--     na Cakto. Não bloqueia.
--
-- Por que precisa desta função e não só do deleteUser:
--   * Lancamentos.user_id, cartoes.user_id, agente_logs, agente_msgs_processadas e
--     agente_onboarding_estado apontam para auth.users SEM cascade → o deleteUser falha.
--   * bancos.user_id e metas.user_id são CASCADE → no casal, o deleteUser apagaria
--     bancos e metas que o parceiro usa.
--   * Lancamentos/cartoes/bancos/metas.livro_id não têm cascade → o Livro de quem usa
--     sozinho não sai sem limpar antes.
--
-- Idempotente: rodar de novo para o mesmo usuário não quebra (sem Livro = nada a fazer).

create or replace function public.excluir_conta_preparar(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_livro uuid;
  v_parceiro uuid;
  v_rotulo text;
  v_perfil record;
  v_pagou boolean;
  v_modo text;
begin
  if p_user_id is null then
    raise exception 'user_id obrigatorio';
  end if;

  -- Retrato antes de apagar: vai no aviso do Lucas. cakto_eventos.user_id vira null
  -- depois do deleteUser, então tem que ser lido agora.
  select p.nome, p.apelido, p.telefone, p.plano, p.plano_ate, p.trial_ate
    into v_perfil
    from public.fp_perfil p
   where p.user_id = p_user_id;

  select exists (select 1 from public.cakto_eventos e where e.user_id = p_user_id)
    into v_pagou;

  select m.livro_id into v_livro
    from public.livro_membros m
   where m.user_id = p_user_id
   limit 1;

  if v_livro is not null then
    select m.user_id into v_parceiro
      from public.livro_membros m
     where m.livro_id = v_livro and m.user_id <> p_user_id and m.ativo
     order by (m.papel = 'dono') desc, m.created_at
     limit 1;
  end if;

  if v_parceiro is not null then
    -- ===== Casal: o Livro fica com o parceiro =====
    v_modo := 'casal';

    -- Nome de banco/meta é único por usuário. Se o parceiro já tem um "Nubank", o
    -- "Nubank" de quem sai vira "Nubank (Ana)" em vez de quebrar a transferência.
    v_rotulo := coalesce(nullif(trim(v_perfil.apelido), ''),
                         nullif(split_part(trim(coalesce(v_perfil.nome, '')), ' ', 1), ''),
                         'ex-membro');

    update public.bancos b
       set nome = b.nome || ' (' || v_rotulo || ')'
     where b.user_id = p_user_id and b.livro_id = v_livro and not b.removido
       and exists (select 1 from public.bancos o
                    where o.user_id = v_parceiro and not o.removido
                      and lower(o.nome) = lower(b.nome));
    update public.metas t
       set nome = t.nome || ' (' || v_rotulo || ')'
     where t.user_id = p_user_id and t.livro_id = v_livro and not t.arquivada
       and exists (select 1 from public.metas o
                    where o.user_id = v_parceiro and not o.arquivada
                      and lower(o.nome) = lower(t.nome));

    -- O trigger sync_saldo_pagamento_fatura dispara neste UPDATE: estorna com o user
    -- antigo e debita com o novo. Dentro do Livro o banco do cartão é o mesmo para os
    -- dois (banco_id_do_cartao procura pelo livro_id), então o saldo fica igual.
    update public."Lancamentos" set user_id = v_parceiro
     where user_id = p_user_id and livro_id = v_livro;
    update public.cartoes set user_id = v_parceiro
     where user_id = p_user_id and livro_id = v_livro;
    update public.bancos set user_id = v_parceiro
     where user_id = p_user_id and livro_id = v_livro;
    update public.metas set user_id = v_parceiro
     where user_id = p_user_id and livro_id = v_livro;
    update public.meta_marcos mm set user_id = v_parceiro
     where mm.user_id = p_user_id
       and mm.meta_id in (select id from public.metas where livro_id = v_livro);

    update public.livro_membros set papel = 'dono', ativo = true
     where livro_id = v_livro and user_id = v_parceiro;
    delete from public.livro_membros where user_id = p_user_id;
  elsif v_livro is not null then
    -- ===== Sozinho: o Livro inteiro vai junto =====
    v_modo := 'sozinho';

    delete from public."Lancamentos" where livro_id = v_livro;
    delete from public.cartoes where livro_id = v_livro;
    delete from public.metas where livro_id = v_livro;
    delete from public.bancos where livro_id = v_livro;
    delete from public.livros where id = v_livro;  -- livro_membros sai em cascade
  else
    v_modo := 'sem_livro';
  end if;

  -- Sobras fora do Livro (dado antigo sem livro_id) que travariam o deleteUser.
  delete from public."Lancamentos" where user_id = p_user_id;
  delete from public.cartoes where user_id = p_user_id;

  -- Tabelas do agente sem cascade.
  delete from public.agente_logs where user_id = p_user_id;
  delete from public.agente_msgs_processadas where user_id = p_user_id;
  delete from public.agente_onboarding_estado where user_id_candidato = p_user_id;

  -- Clientes de um assessor que sai ficam sem assessor (FK sem cascade).
  update public.profiles set assessor_id = null where assessor_id = p_user_id;

  return jsonb_build_object(
    'modo', v_modo,
    'parceiro_id', v_parceiro,
    'nome', v_perfil.nome,
    'telefone', v_perfil.telefone,
    'plano', coalesce(v_perfil.plano, 'none'),
    'plano_ate', v_perfil.plano_ate,
    'trial_ate', v_perfil.trial_ate,
    'pagou_cakto', v_pagou
  );
end;
$$;

comment on function public.excluir_conta_preparar(uuid) is
  'Prepara a exclusão de conta: casal → Livro fica com o parceiro; sozinho → Livro apagado. Limpa as FKs sem cascade. Depois dela, auth.admin.deleteUser. Só service_role.';

revoke all on function public.excluir_conta_preparar(uuid) from public, anon, authenticated;
grant execute on function public.excluir_conta_preparar(uuid) to service_role;
