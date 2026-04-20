-- DIAGNOSTICO E CORRECAO DO ERRO:
-- record "new" has no field "updated_at"
--
-- Objetivo:
-- descobrir qual trigger/funcao esta tentando acessar NEW.updated_at
-- nas tabelas fp_rendas e fp_despesas, e corrigir de forma segura.

-- =========================================================
-- 1. INSPECAO DAS COLUNAS
-- =========================================================
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('fp_rendas', 'fp_despesas')
order by table_name, ordinal_position;

-- =========================================================
-- 2. INSPECAO DAS TRIGGERS NAS TABELAS
-- =========================================================
select
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation,
  action_statement
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('fp_rendas', 'fp_despesas')
order by event_object_table, trigger_name;

-- =========================================================
-- 3. INSPECAO DAS FUNCOES RELACIONADAS A TRIGGERS
-- =========================================================
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_def
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and (
    pg_get_functiondef(p.oid) ilike '%updated_at%'
    or pg_get_functiondef(p.oid) ilike '%fp_rendas%'
    or pg_get_functiondef(p.oid) ilike '%fp_despesas%'
  )
order by p.proname;

-- =========================================================
-- 4. CORRECAO POSSIVEL A
-- Se existir trigger generica de updated_at e a tabela deve ter essa coluna
-- =========================================================
alter table public.fp_rendas
add column if not exists updated_at timestamptz default now();

alter table public.fp_despesas
add column if not exists updated_at timestamptz default now();

update public.fp_rendas
set updated_at = now()
where updated_at is null;

update public.fp_despesas
set updated_at = now()
where updated_at is null;

-- =========================================================
-- 5. CORRECAO POSSIVEL B
-- Se a trigger estiver errada e NAO quisermos updated_at nessas tabelas
-- usar somente depois de identificar o nome real da trigger
-- Exemplos:
-- drop trigger if exists set_updated_at_on_fp_rendas on public.fp_rendas;
-- drop trigger if exists set_updated_at_on_fp_despesas on public.fp_despesas;
-- =========================================================

-- =========================================================
-- 6. CORRECAO POSSIVEL C
-- Se existir uma funcao generica tipo handle_updated_at() ou set_updated_at()
-- ela deve ser algo assim:
-- =========================================================
--
-- create or replace function public.set_updated_at()
-- returns trigger
-- language plpgsql
-- as $$
-- begin
--   if row_to_json(new)::jsonb ? 'updated_at' then
--     new.updated_at = now();
--   end if;
--   return new;
-- end;
-- $$;
--
-- Observacao:
-- esse modelo evita quebrar tabelas que nao possuem updated_at.

-- =========================================================
-- 7. VALIDACAO FINAL
-- Rodar depois da correcao
-- =========================================================
select trigger_name, event_object_table
from information_schema.triggers
where trigger_schema = 'public'
  and event_object_table in ('fp_rendas', 'fp_despesas')
order by event_object_table, trigger_name;
