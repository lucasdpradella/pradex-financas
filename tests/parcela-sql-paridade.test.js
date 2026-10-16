// A data da parcela existe duas vezes: dataDaParcelaNoCiclo (site) e
// public.data_parcela_no_ciclo (banco — agente do WhatsApp, editar_compra_parcelada,
// criar_compra_parcelada do app iOS). Este teste roda a função SQL da migration num
// Postgres em memória e exige o mesmo resultado do JS. Mudou a regra num lado, quebra aqui.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { dataDaParcelaNoCiclo } from "../src/lib/faturas";

const MIGRATION = new URL("../supabase/migrations/2026-10-16_parcela_no_ciclo_no_banco.sql", import.meta.url);

function funcaoSql() {
  const sql = readFileSync(MIGRATION, "utf8");
  const ini = sql.indexOf("create or replace function public.data_parcela_no_ciclo(");
  const fim = sql.indexOf("$$;", ini);
  if (ini < 0 || fim < 0) throw new Error("data_parcela_no_ciclo não encontrada na migration");
  return sql.slice(ini, fim + 3);
}

function casos() {
  const iso = (d) => d.toISOString().slice(0, 10);
  const datas = [];
  for (let d = new Date(Date.UTC(2025, 11, 1)); d <= new Date(Date.UTC(2028, 2, 31)); d.setUTCDate(d.getUTCDate() + 1)) {
    const dia = d.getUTCDate();
    const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    if (dia % 4 === 0 || dia >= ultimo - 3 || dia <= 2) datas.push(iso(d));
  }
  const out = [];
  for (const a of datas) for (const f of [null, 1, 5, 15, 28, 29, 30, 31]) for (const p of [1, 2, 3, 6, 13]) {
    out.push([a, p, f, dataDaParcelaNoCiclo(a, p, f, null)]);
  }
  return out;
}

describe("data da parcela: SQL igual ao JS", () => {
  let db;
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(funcaoSql());
  }, 60_000);
  afterAll(async () => { await db?.close(); });

  it("mesma data em todas as combinações de compra × fechamento × parcela", async () => {
    const lista = casos();
    const { rows } = await db.query(
      `select c->>0 a, (c->>1)::int p, (c->>2)::int f, c->>3 js,
              public.data_parcela_no_ciclo((c->>0)::date, (c->>1)::int, (c->>2)::int)::text sql
         from jsonb_array_elements($1::jsonb) c
        where public.data_parcela_no_ciclo((c->>0)::date, (c->>1)::int, (c->>2)::int)::text is distinct from c->>3`,
      [JSON.stringify(lista)],
    );
    expect(lista.length).toBeGreaterThan(10_000);
    expect(rows).toEqual([]);
  }, 60_000);

  it("fecha dia 28, compra em 31/01: a 2ª parcela vai para 01/03, não 28/02", async () => {
    const { rows } = await db.query(`select public.data_parcela_no_ciclo('2026-01-31', 2, 28)::text d`);
    expect(rows[0].d).toBe("2026-03-01");
  });

  it("sem fechamento: mês calendário, como antes", async () => {
    const { rows } = await db.query(`select public.data_parcela_no_ciclo('2026-01-31', 2, null)::text d`);
    expect(rows[0].d).toBe("2026-02-28");
  });
});
