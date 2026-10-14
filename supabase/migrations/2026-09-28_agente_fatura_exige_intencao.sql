-- 2026-09-28 — Agente: "Pagamento fatura" exige intenção explícita
--
-- ⚠️ NÃO APLICADA automaticamente. Rodar (SQL Editor ou `supabase db query --linked -f`)
-- junto com o deploy da edge function agente-pradex deste mesmo PR.
--
-- Bug (25–27/09): gastos comuns no débito/PIX ("Gastei 90 no débito restaurante Hong
-- bin", "$24 mercado") foram gravados com categoria 'Pagamento fatura' e
-- abate_saldo=false — saíram do Saiu. Duas portas levavam lá, as duas criadas em
-- 24/09 (71e84b2 "Home: Fluxo do mês..." e 17ddac6 #96):
--   1. edge function: prepararAcao tratava a categoria devolvida pelo modelo como
--      intenção (e o texto da categoria "Pagamento fatura" casava com a própria regex);
--   2. este RPC: `or (v_abate = false and meta_id is null and tipo <> 'receita')`
--      promovia a pagamento de fatura qualquer ação que o modelo mandasse com
--      abate_saldo=false.
-- A edge function agora só marca pagamento com intenção na fala; aqui, abate_saldo
-- false sem meta e sem fatura volta a ser true. Corpo idêntico ao de
-- 2026-09-24_livros_casal_moeda_idioma.sql fora esse bloco.
--
-- Não mexe em dado. A correção das linhas já gravadas é um SQL à parte (ver PR).

create or replace function public.agente_aplicar_acoes(p_user_id uuid, p_acoes jsonb)
returns table(acao_index integer, tipo text, ids_afetados bigint[], parcela_grupo_id uuid)
language plpgsql
security definer
set search_path to public
as $function$
declare
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
  v_forma text;
  v_categoria text;
  v_descricao text;
  v_abate boolean;
  v_tipo_lanc text;
  v_livro uuid;
begin
  if p_user_id is null then
    raise exception 'user_id obrigatorio';
  end if;
  if jsonb_typeof(p_acoes) != 'array' then
    raise exception 'p_acoes deve ser array JSONB';
  end if;

  v_livro := public.garantir_livro(p_user_id);

  for v_acao in select * from jsonb_array_elements(p_acoes) loop
    v_tipo := v_acao->>'tipo';
    v_dados := v_acao->'dados';
    v_ids := array[]::bigint[];
    v_parcela_grupo := null;

    v_forma := public.normalizar_forma_pagamento(v_dados->>'forma_pagamento');
    v_categoria := v_dados->>'categoria';
    v_descricao := v_dados->>'descricao';
    v_abate := coalesce((v_dados->>'abate_saldo')::boolean, true);

    v_tipo_lanc := coalesce(v_dados->>'tipo', 'gasto');
    -- 28/09: pagamento de fatura só pela categoria/descrição (que a edge function já
    -- filtrou pela fala do cliente). abate_saldo=false sozinho NÃO é mais intenção:
    -- era o que transformava "gastei 90 no débito no restaurante" em pagamento.
    if public.eh_pagamento_fatura(v_categoria, v_descricao) then
      v_categoria := 'Pagamento fatura';
      v_abate := false;
      v_tipo_lanc := 'gasto';
      if v_forma is null or v_forma = 'Crédito' then
        v_forma := 'Débito';
      end if;
    elsif v_abate = false and (v_dados->>'meta_id') is null then
      -- abate_saldo=false sem meta e sem fatura não tem significado: vira gasto normal.
      v_abate := true;
    end if;

    if v_tipo = 'criar' then
      v_parcelado := coalesce((v_dados->>'parcelado')::boolean, false) and v_abate;
      v_total_parcelas := coalesce((v_dados->>'total_parcelas')::integer, 1);
      v_valor := (v_dados->>'valor')::numeric;

      if v_valor is null or v_valor <= 0 then
        raise exception 'valor invalido na acao %', v_index;
      end if;

      if v_parcelado and v_total_parcelas > 1 then
        v_parcela_grupo := gen_random_uuid();
        v_valor_parcela := round(v_valor / v_total_parcelas, 2);

        for v_i in 1..v_total_parcelas loop
          insert into public."Lancamentos" (
            user_id, criado_por, livro_id, descricao, valor, tipo, categoria, data_lancamento,
            forma_pagamento, cartao_id, parcela_atual, total_parcelas, parcela_grupo_id,
            abate_saldo
          ) values (
            p_user_id,
            p_user_id,
            v_livro,
            v_descricao,
            v_valor_parcela,
            v_tipo_lanc,
            v_categoria,
            (coalesce((v_dados->>'data_lancamento')::date, current_date)
              + make_interval(months => v_i - 1))::date,
            v_forma,
            (v_dados->>'cartao_id')::bigint,
            v_i,
            v_total_parcelas,
            v_parcela_grupo,
            true
          ) returning id into v_lancamento_id;
          v_ids := array_append(v_ids, v_lancamento_id);
        end loop;
      else
        insert into public."Lancamentos" (
          user_id, criado_por, livro_id, descricao, valor, tipo, categoria, data_lancamento,
          forma_pagamento, cartao_id, abate_saldo
        ) values (
          p_user_id,
          p_user_id,
          v_livro,
          v_descricao,
          v_valor,
          v_tipo_lanc,
          v_categoria,
          coalesce((v_dados->>'data_lancamento')::date, current_date),
          v_forma,
          (v_dados->>'cartao_id')::bigint,
          v_abate
        ) returning id into v_lancamento_id;
        v_ids := array[v_lancamento_id];
      end if;

    elsif v_tipo = 'editar' then
      v_lancamento_id := (v_acao->>'lancamento_id')::bigint;
      if v_lancamento_id is null then
        raise exception 'lancamento_id obrigatorio para editar (acao %)', v_index;
      end if;

      update public."Lancamentos"
      set
        descricao = coalesce(v_descricao, descricao),
        valor = coalesce((v_dados->>'valor')::numeric, valor),
        tipo = case when v_categoria = 'Pagamento fatura' and v_abate = false then 'gasto' else coalesce(v_dados->>'tipo', tipo) end,
        categoria = coalesce(v_categoria, categoria),
        data_lancamento = coalesce((v_dados->>'data_lancamento')::date, data_lancamento),
        forma_pagamento = coalesce(v_forma, forma_pagamento),
        abate_saldo = case when v_abate = false then false else abate_saldo end,
        cartao_id = coalesce((v_dados->>'cartao_id')::bigint, cartao_id)
      where id = v_lancamento_id and livro_id = v_livro;

      if not found then
        raise exception 'lancamento % nao encontrado no livro %', v_lancamento_id, v_livro;
      end if;
      v_ids := array[v_lancamento_id];

    elsif v_tipo = 'deletar' then
      v_lancamento_id := (v_acao->>'lancamento_id')::bigint;
      if v_lancamento_id is null then
        raise exception 'lancamento_id obrigatorio para deletar (acao %)', v_index;
      end if;

      delete from public."Lancamentos"
      where id = v_lancamento_id and livro_id = v_livro;

      if not found then
        raise exception 'lancamento % nao encontrado no livro %', v_lancamento_id, v_livro;
      end if;
      v_ids := array[v_lancamento_id];

    else
      raise exception 'tipo invalido: %', v_tipo;
    end if;

    acao_index := v_index;
    tipo := v_tipo;
    ids_afetados := v_ids;
    parcela_grupo_id := v_parcela_grupo;
    return next;
    v_index := v_index + 1;
  end loop;

  return;
end;
$function$;

revoke all on function public.agente_aplicar_acoes(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.agente_aplicar_acoes(uuid, jsonb) to service_role;

-- ============================================================================
-- Conferência
-- ============================================================================
--   select position('elsif v_abate = false' in prosrc) > 0 as corrigida
--     from pg_proc where proname = 'agente_aplicar_acoes';
