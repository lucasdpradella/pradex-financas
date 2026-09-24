import { describe, it, expect } from "vitest";
import { acharCartaoNoTexto, normalizarFormaPagamento, prepararAcoes, textoEhPagamentoFatura } from "../supabase/functions/agente-pradex/forma.ts";

const cartoes = [
  { id: 1, nome: "Santander" },
  { id: 2, nome: "XP" },
];

describe("agente normaliza a forma antes de gravar", () => {
  it("crédito minúsculo vira Crédito", () => {
    const [acao] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "almoço", valor: 40, tipo: "gasto", categoria: "Alimentação", forma_pagamento: "crédito" } }],
      "almoço 40 no crédito",
      cartoes,
    );
    expect(acao.dados.forma_pagamento).toBe("Crédito");
    expect(acao.dados.abate_saldo).toBeUndefined();
    expect(normalizarFormaPagamento("débito")).toBe("Débito");
  });

  it("paguei a fatura não abate de novo e aponta o cartão", () => {
    expect(textoEhPagamentoFatura("paguei a fatura do cartão XP")).toBe(true);
    expect(textoEhPagamentoFatura("almoço no crédito")).toBe(false);

    const [acao] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "Fatura", valor: 1500, tipo: "gasto", categoria: "Outros", forma_pagamento: "crédito" } }],
      "paguei a fatura do cartão XP 1500",
      cartoes,
    );
    expect(acao.dados.categoria).toBe("Pagamento fatura");
    expect(acao.dados.abate_saldo).toBe(false);
    expect(acao.dados.forma_pagamento).toBe("Débito");
    expect(acao.dados.cartao_id).toBe(2);
    expect(acao.dados.parcelado).toBe(false);
  });

  it("mensagem com dois lançamentos não marca o mercado como pagamento", () => {
    const acoes = prepararAcoes(
      [
        { tipo: "criar", dados: { descricao: "paguei a fatura Santander", valor: 400, tipo: "gasto", categoria: "Outros", forma_pagamento: "pix" } },
        { tipo: "criar", dados: { descricao: "mercado", valor: 80, tipo: "gasto", categoria: "Alimentação", forma_pagamento: "débito" } },
      ],
      "paguei a fatura do Santander e gastei 80 no mercado",
      cartoes,
    );
    expect(acoes[0].dados.categoria).toBe("Pagamento fatura");
    expect(acoes[0].dados.cartao_id).toBe(1);
    expect(acoes[0].dados.forma_pagamento).toBe("PIX");
    expect(acoes[1].dados.categoria).toBe("Alimentação");
    expect(acoes[1].dados.abate_saldo).toBeUndefined();
    expect(acoes[1].dados.forma_pagamento).toBe("Débito");
  });

  it("no crédito XP e crédito AXP apontam o cartão XP", () => {
    const [xp] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "almoço", valor: 50, tipo: "gasto", categoria: "Alimentação", forma_pagamento: "Crédito", cartao_id: null } }],
      "gastei 50 no crédito XP",
      cartoes,
    );
    expect(xp.dados.forma_pagamento).toBe("Crédito");
    expect(xp.dados.cartao_id).toBe(2);

    const [axp] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "crédito AXP", valor: 20, tipo: "gasto", categoria: "Alimentação", forma_pagamento: "Crédito", cartao_id: null } }],
      "20 reais",
      cartoes,
    );
    expect(axp.dados.forma_pagamento).toBe("Crédito");
    expect(axp.dados.cartao_id).toBe(2);
    expect(acharCartaoNoTexto("crédito AXP", cartoes)?.id).toBe(2);
    expect(acharCartaoNoTexto("cartão XP", cartoes)?.id).toBe(2);
  });

  it("crédito sem nome não chuta cartão quando há mais de um", () => {
    const [acao] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "almoço cartão de crédito do hoje", valor: 650.88, tipo: "gasto", categoria: "Alimentação", forma_pagamento: "Crédito", cartao_id: null } }],
      "almoço cartão de crédito",
      cartoes,
    );
    expect(acao.dados.forma_pagamento).toBe("Crédito");
    expect(acao.dados.cartao_id ?? null).toBeNull();
  });

  it("crédito sem nome, com um cartão só, usa esse cartão", () => {
    const [acao] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "almoço", valor: 40, tipo: "gasto", categoria: "Alimentação", forma_pagamento: "Crédito", cartao_id: null } }],
      "almoço 40 no crédito",
      [{ id: 2, nome: "XP" }],
    );
    expect(acao.dados.forma_pagamento).toBe("Crédito");
    expect(acao.dados.cartao_id).toBe(2);
  });

  it("crédito na fala vira Crédito e acha o cartão, mesmo se o modelo gravar Débito", () => {
    const [acao] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "almoço", valor: 50, tipo: "gasto", categoria: "Alimentação", forma_pagamento: "Débito", cartao_id: null } }],
      "gastei 50 no almoço no crédito XP",
      cartoes,
    );
    expect(acao.dados.forma_pagamento).toBe("Crédito");
    expect(acao.dados.cartao_id).toBe(2);
    expect(acao.dados.categoria).toBe("Alimentação");
  });

  it("sem forma no modelo, 'no crédito' e 'cartão de crédito' gravam Crédito", () => {
    const [semNome] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "almoço", valor: 50, tipo: "gasto", categoria: "Alimentação" } }],
      "almoço 50 NO CRÉDITO",
      cartoes,
    );
    expect(semNome.dados.forma_pagamento).toBe("Crédito");
    expect(semNome.dados.cartao_id ?? null).toBeNull();

    const [comNome] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "farmácia", valor: 80, tipo: "gasto", categoria: "Saúde", forma_pagamento: null } }],
      "80 na farmácia no cartão de crédito",
      cartoes,
    );
    expect(comNome.dados.forma_pagamento).toBe("Crédito");
  });

  it("cartão XP sem a palavra crédito ainda é Crédito nesse cartão", () => {
    const [acao] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "almoço", valor: 50, tipo: "gasto", categoria: "Alimentação", forma_pagamento: "Débito" } }],
      "gastei 50 no almoço no cartão XP",
      cartoes,
    );
    expect(acao.dados.forma_pagamento).toBe("Crédito");
    expect(acao.dados.cartao_id).toBe(2);
    expect(normalizarFormaPagamento("cartão XP")).toBe("Crédito");
    expect(normalizarFormaPagamento("cartão de débito")).toBe("Débito");
  });

  it("débito explícito não vira crédito", () => {
    const [omitida] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "almoço", valor: 50, tipo: "gasto", categoria: "Alimentação" } }],
      "gastei 50 no débito",
      cartoes,
    );
    expect(omitida.dados.forma_pagamento).toBe("Débito");
    expect(omitida.dados.cartao_id ?? null).toBeNull();

    const [modeloDisseCredito] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "almoço", valor: 50, tipo: "gasto", categoria: "Alimentação", forma_pagamento: "crédito" } }],
      "gastei 50 no débito",
      cartoes,
    );
    expect(modeloDisseCredito.dados.forma_pagamento).toBe("Débito");
  });

  it("cartão de débito continua Débito e ainda aponta o cartão", () => {
    const [acao] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "almoço", valor: 50, tipo: "gasto", categoria: "Alimentação", forma_pagamento: null } }],
      "gastei 50 no cartão de débito XP",
      cartoes,
    );
    expect(acao.dados.forma_pagamento).toBe("Débito");
    expect(acao.dados.cartao_id).toBe(2);
  });

  it("se a fala cita crédito e débito, fica Crédito", () => {
    const [acao] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "almoço", valor: 50, tipo: "gasto", categoria: "Alimentação", forma_pagamento: "Débito" } }],
      "era no débito? não, 50 no crédito",
      cartoes,
    );
    expect(acao.dados.forma_pagamento).toBe("Crédito");
  });

  it("pix explícito não vira crédito só porque o nome do cartão apareceu", () => {
    const [acao] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "transferência", valor: 50, tipo: "gasto", categoria: "Outros", forma_pagamento: "Débito" } }],
      "mande 50 no pix pro Santander",
      cartoes,
    );
    expect(acao.dados.forma_pagamento).toBe("PIX");
    expect(acao.dados.cartao_id).toBe(1);
  });

  it("paguei a fatura do AXP continua pagamento, no cartão XP, nunca Crédito", () => {
    const [acao] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "fatura", valor: 1500, tipo: "gasto", categoria: "Outros", forma_pagamento: "pix" } }],
      "paguei a fatura do AXP",
      cartoes,
    );
    expect(acao.dados.categoria).toBe("Pagamento fatura");
    expect(acao.dados.forma_pagamento).toBe("PIX");
    expect(acao.dados.forma_pagamento).not.toBe("Crédito");
    expect(acao.dados.cartao_id).toBe(2);
    expect(acao.dados.abate_saldo).toBe(false);
  });

  it("paguei a fatura do XP continua pagamento, nunca Crédito", () => {
    const [acao] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "fatura", valor: 1500, tipo: "gasto", categoria: "Outros" } }],
      "paguei a fatura do XP",
      cartoes,
    );
    expect(acao.dados.categoria).toBe("Pagamento fatura");
    expect(acao.dados.forma_pagamento).toBe("Débito");
    expect(acao.dados.forma_pagamento).not.toBe("Crédito");
    expect(acao.dados.cartao_id).toBe(2);
    expect(acao.dados.abate_saldo).toBe(false);
  });

  it("com dois lançamentos, o crédito de um não vaza pro outro", () => {
    const acoes = prepararAcoes(
      [
        { tipo: "criar", dados: { descricao: "almoço no crédito XP", valor: 50, tipo: "gasto", categoria: "Alimentação" } },
        { tipo: "criar", dados: { descricao: "mercado", valor: 80, tipo: "gasto", categoria: "Alimentação", forma_pagamento: "débito" } },
      ],
      "gastei 50 no almoço no crédito XP e 80 no mercado no débito",
      cartoes,
    );
    expect(acoes[0].dados.forma_pagamento).toBe("Crédito");
    expect(acoes[0].dados.cartao_id).toBe(2);
    expect(acoes[1].dados.forma_pagamento).toBe("Débito");
    expect(acoes[1].dados.cartao_id ?? null).toBeNull();
  });

  it("receita e aporte de meta não viram compra no crédito", () => {
    const [receita] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "salário", valor: 5000, tipo: "receita", categoria: "Salário" } }],
      "recebi 5000, o crédito caiu na conta",
      cartoes,
    );
    expect(receita.dados.forma_pagamento).toBeNull();

    const [meta] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "aporte", valor: 100, tipo: "gasto", categoria: "Meta", forma_pagamento: "PIX", meta_id: 9, abate_saldo: false } }],
      "aportei 100 no crédito da meta",
      cartoes,
    );
    expect(meta.dados.forma_pagamento).toBe("PIX");
    expect(meta.dados.meta_id).toBe(9);
  });

  it("XP não casa dentro de outra palavra", () => {
    expect(acharCartaoNoTexto("gastei 50 na experiência", cartoes)).toBeNull();
    const [acao] = prepararAcoes(
      [{ tipo: "criar", dados: { descricao: "ingresso", valor: 50, tipo: "gasto", categoria: "Lazer", forma_pagamento: "Débito" } }],
      "gastei 50 na experiência",
      cartoes,
    );
    expect(acao.dados.forma_pagamento).toBe("Débito");
    expect(acao.dados.cartao_id ?? null).toBeNull();
  });
});
