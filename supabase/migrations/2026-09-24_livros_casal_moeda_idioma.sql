-- 2026-09-24 — Livro do casal + moeda + idioma
--
-- Um livro (household) por pessoa. Casal = dois logins no mesmo livro, cada um
-- no próprio WhatsApp. Lançamento guarda quem criou. Moeda e idioma são do livro
-- (BRL | USD | DKK, pt-BR | en). Nada converte câmbio.
--
-- Idempotente: rodar de novo não duplica livro de quem já tem membership ativa.
-- Aplicar no Supabase antes do smoke. A edge function não é deployada por este arquivo.

-- ============================================================================
-- Livro e membros
-- ============================================================================
create table if not exists public.livros (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null default 'Casa',
  moeda      text not null default 'BRL',
  idioma     text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  constraint livros_moeda_chk check (moeda in ('BRL', 'USD', 'DKK')),
  constraint livros_idioma_chk check (idioma in ('pt-BR', 'en'))
);

create table if not exists public.livro_membros (
  id         uuid primary key default gen_random_uuid(),
  livro_id   uuid not null references public.livros (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  papel      text not null default 'dono',
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  constraint livro_membros_papel_chk check (papel in ('dono', 'membro')),
  constraint livro_membros_user_unico unique (user_id)
);

create index if not exists livro_membros_livro_idx on public.livro_membros (livro_id);

-- ============================================================================
-- Funções de membership (security definer: a policy não pode ler a própria tabela)
-- ============================================================================
create or replace function public.garantir_livro(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_livro uuid;
begin
  if p_user_id is null then
    raise exception 'user_id obrigatorio';
  end if;

  select m.livro_id into v_livro
    from public.livro_membros m
   where m.user_id = p_user_id and m.ativo
   limit 1;
  if v_livro is not null then
    return v_livro;
  end if;

  insert into public.livros (nome, moeda, idioma)
  values ('Casa', 'BRL', 'pt-BR')
  returning id into v_livro;

  insert into public.livro_membros (livro_id, user_id, papel, ativo)
  values (v_livro, p_user_id, 'dono', true)
  on conflict (user_id) do update
    set livro_id = excluded.livro_id,
        papel = 'dono',
        ativo = true;

  return v_livro;
end;
$$;

create or replace function public.sou_membro_do_livro(p_livro uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.livro_membros m
     where m.livro_id = p_livro
       and m.user_id = auth.uid()
       and m.ativo
  );
$$;

create or replace function public.garantir_meu_livro()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_livro uuid;
  v_row public.livros%rowtype;
  v_papel text;
begin
  if v_user is null then
    raise exception 'unauthenticated';
  end if;
  v_livro := public.garantir_livro(v_user);
  select * into v_row from public.livros where id = v_livro;
  select m.papel into v_papel
    from public.livro_membros m
   where m.user_id = v_user and m.ativo;
  return jsonb_build_object(
    'id', v_row.id,
    'nome', v_row.nome,
    'moeda', v_row.moeda,
    'idioma', v_row.idioma,
    'papel', coalesce(v_papel, 'dono')
  );
end;
$$;

create or replace function public.membros_do_meu_livro()
returns table (user_id uuid, nome text, papel text)
language sql
stable
security definer
set search_path = public
as $$
  select m.user_id,
         coalesce(nullif(btrim(fp.nome), ''), nullif(btrim(fp.apelido), ''), ''),
         m.papel
    from public.livro_membros eu
    join public.livro_membros m on m.livro_id = eu.livro_id and m.ativo
    left join public.fp_perfil fp on fp.user_id = m.user_id
   where eu.user_id = auth.uid() and eu.ativo;
$$;

-- Ops: liga dois logins no livro de A, move os dados de B e grava moeda/idioma.
-- Sem UI de convite. Só service_role (e o SQL editor, como dono).
create or replace function public.vincular_casal(
  p_user_a uuid,
  p_user_b uuid,
  p_moeda text default 'BRL',
  p_idioma text default 'pt-BR'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_livro uuid;
  v_livro_b uuid;
  v_moeda text := case when p_moeda in ('BRL', 'USD', 'DKK') then p_moeda else 'BRL' end;
  v_idioma text := case when p_idioma in ('pt-BR', 'en') then p_idioma else 'pt-BR' end;
begin
  if p_user_a is null or p_user_b is null or p_user_a = p_user_b then
    raise exception 'informe dois usuarios diferentes';
  end if;

  v_livro := public.garantir_livro(p_user_a);
  v_livro_b := public.garantir_livro(p_user_b);

  if v_livro_b is distinct from v_livro then
    update public."Lancamentos"
       set livro_id = v_livro
     where livro_id = v_livro_b or user_id = p_user_b;
    update public.cartoes
       set livro_id = v_livro
     where livro_id = v_livro_b or user_id = p_user_b;
    update public.bancos
       set livro_id = v_livro
     where livro_id = v_livro_b or user_id = p_user_b;
    update public.metas
       set livro_id = v_livro
     where livro_id = v_livro_b or user_id = p_user_b;

    update public.livro_membros
       set livro_id = v_livro, papel = 'membro', ativo = true
     where user_id = p_user_b;

    delete from public.livros l
     where l.id = v_livro_b
       and not exists (select 1 from public.livro_membros m where m.livro_id = l.id);
  end if;

  update public.livros
     set moeda = v_moeda, idioma = v_idioma
   where id = v_livro;

  update public.livro_membros
     set papel = 'dono', ativo = true
   where livro_id = v_livro and user_id = p_user_a;

  return v_livro;
end;
$$;

revoke all on function public.garantir_livro(uuid) from public, anon, authenticated;
grant execute on function public.garantir_livro(uuid) to service_role;

revoke all on function public.vincular_casal(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.vincular_casal(uuid, uuid, text, text) to service_role;

revoke all on function public.garantir_meu_livro() from public, anon;
grant execute on function public.garantir_meu_livro() to authenticated, service_role;

revoke all on function public.membros_do_meu_livro() from public, anon;
grant execute on function public.membros_do_meu_livro() to authenticated, service_role;

revoke all on function public.sou_membro_do_livro(uuid) from public, anon;
grant execute on function public.sou_membro_do_livro(uuid) to authenticated, service_role;

-- ============================================================================
-- Escopo do livro nas tabelas que o casal compartilha
-- ============================================================================
alter table public."Lancamentos"
  add column if not exists livro_id uuid references public.livros (id),
  add column if not exists criado_por uuid references auth.users (id) on delete set null;

alter table public.cartoes
  add column if not exists livro_id uuid references public.livros (id);

alter table public.bancos
  add column if not exists livro_id uuid references public.livros (id);

alter table public.metas
  add column if not exists livro_id uuid references public.livros (id);

create index if not exists lancamentos_livro_idx on public."Lancamentos" (livro_id);
create index if not exists cartoes_livro_idx on public.cartoes (livro_id);
create index if not exists bancos_livro_idx on public.bancos (livro_id);
create index if not exists metas_livro_idx on public.metas (livro_id);

-- Um livro BRL/pt-BR por usuário que já existe. Quem já tem membership fica.
do $$
declare
  r record;
begin
  for r in
    select distinct u.user_id
      from (
        select id as user_id from auth.users
        union
        select user_id from public.fp_perfil where user_id is not null
        union
        select user_id from public."Lancamentos" where user_id is not null
        union
        select user_id from public.cartoes where user_id is not null
        union
        select user_id from public.bancos where user_id is not null
        union
        select user_id from public.metas where user_id is not null
      ) u
     where u.user_id is not null
       and exists (select 1 from auth.users au where au.id = u.user_id)
  loop
    perform public.garantir_livro(r.user_id);
  end loop;
end $$;

update public."Lancamentos" l
   set livro_id = m.livro_id,
       criado_por = coalesce(l.criado_por, l.user_id)
  from public.livro_membros m
 where m.user_id = l.user_id
   and m.ativo
   and (l.livro_id is null or l.criado_por is null);

update public.cartoes c
   set livro_id = m.livro_id
  from public.livro_membros m
 where m.user_id = c.user_id and m.ativo and c.livro_id is null;

update public.bancos b
   set livro_id = m.livro_id
  from public.livro_membros m
 where m.user_id = b.user_id and m.ativo and b.livro_id is null;

update public.metas g
   set livro_id = m.livro_id
  from public.livro_membros m
 where m.user_id = g.user_id and m.ativo and g.livro_id is null;

-- Insert do app e do agente herda o livro de quem lançou, se a coluna vier vazia.
create or replace function public.preencher_livro_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  v_user := coalesce(new.user_id, auth.uid());
  if new.user_id is null and v_user is not null then
    new.user_id := v_user;
  end if;
  if tg_table_name = 'Lancamentos' and new.criado_por is null then
    new.criado_por := coalesce(auth.uid(), v_user);
  end if;
  if new.livro_id is null and v_user is not null then
    new.livro_id := public.garantir_livro(v_user);
  end if;
  return new;
end;
$$;

drop trigger if exists lancamentos_preencher_livro on public."Lancamentos";
create trigger lancamentos_preencher_livro
  before insert on public."Lancamentos"
  for each row execute function public.preencher_livro_id();

drop trigger if exists cartoes_preencher_livro on public.cartoes;
create trigger cartoes_preencher_livro
  before insert on public.cartoes
  for each row execute function public.preencher_livro_id();

drop trigger if exists bancos_preencher_livro on public.bancos;
create trigger bancos_preencher_livro
  before insert on public.bancos
  for each row execute function public.preencher_livro_id();

drop trigger if exists metas_preencher_livro on public.metas;
create trigger metas_preencher_livro
  before insert on public.metas
  for each row execute function public.preencher_livro_id();

create or replace function public.fp_perfil_garante_livro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null then
    perform public.garantir_livro(new.user_id);
  end if;
  return new;
end;
$$;

drop trigger if exists fp_perfil_garante_livro on public.fp_perfil;
create trigger fp_perfil_garante_livro
  after insert on public.fp_perfil
  for each row execute function public.fp_perfil_garante_livro();

-- ============================================================================
-- RLS: membro do livro lê e escreve. Categorias, orçamentos e perfil seguem no user.
-- ============================================================================
alter table public.livros enable row level security;
alter table public.livro_membros enable row level security;

drop policy if exists livros_select_membro on public.livros;
create policy livros_select_membro on public.livros
  for select to authenticated
  using (public.sou_membro_do_livro(id));

drop policy if exists livros_update_membro on public.livros;
create policy livros_update_membro on public.livros
  for update to authenticated
  using (public.sou_membro_do_livro(id))
  with check (public.sou_membro_do_livro(id));

drop policy if exists livro_membros_select_membro on public.livro_membros;
create policy livro_membros_select_membro on public.livro_membros
  for select to authenticated
  using (public.sou_membro_do_livro(livro_id));

grant select, update on public.livros to authenticated;
grant select on public.livro_membros to authenticated;

do $$
declare
  r record;
  alvos text[] := array['Lancamentos', 'cartoes', 'bancos', 'metas'];
  t text;
begin
  foreach t in array alvos loop
    if to_regclass(format('public.%I', t)) is null then
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    for r in
      select policyname from pg_policies
       where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', r.policyname, t);
    end loop;
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.sou_membro_do_livro(livro_id))',
      t || '_select_livro', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.sou_membro_do_livro(livro_id) and user_id = auth.uid())',
      t || '_insert_livro', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.sou_membro_do_livro(livro_id)) with check (public.sou_membro_do_livro(livro_id))',
      t || '_update_livro', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.sou_membro_do_livro(livro_id))',
      t || '_delete_livro', t
    );
  end loop;
