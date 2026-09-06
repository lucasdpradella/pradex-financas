import { describe, it, expect } from "vitest";
import {
  prefixoMes,
  passoMes,
  diasDoMes,
  lancamentosDoMes,
  diasComLancamento,
  maiorSequencia,
  calcularFechamento,
} from "../src/lib/fechamento";

// Helper: lançamento com os campos que o app realmente usa.
let seq = 0;
const l = (over = {}) => ({
  id: ++seq,
  descricao: "Mercado",
  valor: 100,
  tipo: "gasto",
  categoria: "Alimentação",
  forma_pagamento: "Débito",
  data_lancamento: "2026-06-10",
  poderia_ter_evitado: false,
  ...over,
});

const HOJE = new Date(2026, 6, 15); // 15/jul/2026 — junho é mês fechado

describe("helpers de mês", () => {
  it("prefixoMes usa mês 1-indexado com zero à esquerda", () => {
    expect(prefixoMes(2026, 0)).toBe("2026-01");
    expect(prefixoMes(2026, 11)).toBe("2026-12");
  });

  it("passoMes atravessa a virada de ano nos dois sentidos", () => {
    expect(passoMes(2026, 0, -1)).toEqual({ ano: 2025, mes: 11 });
    expect(passoMes(2026, 11, 1)).toEqual({ ano: 2027, mes: 0 });
  });

  it("diasDoMes acerta fevereiro bissexto", () => {
    expect(diasDoMes(2026, 1)).toBe(28);
    expect(diasDoMes(2024, 1)).toBe(29);
    expect(diasDoMes(2026, 5)).toBe(30);
  });

  it("lancamentosDoMes não vaza de outros meses nem quebra com data ausente", () => {
    const dados = [l(), l({ data_lancamento: "2026-07-01" }), l({ data_lancamento: null })];
    expect(lancamentosDoMes(dados, 2026, 5)).toHaveLength(1);
  });
});

describe("dias e sequência", () => {
  it("conta dia único mesmo com vários lançamentos nele", () => {
    const dias = diasComLancamento([l(), l(), l({ data_lancamento: "2026-06-11" })]);
    expect(dias.size).toBe(2);
  });

  it("maiorSequencia acha o trecho consecutivo mais longo", () => {
    expect(maiorSequencia(new Set([1, 2, 3, 7, 8]))).toBe(3);
    expect(maiorSequencia(new Set([5]))).toBe(1);
    expect(maiorSequencia(new Set())).toBe(0);
  });
});

