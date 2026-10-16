// excluir_conta_preparar roda num Postgres em memória com as FKs de produção
// (mesmas regras de ON DELETE, levantadas do catálogo em 2026-10-16). O que se prova:
// depois dela, apagar o login não quebra em FK nenhuma; no casal o Livro fica inteiro
// com o parceiro; sozinho, nada sobra.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const MIGRATION = readFileSync(
  new URL("../supabase/migrations/2026-10-16_excluir_conta.sql", import.meta.url), "utf8");

const ANA = "aaaaaaaa-0000-0000-0000-000000000001";
const BETO = "bbbbbbbb-0000-0000-0000-000000000002";
const CAIO = "cccccccc-0000-0000-0000-000000000003";
const LIVRO_CASAL = "11111111-0000-0000-0000-000000000001";
const LIVRO_CAIO = "33333333-0000-0000-0000-000000000003";

const ESQUEMA = `
create schema auth;
create table auth.users (id uuid primary key);
create role authenticated; create role anon; create role service_role;

create table public.livros (id uuid primary key);
create table public.livro_membros (
  livro_id uuid not null references public.livros on delete cascade,
  user_id uuid not null unique references auth.users on delete cascade,
  papel text not null default 'dono', ativo boolean not null default true,
  created_at timestamptz not null default now());
create table public.fp_perfil (user_id uuid unique references auth.users on delete cascade,
  nome text, apelido text, telefone text, plano text, plano_ate timestamptz, trial_ate timestamptz);
create table public.profiles (id uuid primary key references auth.users on delete cascade,
  assessor_id uuid references public.profiles);
create table public.bancos (id bigserial primary key, nome text, removido boolean not null default false,
  user_id uuid references auth.users on delete cascade, livro_id uuid references public.livros);
create unique index on public.bancos (user_id, lower(nome)) where removido = false;
create table public.cartoes (id bigserial primary key, user_id uuid references auth.users,
  livro_id uuid references public.livros, banco_id bigint references public.bancos on delete set null);
create table public.metas (id bigserial primary key, nome text, arquivada boolean not null default false,
  user_id uuid references auth.users on delete cascade, livro_id uuid references public.livros);
create unique index on public.metas (user_id, lower(nome)) where arquivada = false;
create table public.meta_marcos (meta_id bigint references public.metas on delete cascade, user_id uuid);
create table public."Lancamentos" (id bigserial primary key, descricao text,
  user_id uuid references auth.users, criado_por uuid references auth.users on delete set null,
  livro_id uuid references public.livros, cartao_id bigint references public.cartoes,
  meta_id bigint references public.metas on delete set null);
create table public.categorias (user_id uuid references auth.users on delete cascade, nome text);
create table public.cakto_eventos (user_id uuid references auth.users on delete set null);
create table public.agente_logs (user_id uuid references auth.users);
create table public.agente_msgs_processadas (user_id uuid references auth.users);
create table public.agente_onboarding_estado (user_id_candidato uuid references auth.users);
`;

const DADOS = `
insert into auth.users values ('${ANA}'), ('${BETO}'), ('${CAIO}');
insert into public.livros values ('${LIVRO_CASAL}'), ('${LIVRO_CAIO}');
insert into public.livro_membros (livro_id, user_id, papel, created_at) values
  ('${LIVRO_CASAL}', '${ANA}', 'dono', now() - interval '1 day'),
  ('${LIVRO_CASAL}', '${BETO}', 'membro', now()),
  ('${LIVRO_CAIO}', '${CAIO}', 'dono', now());
insert into public.fp_perfil values
  ('${ANA}', 'Ana Souza', null, '5511999990001', 'casal', now() + interval '20 days', null),
  ('${BETO}', 'Beto Lima', null, '5511999990002', 'casal', now() + interval '20 days', null),
  ('${CAIO}', 'Caio Reis', 'caio', null, 'none', null, now() - interval '3 days');
insert into public.profiles values ('${ANA}', null), ('${BETO}', '${ANA}'), ('${CAIO}', null);
insert into public.cakto_eventos values ('${ANA}');

insert into public.bancos (nome, user_id, livro_id) values
  ('Nubank', '${ANA}', '${LIVRO_CASAL}'), ('Itaú', '${ANA}', '${LIVRO_CASAL}'),
  ('Nubank', '${BETO}', '${LIVRO_CASAL}'), ('Inter', '${CAIO}', '${LIVRO_CAIO}');
insert into public.cartoes (user_id, livro_id, banco_id) values
  ('${ANA}', '${LIVRO_CASAL}', 1), ('${CAIO}', '${LIVRO_CAIO}', 4);
insert into public.metas (nome, user_id, livro_id) values
  ('Viagem', '${ANA}', '${LIVRO_CASAL}'), ('Viagem', '${BETO}', '${LIVRO_CASAL}'),
  ('Carro', '${CAIO}', '${LIVRO_CAIO}');
insert into public.meta_marcos values (1, '${ANA}'), (3, '${CAIO}');
insert into public."Lancamentos" (descricao, user_id, criado_por, livro_id, cartao_id, meta_id) values
  ('Mercado', '${ANA}', '${ANA}', '${LIVRO_CASAL}', 1, null),
  ('Poupança', '${ANA}', '${ANA}', '${LIVRO_CASAL}', null, 1),
  ('Uber', '${BETO}', '${BETO}', '${LIVRO_CASAL}', 1, null),
  ('Padaria', '${CAIO}', '${CAIO}', '${LIVRO_CAIO}', 2, 3),
  ('Antigo sem livro', '${CAIO}', '${CAIO}', null, null, null);
insert into public.categorias values ('${ANA}', 'Casa'), ('${BETO}', 'Casa'), ('${CAIO}', 'Pets');
insert into public.agente_logs values ('${ANA}'), ('${CAIO}');
insert into public.agente_msgs_processadas values ('${ANA}');
insert into public.agente_onboarding_estado values ('${CAIO}');
`;

