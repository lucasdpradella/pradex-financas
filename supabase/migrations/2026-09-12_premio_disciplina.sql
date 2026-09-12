-- 2026-09-12 — Prêmio por disciplina (uma vez na vida)
--
-- Regra: bateu 80 de disciplina, com piso de dias distintos com lançamento, ganha
-- 20% no PRIMEIRO mês + 14 dias de trial. Uma vez por usuário, na vida.
-- Lógica em src/lib/premio.js. Spec: Chave Mestre, Projetos/PRADEX/orcamento-e-disciplina.md
--
-- ⚠️ Depende de 2026-09-11_drop_acesso_pago.sql: a função recriada abaixo NÃO
-- sincroniza `acesso_pago`. Se aquela migration ainda não tiver rodado, a coluna
-- simplesmente para de ser atualizada — ninguém a lê desde 05/09, então é inócuo.

alter table public.fp_perfil
  add column if not exists premio_disciplina_em timestamptz;

comment on column public.fp_perfil.premio_disciplina_em is
  'Quando o usuário resgatou o prêmio por disciplina. Preenchido UMA vez; não-nulo significa que ele nunca mais é elegível, mesmo que volte pro Free.';

-- ============================================================================
-- Guarda: o usuário não se auto-premia
-- ============================================================================
-- Mesmo motivo de plano e trial: o front escreve em fp_perfil com o token do próprio
-- usuário, então sem guarda qualquer conta faria PATCH zerando `premio_disciplina_em`
-- e resgataria o prêmio de novo, quantas vezes quisesse.
--
-- A regra aqui é assimétrica de propósito: em UPDATE, o valor antigo só é restaurado
-- quando já existe. Se for null, deixa passar — é assim que o resgate legítimo grava
-- a primeira vez sem precisar de service_role. Uma vez gravado, vira imutável.
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
      -- Só trava depois do primeiro resgate. Null continua gravável uma vez.
      if old.premio_disciplina_em is not null then
        new.premio_disciplina_em := old.premio_disciplina_em;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_fp_perfil_sync_plano on public.fp_perfil;
create trigger trg_fp_perfil_sync_plano
  before insert or update on public.fp_perfil
  for each row execute function public.fp_perfil_sync_plano();

-- ============================================================================
-- Conferir
-- ============================================================================
--   -- quem já resgatou:
--   select user_id, nome, plano, premio_disciplina_em
--     from public.fp_perfil where premio_disciplina_em is not null
--    order by premio_disciplina_em desc;
--
--   -- devolver o prêmio pra alguém (suporte; roda como postgres, o trigger não barra):
--   update public.fp_perfil set premio_disciplina_em = null where telefone = '55...';
