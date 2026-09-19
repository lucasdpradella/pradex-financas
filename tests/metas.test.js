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
  DIFICULDADES,
  DIFICULDADE_PADRAO,
  dificuldadeDe,
  MARCOS,
  pontosDoMarco,
  marcosAlcancados,
  mensagemDoMarco,
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
    expect(montarLancamentoAporte({ ...base, forma: "PIX/Débito" }).lancamento.forma_pagamento).toBe("PIX/Débito");
  });

  // "Saldo da conta" é o caso mais comum — mover dinheiro pra caixinha do próprio
  // banco não é PIX nem débito, e antes de 19/09 quem fazia isso não achava a
  // própria resposta na lista.
  it("as três opções de origem são as que a tela mostra", () => {
    expect(FORMAS_APORTE).toEqual(["Saldo da conta", "PIX/Débito", "Dinheiro"]);
    for (const f of FORMAS_APORTE) {
      expect(montarLancamentoAporte({ ...base, forma: f }).lancamento.forma_pagamento).toBe(f);
    }
  });

  // Vale pra qualquer texto que não esteja na lista, inclusive o enunciado da própria
  // pergunta — que era exatamente o que o select mandava quando ninguém escolhia nada.
  it("texto fora da lista não vira forma de pagamento", () => {
    expect(montarLancamentoAporte({ ...base, forma: "De onde saiu (opcional)" }).lancamento.forma_pagamento).toBeNull();
    expect(montarLancamentoAporte({ ...base, forma: "" }).lancamento.forma_pagamento).toBeNull();
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

// ============================================================================
// abate_saldo — o aporte que NÃO mexe no mês (18/09)
// ============================================================================
// Pedido do Lucas: "deixa a opção dele abater ou não do saldo". O caso que motivou é
// a estreia: quem cria "Viagem — R$ 5.000" já tendo R$ 2.000 juntados não pode ver o
// mês nascer com R$ 2.000 negativos por um dinheiro que saiu da conta meses atrás.
describe("aporte que não abate do saldo", () => {
  it("enche a caixinha igual: o acumulado conta os dois", () => {
    const ls = [
      lanc({ meta_id: 7, valor: 2000, abate_saldo: false }),  // já estava guardado
      lanc({ meta_id: 7, valor: 300 }),                        // saiu da conta agora
    ];
    expect(acumuladoDaMeta(ls, 7)).toBe(2300);
  });

  it("fica fora do saldo, do guardado e do gasto do mês", () => {
    const ls = [
      lanc({ tipo: "receita", valor: 1000, data_lancamento: "2026-09-01" }),
      lanc({ meta_id: 7, valor: 2000, data_lancamento: "2026-09-02", abate_saldo: false }),
    ];
    const f = calcularFechamento(ls, 2026, 8, { hoje: new Date("2026-09-30T12:00:00") });
    expect(f.guardado).toBe(0);
    expect(f.gastoTotal).toBe(0);
    expect(f.saldo).toBe(1000);   // e não -1000
  });

  it("resgate que não passou pela conta também não entra no saldo", () => {
    const ls = [
      lanc({ tipo: "receita", valor: 1000, data_lancamento: "2026-09-01" }),
      lanc({ tipo: "receita", valor: 500, data_lancamento: "2026-09-03", meta_id: 7, abate_saldo: false }),
    ];
    const f = calcularFechamento(ls, 2026, 8, { hoje: new Date("2026-09-30T12:00:00") });
    expect(f.resgatado).toBe(0);
    expect(f.saldo).toBe(1000);
  });

  // A coluna nasceu em 18/09: tudo que veio antes chega sem o campo, e ausente
  // precisa significar "abate" — senão um dia de lançamentos antigos sumiria do saldo.
  it("campo ausente é tratado como abate (compatibilidade)", () => {
    const ls = [lanc({ meta_id: 7, valor: 300, data_lancamento: "2026-09-02" })];
    const f = calcularFechamento(ls, 2026, 8, { hoje: new Date("2026-09-30T12:00:00") });
    expect(f.guardado).toBe(300);
    expect(f.saldo).toBe(-300);
  });

  it("não pontua o score: premiaria o cadastro em vez do hábito", () => {
    expect(guardouNoMes([lanc({ valor: 2000, meta_id: 7, abate_saldo: false })])).toBe(false);
    expect(guardouNoMes([lanc({ valor: 20, meta_id: 7 })])).toBe(true);
  });

  it("montarLancamentoAporte marca a coluna e dispensa a forma de pagamento", () => {
    const { lancamento } = montarLancamentoAporte({
      meta, valor: 2000, data: "2026-09-18", userId: "u1", abateSaldo: false, forma: "PIX/Débito",
    });
    expect(lancamento.abate_saldo).toBe(false);
    // Dizer "PIX" afirmaria um PIX de hoje que não aconteceu.
    expect(lancamento.forma_pagamento).toBe(null);
    expect(lancamento.descricao).toContain("já estava guardado");
  });

  it("o padrão continua sendo abater — guardar = aplicar = debitar", () => {
    const { lancamento } = montarLancamentoAporte({ meta, valor: 300, data: "2026-09-18", userId: "u1" });
    expect(lancamento.abate_saldo).toBe(true);
    expect(lancamento.descricao).toBe("Guardei — Viagem");
  });
});

// ============================================================================
// Dificuldade, marcos e pontos (19/09)
// ============================================================================
// O problema, nas palavras do Lucas: "coloquei uma meta de casamento, 100 mil. Até
// juntar 100 mil o cara nunca será recompensado por ter chegado?"
describe("dificuldade declarada", () => {
  it("as três opções existem com peso crescente", () => {
    expect(DIFICULDADES.map((d) => d.chave)).toEqual(["facil", "moderada", "dificil"]);
    expect(DIFICULDADES.map((d) => d.peso)).toEqual([4, 7, 10]);
  });

  it("a razão é 1 : 1,75 : 2,5", () => {
    const [f, m, d] = DIFICULDADES;
    expect(d.peso / f.peso).toBe(2.5);
    expect(m.peso / f.peso).toBe(1.75);
  });

  // A ÂNCORA DO LUCAS (19/09), literal: "quem chega a 100% da fácil equivale a 40%
  // da difícil". É ela que fixa a razão em 2,5 — a primeira versão usava 2, e com ela
  // a fácil inteira valia 50% da difícil, generoso demais no julgamento dele.
  //
  // Este teste é a régua: mexeu em peso e ele quebrou, a régua mudou junto.
  it("100% da fácil = 40% da difícil", () => {
    const facilInteira = MARCOS.reduce((s, m) => s + pontosDoMarco(m, "facil"), 0);
    const dificilInteira = MARCOS.reduce((s, m) => s + pontosDoMarco(m, "dificil"), 0);
    expect(facilInteira).toBe(400);
    expect(dificilInteira).toBe(1000);
    expect(facilInteira / dificilInteira).toBe(0.4);
  });

  // A frase é o mecanismo que faz a declaração sair honesta: ela descreve o mês da
  // pessoa, não o prêmio.
  it("toda opção tem a frase que ancora na vida de quem escolhe", () => {
    for (const d of DIFICULDADES) expect(d.frase.length).toBeGreaterThan(10);
  });

  it("meta sem dificuldade cai no padrão, não em undefined", () => {
    expect(dificuldadeDe({}).chave).toBe(DIFICULDADE_PADRAO);
    expect(dificuldadeDe(null).chave).toBe(DIFICULDADE_PADRAO);
    expect(dificuldadeDe({ dificuldade: "impossivel" }).chave).toBe(DIFICULDADE_PADRAO);
  });
});

describe("marcos e pontos", () => {
  // O 10 existe por causa da meta grande: em R$ 100.000, o 25% ainda é R$ 25.000.
  it("os sete marcos, com o 1 sendo 'começou'", () => {
    expect(MARCOS).toEqual([1, 10, 25, 50, 75, 90, 100]);
  });

  // A propriedade que define a conta: pontos são o INCREMENTO de cada marco, então a
  // soma dos sete fecha exatamente 100 × peso — e não 351 × peso.
  it("a soma de todos os marcos é 100 × peso", () => {
    for (const d of DIFICULDADES) {
      const total = MARCOS.reduce((s, m) => s + pontosDoMarco(m, d.chave), 0);
      expect(total).toBe(100 * d.peso);
    }
  });

  // É o que faz o ranking não ser em reais: quem junta pouco numa difícil passa na
  // frente de quem junta muito numa fácil. Com a régua de 19/09, a difícil já passa
  // a fácil inteira no marco dos 50% — antes só empatava lá.
  it("uma difícil na metade já vale mais que uma fácil inteira", () => {
    const dificilAteMetade = [1, 10, 25, 50].reduce((s, m) => s + pontosDoMarco(m, "dificil"), 0);
    const facilInteira = MARCOS.reduce((s, m) => s + pontosDoMarco(m, "facil"), 0);
    expect(dificilAteMetade).toBe(500);
    expect(dificilAteMetade).toBeGreaterThan(facilInteira);
  });

  // O marco 1 pergunta "entrou dinheiro?", não "chegou a 1%": R$ 10 numa meta de
  // R$ 100.000 é 0,01% e ainda assim é o dia em que a pessoa começou.
  it("o primeiro aporte conta mesmo sendo 0,01% da meta", () => {
    expect(marcosAlcancados(0.0001, 10)).toEqual([1]);
    expect(marcosAlcancados(0, 0)).toEqual([]);
  });

  it("progresso alcança todos os marcos abaixo dele", () => {
    expect(marcosAlcancados(0.5, 500)).toEqual([1, 10, 25, 50]);
    expect(marcosAlcancados(1, 1000)).toEqual([1, 10, 25, 50, 75, 90, 100]);
    expect(marcosAlcancados(1.4, 1400)).toEqual([1, 10, 25, 50, 75, 90, 100]);
  });
});

describe("mensagem do marco", () => {
  it("todo marco tem título e frase", () => {
    for (const m of MARCOS) {
      const { titulo, frase } = mensagemDoMarco(m, meta);
      // O piso é 3 porque os títulos mais curtos são "75%" e "90%" — cabe assim.
      expect(titulo.length).toBeGreaterThanOrEqual(3);
      expect(frase.length).toBeGreaterThan(10);
    }
  });

  // A dificuldade é a única coisa que o app sabe sobre o esforço — é ela que faz a
  // frase reconhecer o que a conquista custou.
  it("a meta difícil recebe frase diferente da fácil", () => {
    const facil = mensagemDoMarco(50, { ...meta, dificuldade: "facil" }).frase;
    const dificil = mensagemDoMarco(50, { ...meta, dificuldade: "dificil" }).frase;
    expect(dificil).not.toBe(facil);
    expect(dificil).toContain("doer");
  });

  it("o 100 usa o nome da meta e não promete nada", () => {
    expect(mensagemDoMarco(100, meta).titulo).toBe("Meta batida");
    expect(mensagemDoMarco(100, meta).frase).toContain(meta.nome);
  });
});
