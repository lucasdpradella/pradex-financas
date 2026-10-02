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

describe("fluxo da home", () => {
  it("Entrou, Saiu e Diferença seguem o caixa do mês", () => {
    const dados = [
      l({ data_lancamento: "2026-09-01", tipo: "receita", valor: 40000, categoria: "Salário" }),
      l({ data_lancamento: "2026-09-04", valor: 15000, forma_pagamento: "Débito" }),
      l({ data_lancamento: "2026-09-08", valor: 20000, forma_pagamento: "Crédito" }),
    ];
    const f = calcularFechamento(dados, 2026, 8, { hoje: new Date(2026, 8, 24) });
    expect(f.entrou).toBe(40000);
    expect(f.saiu).toBe(35000);
    expect(f.diferenca).toBe(5000);
  });

  it("crédito minúsculo conta como cartão, não como débito", () => {
    const dados = [
      l({ data_lancamento: "2026-09-03", valor: 80, forma_pagamento: "crédito" }),
      l({ data_lancamento: "2026-09-04", valor: 20, forma_pagamento: "DÉBITO" }),
    ];
    const f = calcularFechamento(dados, 2026, 8, { hoje: new Date(2026, 8, 24) });
    expect(f.cartao).toBe(80);
    expect(f.debito).toBe(20);
    expect(f.saiu).toBe(100);
  });

  it("pagamento de fatura não entra de novo no Saiu", () => {
    const dados = [
      l({ data_lancamento: "2026-09-02", tipo: "receita", valor: 5000 }),
      l({ data_lancamento: "2026-09-05", valor: 800, forma_pagamento: "Crédito", cartao_id: 2 }),
      l({
        data_lancamento: "2026-09-20",
        valor: 800,
        forma_pagamento: "PIX",
        categoria: "Pagamento fatura",
        abate_saldo: false,
        cartao_id: 2,
        descricao: "paguei a fatura",
      }),
    ];
    const f = calcularFechamento(dados, 2026, 8, { hoje: new Date(2026, 8, 24) });
    expect(f.saiu).toBe(800);
    expect(f.cartao).toBe(800);
    expect(f.debito).toBe(0);
    expect(f.pagamentoFatura).toBe(800);
    expect(f.diferenca).toBe(4200);
    expect(f.saldo).toBe(4200);
  });

  it("Guardou não mistura no Saiu", () => {
    const dados = [
      l({ data_lancamento: "2026-09-01", tipo: "receita", valor: 3000 }),
      l({ data_lancamento: "2026-09-05", valor: 400 }),
      l({ data_lancamento: "2026-09-10", valor: 500, meta_id: 7 }),
    ];
    const f = calcularFechamento(dados, 2026, 8, { hoje: new Date(2026, 8, 24) });
    expect(f.saiu).toBe(400);
    expect(f.guardado).toBe(500);
    expect(f.diferenca).toBe(2600);
    expect(f.saldo).toBe(2100);
  });

  it("resgate entra no Entrou e não nas receitas", () => {
    const dados = [
      l({ data_lancamento: "2026-09-01", tipo: "receita", valor: 1000 }),
      l({ data_lancamento: "2026-09-12", tipo: "receita", valor: 200, meta_id: 7 }),
    ];
    const f = calcularFechamento(dados, 2026, 8, { hoje: new Date(2026, 8, 24) });
    expect(f.receitas).toBe(1000);
    expect(f.resgatado).toBe(200);
    expect(f.entrou).toBe(1200);
  });
});

