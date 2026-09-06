import { describe, it, expect } from "vitest";
import { calcularFechamento } from "../src/lib/fechamento";
import { calcularDisciplina, PONTOS, DIAS_MES_PREENCHIDO, limiarPreenchido } from "../src/lib/disciplina";

const HOJE = new Date(2026, 6, 15); // 15/jul/2026 — junho fechado

let seq = 0;
const l = (over = {}) => ({
  id: ++seq,
  valor: 100,
  tipo: "gasto",
  categoria: "Alimentação",
  forma_pagamento: "Débito",
  data_lancamento: "2026-06-10",
  poderia_ter_evitado: false,
  ...over,
});

// Junho com lançamento nos N primeiros dias.
const mesCom = (dias, extra = []) => [
  ...Array.from({ length: dias }, (_, i) =>
    l({ data_lancamento: `2026-06-${String(i + 1).padStart(2, "0")}` })),
  ...extra,
];

const scoreDe = (lancamentos, opts) =>
  calcularDisciplina(calcularFechamento(lancamentos, 2026, 5, { hoje: HOJE }), opts);

describe("a regra inegociável: só comportamento", () => {
  // Duas pessoas com o MESMO comportamento e patrimônios opostos precisam empatar.
  it("renda e valor dos gastos não movem o score", () => {
    const pobre = mesCom(10);
    const rico = mesCom(10).map((x) => ({ ...x, valor: x.valor * 1000 }));
    const comSalario = [...mesCom(10), l({ tipo: "receita", valor: 999999, categoria: "Salário", data_lancamento: "2026-06-01" })];

    expect(scoreDe(rico).score).toBe(scoreDe(pobre).score);
    expect(scoreDe(comSalario).score).toBe(scoreDe(pobre).score);
  });

  it("saldo negativo não penaliza quem lançou direito", () => {
    const gastou = mesCom(25);
    const gastouEGanhou = [...mesCom(25), l({ tipo: "receita", valor: 50000, data_lancamento: "2026-06-01" })];
    expect(scoreDe(gastou).score).toBe(scoreDe(gastouEGanhou).score);
  });
});

describe("normalização sobre o aplicável", () => {
  // O ponto central da v0: teto não existe no produto, então não pode puxar o teto
  // do score pra baixo.
  it("100 é alcançável mesmo sem nenhum teto cadastrado", () => {
    const r = scoreDe(mesCom(30, [
      l({ data_lancamento: "2026-05-10", valor: 200, poderia_ter_evitado: true }),
    ]));
    expect(r.score).toBe(100);
    expect(r.componentes.find((c) => c.chave === "teto").aplicavel).toBe(false);
  });

  it("componente inaplicável fica fora do numerador e do denominador", () => {
    const r = scoreDe(mesCom(30));
    const teto = r.componentes.find((c) => c.chave === "teto");
    const evit = r.componentes.find((c) => c.chave === "evitavel");
    expect(teto.aplicavel).toBe(false);
    expect(evit.aplicavel).toBe(false); // sem mês anterior
    // Sobram constância + mês preenchido, ambos no máximo.
    expect(r.score).toBe(100);
  });

  it("com tetos cadastrados o componente passa a valer", () => {
    const lancamentos = mesCom(30);
    const dentro = scoreDe(lancamentos, { tetos: [{ categoria: "Alimentação", limite: 999999 }] });
    const fora = scoreDe(lancamentos, { tetos: [{ categoria: "Alimentação", limite: 1 }] });

    expect(dentro.componentes.find((c) => c.chave === "teto").aplicavel).toBe(true);
    expect(dentro.score).toBe(100);
    expect(fora.score).toBeLessThan(100);
  });

  it("teto sem limite válido é ignorado", () => {
    const r = scoreDe(mesCom(30), { tetos: [{ categoria: "Alimentação", limite: 0 }] });
    expect(r.componentes.find((c) => c.chave === "teto").aplicavel).toBe(false);
  });
});

describe("mês vazio", () => {
  it("é zero, não 'sem dados' — e não premia evitável zerado", () => {
    const r = scoreDe([l({ data_lancamento: "2026-05-01", valor: 500, poderia_ter_evitado: true })]);
    expect(r.score).toBe(0);
    expect(r.vazio).toBe(true);
    expect(r.badges).toEqual([]);
  });
});

