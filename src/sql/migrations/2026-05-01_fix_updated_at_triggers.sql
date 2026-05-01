-- ============================================================
-- Migração: 2026-05-01
-- Bug: erro ao editar renda/despesa/membro (HTTP 400)
-- Causa: trigger genérica setava NEW.updated_at em tabelas
--        que não possuíam essa coluna
-- Fix: 1) adicionar updated_at em todas as tabelas FP
--      2) padronizar uma única trigger (set_updated_at_trigger)
--      3) remover triggers antigas duplicadas
-- ============================================================

-- 1. Adiciona updated_at nas tabelas FP que não têm
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name LIKE 'fp_%'
      AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = t.table_name
          AND c.column_name = 'updated_at'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()',
      r.table_name
    );
  END LOOP;
END $$;

-- 2. Função do trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- 3. Trigger padronizada em todas as tabelas FP
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT t.table_name
    FROM information_schema.tables t
    WHERE t.table_schema = 'public'
      AND t.table_name LIKE 'fp_%'
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at_trigger ON public.%I',
      r.table_name
    );
    EXECUTE format(
      'CREATE TRIGGER set_updated_at_trigger
       BEFORE UPDATE ON public.%I
       FOR EACH ROW
       EXECUTE FUNCTION public.set_updated_at()',
      r.table_name
    );
  END LOOP;
END $$;

-- 4. Limpeza: remove triggers antigas duplicadas
DROP TRIGGER IF EXISTS fp_despesas_updated_at ON public.fp_despesas;
DROP TRIGGER IF EXISTS fp_membros_updated_at ON public.fp_membros;
DROP TRIGGER IF EXISTS fp_rendas_updated_at ON public.fp_rendas;
