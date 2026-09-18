-- 2026-09-18 — METAS: o aporte passa a poder NÃO abater do saldo
--
-- Brief: Chave Mestre, Projetos/PRADEX/briefs/2026-09-16_metas-caixinhas.md
--
-- O QUE MUDA (Lucas, 18/09): "melhor o cliente ir lá na caixinha e depositar, aí já
-- abate do saldo, e deixa a opção dele abater ou não do saldo."
--
-- Até aqui a regra era absoluta: guardar = aplicar = debitar da conta (16/09). Ela
-- continua sendo o PADRÃO — e é o padrão certo, porque na esmagadora maioria das
-- vezes o dinheiro sai mesmo da conta no dia em que a pessoa guarda.
--
-- Mas ela quebrava no caso de estreia, que é justamente o primeiro que todo mundo
-- vive: a pessoa cria a caixinha "Viagem — R$ 5.000" e já tem R$ 2.000 juntados de
-- antes. Registrar esses R$ 2.000 hoje fazia o mês dela nascer com R$ 2.000 de saldo
-- negativo por um dinheiro que saiu da conta meses atrás. A alternativa era mentir o
-- valor da caixinha — e aí a barra de progresso nunca mais bate com a vida.
--
--   abate_saldo = true  (padrão) -> saiu da conta agora. Entra no saldo do mês.
--   abate_saldo = false          -> já estava guardado. Só enche a caixinha.
--
-- Vale pros dois sentidos: no resgate, `false` é "tirei da caixinha mas não voltou
-- pra conta" (por exemplo, paguei a viagem direto com o dinheiro que estava aplicado).
--
-- POR QUE UMA COLUNA EM Lancamentos e não uma tabela de aportes: a decisão de 16/09
-- ("o histórico da caixinha É o histórico de lançamentos") continua valendo e é o que
-- impede duas fontes de divergirem. Um aporte que não abate ainda é um aporte — o que
-- muda é só se as agregações do mês o contam. Tabela separada traria de volta o
-- problema inteiro pra resolver um flag booleano.

alter table public."Lancamentos"
  add column if not exists abate_saldo boolean not null default true;

comment on column public."Lancamentos".abate_saldo is
  'Só faz sentido em aporte de meta (meta_id not null). false = dinheiro que já estava guardado: enche a caixinha mas não entra no saldo/gasto/receita do mês. Lançamento comum é sempre true.';

-- Lançamento comum nunca é false: `abate_saldo` responde uma pergunta que só existe
-- pra aporte. Sem esta trava, um bug de front poderia esconder um gasto de verdade do
-- relatório inteiro, e ele sumiria sem dar erro em lugar nenhum.
alter table public."Lancamentos" drop constraint if exists lancamentos_abate_saldo_so_em_aporte;
alter table public."Lancamentos"
  add constraint lancamentos_abate_saldo_so_em_aporte
  check (abate_saldo or meta_id is not null);

-- A trigger de conclusão (2026-09-16_metas.sql) NÃO muda de propósito: ela soma tudo
-- que tem meta_id, com ou sem abatimento. O troféu é sobre a caixinha ter enchido —
-- não sobre de qual bolso o dinheiro veio.

-- ============================================================================
-- Conferir depois de rodar
-- ============================================================================
--   select column_name, data_type, column_default, is_nullable
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'Lancamentos'
--      and column_name = 'abate_saldo';
--
--   select conname from pg_constraint
--    where conname = 'lancamentos_abate_saldo_so_em_aporte';
