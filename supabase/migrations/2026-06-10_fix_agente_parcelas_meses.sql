-- Fix: agente_aplicar_acoes criava as N parcelas de uma compra parcelada todas
-- com a MESMA data_lancamento (sem somar os meses). Sintoma reportado pelo Lucas
-- em 2026-06-10 (compra "viagem bea" 6x, todas em 2026-06-03; dados corrigidos
-- via UPDATE manual no mesmo dia).
-- Única mudança funcional: data_lancamento da parcela i = data_inicio + (i-1) meses
-- (mesmo padrão da editar_compra_parcelada). Resto da função idêntico ao prod
-- (fonte extraída via pg_get_functiondef em 2026-06-10).

CREATE OR REPLACE FUNCTION public.agente_aplicar_acoes(p_user_id uuid, p_acoes jsonb)
 RETURNS TABLE(acao_index integer, tipo text, ids_afetados bigint[], parcela_grupo_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_acao jsonb;
  v_index integer := 0;
  v_tipo text;
  v_dados jsonb;
  v_parcelado boolean;
  v_total_parcelas integer;
  v_valor numeric;
  v_valor_parcela numeric;
  v_parcela_grupo uuid;
  v_lancamento_id bigint;
  v_ids bigint[];
  v_i integer;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id obrigatorio';
  END IF;

  IF jsonb_typeof(p_acoes) != 'array' THEN
    RAISE EXCEPTION 'p_acoes deve ser array JSONB';
  END IF;

  FOR v_acao IN SELECT * FROM jsonb_array_elements(p_acoes) LOOP
    v_tipo := v_acao->>'tipo';
    v_dados := v_acao->'dados';
    v_ids := ARRAY[]::bigint[];
    v_parcela_grupo := NULL;

    IF v_tipo = 'criar' THEN
      v_parcelado := COALESCE((v_dados->>'parcelado')::boolean, false);
      v_total_parcelas := COALESCE((v_dados->>'total_parcelas')::integer, 1);
      v_valor := (v_dados->>'valor')::numeric;

      IF v_valor IS NULL OR v_valor <= 0 THEN
        RAISE EXCEPTION 'valor invalido na acao %', v_index;
      END IF;

      IF v_parcelado AND v_total_parcelas > 1 THEN
        v_parcela_grupo := gen_random_uuid();
        v_valor_parcela := round(v_valor / v_total_parcelas, 2);

        FOR v_i IN 1..v_total_parcelas LOOP
          INSERT INTO public."Lancamentos" (
            user_id, descricao, valor, tipo, categoria, data_lancamento,
            forma_pagamento, cartao_id, parcela_atual, total_parcelas, parcela_grupo_id
          ) VALUES (
            p_user_id,
            v_dados->>'descricao',
            v_valor_parcela,
            COALESCE(v_dados->>'tipo', 'gasto'),
            v_dados->>'categoria',
            (COALESCE((v_dados->>'data_lancamento')::date, CURRENT_DATE)
              + make_interval(months => v_i - 1))::date,
            v_dados->>'forma_pagamento',
            (v_dados->>'cartao_id')::bigint,
            v_i,
            v_total_parcelas,
            v_parcela_grupo
          ) RETURNING id INTO v_lancamento_id;
          v_ids := array_append(v_ids, v_lancamento_id);
        END LOOP;
      ELSE
        INSERT INTO public."Lancamentos" (
          user_id, descricao, valor, tipo, categoria, data_lancamento,
          forma_pagamento, cartao_id
        ) VALUES (
          p_user_id,
          v_dados->>'descricao',
          v_valor,
          COALESCE(v_dados->>'tipo', 'gasto'),
          v_dados->>'categoria',
          COALESCE((v_dados->>'data_lancamento')::date, CURRENT_DATE),
          v_dados->>'forma_pagamento',
          (v_dados->>'cartao_id')::bigint
        ) RETURNING id INTO v_lancamento_id;
        v_ids := ARRAY[v_lancamento_id];
      END IF;

    ELSIF v_tipo = 'editar' THEN
      v_lancamento_id := (v_acao->>'lancamento_id')::bigint;
      IF v_lancamento_id IS NULL THEN
        RAISE EXCEPTION 'lancamento_id obrigatorio para editar (acao %)', v_index;
      END IF;

      UPDATE public."Lancamentos"
      SET
        descricao = COALESCE(v_dados->>'descricao', descricao),
        valor = COALESCE((v_dados->>'valor')::numeric, valor),
        tipo = COALESCE(v_dados->>'tipo', tipo),
        categoria = COALESCE(v_dados->>'categoria', categoria),
        data_lancamento = COALESCE((v_dados->>'data_lancamento')::date, data_lancamento),
        forma_pagamento = COALESCE(v_dados->>'forma_pagamento', forma_pagamento)
      WHERE id = v_lancamento_id AND user_id = p_user_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'lancamento % nao encontrado para user %', v_lancamento_id, p_user_id;
      END IF;
      v_ids := ARRAY[v_lancamento_id];

    ELSIF v_tipo = 'deletar' THEN
      v_lancamento_id := (v_acao->>'lancamento_id')::bigint;
      IF v_lancamento_id IS NULL THEN
        RAISE EXCEPTION 'lancamento_id obrigatorio para deletar (acao %)', v_index;
      END IF;

      DELETE FROM public."Lancamentos"
      WHERE id = v_lancamento_id AND user_id = p_user_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'lancamento % nao encontrado para user %', v_lancamento_id, p_user_id;
      END IF;
      v_ids := ARRAY[v_lancamento_id];

    ELSE
      RAISE EXCEPTION 'tipo invalido: %', v_tipo;
    END IF;

    acao_index := v_index;
    tipo := v_tipo;
    ids_afetados := v_ids;
    parcela_grupo_id := v_parcela_grupo;
    RETURN NEXT;
    v_index := v_index + 1;
  END LOOP;

  RETURN;
END;
$function$;
