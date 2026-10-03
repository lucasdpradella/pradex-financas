-- 2026-09-25 — Plano Casal (nível 3: tudo do Assistente, para os dois membros do livro)
--
-- ⚠️ NÃO APLICADA automaticamente. Rodar no SQL Editor (ou `supabase db query --linked -f`)
-- ANTES do deploy das Edge Functions: o cakto-webhook novo grava plano='casal' em
-- fp_perfil e em pendencias_assinatura, e sem esta migration o check constraint recusa.
--
-- Três peças:
--   1. fp_perfil_plano_check passa a aceitar 'casal'.
--   2. pendencias_assinatura_plano_check idem (compra do Casal sem conta no app).
--   3. admin_metricas conta o Casal: coluna própria, entra em pagantes/convertidos e
--      soma R$ 249,00 no MRR estimado — por LIVRO, não por perfil, porque o webhook
--      propaga o plano pro parceiro e contar os dois dobraria a receita.
--   4. De carona: conserta `ultimas_vendas` (order by v.recebido_em → sub.recebido_em),
--      que fazia admin_metricas() quebrar ao executar — ver comentário no bloco.
--
-- Base do admin_metricas: 2026-09-18_admin_metricas_fix.sql (conferido contra a função
-- em produção em 2026-09-25 — mesmo corpo, inclusive o bug do item 4).

begin;

alter table public.fp_perfil
  drop constraint if exists fp_perfil_plano_check;
alter table public.fp_perfil
  add constraint fp_perfil_plano_check
  check (plano in ('none', 'essencial', 'assistente', 'casal'));

alter table public.pendencias_assinatura
  drop constraint if exists pendencias_assinatura_plano_check;
alter table public.pendencias_assinatura
  add constraint pendencias_assinatura_plano_check
  check (plano in ('essencial', 'assistente', 'casal'));

create or replace function public.admin_metricas()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  eh_admin boolean;
  resultado jsonb;
begin
  -- Porta única. SECURITY DEFINER roda como dono da função, então RLS não protege
  -- nada aqui dentro: se esta checagem sair, qualquer usuário logado lê as métricas
  -- da empresa inteira.
  select (p.role = 'super_admin') into eh_admin
    from public.profiles p where p.id = auth.uid();

  if coalesce(eh_admin, false) is not true then
    raise exception 'acesso restrito' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'gerado_em', now(),

    'cadastros', (
      select jsonb_build_object(
        'total', count(*),
        'hoje', count(*) filter (where u.created_at >= date_trunc('day', now())),
        'sete_dias', count(*) filter (where u.created_at >= now() - interval '7 days'),
        'trinta_dias', count(*) filter (where u.created_at >= now() - interval '30 days')
      ) from auth.users u
    ),

    -- "Ativo" = registrou lançamento na janela. Abrir o app não deixa rastro, e é de
    -- propósito. A janela usa `data_lancamento`, que é a data DO GASTO.
    'ativos', (
      select jsonb_build_object(
        'sete_dias', count(distinct l.user_id) filter (where l.data_lancamento >= (current_date - 7)),
        'trinta_dias', count(distinct l.user_id) filter (where l.data_lancamento >= (current_date - 30))
      ) from public."Lancamentos" l
    ),

    -- MRR ESTIMADO: contagem × preço de tabela. Não desconta taxa, não conhece cupom
    -- e não sabe de assinatura em atraso. Tendência, não caixa.
    'planos', (
      select jsonb_build_object(
        'free', count(*) filter (where coalesce(f.plano, 'none') = 'none'),
        'essencial', count(*) filter (where f.plano = 'essencial'),
        'assistente', count(*) filter (where f.plano = 'assistente'),
        'casal', count(*) filter (where f.plano = 'casal'),
        -- Pagantes conta PERFIS: um Casal propagado pro parceiro aparece duas vezes
        -- aqui, mas é uma assinatura só. O MRR abaixo corrige isso contando o Casal
        -- por livro, não por perfil.
        'pagantes', count(*) filter (where f.plano in ('essencial', 'assistente', 'casal')),
        'mrr_estimado', round(
          count(*) filter (where f.plano = 'essencial') * 29.90 +
          count(*) filter (where f.plano = 'assistente') * 79.90 +
          (select count(distinct coalesce(m.livro_id::text, fc.user_id::text))
             from public.fp_perfil fc
             left join public.livro_membros m on m.user_id = fc.user_id and m.ativo
            where fc.plano = 'casal') * 249.00, 2)
      ) from public.fp_perfil f
    ),

    'trial', (
      select jsonb_build_object(
        'ativos', count(*) filter (where f.trial_ate is not null and f.trial_ate > now()
                                     and coalesce(f.plano, 'none') = 'none'),
        'expirados_sem_converter', count(*) filter (where f.trial_ate is not null and f.trial_ate <= now()
                                     and coalesce(f.plano, 'none') = 'none'),
        'converteram', count(*) filter (where f.trial_inicio is not null
                                     and f.plano in ('essencial', 'assistente', 'casal'))
      ) from public.fp_perfil f
    ),

    -- Sem telefone no perfil o agente não reconhece a pessoa. É o gargalo silencioso
    -- de quem paga o Essencial e "acha que não funciona".
    'whatsapp', (
      select jsonb_build_object(
        'com_telefone', count(*) filter (where coalesce(f.telefone, '') <> ''),
        'pagantes_sem_telefone', count(*) filter (where coalesce(f.telefone, '') = ''
                                     and f.plano in ('essencial', 'assistente', 'casal'))
      ) from public.fp_perfil f
    ),

    -- Só as PENDENTES. Alerta que não apaga depois de resolvido vira
    -- alerta que se aprende a ignorar.
    'pendencias', (
      select count(*) from public.pendencias_assinatura where resolvido = false
    ),

    'lancamentos', (
      select jsonb_build_object(
        'total', count(*),
        'trinta_dias', count(*) filter (where l.data_lancamento >= (current_date - 30))
      ) from public."Lancamentos" l
    ),

    -- A coluna é `recebido_em` (ver 2026-09-05_cakto_webhook.sql:31). Traz e-mail de
    -- propósito: é o que permite socorrer alguém na mão quando o pagamento não virou
    -- acesso.
    --
    -- CORREÇÃO (2026-09-25): era `order by v.recebido_em`. `v` é a COLUNA jsonb da
    -- subquery, não um alias de tabela — o Postgres responde "missing FROM-clause
    -- entry for table v" e a função inteira quebra ao executar (o mesmo texto estava
    -- em produção). O alias da subquery é `sub`.
    'ultimas_vendas', (
      select coalesce(jsonb_agg(v order by sub.recebido_em desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'email', e.email, 'plano', e.plano, 'resultado', e.resultado, 'quando', e.recebido_em
        ) as v, e.recebido_em
        from public.cakto_eventos e
        where e.resultado in ('aplicado', 'sem_conta')
        order by e.recebido_em desc
        limit 10
      ) sub
    )
  ) into resultado;

  return resultado;
end;
$$;

revoke all on function public.admin_metricas() from public, anon;
grant execute on function public.admin_metricas() to authenticated;

commit;

-- ============================================================================
-- Conferir depois de rodar
-- ============================================================================
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conname in ('fp_perfil_plano_check', 'pendencias_assinatura_plano_check');
--   -- as mesmas contagens do painel, soltas (a função exige super_admin):
--   select plano, count(*) from public.fp_perfil group by plano;
