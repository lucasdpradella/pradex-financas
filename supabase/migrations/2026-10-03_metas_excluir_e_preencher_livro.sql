-- ============================================================================
-- 2026-10-03 — Excluir caixinha (meta) + preencher_livro_id em sincronia com prod
-- ============================================================================
-- ⚠️ NÃO APLICADA EM PRODUÇÃO. Aplicar só com decisão do Lucas.
--
-- O conserto do app (editar/arquivar/excluir na tela de Metas) NÃO depende deste
-- arquivo: a tela apaga os aportes da caixinha antes de apagar a caixinha. Isto aqui
-- é (1) registrar no repo um hotfix que já está em prod e (2) blindar o banco pra
-- qualquer outro caminho de exclusão (agente, SQL manual, versões antigas do app).
--
-- ----------------------------------------------------------------------------
-- 1. preencher_livro_id — cópia FIEL da definição que está em prod
-- ----------------------------------------------------------------------------
-- Em 2026-09-28 a função foi corrigida direto em prod e o repo ficou pra trás. A
-- versão do repo (2026-09-24_livros_casal_moeda_idioma.sql) faz
--     if tg_table_name = 'Lancamentos' and new.criado_por is null then
-- e o plpgsql avalia `new.criado_por` mesmo quando a tabela não é Lancamentos —
-- bancos, cartoes e metas não têm essa coluna, então todo INSERT nelas quebrava
-- ("record new has no field criado_por"). Em prod o acesso ao campo está aninhado
-- dentro do `if tg_table_name = 'Lancamentos'`. Definição lida de prod em
-- 2026-10-03 com pg_get_functiondef; aplicar isto em prod é um no-op.
CREATE OR REPLACE FUNCTION public.preencher_livro_id()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user uuid;
begin
  v_user := coalesce(new.user_id, auth.uid());
  if new.user_id is null and v_user is not null then
    new.user_id := v_user;
  end if;
  if tg_table_name = 'Lancamentos' then
    if new.criado_por is null then
      new.criado_por := coalesce(auth.uid(), v_user);
    end if;
  end if;
  if new.livro_id is null and v_user is not null then
    new.livro_id := public.garantir_livro(v_user);
  end if;
  return new;
end;
$function$;

-- ----------------------------------------------------------------------------
-- 2. Lancamentos.meta_id: ON DELETE SET NULL -> ON DELETE CASCADE
-- ----------------------------------------------------------------------------
-- Por que o DELETE de uma meta falhava: um aporte de "dinheiro que já estava
-- guardado" tem abate_saldo = false. O SET NULL deixaria essa linha com
-- abate_saldo = false e meta_id null, o que a constraint
--     lancamentos_abate_saldo_so_em_aporte
--     CHECK (abate_saldo OR meta_id IS NOT NULL OR categoria = 'Pagamento fatura')
-- recusa (23514) — e o DELETE da meta inteiro é desfeito. Era o caso da meta id 3
-- em prod (1 aporte com abate_saldo = false).
--
-- E mesmo quando não falhava, o SET NULL estava errado: aporte normal sem meta vira
-- "gasto" comum (entra em consumo/categoria), e no front uma linha abate_saldo=false
-- sem meta é lida como pagamento de fatura. Aporte sem caixinha não significa nada.
--
-- Por que CASCADE e não um BEFORE DELETE em metas apagando os aportes: o
-- trg_metas_conclusao (after delete em Lancamentos) faz UPDATE na própria meta; num
-- BEFORE DELETE isso dá "tuple to be deleted was already modified by an operation
-- triggered by the current command". No CASCADE a meta já saiu quando os aportes
-- são apagados, e a trigger acha alvo null e só retorna.
--
-- meta_marcos já é ON DELETE CASCADE: excluir a caixinha tira os pontos dela do
-- ranking. Quem quer manter histórico e pontos ARQUIVA (metas.arquivada = true).
alter table public."Lancamentos"
  drop constraint if exists "Lancamentos_meta_id_fkey";
alter table public."Lancamentos"
  add constraint "Lancamentos_meta_id_fkey"
  foreign key (meta_id) references public.metas(id) on delete cascade;
