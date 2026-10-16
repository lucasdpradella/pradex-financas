-- 2026-10-16 — a data de cada parcela passa a ser calculada no banco, pelo ciclo do cartão.
--
-- Antes: o site calculava pelo ciclo (dataDaParcelaNoCiclo, decisão 2026-10-05), mas
-- editar_compra_parcelada e agente_aplicar_acoes (WhatsApp) somavam meses de calendário.
-- Compra feita depois do fechamento caía numa fatura pelo site e noutra pelo WhatsApp.
--
-- Agora:
--   data_parcela_no_ciclo      regra única, espelho de src/lib/faturas.js (paridade testada
--                              em 31.493 combinações de data x fechamento x parcela)
--   dia_fechamento_do_cartao   lê o fechamento do cartão do Livro
--   criar_compra_parcelada     RPC nova, para o app iOS (e o site, quando migrar)
--   editar_compra_parcelada    mesma assinatura; só a data de cada parcela muda
--   agente_aplicar_acoes       mesma assinatura; só a data de cada parcela muda
--
-- Sem cartão (ou cartão sem dia de fechamento) o resultado é idêntico ao de antes:
-- o ciclo é o mês calendário. Nada de histórico é regravado.
-- As duas funções existentes foram copiadas de produção (pg_get_functiondef) em 2026-10-16.


create or replace function public.data_parcela_no_ciclo(
  p_data_ancora date,
  p_passos integer,
  p_dia_fechamento integer
)
returns date
language plpgsql
immutable
set search_path = public
as $$
declare
  v_n integer := greatest(1, coalesce(p_passos, 1));
  v_fecha integer := nullif(p_dia_fechamento, 0);
  v_ref date := p_data_ancora;
  v_inicio date;
  v_fim date;
  v_mes date;
  v_ant date;
  v_ult integer;
  v_i integer;
  v_desloc date;
begin
  if p_data_ancora is null then
    return null;
  end if;

  -- Ciclo que contém a âncora, depois avança n-1 ciclos (cada um começa no dia
  -- seguinte ao fechamento do anterior). Espelha cicloQueContem/avancarCiclo.
  for v_i in 1..v_n loop
    v_mes := date_trunc('month', v_ref)::date;
    if v_fecha is null then
      v_inicio := v_mes;
      v_fim := (v_mes + interval '1 month' - interval '1 day')::date;
    else
      v_ult := extract(day from (v_mes + interval '1 month' - interval '1 day'))::integer;
      if extract(day from v_ref)::integer > least(greatest(1, v_fecha), v_ult) then
        v_mes := (v_mes + interval '1 month')::date;
        v_ult := extract(day from (v_mes + interval '1 month' - interval '1 day'))::integer;
      end if;
      v_fim := v_mes + (least(greatest(1, v_fecha), v_ult) - 1);
      v_ant := (v_mes - interval '1 month')::date;
      v_ult := extract(day from (v_ant + interval '1 month' - interval '1 day'))::integer;
      v_inicio := v_ant + least(greatest(1, v_fecha), v_ult);
    end if;
    v_ref := v_fim + 1;
  end loop;

  -- Mesmo dia n-1 meses depois, se cair dentro do ciclo de cobrança; senão o
  -- primeiro dia do ciclo.
  v_desloc := (p_data_ancora + make_interval(months => v_n - 1))::date;
  if v_desloc between v_inicio and v_fim then
    return v_desloc;
  end if;
  return v_inicio;
end;
$$;


comment on function public.data_parcela_no_ciclo(date, integer, integer) is
  'Data para gravar a parcela p_passos (1 = a âncora) de uma compra no crédito. Espelha dataDaParcelaNoCiclo (src/lib/faturas.js): mesmo dia p_passos-1 meses depois se cair no ciclo de cobrança, senão o primeiro dia do ciclo. Sem dia de fechamento, o ciclo é o mês calendário.';

-- Dia de fechamento do cartão, tolerante a coluna texto/vazia.
create or replace function public.dia_fechamento_do_cartao(p_cartao_id bigint, p_livro_id uuid)
returns integer
language sql
stable
set search_path = public
as $$
  select nullif(trim(c.dia_fechamento::text), '')::integer
    from public.cartoes c
   where c.id = p_cartao_id
     and c.livro_id = p_livro_id
$$;

