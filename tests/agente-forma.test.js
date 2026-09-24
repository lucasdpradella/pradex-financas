import { describe, it, expect } from "vitest";
import { normalizarFormaPagamento, prepararAcoes, textoEhPagamentoFatura } from "../supabase/functions/agente-pradex/forma.ts";

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
});