end $$;

-- ============================================================================
-- Pagamento de fatura acha o banco do livro, não só o user_id de quem pagou
-- ============================================================================
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
       where b.removido = false
         and (
           (c.livro_id is not null and b.livro_id = c.livro_id)
           or (c.livro_id is null and b.user_id = p_user)
         )
         and (
           public.texto_sem_acento(c.nome) like '%' || public.texto_sem_acento(b.nome) || '%'
           or public.texto_sem_acento(b.nome) like '%' || public.texto_sem_acento(c.nome) || '%'
         )
       order by length(b.nome) desc
       limit 1
    )
  );
$$;

create or replace function public.sync_saldo_pagamento_fatura()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_banco bigint;
  v_user uuid;
  v_livro uuid;
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
           and saldo_atual is not null
           and (
             user_id = old.user_id
             or (old.livro_id is not null and livro_id = old.livro_id)
           );
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if public.eh_pagamento_fatura(new.categoria, new.descricao)
       or (new.abate_saldo = false and new.meta_id is null) then
      v_user := new.user_id;
      v_livro := new.livro_id;
      v_banco := public.banco_id_do_cartao(new.cartao_id, v_user);
      if v_banco is not null then
        update public.bancos
           set saldo_atual = saldo_atual - new.valor,
               atualizado_em = now()
         where id = v_banco
           and saldo_atual is not null
           and (
             user_id = v_user
             or (v_livro is not null and livro_id = v_livro)
           );
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- Compras parceladas: qualquer membro do livro edita/apaga, criado_por fica
-- ============================================================================
create or replace function public.deletar_compra_parcelada(p_grupo_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_user_id uuid := auth.uid();
  v_livro uuid;
begin
  if v_user_id is null then
    raise exception 'unauthenticated';
  end if;

  select m.livro_id into v_livro
    from public.livro_membros m
   where m.user_id = v_user_id and m.ativo
   limit 1;
  if v_livro is null then
    raise exception 'livro nao encontrado';
  end if;

  delete from public."Lancamentos"
   where parcela_grupo_id = p_grupo_id
     and livro_id = v_livro;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.editar_compra_parcelada(
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
returns setof public."Lancamentos"
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_livro uuid;
  v_dono uuid;
  v_criado uuid;
  v_i integer;
  v_flags boolean[];
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
      (p_data_inicio + ((v_i - 1) || ' months')::interval)::date,
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
$$;

-- ============================================================================
-- Agente: grava no livro de quem falou, com criado_por. Edita o livro inteiro.
-- ============================================================================
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