describe("calcularFechamento", () => {
  const dados = [
    // Junho (mês do relatório)
    l({ data_lancamento: "2026-06-01", tipo: "receita", valor: 5000, categoria: "Salário" }),
    l({ data_lancamento: "2026-06-02", valor: 300, categoria: "Alimentação" }),
    l({ data_lancamento: "2026-06-03", valor: 200, categoria: "Transporte", forma_pagamento: "Crédito" }),
    l({ data_lancamento: "2026-06-04", valor: 150, categoria: "Lazer", poderia_ter_evitado: true }),
    // Maio (base de comparação)
    l({ data_lancamento: "2026-05-10", valor: 100, categoria: "Alimentação" }),
    l({ data_lancamento: "2026-05-11", valor: 250, categoria: "Lazer", poderia_ter_evitado: true }),
  ];
  const f = calcularFechamento(dados, 2026, 5, { hoje: HOJE });

  it("soma receitas, gastos e saldo do mês certo", () => {
    expect(f.receitas).toBe(5000);
    expect(f.gastoTotal).toBe(650);
    expect(f.saldo).toBe(4350);
  });

  it("separa cartão de débito/PIX", () => {
    expect(f.cartao).toBe(200);
    expect(f.debito).toBe(450);
    expect(f.cartao + f.debito).toBe(f.gastoTotal);
  });

  it("soma o evitável do mês e o do mês anterior", () => {
    expect(f.evitavel).toBe(150);
    expect(f.evitavelAnterior).toBe(250);
  });

  it("compara com o mês anterior", () => {
    expect(f.gastoAnterior).toBe(350);
    expect(f.deltaGasto).toBe(300);
    expect(f.labelAnterior).toBe("Mai/2026");
  });

  it("ordena categorias por valor e limita o top a 5", () => {
    expect(f.categorias[0]).toMatchObject({ cat: "Alimentação", total: 300 });
    expect(f.topCategorias.length).toBeLessThanOrEqual(5);
  });

  it("mês fechado considera o mês inteiro, não os dias decorridos", () => {
    expect(f.mesCorrente).toBe(false);
    expect(f.diasConsiderados).toBe(30);
    expect(f.diasComLancamento).toBe(4);
  });

  it("mês corrente considera só os dias já decorridos", () => {
    const atual = calcularFechamento(
      [l({ data_lancamento: "2026-07-02" })],
      2026, 6, { hoje: HOJE },
    );
    expect(atual.mesCorrente).toBe(true);
    expect(atual.diasConsiderados).toBe(15);
  });

  it("mês futuro não tem dia decorrido", () => {
    const futuro = calcularFechamento([], 2026, 10, { hoje: HOJE });
    expect(futuro.diasConsiderados).toBe(0);
  });

  it("normalizar junta categoria com encoding quebrado", () => {
    const comMojibake = [
      l({ data_lancamento: "2026-06-05", valor: 50, categoria: "AlimentaÃ§Ã£o" }),
      l({ data_lancamento: "2026-06-06", valor: 50, categoria: "Alimentação" }),
    ];
    const semFix = calcularFechamento(comMojibake, 2026, 5);
    expect(semFix.categorias).toHaveLength(2);

    const comFix = calcularFechamento(comMojibake, 2026, 5, {
      normalizar: (x) => (x === "AlimentaÃ§Ã£o" ? "Alimentação" : x),
    });
    expect(comFix.categorias).toHaveLength(1);
    expect(comFix.categorias[0].total).toBe(100);
  });

  it("mês vazio não quebra e sinaliza ausência de lançamento", () => {
    const vazio = calcularFechamento([], 2026, 5, { hoje: HOJE });
    expect(vazio.temLancamentos).toBe(false);
    expect(vazio.gastoTotal).toBe(0);
    expect(vazio.maxCategoria).toBe(1); // guarda contra divisão por zero na barra
    expect(vazio.deltaGastoPct).toBeNull();
  });
});

describe("destaque do mês", () => {
  it("aponta a categoria que mais subiu, em percentual", () => {
    const dados = [
      l({ data_lancamento: "2026-05-02", valor: 100, categoria: "Lazer" }),
      l({ data_lancamento: "2026-06-02", valor: 300, categoria: "Lazer" }),
    ];
    expect(calcularFechamento(dados, 2026, 5, { hoje: HOJE }).destaque).toMatch(/Lazer.*200%/);
  });

  it("categoria nova não vira percentual infinito", () => {
    const dados = [
      l({ data_lancamento: "2026-05-02", valor: 100, categoria: "Lazer" }),
      l({ data_lancamento: "2026-06-02", valor: 80, categoria: "Pets" }),
    ];
    const d = calcularFechamento(dados, 2026, 5, { hoje: HOJE }).destaque;
    expect(d).toMatch(/Pets/);
    expect(d).not.toMatch(/Infinity|NaN|%/);
  });

  it("sem mês anterior, mostra a maior categoria", () => {
    const dados = [l({ data_lancamento: "2026-06-02", valor: 80, categoria: "Pets" })];
    expect(calcularFechamento(dados, 2026, 5, { hoje: HOJE }).destaque).toMatch(/Pets.*maior categoria/);
  });

  it("mês sem gasto nenhum tem frase própria", () => {
    expect(calcularFechamento([], 2026, 5, { hoje: HOJE }).destaque).toMatch(/Nenhum gasto/);
  });
});
