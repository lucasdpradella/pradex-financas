-- 2026-09-14 — Conserta a tabela `orcamentos`: faltavam colunas
--
-- O SINTOMA. "Teto de gasto ainda tá sumindo." O app salvava e nada ficava.
-- Testado contra a API com a sessão real:
--
--   POST /rest/v1/orcamentos
--   → 400 PGRST204: Could not find the 'limite' column of 'orcamentos'
--
-- Varrendo coluna a coluna, a tabela em produção tinha só:
--   id, user_id, categoria, mes, created_at
-- Faltavam `limite` e `updated_at` — e `limite` é justamente o valor do teto.
--
-- A CAUSA, e é um erro meu. A migration 2026-09-12_orcamentos.sql abre com
-- `create table if not exists`. Já existia uma tabela `orcamentos` com formato
-- diferente (de alguma tentativa anterior), então o comando virou NO-OP: não criou
-- nada, não reclamou de nada, e a migration inteira reportou sucesso. As colunas
-- novas nunca entraram.
--
-- ⚠️ LIÇÃO: `create table if not exists` não garante o FORMATO, só a existência.
-- Num banco que já viu tentativa anterior, ele é um silêncio perigoso. Migration
-- que precisa garantir colunas deve usar `alter table ... add column if not exists`
-- depois do create — que é exatamente o que este arquivo faz.

-- ============================================================================
-- 1. As colunas que faltavam
-- ============================================================================
alter table public.orcamentos
  add column if not exists limite numeric(12,2);

alter table public.orcamentos
  add column if not exists updated_at timestamptz not null default now();

-- O check e o not null entram DEPOIS do add, e só se ainda não existirem — a coluna
-- pode ter sido criada sem eles acima.
do $$
begin
  -- Linha órfã sem limite quebraria o not null. Não deve haver nenhuma (o app nunca
  -- conseguiu inserir), mas a guarda é barata.
  delete from public.orcamentos where limite is null;

  begin
    alter table public.orcamentos alter column limite set not null;
  exception when others then
    raise notice 'limite ja era not null ou nao pode ser alterada: %', sqlerrm;
  end;

  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.orcamentos'::regclass and conname = 'orcamentos_limite_positivo'
  ) then
    alter table public.orcamentos
      add constraint orcamentos_limite_positivo check (limite > 0);
  end if;
end $$;

-- ============================================================================
-- 2. Reaplica o que dependia das colunas
-- ============================================================================
-- O índice único e o trigger podem não ter sido criados na migration original se ela
-- abortou, ou podem estar lá. Os dois comandos são idempotentes.

create index if not exists orcamentos_user_mes_idx
  on public.orcamentos (user_id, mes);

create unique index if not exists orcamentos_user_mes_categoria_idx
  on public.orcamentos (user_id, mes, lower(categoria));

create or replace function public.orcamentos_normaliza()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.mes := date_trunc('month', new.mes)::date;
  new.categoria := btrim(new.categoria);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_orcamentos_normaliza on public.orcamentos;
create trigger trg_orcamentos_normaliza
  before insert or update on public.orcamentos
  for each row execute function public.orcamentos_normaliza();

-- ============================================================================
-- 3. RLS — reaplica pelo mesmo motivo
-- ============================================================================
alter table public.orcamentos enable row level security;

drop policy if exists "orcamentos_select_own" on public.orcamentos;
create policy "orcamentos_select_own" on public.orcamentos
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "orcamentos_insert_own" on public.orcamentos;
create policy "orcamentos_insert_own" on public.orcamentos
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "orcamentos_update_own" on public.orcamentos;
create policy "orcamentos_update_own" on public.orcamentos
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "orcamentos_delete_own" on public.orcamentos;
create policy "orcamentos_delete_own" on public.orcamentos
  for delete to authenticated using (user_id = auth.uid());

-- ============================================================================
-- 4. PostgREST precisa reler o schema
-- ============================================================================
-- Sem isto o erro PGRST204 pode continuar mesmo com a coluna já criada: o PostgREST
-- serve a partir de um cache de schema.
notify pgrst, 'reload schema';

-- ============================================================================
-- Conferir
-- ============================================================================
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'orcamentos'
--    order by ordinal_position;
--
-- Tem que listar: id, user_id, categoria, limite, mes, created_at, updated_at
