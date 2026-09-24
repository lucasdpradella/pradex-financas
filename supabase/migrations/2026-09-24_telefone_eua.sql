-- 2026-09-24 — fp_perfil.telefone aceita WhatsApp dos EUA (+1)
--
-- O agente grava o número normalizado nesta coluna no fim do onboarding, e o
-- lookup seguinte compara a string exata. Celular BR continua 55 + DDD + 9 + 8.
-- NANP é 1 + 10 dígitos. Um check antigo que só deixava passar 55… (se tiver
-- sido criado direto no banco — o app já trata o 23514 como "formato inválido")
-- rejeita o vínculo e a pessoa recebe "problema técnico vinculando sua conta".
--
-- Só remove check que menciona a coluna e o DDI 55. Não cria outro: não dá pra
-- saber daqui quais linhas já existem fora do padrão, e um check novo quebraria
-- o próximo save delas.

do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'fp_perfil'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%telefone%'
      and pg_get_constraintdef(c.oid) like '%55%'
  loop
    execute format('alter table public.fp_perfil drop constraint %I', r.conname);
  end loop;
end $$;
