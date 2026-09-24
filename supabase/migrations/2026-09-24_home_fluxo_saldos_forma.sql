-- 2026-09-24 — Home Fluxo + saldos + forma de pagamento
--
-- Três coisas, todas idempotentes:
-- 1. forma_pagamento canônica (Crédito / Débito / PIX / …). "crédito" minúsculo
--    caía no Débito porque o fechamento comparava com match exato.
-- 2. Pagamento de fatura pode ter abate_saldo = false sem meta_id. A compra no
--    crédito já entrou no Saiu; o PIX que quita o cartão não entra de novo.
-- 3. bancos.saldo_atual — saldo manual da conta ("Nas contas agora"). O trigger
--    abate esse saldo quando entra um pagamento de fatura ligado ao cartão.
--
-- Aplicar no projeto Supabase antes do smoke. Rodar de novo não duplica nada.

-- ============================================================================
-- Helpers
-- ============================================================================
create or replace function public.texto_sem_acento(p text)
returns text
language sql
immutable
as $$
  select translate(
    lower(coalesce(p, '')),
    'áàâãäéèêëíìîïóòôõöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  );
$$;

create or replace function public.normalizar_forma_pagamento(p text)
returns text
language plpgsql
immutable
as $$
declare
  n text := public.texto_sem_acento(p);
begin
  if p is null or btrim(p) = '' then
    return null;
  end if;
  if n in ('credito', 'cartao', 'cartao de credito', 'credito parcelado') or n like 'credito %' then
    return 'Crédito';
  end if;
  if n in ('debito', 'debito em conta', 'cartao de debito') then
    return 'Débito';
  end if;
  if n = 'pix' then
    return 'PIX';
  end if;
  if n in ('pix/debito', 'pix / debito') then
    return 'PIX/Débito';
  end if;
  if n = 'saldo da conta' then
    return 'Saldo da conta';
  end if;
  if n in ('dinheiro', 'especie') then
    return 'Dinheiro';
  end if;
  if n = 'outros' then
    return 'Outros';
  end if;
  return btrim(p);
end;
$$;

create or replace function public.eh_pagamento_fatura(p_categoria text, p_descricao text)
returns boolean
language sql
immutable
as $$
  select public.texto_sem_acento(p_categoria) in ('pagamento fatura', 'pagamento de fatura')
      or public.texto_sem_acento(p_descricao) ~ 'pag(uei|ar|amento|o).{0,40}(fatura|cartao)'
      or public.texto_sem_acento(p_descricao) ~ '(quitei|quitacao|quitar).{0,40}(fatura|cartao)';
$$;

-- Banco da conta que paga o cartão: o vínculo explícito, ou o nome (XP ↔ Cartão XP).
create or replace function public.banco_id_do_cartao(p_cartao bigint, p_user uuid)
returns bigint
language sql
stable
as $$
  select coalesce(
    (select c.banco_id from public.cartoes c where c.id = p_cartao),
    (
      select b.id
        from public.bancos b
        join public.cartoes c on c.id = p_cartao
       where b.user_id = p_user
         and b.removido = false
         and (
           public.texto_sem_acento(c.nome) like '%' || public.texto_sem_acento(b.nome) || '%'
           or public.texto_sem_acento(b.nome) like '%' || public.texto_sem_acento(c.nome) || '%'
         )
       order by length(b.nome) desc
       limit 1
    )
  );
$$;

-- ============================================================================
-- abate_saldo = false também vale para pagamento de fatura (sem meta)
-- ============================================================================
alter table public."Lancamentos" drop constraint if exists lancamentos_abate_saldo_so_em_aporte;

alter table public."Lancamentos"
  add constraint lancamentos_abate_saldo_so_em_aporte
  check (
    abate_saldo
    or meta_id is not null
    or categoria = 'Pagamento fatura'
  );

-- ============================================================================
-- Backfill — só mexe na linha que ainda está fora do canônico
-- ============================================================================
update public."Lancamentos"
   set forma_pagamento = public.normalizar_forma_pagamento(forma_pagamento)
 where forma_pagamento is not null
   and forma_pagamento is distinct from public.normalizar_forma_pagamento(forma_pagamento);

update public."Lancamentos"
   set categoria = 'Pagamento fatura',
       abate_saldo = false
 where meta_id is null
   and tipo = 'gasto'
   and public.eh_pagamento_fatura(categoria, descricao)
   and (categoria is distinct from 'Pagamento fatura' or abate_saldo is distinct from false);

-- ============================================================================
-- Saldo manual da conta
-- ============================================================================
alter table public.bancos
  add column if not exists saldo_atual numeric(14, 2),
  add column if not exists atualizado_em timestamptz;

comment on column public.bancos.saldo_atual is
  'Saldo informado pelo usuário (Nas contas agora). Pagamento de fatura abate daqui quando o cartão aponta pra este banco.';

-- ============================================================================
-- Trigger: pagamento de fatura move o saldo da conta e não é gasto novo
-- ============================================================================
create or replace function public.sync_saldo_pagamento_fatura()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_banco bigint;
  v_user uuid;
begin
  if tg_op = 'DELETE' or tg_op = 'UPDATE' then
    if public.eh_pagamento_fatura(old.categoria, old.descricao)
       or (old.abate_saldo = false and old.meta_id is null) then
      v_banco := public.banco_id_do_cartao(old.cartao_id, old.user_id);
      if v_banco is not null then
        update public.bancos
           set saldo_atual = saldo_atual + old.valor,
               atualizado_em = now()
         where id = v_banco
           and user_id = old.user_id
           and saldo_atual is not null;
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if public.eh_pagamento_fatura(new.categoria, new.descricao)
       or (new.abate_saldo = false and new.meta_id is null) then
      v_user := new.user_id;
      v_banco := public.banco_id_do_cartao(new.cartao_id, v_user);
      if v_banco is not null then
        update public.bancos
           set saldo_atual = saldo_atual - new.valor,
               atualizado_em = now()
         where id = v_banco
           and user_id = v_user
           and saldo_atual is not null;
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists lancamentos_sync_saldo_pagamento_fatura on public."Lancamentos";
create trigger lancamentos_sync_saldo_pagamento_fatura
after insert or update or delete on public."Lancamentos"
for each row execute function public.sync_saldo_pagamento_fatura();

-- ============================================================================
-- Agente: grava a forma já normalizada e marca pagamento de fatura
-- ============================================================================
create or replace function public.agente_aplicar_acoes(p_user_id uuid, p_acoes jsonb)
 returns table(acao_index integer, tipo text, ids_afetados bigint[], parcela_grupo_id uuid)
 language plpgsql
 security definer
 set search_path to 'public'
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
begin
  if p_user_id is null then
    raise exception 'user_id obrigatorio';
  end if;

  if jsonb_typeof(p_acoes) != 'array' then
    raise exception 'p_acoes deve ser array JSONB';
  end if;

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
    if public.eh_pagamento_fatura(v_categoria, v_descricao) or (v_abate = false and (v_dados->>'meta_id') is null and v_tipo_lanc <> 'receita') then
      v_categoria := 'Pagamento fatura';
      v_abate := false;
      v_tipo_lanc := 'gasto';
      if v_forma is null or v_forma = 'Crédito' then
        v_forma := 'Débito';
      end if;
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
            user_id, descricao, valor, tipo, categoria, data_lancamento,
            forma_pagamento, cartao_id, parcela_atual, total_parcelas, parcela_grupo_id,
            abate_saldo
          ) values (
            p_user_id,
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
          user_id, descricao, valor, tipo, categoria, data_lancamento,
          forma_pagamento, cartao_id, abate_saldo
        ) values (
          p_user_id,
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
      where id = v_lancamento_id and user_id = p_user_id;

      if not found then
        raise exception 'lancamento % nao encontrado para user %', v_lancamento_id, p_user_id;
      end if;
      v_ids := array[v_lancamento_id];

    elsif v_tipo = 'deletar' then
      v_lancamento_id := (v_acao->>'lancamento_id')::bigint;
      if v_lancamento_id is null then
        raise exception 'lancamento_id obrigatorio para deletar (acao %)', v_index;
      end if;

      delete from public."Lancamentos"
      where id = v_lancamento_id and user_id = p_user_id;

      if not found then
        raise exception 'lancamento % nao encontrado para user %', v_lancamento_id, p_user_id;
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
