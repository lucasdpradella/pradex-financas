import { describe, it, expect } from "vitest";
import {
  acumuladoDaMeta,
  comProgresso,
  metasAtivas,
  limiteDeMetas,
  montarLancamentoAporte,
  guardouNoMes,
  semAportes,
  ehAporte,
  CATEGORIA_META,
  FORMAS_APORTE,
  LIMITE_FREE,
} from "../src/lib/metas";
import { calcularFechamento } from "../src/lib/fechamento";
import { calcularDisciplina } from "../src/lib/disciplina";

const meta = { id: 7, nome: "Viagem", valor_alvo: 1000 };
const lanc = (over = {}) => ({ tipo: "gasto", valor: 100, data_lancamento: "2026-09-10", meta_id: null, ...over });

describe("acumuladoDaMeta", () => {
  it("soma o que guardou e desconta o que resgatou", () => {
    const ls = [
      lanc({ meta_id: 7, valor: 400 }),
      lanc({ meta_id: 7, valor: 300 }),
      lanc({ meta_id: 7, valor: 100, tipo: "receita" }),  // resgate
    ];
    expect(acumuladoDaMeta(ls, 7)).toBe(600);
  });

  it("ignora lançamento de outra meta e de consumo", () => {
    const ls = [lanc({ meta_id: 7, valor: 200 }), lanc({ meta_id: 9, valor: 500 }), lanc({ valor: 900 })];
    expect(acumuladoDaMeta(ls, 7)).toBe(200);
  });

  // O id vem do banco como number e da tela às vezes como string.
  it("compara id sem se importar com o tipo", () => {
    expect(acumuladoDaMeta([lanc({ meta_id: "7", valor: 50 })], 7)).toBe(50);
  });

  it("sem meta ou sem lançamento é zero", () => {
    expect(acumuladoDaMeta([], 7)).toBe(0);
    expect(acumuladoDaMeta(null, 7)).toBe(0);
    expect(acumuladoDaMeta([lanc({ meta_id: 7 })], null)).toBe(0);
  });
});

describe("comProgresso", () => {
  it("calcula progresso, falta e conclusão", () => {
    const m = comProgresso(meta, [lanc({ meta_id: 7, valor: 250 })]);
    expect(m.acumulado).toBe(250);
    expect(m.falta).toBe(750);
    expect(m.progresso).toBeCloseTo(0.25);
    expect(m.concluida).toBe(false);
  });

  // A barra para em 100%, mas o valor guardado continua cru: quem passou do alvo
  // merece ver o quanto passou.
  it("a barra trava em 100% sem esconder o excedente", () => {
    const m = comProgresso(meta, [lanc({ meta_id: 7, valor: 1500 })]);
    expect(m.progresso).toBe(1);
    expect(m.acumulado).toBe(1500);
    expect(m.falta).toBe(0);
    expect(m.concluida).toBe(true);
  });

  // O troféu vem do banco (trigger) e não se desfaz: resgatar depois de bater a meta
  // não devolve o troféu, senão o ranking viraria placar piscando.
  it("concluida_em do banco manda, mesmo depois de resgate", () => {
    const batida = { ...meta, concluida_em: "2026-09-15T10:00:00Z" };
    const m = comProgresso(batida, [
      lanc({ meta_id: 7, valor: 1000 }),
      lanc({ meta_id: 7, valor: 900, tipo: "receita" }),
    ]);
    expect(m.acumulado).toBe(100);
    expect(m.concluida).toBe(true);
  });

  it("alvo zero ou ausente não explode em divisão", () => {
    const m = comProgresso({ id: 1, nome: "x", valor_alvo: 0 }, []);
    expect(m.progresso).toBe(0);
    expect(m.concluida).toBe(false);
  });
});

describe("limiteDeMetas", () => {
  it("Free cria a primeira e para na segunda", () => {
    expect(limiteDeMetas("none", [])).toBeNull();
    expect(limiteDeMetas("none", [meta])).not.toBeNull();
  });

  it("quem paga não tem limite", () => {
    const muitas = [1, 2, 3, 4, 5].map((id) => ({ ...meta, id }));
    expect(limiteDeMetas("essencial", muitas, { temAcessoPago: true })).toBeNull();
  });

  // Arquivar é o jeito de liberar vaga sem apagar histórico.
  it("arquivada não ocupa vaga", () => {
    expect(limiteDeMetas("none", [{ ...meta, arquivada: true }])).toBeNull();
    expect(metasAtivas([meta, { ...meta, id: 2, arquivada: true }])).toHaveLength(1);
  });

  it("o bloqueio diz quantas existem e qual é o limite", () => {
    const r = limiteDeMetas("none", [meta]);
    expect(r.ativas).toBe(1);
    expect(r.limite).toBe(LIMITE_FREE);
  });
});

