-- 2026-09-19 (c) — MODO CAOS: o tom do agente, por pessoa
--
-- Copy e regras: briefs/2026-09-12_modo-caos-copy.md (neste repo)
--
-- A copy existe desde 12/09 e nunca rodou: faltavam os gatilhos (dois dependiam de
-- teto, que chegou em 12/09, e dois de metas, que chegaram em 16/09) e faltava onde
-- guardar o tom. Esta migration é a segunda metade.
--
-- TRÊS COLUNAS E NENHUMA MÁQUINA DE ESTADO. A tentação era um campo `modo` com
-- cinco valores e regras de transição; o problema é que silêncio e elogio são
-- TEMPORÁRIOS (24h) e o tom é PERMANENTE, então um campo só precisaria guardar
-- "estou em elogio mas era caos antes" — que é estado dentro de estado.
--
--   agente_tom          seco | caos      (permanente, muda quando a pessoa pede)
--   agente_silencio_ate quando o "cala" expira
--   agente_elogio_ate   quando o "me elogia" expira
--
-- Expirado é o mesmo que nunca ter existido: nada precisa limpar as datas, e uma
-- data no passado simplesmente deixa de valer. Sem cron, sem varredura.

alter table public.fp_perfil
  add column if not exists agente_tom text not null default 'seco';

alter table public.fp_perfil drop constraint if exists fp_perfil_agente_tom_valido;
alter table public.fp_perfil
  add constraint fp_perfil_agente_tom_valido
  check (agente_tom in ('seco', 'caos'));

alter table public.fp_perfil
  add column if not exists agente_silencio_ate timestamptz;

alter table public.fp_perfil
  add column if not exists agente_elogio_ate timestamptz;

comment on column public.fp_perfil.agente_tom is
  'Tom base do agente no WhatsApp: seco (padrão) ou caos. Elogio e silêncio são temporários e moram nas colunas _ate.';

-- ⚠️ SEM GUARDA CONTRA O PRÓPRIO USUÁRIO, ao contrário de `plano` e
-- `premio_disciplina_em`. É de propósito: estas três colunas são preferência de
-- COMO ele quer ser tratado, não direito de acesso. Se alguém editar o próprio tom
-- por PATCH, conseguiu exatamente o que conseguiria mandando "caos" no WhatsApp —
-- não há nada pra proteger.

-- ============================================================================
-- Conferir depois de rodar
-- ============================================================================
--   select column_name, column_default from information_schema.columns
--    where table_schema='public' and table_name='fp_perfil'
--      and column_name like 'agente_%';
--   select agente_tom, count(*) from public.fp_perfil group by 1;
