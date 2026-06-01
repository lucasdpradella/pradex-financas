-- Migration: RPCs SECURITY DEFINER pra operar em compras parceladas como unidade indivisível.
-- Brief: Projetos/PRADEX/briefs/2026-05-18_parcelamento-frontend.md (decisão de produto: "compra é unidade indivisível").
-- Sem alteração de schema da Lancamentos — colunas parcela_atual/total_parcelas/parcela_grupo_id já existem.

-- ============================================================================
-- deletar_compra_parcelada(p_grupo_id uuid) -> integer (linhas removidas)
-- ============================================================================
-- Deleta TODAS as N parcelas de uma compra (mesmo parcela_grupo_id). Checa
-- user_id = auth.uid() pra impedir um user deletar grupo de outro.
CREATE OR REPLACE FUNCTION public.deletar_compra_parcelada(p_grupo_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  DELETE FROM "Lancamentos"
   WHERE parcela_grupo_id = p_grupo_id
     AND user_id = v_user_id;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.deletar_compra_parcelada(uuid) TO authenticated;

-- ============================================================================
-- editar_compra_parcelada(p_grupo_id, p_descricao, p_valor_parcela,
--                        p_n_parcelas, p_data_inicio, p_cartao_id,
--                        p_categoria, p_tipo, p_forma_pagamento)
--   -> SETOF "Lancamentos" (as N novas linhas)
-- ============================================================================
-- Re-cria a compra inteira: DELETE das N antigas + INSERT das N novas com o
-- MESMO parcela_grupo_id (rastreabilidade). Sufixo "(i/N)" gerado na RPC.
-- Datas: p_data_inicio + (i-1) meses.
CREATE OR REPLACE FUNCTION public.editar_compra_parcelada(
  p_grupo_id        uuid,
  p_descricao       text,
  p_valor_parcela   double precision,
  p_n_parcelas      integer,
  p_data_inicio     date,
  p_cartao_id       bigint,
  p_categoria       text,
  p_tipo            text,
  p_forma_pagamento text
)
RETURNS SETOF "Lancamentos"
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_i integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_n_parcelas IS NULL OR p_n_parcelas < 2 THEN
    RAISE EXCEPTION 'p_n_parcelas deve ser >= 2';
  END IF;

  IF p_valor_parcela IS NULL OR p_valor_parcela <= 0 THEN
    RAISE EXCEPTION 'p_valor_parcela invalido';
  END IF;

  -- Defesa em profundidade: só apaga linhas do próprio user
  DELETE FROM "Lancamentos"
   WHERE parcela_grupo_id = p_grupo_id
     AND user_id = v_user_id;

  -- Re-insere N parcelas com mesmo grupo_id (rastreabilidade)
  FOR v_i IN 1..p_n_parcelas LOOP
    INSERT INTO "Lancamentos" (
      descricao,
      valor,
      tipo,
      categoria,
      data_lancamento,
      user_id,
      forma_pagamento,
      cartao_id,
      parcela_atual,
      total_parcelas,
      parcela_grupo_id,
      poderia_ter_evitado,
      recorrente
    ) VALUES (
      p_descricao || ' (' || v_i || '/' || p_n_parcelas || ')',
      p_valor_parcela,
      p_tipo,
      p_categoria,
      (p_data_inicio + ((v_i - 1) || ' months')::interval)::date,
      v_user_id,
      p_forma_pagamento,
      p_cartao_id,
      v_i,
      p_n_parcelas,
      p_grupo_id,
      false,
      false
    );
  END LOOP;

  RETURN QUERY
    SELECT * FROM "Lancamentos"
     WHERE parcela_grupo_id = p_grupo_id
       AND user_id = v_user_id
     ORDER BY parcela_atual;
END;
$$;

GRANT EXECUTE ON FUNCTION public.editar_compra_parcelada(
  uuid, text, double precision, integer, date, bigint, text, text, text
) TO authenticated;