describe("montarLancamentoAporte", () => {
  const base = { meta, valor: 250, data: "2026-09-16", userId: "u1" };

  it("guardar é gasto com meta_id, na categoria reservada", () => {
    const { lancamento } = montarLancamentoAporte(base);
    expect(lancamento.tipo).toBe("gasto");
    expect(lancamento.meta_id).toBe(7);
    expect(lancamento.categoria).toBe(CATEGORIA_META);
    expect(lancamento.valor).toBe(250);
  });

  it("resgatar é receita com o mesmo meta_id", () => {
    const { lancamento } = montarLancamentoAporte({ ...base, resgate: true });
    expect(lancamento.tipo).toBe("receita");
    expect(lancamento.meta_id).toBe(7);
  });

  // Guardar dinheiro é o oposto do que `poderia_ter_evitado` mede.
  it("aporte nunca é gasto evitável", () => {
    expect(montarLancamentoAporte(base).lancamento.poderia_ter_evitado).toBe(false);
  });

  // Guardar no crédito geraria fatura e dívida fingindo de poupança.
  it("Crédito não é forma de aporte", () => {
    expect(FORMAS_APORTE).not.toContain("Crédito");
    expect(montarLancamentoAporte({ ...base, forma: "Crédito" }).lancamento.forma_pagamento).toBeNull();
    expect(montarLancamentoAporte({ ...base, forma: "PIX" }).lancamento.forma_pagamento).toBe("PIX");
  });

  it("valor inválido vira erro, não lançamento", () => {
    for (const v of [0, -10, "abc", null, undefined]) {
      expect(montarLancamentoAporte({ ...base, valor: v }).erro).toBeTruthy();
    }
    expect(montarLancamentoAporte({ ...base, meta: null }).erro).toBeTruthy();
  });

  it("arredonda pra centavo", () => {
    expect(montarLancamentoAporte({ ...base, valor: 10.999 }).lancamento.valor).toBe(11);
  });
});

// ===== A regra que atravessa o app: guardar debita, mas não é consumo =====
describe("fechamento separa consumo de poupança", () => {
  const ls = [
    lanc({ tipo: "receita", valor: 3000, data_lancamento: "2026-09-01" }),
    lanc({ valor: 800, data_lancamento: "2026-09-05" }),                      // consumo
    lanc({ valor: 500, data_lancamento: "2026-09-10", meta_id: 7 }),          // guardou
  ];
  const f = calcularFechamento(ls, 2026, 8, { hoje: new Date("2026-09-30T12:00:00") });

  it("o aporte SAI do saldo — guardar = debitar da conta", () => {
    expect(f.saldo).toBe(3000 - 800 - 500);
  });

  it("mas NÃO conta como gasto: quem guarda não pode parecer gastão", () => {
    expect(f.gastoTotal).toBe(800);
    expect(f.guardado).toBe(500);
  });

  it("e não polui o relatório por categoria", () => {
    expect(f.categorias.some((c) => c.cat === CATEGORIA_META)).toBe(false);
  });

  it("resgate volta pro saldo sem virar renda", () => {
    const comResgate = calcularFechamento(
      [...ls, lanc({ tipo: "receita", valor: 200, data_lancamento: "2026-09-20", meta_id: 7 })],
      2026, 8, { hoje: new Date("2026-09-30T12:00:00") },
    );
    expect(comResgate.receitas).toBe(3000);
    expect(comResgate.resgatado).toBe(200);
    expect(comResgate.saldo).toBe(3000 + 200 - 800 - 500);
  });

  it("semAportes / ehAporte separam o que a tela precisa", () => {
    expect(semAportes(ls)).toHaveLength(2);
    expect(ehAporte(ls[2])).toBe(true);
  });
});

describe("guardouNoMes e o componente do score", () => {
  it("é binário: R$ 5 vale o mesmo que R$ 5.000", () => {
    expect(guardouNoMes([lanc({ valor: 5, meta_id: 7 })])).toBe(true);
    expect(guardouNoMes([lanc({ valor: 5000, meta_id: 7 })])).toBe(true);
  });

  it("resgate não conta como ter guardado", () => {
    expect(guardouNoMes([lanc({ valor: 500, meta_id: 7, tipo: "receita" })])).toBe(false);
  });

  it("mês sem aporte é false", () => {
    expect(guardouNoMes([lanc({ valor: 900 })])).toBe(false);
    expect(guardouNoMes([])).toBe(false);
  });

  // Mesmo tratamento do teto: quem não tem caixinha sai do numerador E do
  // denominador, e não é rebaixado por uma feature que não usa.
  it("sem meta, o componente é inaplicável e não derruba o score", () => {
    const ls = [lanc({ tipo: "receita", valor: 1000, data_lancamento: "2026-09-01" }), lanc({ valor: 100, data_lancamento: "2026-09-02" })];
    const f = calcularFechamento(ls, 2026, 8, { hoje: new Date("2026-09-30T12:00:00") });

    const semMetas = calcularDisciplina(f, { metas: [] });
    const comp = semMetas.componentes.find((c) => c.chave === "guardou");
    expect(comp.aplicavel).toBe(false);

    // Criar a caixinha e não alimentar DERRUBA o score — é o ponto do componente.
    const comMeta = calcularDisciplina(f, { metas: [meta] });
    expect(comMeta.componentes.find((c) => c.chave === "guardou").aplicavel).toBe(true);
    expect(comMeta.score).toBeLessThan(semMetas.score);
  });

  it("guardar no mês pontua o componente cheio", () => {
    const ls = [
      lanc({ tipo: "receita", valor: 1000, data_lancamento: "2026-09-01" }),
      lanc({ valor: 200, data_lancamento: "2026-09-02", meta_id: 7 }),
    ];
    const f = calcularFechamento(ls, 2026, 8, { hoje: new Date("2026-09-30T12:00:00") });
    const d = calcularDisciplina(f, { metas: [meta] });
    const comp = d.componentes.find((c) => c.chave === "guardou");
    expect(comp.pontos).toBe(comp.max);
  });
});
