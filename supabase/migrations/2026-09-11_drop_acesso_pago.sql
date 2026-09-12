-- 2026-09-11 — Aposenta `fp_perfil.acesso_pago`
--
-- Item 9 do backlog de 07/09 ("limpar acesso_pago").
--
-- HISTÓRIA. A coluna nasceu em 2026-08-15 como o gate único dos dois recursos pagos
-- (agente WhatsApp + Diagnóstico FP), quando a esteira era Pradex 1:1 / Pradex 360 e a
-- liberação era UPDATE na mão. Em 2026-09-05 a Fase 0 do SaaS trouxe `plano`
-- ('none' | 'essencial' | 'assistente'), e desde então `acesso_pago` virou um espelho:
-- o trigger a mantinha como `plano = 'assistente'` e nada mais lia dela.
--
-- Em 2026-09-11 o PRADELLA aposentou a esteira 1:1/360 de vez — o que resta é
-- Free / Essencial / Assistente. A coluna perdeu o último motivo de existir.
--
-- SEM PERDA DE DADO. `acesso_pago` era 100% derivada de `plano`. Quem quiser o valor
-- antigo de volta calcula: `plano = 'assistente'`. Nenhuma policy, índice ou view
-- depende dela (conferido), e o front já não a menciona em lugar nenhum — só estas
-- migrations citavam.
--
-- ORDEM IMPORTA: a atribuição sai do trigger ANTES do drop, senão o próximo
-- insert/update estoura "column acesso_pago does not exist".

-- ============================================================================
-- 1. Trigger sem a sincronização
-- ============================================================================
-- Mesma função de 2026-09-07 (guarda de plano + trial), menos a linha do espelho.
create or replace function public.fp_perfil_sync_plano()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('anon', 'authenticated') then
    -- Reverte em silêncio em vez de dar erro: o app nunca manda essas colunas, então
    -- levantar exceção só quebraria o cadastro se algum payload mudar sem querer.
    if tg_op = 'INSERT' then
      new.plano := 'none';
      new.plano_ate := null;
      new.trial_inicio := null;
      new.trial_ate := null;
    else
      new.plano := old.plano;
      new.plano_ate := old.plano_ate;
      new.trial_inicio := old.trial_inicio;
      new.trial_ate := old.trial_ate;
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 2. A coluna
-- ============================================================================
alter table public.fp_perfil
  drop column if exists acesso_pago;

-- ============================================================================
-- Conferir depois de rodar
-- ============================================================================
-- Não deve voltar nenhuma linha:
--
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'fp_perfil'
--      and column_name = 'acesso_pago';
--
-- E o gate segue de pé por `plano`:
--
--   select user_id, nome, telefone, plano, plano_ate, trial_ate
--     from public.fp_perfil where plano <> 'none' or trial_ate is not null
--    order by plano_ate nulls last;