-- ===== Criar compra parcelada (o app iOS chama; o site pode migrar depois) =====
--
-- Igual ao handleSubmit do site: cria da parcela p_parcela_atual até a última,
-- a primeira na data p_data e as seguintes pelo ciclo do cartão. Descrição ganha
-- " (i/N)". SECURITY INVOKER: o RLS do Livro vale normalmente.
create or replace function public.criar_compra_parcelada(
  p_descricao text,
  p_valor_parcela numeric,
  p_n_parcelas integer,
  p_data date,
  p_categoria text,
  p_cartao_id bigint default null,
  p_parcela_atual integer default 1,
  p_tipo text default 'gasto',
  p_poderia_ter_evitado boolean default false
)
returns setof public."Lancamentos"
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_livro uuid;
  v_grupo uuid := gen_random_uuid();
  v_fecha integer;
  v_base text;
  v_i integer;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;
  if p_n_parcelas is null or p_n_parcelas < 2 then
    raise exception 'p_n_parcelas deve ser >= 2';
  end if;
  if p_parcela_atual is null or p_parcela_atual < 1 or p_parcela_atual > p_n_parcelas then
    raise exception 'p_parcela_atual deve estar entre 1 e p_n_parcelas';
  end if;
  if p_valor_parcela is null or p_valor_parcela <= 0 then
    raise exception 'p_valor_parcela invalido';
  end if;
  if p_data is null or coalesce(trim(p_descricao), '') = '' or coalesce(trim(p_categoria), '') = '' then
    raise exception 'descricao, categoria e data sao obrigatorios';
  end if;

  select m.livro_id into v_livro
    from public.livro_membros m
   where m.user_id = v_user_id and m.ativo
   limit 1;
  if v_livro is null then
    raise exception 'livro nao encontrado';
  end if;

  if p_cartao_id is not null then
    if not exists (select 1 from public.cartoes c where c.id = p_cartao_id and c.livro_id = v_livro) then
      raise exception 'cartao nao encontrado neste livro';
    end if;
    v_fecha := public.dia_fechamento_do_cartao(p_cartao_id, v_livro);
  end if;

  v_base := trim(regexp_replace(p_descricao, '\s*\(\d+/\d+\)\s*$', ''));

  for v_i in p_parcela_atual..p_n_parcelas loop
    insert into public."Lancamentos" (
      descricao, valor, tipo, categoria, data_lancamento,
      user_id, criado_por, livro_id,
      forma_pagamento, cartao_id,
      parcela_atual, total_parcelas, parcela_grupo_id,
      poderia_ter_evitado, recorrente
    ) values (
      v_base || ' (' || v_i || '/' || p_n_parcelas || ')',
      round(p_valor_parcela, 2),
      coalesce(p_tipo, 'gasto'),
      p_categoria,
      public.data_parcela_no_ciclo(p_data, v_i - p_parcela_atual + 1, v_fecha),
      v_user_id,
      v_user_id,
      v_livro,
      'Crédito',
      p_cartao_id,
      v_i,
      p_n_parcelas,
      v_grupo,
      coalesce(p_poderia_ter_evitado, false),
      false
    );
  end loop;

  return query
    select * from public."Lancamentos"
     where parcela_grupo_id = v_grupo
     order by parcela_atual;
end;
$$;

revoke all on function public.criar_compra_parcelada(text, numeric, integer, date, text, bigint, integer, text, boolean) from public, anon;
grant execute on function public.criar_compra_parcelada(text, numeric, integer, date, text, bigint, integer, text, boolean) to authenticated;


-- ===== editar_compra_parcelada =====
CREATE OR REPLACE FUNCTION public.editar_compra_parcelada(p_grupo_id uuid, p_descricao text, p_valor_parcela double precision, p_n_parcelas integer, p_data_inicio date, p_cartao_id bigint, p_categoria text, p_tipo text, p_forma_pagamento text)
 RETURNS SETOF "Lancamentos"
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_livro uuid;
  v_dono uuid;
  v_criado uuid;
  v_i integer;
  v_flags boolean[];
  v_fecha integer;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;
  if p_n_parcelas is null or p_n_parcelas < 2 then
    raise exception 'p_n_parcelas deve ser >= 2';
  end if;
  if p_valor_parcela is null or p_valor_parcela <= 0 then
    raise exception 'p_valor_parcela invalido';
  end if;

  select m.livro_id into v_livro
    from public.livro_membros m
   where m.user_id = v_user_id and m.ativo
   limit 1;

  select l.user_id, l.criado_por
    into v_dono, v_criado
    from public."Lancamentos" l
   where l.parcela_grupo_id = p_grupo_id
     and l.livro_id = v_livro
   order by l.parcela_atual
   limit 1;

  if v_dono is null then
    raise exception 'compra nao encontrada neste livro';
  end if;

  v_fecha := public.dia_fechamento_do_cartao(p_cartao_id, v_livro);

  select array_agg(coalesce(poderia_ter_evitado, false) order by parcela_atual)
    into v_flags
    from public."Lancamentos"
   where parcela_grupo_id = p_grupo_id
     and livro_id = v_livro;

  delete from public."Lancamentos"
   where parcela_grupo_id = p_grupo_id
     and livro_id = v_livro;

  for v_i in 1..p_n_parcelas loop
    insert into public."Lancamentos" (
      descricao, valor, tipo, categoria, data_lancamento,
      user_id, criado_por, livro_id,
      forma_pagamento, cartao_id,
      parcela_atual, total_parcelas, parcela_grupo_id,
      poderia_ter_evitado, recorrente
    ) values (
      p_descricao || ' (' || v_i || '/' || p_n_parcelas || ')',
      p_valor_parcela,
      p_tipo,
      p_categoria,
      public.data_parcela_no_ciclo(p_data_inicio, v_i, v_fecha),
      v_dono,
      coalesce(v_criado, v_dono),
      v_livro,
      p_forma_pagamento,
      p_cartao_id,
      v_i,
      p_n_parcelas,
      p_grupo_id,
      coalesce(v_flags[v_i], false),
      false
    );
  end loop;

  return query
    select * from public."Lancamentos"
     where parcela_grupo_id = p_grupo_id
       and livro_id = v_livro
     order by parcela_atual;
end;
$function$;

-- ===== agente_aplicar_acoes =====
CREATE OR REPLACE FUNCTION public.agente_aplicar_acoes(p_user_id uuid, p_acoes jsonb)
 RETURNS TABLE(acao_index integer, tipo text, ids_afetados bigint[], parcela_grupo_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
            public.data_parcela_no_ciclo(
              coalesce((v_dados->>'data_lancamento')::date, current_date),
              v_i,
              public.dia_fechamento_do_cartao((v_dados->>'cartao_id')::bigint, v_livro)),
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
