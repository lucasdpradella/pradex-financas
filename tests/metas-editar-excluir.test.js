import { describe, it, expect } from "vitest";
import { validarEdicaoMeta, resumoExclusaoMeta } from "../src/lib/metas";

const metas = [
  { id: 1, nome: "Viagem", arquivada: false },
  { id: 2, nome: "Reserva", arquivada: false },
  { id: 3, nome: "Carro", arquivada: true },
];

describe("validarEdicaoMeta", () => {
  it("monta o PATCH com nome limpo, alvo arredondado e vazios como null", () => {
    const r = validarEdicaoMeta({ nome: "  Viagem Japão ", valorAlvo: 1234.567, prazo: "", aplicadoEm: "  " }, metas[0], metas);
    expect(r.erro).toBeUndefined();
    expect(r.dados).toEqual({ nome: "Viagem Japão", valor_alvo: 1234.57, prazo: null, aplicado_em: null });
  });

  it("pode manter o próprio nome (não conflita consigo mesma)", () => {
    expect(validarEdicaoMeta({ nome: "viagem", valorAlvo: 10 }, metas[0], metas).dados.nome).toBe("viagem");
  });

  it("recusa nome de outra caixinha ativa, mas aceita o de uma arquivada", () => {
    expect(validarEdicaoMeta({ nome: "RESERVA", valorAlvo: 10 }, metas[0], metas).erro).toMatch(/já tem/);
    expect(validarEdicaoMeta({ nome: "Carro", valorAlvo: 10 }, metas[0], metas).erro).toBeUndefined();
  });

  it("recusa nome vazio e alvo inválido", () => {
    expect(validarEdicaoMeta({ nome: " ", valorAlvo: 10 }, metas[0], metas).erro).toBeTruthy();
    expect(validarEdicaoMeta({ nome: "X", valorAlvo: null }, metas[0], metas).erro).toBeTruthy();
    expect(validarEdicaoMeta({ nome: "X", valorAlvo: 0 }, metas[0], metas).erro).toBeTruthy();
    expect(validarEdicaoMeta({ nome: "X", valorAlvo: NaN }, metas[0], metas).erro).toBeTruthy();
  });
});

describe("resumoExclusaoMeta", () => {
  const lancs = [
    { id: 10, meta_id: 3, tipo: "gasto", valor: 500, abate_saldo: false },
    { id: 11, meta_id: 3, tipo: "gasto", valor: "100" },
    { id: 12, meta_id: 3, tipo: "receita", valor: 50 },
    { id: 13, meta_id: 1, tipo: "gasto", valor: 999 },
    { id: 14, meta_id: null, tipo: "gasto", valor: 1 },
  ];

  it("conta todos os registros da caixinha (guardar e tirar) e soma o guardado", () => {
    expect(resumoExclusaoMeta({ id: 3 }, lancs)).toEqual({ quantidade: 3, ids: [10, 11, 12], guardado: 600 });
  });

  it("caixinha sem aporte: nada vai junto", () => {
    expect(resumoExclusaoMeta({ id: 2 }, lancs)).toEqual({ quantidade: 0, ids: [], guardado: 0 });
    expect(resumoExclusaoMeta(null, lancs).quantidade).toBe(0);
  });
});
