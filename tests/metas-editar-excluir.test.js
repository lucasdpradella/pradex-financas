import { describe, it, expect } from "vitest";
import { validarEdicaoMeta, metasAtivas } from "../src/lib/metas";

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


describe("excluir caixinha = arquivar", () => {
  it("a arquivada some da lista e libera o nome pra uma nova", () => {
    const depois = metas.map((m) => (m.id === 1 ? { ...m, arquivada: true } : m));
    expect(metasAtivas(depois).map((m) => m.id)).toEqual([2]);
    expect(validarEdicaoMeta({ nome: "Viagem", valorAlvo: 10 }, metas[1], depois).erro).toBeUndefined();
  });
});
