import { describe, it, expect } from "vitest";
import { cicloQueContem, listarFaturas, rotuloFatura, dataReferenciaDoMes } from "../src/lib/faturas";
import { completarLancamento, ehCredito, normalizarFormaPagamento, parseValorConta, ehPagamentoFatura } from "../src/lib/formaPagamento";

const HOJE = new Date(2026, 8, 24); // 24/set/2026

describe("forma de pagamento", () => {
  it("normaliza crédito e débito sem acento e sem caixa", () => {
    expect(normalizarFormaPagamento("crédito")).toBe("Crédito");
    expect(normalizarFormaPagamento("CREDITO")).toBe("Crédito");
    expect(normalizarFormaPagamento("cartão")).toBe("Crédito");
    expect(normalizarFormaPagamento("débito")).toBe("Débito");
    expect(normalizarFormaPagamento("pix")).toBe("PIX");
    expect(normalizarFormaPagamento("PIX/Débito")).toBe("PIX/Débito");
    expect(normalizarFormaPagamento("Saldo da conta")).toBe("Saldo da conta");
    expect(normalizarFormaPagamento("")).toBeNull();
    expect(normalizarFormaPagamento(null)).toBeNull();
  });

  it("ehCredito reconhece o canônico e o minúsculo", () => {
    expect(ehCredito("crédito")).toBe(true);
    expect(ehCredito("Crédito")).toBe(true);
    expect(ehCredito("Débito")).toBe(false);
    expect(ehCredito("PIX")).toBe(false);
    expect(ehCredito(null)).toBe(false);
  });

  it("pagamento de fatura marca abate e sai do crédito", () => {
    const body = completarLancamento({
      descricao: "paguei a fatura do XP",
      valor: 1500,
      tipo: "gasto",
      categoria: "Outros",
      forma_pagamento: "crédito",
      cartao_id: 2,
    });
    expect(body.categoria).toBe("Pagamento fatura");
    expect(body.abate_saldo).toBe(false);
    expect(body.forma_pagamento).toBe("Débito");
    expect(ehPagamentoFatura(body)).toBe(true);
  });

  it("compra no crédito não vira pagamento", () => {
    const body = completarLancamento({
      descricao: "almoço",
      categoria: "Alimentação",
      forma_pagamento: "crédito",
      tipo: "gasto",
    });
    expect(body.categoria).toBe("Alimentação");
    expect(body.forma_pagamento).toBe("Crédito");
    expect(body.abate_saldo).toBeUndefined();
  });

  it("parseValorConta lê milhar brasileiro", () => {
    expect(parseValorConta("2.180")).toBe(2180);
    expect(parseValorConta("2.180,50")).toBe(2180.5);
    expect(parseValorConta("3600")).toBe(3600);
    expect(parseValorConta("")).toBeNull();
    expect(parseValorConta("abc")).toBeNull();
  });
});

describe("ciclo da fatura", () => {
  it("compra depois do fechamento cai na fatura do mês seguinte", () => {
    const c = cicloQueContem("2026-09-20", 5, 10);
    expect(c.inicio).toBe("2026-09-06");
    expect(c.fim).toBe("2026-10-05");
    expect(c.mesVenc).toBe(9);
    expect(c.atePagamento).toBe("2026-10-10");
  });

  it("vencimento antes do fechamento empurra o rótulo um mês", () => {
    const c = cicloQueContem("2026-09-20", 25, 5);
    expect(c.fim).toBe("2026-09-25");
    expect(c.mesVenc).toBe(9);
    expect(c.atePagamento).toBe("2026-10-05");
  });

  it("sem dia de fechamento, a fatura é o mês calendário", () => {
    const c = cicloQueContem("2026-09-20", null, null);
    expect(c.inicio).toBe("2026-09-01");
    expect(c.fim).toBe("2026-09-30");
    expect(c.mesVenc).toBe(8);
  });
});

describe("listarFaturas", () => {
  const cartoes = [
    { id: 2, nome: "XP", dia_fechamento: 5, dia_vencimento: 10 },
    { id: 1, nome: "Santander", dia_fechamento: 5, dia_vencimento: 12 },
  ];
  const lancamentos = [
    { id: 1, tipo: "gasto", valor: 4820, forma_pagamento: "crédito", cartao_id: 2, data_lancamento: "2026-09-18", meta_id: null },
    { id: 2, tipo: "gasto", valor: 1150, forma_pagamento: "Crédito", cartao_id: 1, data_lancamento: "2026-09-19", meta_id: null },
    { id: 3, tipo: "gasto", valor: 300, forma_pagamento: "Débito", cartao_id: null, data_lancamento: "2026-09-10", meta_id: null },
  ];

  it("rótulo no formato Fatura {mês} · Cartão {nome}", () => {
    expect(rotuloFatura(9, "XP")).toBe("Fatura outubro · Cartão XP");
    expect(rotuloFatura(9, "Cartão Santander")).toBe("Fatura outubro · Cartão Santander");
  });

  it("setembro com fechamento no dia 5 mostra a fatura de outubro", () => {
    const linhas = listarFaturas(lancamentos, cartoes, 2026, 8, { hoje: HOJE });
    expect(linhas.map((l) => l.label)).toEqual([
      "Fatura outubro · Cartão XP",
      "Fatura outubro · Cartão Santander",
    ]);
    expect(linhas[0].valor).toBe(4820);
    expect(linhas[0].vencimento).toBe("vence dia 10");
    expect(linhas[1].vencimento).toBe("vence dia 12");
  });

  it("pagamento zera a fatura e não precisa de forma Crédito", () => {
    const comPagamento = [
      ...lancamentos,
      {
        id: 4, tipo: "gasto", valor: 4820, forma_pagamento: "PIX", cartao_id: 2,
        data_lancamento: "2026-10-08", categoria: "Pagamento fatura", abate_saldo: false, meta_id: null,
      },
    ];
    const linhas = listarFaturas(comPagamento, cartoes, 2026, 8, { hoje: HOJE });
    const xp = linhas.find((l) => l.cartaoId === 2);
    expect(xp.valor).toBe(0);
    expect(xp.pago).toBe(4820);
  });

  it("a referência do mês corrente é hoje", () => {
    expect(dataReferenciaDoMes(2026, 8, HOJE)).toBe("2026-09-24");
    expect(dataReferenciaDoMes(2026, 7, HOJE)).toBe("2026-08-15");
  });
});
