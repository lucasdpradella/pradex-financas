// Aviso pro Lucas quando alguém exclui a conta (supabase/functions/excluir-conta/aviso.ts).
// O que importa: assinatura paga e vigente grita "CANCELAR NA CAKTO"; trial e plano vencido, não.
import { describe, it, expect } from "vitest";
import { montarAviso, precisaCancelarNaCakto } from "../supabase/functions/excluir-conta/aviso.ts";

const AGORA = new Date("2026-10-16T12:00:00Z");
const base = {
  modo: "sozinho", parceiro_id: null, nome: "Ana Souza", telefone: "5511999990001",
  plano: "essencial", plano_ate: "2026-11-10T03:00:00Z", trial_ate: null, pagou_cakto: true,
};

describe("precisaCancelarNaCakto", () => {
  it("pagou e o plano ainda vale: cancelar", () => {
    expect(precisaCancelarNaCakto(base, AGORA)).toBe(true);
  });
  it("trial (nunca passou pela Cakto): não", () => {
    expect(precisaCancelarNaCakto({ ...base, pagou_cakto: false, trial_ate: "2026-10-20T00:00:00Z" }, AGORA)).toBe(false);
  });
  it("plano já vencido ou none: não", () => {
    expect(precisaCancelarNaCakto({ ...base, plano_ate: "2026-10-01T00:00:00Z" }, AGORA)).toBe(false);
    expect(precisaCancelarNaCakto({ ...base, plano: "none" }, AGORA)).toBe(false);
  });
});

describe("montarAviso", () => {
  it("paga e vigente: título de cancelar e lembrete no fim", () => {
    const t = montarAviso("ana@x.com", base, AGORA);
    expect(t.split("\n")[0]).toBe("⚠️ *Conta excluída — CANCELAR NA CAKTO*");
    expect(t).toContain("Ana Souza — ana@x.com");
    expect(t).toContain("Plano: essencial até 10/11/2026");
    expect(t).toContain("Usava sozinho");
    expect(t).toMatch(/cancelada no painel da Cakto\.$/);
  });
  it("casal sem cobrança a cancelar: aviso simples, menciona o parceiro", () => {
    const t = montarAviso("beto@x.com", { ...base, modo: "casal", plano: "casal", pagou_cakto: false, telefone: null }, AGORA);
    expect(t.split("\n")[0]).toBe("🗑️ *Conta excluída*");
    expect(t).not.toContain("WhatsApp:");
    expect(t).toContain("ficou com o parceiro");
    expect(t).not.toContain("Cakto");
  });
});
