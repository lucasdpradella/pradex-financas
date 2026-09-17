-- 2026-09-17 — Painel do dono: uma RPC agregada, só pro super_admin
--
-- Pedido do Lucas: "meu dash da empresa pra ver cadastros, usuários ativos, planos
-- pagantes etc". Nasceu no dia seguinte à primeira venda do produto (o Augusto, no
-- Essencial) ter chegado em silêncio.
--
-- ⚠️ POR QUE ISTO É UMA RPC, E NÃO UM SELECT DA TELA.
--
-- Todo o app é fechado por RLS `user_id = auth.uid()`: ninguém lê a vida de ninguém.
-- Um painel de métricas é justamente a exceção — precisa contar TODO MUNDO. As duas
-- saídas erradas seriam afrouxar as policies (que protegem dado financeiro de
-- terceiro) ou mandar a service_role pro front (que é a chave do banco inteiro numa
-- página pública).
--
-- A saída certa é esta: uma função SECURITY DEFINER que roda com privilégio, mas
-- devolve APENAS NÚMEROS AGREGADOS. Ela nunca retorna lançamento, nome, telefone ou
-- saldo de ninguém — nem pro Lucas. O que ele vê é "3 pagantes", não quem são.
--
-- A única exceção é a lista de vendas recentes, que traz e-mail: é a informação
-- operacional que ele precisa pra socorrer quem pagou e não recebeu acesso, e sai
-- de `cakto_eventos`, que já é registro comercial dele.

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
  -- da empresa inteira. Ela é a segurança deste arquivo.
  select (p.role = 'super_admin') into eh_admin
    from public.profiles p where p.id = auth.uid();

  if coalesce(eh_admin, false) is not true then
    raise exception 'acesso restrito' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'gerado_em', now(),

    -- ===== CADASTROS =====
    -- auth.users e não fp_perfil: quem criou conta e parou antes de completar o
    -- perfil continua sendo um cadastro, e some da conta se olharmos só o perfil.
    'cadastros', (
      select jsonb_build_object(
        'total', count(*),
        'hoje', count(*) filter (where u.created_at >= date_trunc('day', now())),
        'sete_dias', count(*) filter (where u.created_at >= now() - interval '7 days'),
        'trinta_dias', count(*) filter (where u.created_at >= now() - interval '30 days')
      ) from auth.users u
    ),

    -- ===== ATIVOS =====
    -- "Ativo" = registrou lançamento na janela. É o único sinal honesto de uso que o
    -- banco tem: abrir o app não deixa rastro, e é de propósito (nunca houve
    -- telemetria de navegação aqui).
    --
    -- ⚠️ A janela usa `data_lancamento`, que é a data DO GASTO e não a do registro.
    -- Quem lança hoje uma despesa do mês passado conta no mês passado. É aproximação
    -- conhecida: a coluna de criação não é garantida nesta tabela, que nasceu sem
    -- migration versionada.
    'ativos', (
      select jsonb_build_object(
        'sete_dias', count(distinct l.user_id) filter (where l.data_lancamento >= (current_date - 7)),
        'trinta_dias', count(distinct l.user_id) filter (where l.data_lancamento >= (current_date - 30))
      ) from public."Lancamentos" l
    ),

    -- ===== PLANOS E RECEITA =====
    -- O MRR é ESTIMADO a partir da contagem × preço de tabela. Não é o que a Cakto
    -- liquidou: não desconta taxa, não conhece cupom e não sabe de assinatura em
    -- atraso. Serve pra acompanhar tendência, não pra fechar caixa — por isso o campo
    -- se chama `mrr_estimado` e a tela precisa dizer isso.
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

    -- ===== TRIAL DO WHATSAPP =====
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

    -- ===== ALCANCE DO AGENTE =====
    -- Sem telefone no perfil o agente não reconhece a pessoa. É o gargalo silencioso
    -- de quem paga o Essencial e "acha que não funciona".
    'whatsapp', (
      select jsonb_build_object(
        'com_telefone', count(*) filter (where coalesce(f.telefone, '') <> ''),
        'pagantes_sem_telefone', count(*) filter (where coalesce(f.telefone, '') = ''
                                     and f.plano in ('essencial', 'assistente'))
      ) from public.fp_perfil f
    ),

    -- ===== O QUE PRECISA DE AÇÃO =====
    -- Pagou e não liberou. Desde 17/09 isto também dispara WhatsApp pro Lucas na
    -- hora (ver cakto-webhook), mas o contador fica: aviso se perde, fila não.
    'pendencias', (
      select count(*) from public.pendencias_assinatura
    ),

    -- ===== USO GERAL =====
    'lancamentos', (
      select jsonb_build_object(
        'total', count(*),
        'trinta_dias', count(*) filter (where l.data_lancamento >= (current_date - 30))
      ) from public."Lancamentos" l
    ),

    -- ===== ÚLTIMAS VENDAS =====
    -- Traz e-mail de propósito: é o que permite socorrer alguém na mão. Limitado a 10
    -- — isto é um painel, não um extrato.
    'ultimas_vendas', (
      select coalesce(jsonb_agg(v order by v.criado_em desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'email', e.email, 'plano', e.plano, 'resultado', e.resultado, 'quando', e.criado_em
        ) as v, e.criado_em
        from public.cakto_eventos e
        where e.resultado in ('aplicado', 'sem_conta')
        order by e.criado_em desc
        limit 10
      ) sub
    )
  ) into resultado;

  return resultado;
end;
$$;

-- `authenticated` e NÃO `anon`: a função checa o role por auth.uid(), e sem sessão
-- auth.uid() é null — mas deixar anon executar seria confiar só na checagem interna.
-- Duas portas é melhor que uma.
revoke all on function public.admin_metricas() from public, anon;
grant execute on function public.admin_metricas() to authenticated;

-- ============================================================================
-- Conferir depois de rodar
-- ============================================================================
--   -- como o Lucas (super_admin), deve devolver o JSON:
--   select public.admin_metricas();
--
--   -- como qualquer outro usuário, deve estourar 'acesso restrito':
--   -- (testar pelo app com outra conta, ou com set role)
--
--   -- quem pode executar (não deve listar anon nem PUBLIC):
--   select grantee from information_schema.routine_privileges
--    where routine_name = 'admin_metricas';