describe("excluir_conta_preparar", () => {
  let db;
  const um = async (sql) => (await db.query(sql)).rows[0];
  const todos = async (sql) => (await db.query(sql)).rows;
  const excluir = async (id) => {
    const r = await um(`select public.excluir_conta_preparar('${id}') r`);
    await db.query(`delete from auth.users where id = '${id}'`);
    return r.r;
  };

  beforeEach(async () => {
    db = new PGlite();
    await db.exec(ESQUEMA);
    await db.exec(MIGRATION);
    await db.exec(DADOS);
  }, 60_000);
  afterEach(async () => { await db?.close(); });

  it("sem a função, apagar o login quebra em FK (é por isso que ela existe)", async () => {
    await expect(db.query(`delete from auth.users where id = '${ANA}'`)).rejects.toThrow(/foreign key/);
  });

  it("casal: tudo do Livro fica com o parceiro, que vira dono", async () => {
    const r = await excluir(ANA);
    expect(r).toMatchObject({ modo: "casal", parceiro_id: BETO, plano: "casal", pagou_cakto: true, telefone: "5511999990001" });

    const lanc = await todos(`select descricao, user_id, criado_por from public."Lancamentos" where livro_id = '${LIVRO_CASAL}' order by id`);
    expect(lanc.map((l) => l.descricao)).toEqual(["Mercado", "Poupança", "Uber"]);
    expect(lanc.every((l) => l.user_id === BETO)).toBe(true);
    expect(lanc[0].criado_por).toBeNull();

    expect(await todos(`select nome from public.bancos where livro_id = '${LIVRO_CASAL}' and user_id = '${BETO}' order by id`))
      .toEqual([{ nome: "Nubank (Ana)" }, { nome: "Itaú" }, { nome: "Nubank" }]);
    expect(await todos(`select nome from public.metas where livro_id = '${LIVRO_CASAL}' and user_id = '${BETO}' order by id`))
      .toEqual([{ nome: "Viagem (Ana)" }, { nome: "Viagem" }]);
    expect(await um(`select user_id from public.cartoes where id = 1`)).toEqual({ user_id: BETO });
    expect(await um(`select user_id from public.meta_marcos where meta_id = 1`)).toEqual({ user_id: BETO });
    expect(await todos(`select user_id, papel from public.livro_membros where livro_id = '${LIVRO_CASAL}'`))
      .toEqual([{ user_id: BETO, papel: "dono" }]);
    expect(await um(`select assessor_id from public.profiles where id = '${BETO}'`)).toEqual({ assessor_id: null });

    // dado pessoal de quem saiu sumiu; o do parceiro, não
    expect(await todos(`select user_id from public.categorias where user_id in ('${ANA}', '${BETO}')`)).toEqual([{ user_id: BETO }]);
    expect(await um(`select count(*)::int n from public.agente_logs where user_id = '${ANA}'`)).toEqual({ n: 0 });
  });

  it("sozinho: o Livro inteiro vai junto, e nada do Livro do casal é tocado", async () => {
    const r = await excluir(CAIO);
    expect(r).toMatchObject({ modo: "sozinho", parceiro_id: null, plano: "none", pagou_cakto: false });

    for (const t of ['"Lancamentos"', "cartoes", "bancos", "metas"]) {
      expect(await um(`select count(*)::int n from public.${t} where livro_id = '${LIVRO_CAIO}' or user_id = '${CAIO}'`)).toEqual({ n: 0 });
    }
    expect(await um(`select count(*)::int n from public.livros where id = '${LIVRO_CAIO}'`)).toEqual({ n: 0 });
    expect(await um(`select count(*)::int n from public.meta_marcos`)).toEqual({ n: 1 });
    expect(await um(`select count(*)::int n from public."Lancamentos" where livro_id = '${LIVRO_CASAL}'`)).toEqual({ n: 3 });
  });

  it("o casal inteiro sai: o segundo vira 'sozinho' e o Livro some", async () => {
    await excluir(ANA);
    expect(await excluir(BETO)).toMatchObject({ modo: "sozinho" });
    expect(await um(`select count(*)::int n from public."Lancamentos" where livro_id = '${LIVRO_CASAL}'`)).toEqual({ n: 0 });
    expect(await um(`select count(*)::int n from public.livros where id = '${LIVRO_CASAL}'`)).toEqual({ n: 0 });
  });

  it("rodar de novo para quem já foi preparado não quebra", async () => {
    await um(`select public.excluir_conta_preparar('${CAIO}')`);
    const r = await um(`select public.excluir_conta_preparar('${CAIO}') r`);
    expect(r.r.modo).toBe("sem_livro");
    await db.query(`delete from auth.users where id = '${CAIO}'`);
  });

  it("só o service_role executa", async () => {
    const r = await todos(`select r from unnest(array['anon','authenticated','service_role']) r
                            where has_function_privilege(r, 'public.excluir_conta_preparar(uuid)', 'execute')`);
    expect(r).toEqual([{ r: "service_role" }]);
  });
});
