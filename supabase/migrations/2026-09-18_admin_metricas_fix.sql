-- 2026-09-18 — Conserta a admin_metricas: nome de coluna errado e pendência resolvida
--
-- A função de 17/09 foi criada com sucesso e QUEBRAVA AO EXECUTAR. plpgsql não valida
-- o corpo na criação — só no primeiro `select admin_metricas()`. Como a conferência
-- que eu mesmo escrevi no fim daquele arquivo (`select public.admin_metricas();`) não
-- chegou a ser rodada, o erro só apareceu quando o painel abriu em produção.
--
-- DOIS ERROS, os dois por eu ter inventado o schema em vez de ler a migration que
-- criou as tabelas (2026-09-05_cakto_webhook.sql):
--
--   1. `cakto_eventos.criado_em` NÃO EXISTE — a coluna chama `recebido_em`. Isso
--      derruba a função inteira, porque o jsonb_build_object é um `select ... into`
--      só: falhou uma parte, falhou tudo.
--
--   2. `pendencias_assinatura` tem `resolvido boolean` e eu contava TODAS as linhas.
--      O alerta de "pagou e não liberou" nunca voltaria a zero depois que o Lucas
--      resolvesse a pendência na mão — um alerta que não apaga é um alerta que se
--      aprende a ignorar, e aí ele para de servir pra qualquer coisa.
--
-- Lição que fica: coluna de tabela que nasceu sem migration versionada (ou que
-- nasceu em OUTRA migration) se confere lendo o arquivo, não pela memória.

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
        'pagantes', count(*) filter (where f.plano in ('essencial', 'assistente')),
        'mrr_estimado', round(
          count(*) filter (where f.plano = 'essencial') * 29.90 +
          count(*) filter (where f.plano = 'assistente') * 79.90, 2)
      ) from public.fp_perfil f
    ),

    'trial', (
      select jsonb_build_object(
        'ativos', count(*) filter (where f.trial_ate is not null and f.trial_ate > now()
                                     and coalesce(f.plano, 'none') = 'none'),
        'expirados_sem_converter', count(*) filter (where f.trial_ate is not null and f.trial_ate <= now()
                                     and coalesce(f.plano, 'none') = 'none'),
        'converteram', count(*) filter (where f.trial_inicio is not null
                                     and f.plano in ('essencial', 'assistente'))
      ) from public.fp_perfil f
    ),

    -- Sem telefone no perfil o agente não reconhece a pessoa. É o gargalo silencioso
    -- de quem paga o Essencial e "acha que não funciona".
    'whatsapp', (
      select jsonb_build_object(
        'com_telefone', count(*) filter (where coalesce(f.telefone, '') <> ''),
        'pagantes_sem_telefone', count(*) filter (where coalesce(f.telefone, '') = ''
                                     and f.plano in ('essencial', 'assistente'))
      ) from public.fp_perfil f
    ),

    -- CORREÇÃO 2: só as PENDENTES. Alerta que não apaga depois de resolvido vira
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

    -- CORREÇÃO 1: a coluna é `recebido_em` (ver 2026-09-05_cakto_webhook.sql:31),
    -- não `criado_em`. Traz e-mail de propósito: é o que permite socorrer alguém na
    -- mão quando o pagamento não virou acesso.
    'ultimas_vendas', (
      select coalesce(jsonb_agg(v order by v.recebido_em desc), '[]'::jsonb) from (
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

-- ============================================================================
-- Conferir depois de rodar — AGORA DÁ PRA TESTAR DE VERDADE
-- ============================================================================
-- A função exige auth.uid() = super_admin, e no SQL Editor a sessão não tem
-- auth.uid() — então `select admin_metricas()` ali devolve 'acesso restrito' mesmo
-- estando certa. Por isso a conferência abaixo roda as MESMAS consultas soltas: se
-- elas passarem, a função passa.
--
--   -- 1. as colunas existem? (era exatamente isto que estava errado)
--   select count(*) from public.cakto_eventos where recebido_em is not null;
--   select count(*) from public.pendencias_assinatura where resolvido = false;
--
--   -- 2. as últimas vendas, que é o que o painel mostra:
--   select recebido_em, event, resultado, plano, email
--     from public.cakto_eventos
--    where resultado in ('aplicado','sem_conta')
--    order by recebido_em desc limit 10;
--
--   -- 3. a função existe e está protegida (não deve listar anon nem PUBLIC):
--   select grantee from information_schema.routine_privileges
--    where routine_name = 'admin_metricas';