describe("home do mês: fatura do cartão, débito e receitas (data da compra)", () => {
  const HOJE_OUT = new Date(2026, 9, 1);
  const out = (over) => l({ data_lancamento: "2026-10-10", ...over });

  it("compra no crédito entra na fatura do cartão dela, com valor cheio", () => {
    const dados = [
      out({ valor: 300, forma_pagamento: "Crédito", cartao_id: 1 }),
      out({ valor: 200, forma_pagamento: "Crédito", cartao_id: 2 }),
      out({ valor: 50, forma_pagamento: "Crédito", cartao_id: 1 }),
    ];
    const f = calcularFechamento(dados, 2026, 9, { hoje: HOJE_OUT });
    expect(f.cartao).toBe(550);
    expect(f.debito).toBe(0);
    expect(f.cartaoPorCartao).toEqual([
      { cartaoId: "1", total: 350 },
      { cartaoId: "2", total: 200 },
    ]);
  });

  it("PIX de Pagamento fatura não conta em lugar nenhum (nem débito, nem fatura, nem receita)", () => {
    const dados = [
      out({ valor: 800, forma_pagamento: "Crédito", cartao_id: 2 }),
      out({
        data_lancamento: "2026-10-20",
        valor: 800,
        forma_pagamento: "PIX",
        categoria: "Pagamento fatura",
        abate_saldo: false,
        cartao_id: 2,
        descricao: "paguei a fatura",
      }),
    ];
    const f = calcularFechamento(dados, 2026, 9, { hoje: HOJE_OUT });
    expect(f.debito).toBe(0);
    expect(f.cartao).toBe(800); // valor cheio, sem descontar o pagamento
    expect(f.cartaoPorCartao).toEqual([{ cartaoId: "2", total: 800 }]);
    expect(f.receitas).toBe(0);
    expect(f.gastoTotal).toBe(800);
    expect(f.categorias.map((c) => c.cat)).not.toContain("Pagamento fatura");
    expect(f.pagamentoFatura).toBe(800);
  });

  it("parcela futura cai no mês dela, não no mês da compra", () => {
    const dados = [
      out({ valor: 100, forma_pagamento: "Crédito", cartao_id: 1, parcela_atual: 1, total_parcelas: 3 }),
      l({ data_lancamento: "2026-11-10", valor: 100, forma_pagamento: "Crédito", cartao_id: 1, parcela_atual: 2, total_parcelas: 3 }),
      l({ data_lancamento: "2026-12-10", valor: 100, forma_pagamento: "Crédito", cartao_id: 1, parcela_atual: 3, total_parcelas: 3 }),
    ];
    const outubro = calcularFechamento(dados, 2026, 9, { hoje: HOJE_OUT });
    const novembro = calcularFechamento(dados, 2026, 10, { hoje: HOJE_OUT });
    expect(outubro.cartao).toBe(100);
    expect(outubro.cartaoPorCartao).toEqual([{ cartaoId: "1", total: 100 }]);
    expect(novembro.cartao).toBe(100);
  });

  it("'crédito' minúsculo vai pra fatura; PIX, dinheiro e sem forma vão pro débito", () => {
    const dados = [
      out({ valor: 70, forma_pagamento: "crédito", cartao_id: 3 }),
      out({ valor: 10, forma_pagamento: "PIX" }),
      out({ valor: 20, forma_pagamento: "Dinheiro" }),
      out({ valor: 30, forma_pagamento: null }),
      out({ valor: 40, forma_pagamento: "débito" }),
    ];
    const f = calcularFechamento(dados, 2026, 9, { hoje: HOJE_OUT });
    expect(f.cartao).toBe(70);
    expect(f.cartaoPorCartao).toEqual([{ cartaoId: "3", total: 70 }]);
    expect(f.debito).toBe(100);
  });

  it("aporte de meta fica fora do débito e resgate fica fora das receitas", () => {
    const dados = [
      out({ tipo: "receita", valor: 9000, categoria: "Salário" }),
      out({ valor: 500, meta_id: 7, forma_pagamento: "PIX" }),
      out({ tipo: "receita", valor: 200, meta_id: 7 }),
      out({ valor: 40, forma_pagamento: "PIX" }),
    ];
    const f = calcularFechamento(dados, 2026, 9, { hoje: HOJE_OUT });
    expect(f.debito).toBe(40);
    expect(f.receitas).toBe(9000);
    expect(f.cartaoPorCartao).toEqual([]);
  });

  it("crédito sem cartão vira a linha sem cartão", () => {
    const f = calcularFechamento([out({ valor: 15, forma_pagamento: "Crédito", cartao_id: null })], 2026, 9, { hoje: HOJE_OUT });
    expect(f.cartaoPorCartao).toEqual([{ cartaoId: null, total: 15 }]);
  });
});
