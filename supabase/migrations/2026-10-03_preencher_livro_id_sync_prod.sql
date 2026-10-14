-- ============================================================================
-- 2026-10-03 — preencher_livro_id em sincronia com prod
-- ============================================================================
-- ⚠️ NÃO APLICADA EM PRODUÇÃO. Em prod é um no-op (a definição abaixo é a que já
-- está lá); o objetivo é só o repo parar de divergir do banco.
--
-- O conserto das metas (editar + "Excluir caixinha" = arquivar) NÃO depende disto.
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
