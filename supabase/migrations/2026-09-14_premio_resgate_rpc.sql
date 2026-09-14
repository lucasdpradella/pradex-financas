-- 2026-09-14 — Prêmio por disciplina vira 14 dias de trial, concedidos por RPC
--
-- MUDA A REGRA. O desenho de 12/09 era "20% no primeiro mês + 14 dias de trial".
-- O desconto caiu: o formulário de cupom da Cakto não sabe restringir à PRIMEIRA
-- cobrança nem limitar usos, então um cupom de 20% lá seria 20% pra sempre, pra
-- qualquer um que descobrisse o código. O prêmio passa a ser só o trial — que a
-- gente concede no próprio banco e que expira sozinho. Ver src/lib/premio.js.
--
-- E CONSERTA UM BURACO QUE EXISTIA DESDE 12/09. O resgate no front eram dois passos
-- independentes: PATCH em premio_disciplina_em, depois a RPC fp_iniciar_trial().
-- Dois problemas reais nisso:
--
--   1. fp_iniciar_trial() é idempotente de propósito — se trial_inicio já existe,
--      ela DEVOLVE o trial antigo e não renova nada. Mas o caminho normal do app
--      empurra o trial pro usuário Free logo no card do WhatsApp, e bater 80 de
--      disciplina exige 15 dias distintos com lançamento. Ou seja: na prática
--      quase todo mundo chega no prêmio com o trial já gasto, e ganhava NADA —
--      a data de resgate era gravada, o prêmio queimava, e a pessoa não via
--      diferença nenhuma. Prêmio que não entrega é pior que prêmio nenhum.
--
--   2. Sem atomicidade: o PATCH podia gravar e a RPC falhar logo depois (rede,
--      401, o que for). O prêmio é uma vez na vida — perder ele pra um erro de
--      rede é perda que não dá pra desfazer sem suporte manual.
--
-- A RPC abaixo faz as duas coisas numa transação só, e ESTENDE o trial mesmo que
-- ele já tenha sido usado antes. Ela é o único caminho de resgate.

-- ============================================================================
-- 1. A RPC de resgate
-- ============================================================================
-- SECURITY DEFINER: por dentro, current_user é o dono, então o trigger de guarda
-- de fp_perfil não barra a escrita em trial_ate / premio_disciplina_em.
--
-- Trava de uma vez na vida: `premio_disciplina_em is null`. Diferente de
-- fp_iniciar_trial, aqui não importa se o trial já foi usado — o que não pode
-- repetir é o PRÊMIO.
create or replace function public.fp_resgatar_premio()
returns table (trial_inicio timestamptz, trial_ate timestamptz, premio_em timestamptz, ja_usado boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
-- Os nomes do `returns table` (trial_inicio, trial_ate) viram variáveis OUT e
-- colidem com as colunas homônimas de fp_perfil. Toda referência abaixo está
-- qualificada, mas esta diretiva torna o desempate explícito em vez de depender
-- disso — sem ela, um `trial_ate` solto que escape numa edição futura estoura em
-- "column reference is ambiguous", e só em produção.
#variable_conflict use_column
declare
  v_user_id uuid := auth.uid();
  v_premio  timestamptz;
  v_inicio  timestamptz;
  v_ate     timestamptz;
  v_agora   timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'sem usuário autenticado';
  end if;

  select p.premio_disciplina_em, p.trial_inicio, p.trial_ate
    into v_premio, v_inicio, v_ate
    from public.fp_perfil p
   where p.user_id = v_user_id
     for update;   -- segura a linha: dois cliques rápidos não resgatam duas vezes

  if not found then
    raise exception 'perfil não encontrado';
  end if;

  -- Já resgatou: devolve o estado atual sem tocar em nada. O front usa isto pra
  -- não abrir festa à toa.
  if v_premio is not null then
    return query select v_inicio, v_ate, v_premio, true;
    return;
  end if;

  update public.fp_perfil
     set premio_disciplina_em = v_agora,
         -- Se nunca teve trial, começa agora. Se teve, mantém a data original —
         -- ela é o registro de que o teste de boas-vindas já foi usado.
         trial_inicio = coalesce(fp_perfil.trial_inicio, v_agora),
         -- 14 dias A PARTIR DE AGORA para quem já expirou; 14 dias EMPILHADOS em
         -- cima do que resta para quem ainda está dentro. greatest() resolve os
         -- dois casos: quem tem trial vencido não é punido por ter testado cedo,
         -- e quem está em dia não perde os dias que sobravam.
         trial_ate = greatest(coalesce(fp_perfil.trial_ate, v_agora), v_agora) + interval '14 days'
   where fp_perfil.user_id = v_user_id
   returning fp_perfil.trial_inicio, fp_perfil.trial_ate, fp_perfil.premio_disciplina_em
        into v_inicio, v_ate, v_premio;

  return query select v_inicio, v_ate, v_premio, false;
end;
$$;

revoke all on function public.fp_resgatar_premio() from public, anon;
grant execute on function public.fp_resgatar_premio() to authenticated, service_role;

-- ============================================================================
-- 2. Fecha a escrita direta de premio_disciplina_em
-- ============================================================================
-- Até agora o trigger deixava o usuário gravar `premio_disciplina_em` UMA vez por
-- PATCH — era assim que o resgate funcionava. Com a RPC acima, esse caminho não é
-- mais necessário, e deixá-lo aberto permite que uma conta queime o próprio prêmio
-- (de propósito ou por bug do front) sem ganhar o trial junto.
--
-- A regra passa a ser a mesma de plano e trial: em UPDATE, o valor do usuário é
-- ignorado e o antigo é restaurado, sempre. Só SECURITY DEFINER escreve.
create or replace function public.fp_perfil_sync_plano()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.plano := 'none';
      new.plano_ate := null;
      new.trial_inicio := null;
      new.trial_ate := null;
      new.premio_disciplina_em := null;
    else
      new.plano := old.plano;
      new.plano_ate := old.plano_ate;
      new.trial_inicio := old.trial_inicio;
      new.trial_ate := old.trial_ate;
      -- Antes: só travava depois do primeiro resgate. Agora trava sempre — quem
      -- concede o prêmio é fp_resgatar_premio().
      new.premio_disciplina_em := old.premio_disciplina_em;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fp_perfil_sync_plano on public.fp_perfil;
create trigger trg_fp_perfil_sync_plano
  before insert or update on public.fp_perfil
  for each row execute function public.fp_perfil_sync_plano();

comment on column public.fp_perfil.premio_disciplina_em is
  'Quando o usuário resgatou o prêmio por disciplina (14 dias de Essencial). Gravado UMA vez, só por fp_resgatar_premio(). Não-nulo = nunca mais elegível.';

-- ============================================================================
-- 3. PostgREST relê o schema
-- ============================================================================
notify pgrst, 'reload schema';

-- ============================================================================
-- Conferir
-- ============================================================================
--   -- a RPC existe e está exposta:
--   select proname, prosecdef from pg_proc where proname = 'fp_resgatar_premio';
--
--   -- quem já resgatou, e até quando o prêmio vale:
--   select user_id, nome, plano, premio_disciplina_em, trial_ate
--     from public.fp_perfil where premio_disciplina_em is not null
--    order by premio_disciplina_em desc;
--
--   -- devolver o prêmio pra alguém (suporte; roda como postgres, o trigger não barra):
--   update public.fp_perfil set premio_disciplina_em = null where telefone = '55...';
