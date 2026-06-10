-- Fix (code review 2026-06-10): editar_compra_parcelada zerava poderia_ter_evitado
-- de todas as parcelas no re-INSERT, apagando marcações existentes e distorcendo
-- o Diagnóstico FP (totalEvitavel / impacto 12m).
-- Agora captura os flags por parcela ANTES do DELETE e os re-aplica por posição
-- (parcela i mantém o flag da antiga parcela i; parcelas novas além do total
-- antigo entram como false). Assinatura idêntica — substituição sem overload.

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
  v_flags boolean[];
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

  -- Captura os flags evitável por ordem de parcela antes de apagar
  SELECT array_agg(COALESCE(poderia_ter_evitado, false) ORDER BY parcela_atual)
    INTO v_flags
    FROM "Lancamentos"
   WHERE parcela_grupo_id = p_grupo_id
     AND user_id = v_user_id;

  -- Defesa em profundidade: só apaga linhas do próprio user
  DELETE FROM "Lancamentos"
   WHERE parcela_grupo_id = p_grupo_id
     AND user_id = v_user_id;

  -- Re-insere N parcelas com mesmo grupo_id (rastreabilidade), preservando flags
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
      COALESCE(v_flags[v_i], false),
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