describe("constância", () => {
  it("é proporcional aos dias com lançamento", () => {
    expect(scoreDe(mesCom(15)).componentes.find((c) => c.chave === "constancia").pontos)
      .toBe(Math.round(PONTOS.constancia * 0.5));
  });

  it("mais dias nunca reduz o score", () => {
    const s = [5, 10, 20, 30].map((d) => scoreDe(mesCom(d)).score);
    expect(s).toEqual([...s].sort((a, b) => a - b));
  });
});

describe("mês preenchido", () => {
  it("mês fechado cobra os 20 dias cheios", () => {
    expect(limiarPreenchido({ mesCorrente: false, diasNoMes: 30, diasConsiderados: 30 })).toBe(DIAS_MES_PREENCHIDO);
    expect(scoreDe(mesCom(19)).componentes.find((c) => c.chave === "mesPreenchido").pontos).toBe(0);
    expect(scoreDe(mesCom(20)).componentes.find((c) => c.chave === "mesPreenchido").pontos).toBe(PONTOS.mesPreenchido);
  });

  it("mês corrente cobra proporcional aos dias decorridos", () => {
    // Dia 15 de um mês de 31: meta vira ceil(20 * 15/31) = 10, não 20.
    expect(limiarPreenchido({ mesCorrente: true, diasNoMes: 31, diasConsiderados: 15 })).toBe(10);
  });

  it("no primeiro dia do mês a meta é 1, não zero", () => {
    expect(limiarPreenchido({ mesCorrente: true, diasNoMes: 30, diasConsiderados: 1 })).toBe(1);
  });
});

describe("gasto evitável", () => {
  const anterior = (valor) => l({ data_lancamento: "2026-05-05", valor, poderia_ter_evitado: true });

  it("pontua quando cai contra o mês anterior", () => {
    const r = scoreDe([...mesCom(5, [l({ data_lancamento: "2026-06-07", valor: 50, poderia_ter_evitado: true })]), anterior(300)]);
    expect(r.componentes.find((c) => c.chave === "evitavel").pontos).toBe(PONTOS.evitavel);
  });

  it("não pontua quando sobe", () => {
    const r = scoreDe([...mesCom(5, [l({ data_lancamento: "2026-06-07", valor: 500, poderia_ter_evitado: true })]), anterior(100)]);
    expect(r.componentes.find((c) => c.chave === "evitavel").pontos).toBe(0);
  });

  it("zerar o evitável pontua — não dá pra cair abaixo de zero", () => {
    const r = scoreDe([...mesCom(5), anterior(0)]);
    expect(r.componentes.find((c) => c.chave === "evitavel").pontos).toBe(PONTOS.evitavel);
  });

  it("sem mês anterior o componente é inaplicável, não zero perdido", () => {
    const r = scoreDe(mesCom(5));
    expect(r.componentes.find((c) => c.chave === "evitavel").aplicavel).toBe(false);
  });
});

describe("badges", () => {
  it("streak só aparece a partir de 3 dias seguidos", () => {
    expect(scoreDe(mesCom(2)).badges.some((b) => /seguidos/.test(b))).toBe(false);
    expect(scoreDe(mesCom(3)).badges.some((b) => /3 dias seguidos/.test(b))).toBe(true);
  });

  it("zerar o evitável ganha badge próprio", () => {
    const r = scoreDe([...mesCom(5), l({ data_lancamento: "2026-05-05", valor: 300, poderia_ter_evitado: true })]);
    expect(r.badges).toContain("Zerou o evitável");
  });

  it("mês impecável só com 100", () => {
    expect(scoreDe(mesCom(30)).badges).toContain("Mês impecável");
    expect(scoreDe(mesCom(3)).badges).not.toContain("Mês impecável");
  });
});

describe("faixa do score", () => {
  it("fica sempre entre 0 e 100", () => {
    for (const dias of [0, 1, 7, 19, 20, 30]) {
      const s = scoreDe(mesCom(dias)).score;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});
