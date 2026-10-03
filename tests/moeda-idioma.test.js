import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatMoney, simboloMoeda, iniciaisDe } from "../src/lib/moeda";
import { t } from "../src/lib/i18n";
import { rotuloFatura, listarFaturas } from "../src/lib/faturas";
import HomeResumo from "../src/components/HomeResumo";
import { blocoMoedaIdioma, formatarValorAgente } from "../supabase/functions/agente-pradex/livro.ts";
import { aplicarComando, detectarComando } from "../supabase/functions/agente-pradex/tom.ts";

describe("formatMoney", () => {
  it("formata BRL, USD e DKK sem converter o número", () => {
    expect(formatMoney(40, "BRL")).toMatch(/R\$\s?40,00/);
    expect(formatMoney(40, "USD")).toMatch(/\$40\.00/);
    expect(formatMoney(40, "DKK").toLowerCase()).toContain("kr");
    expect(formatMoney(40, "DKK")).toMatch(/40/);
    expect(simboloMoeda("DKK")).toBe("kr");
  });

  it("moeda desconhecida cai em BRL", () => {
    expect(formatMoney(10, "EUR")).toMatch(/R\$/);
  });
});

describe("iniciais", () => {
  it("usa o nome curto de quem lançou", () => {
    expect(iniciaisDe("Ana Souza")).toBe("AS");
    expect(iniciaisDe("Lia")).toBe("LI");
  });
});

describe("i18n da home", () => {
  it("inglês troca os blocos da home e o símbolo", () => {
    const html = renderToStaticMarkup(
      React.createElement(HomeResumo, {
        variant: "mobile",
        idioma: "en",
        fluxo: { receitas: 40, debito: 10, cartao: 25, cartaoPorCartao: [{ cartaoId: "1", total: 25 }], pagamentoFatura: 0 },
        cartoes: [{ id: 1, nome: "XP", dia_fechamento: 5, dia_vencimento: 12 }],
        formatBRL: (v) => formatMoney(v, "USD"),
      }),
    );
    expect(html).toContain("Card statement");
    expect(html).toContain("Debit this month");
    expect(html).toContain("Income this month");
    expect(html).toContain("Closes on day 5 · Due on day 12");
    expect(html).toContain("$40.00");
    expect(t("en", "livro_titulo")).toBe("Book");
    expect(t("pt-BR", "fatura_cartao")).toBe("Fatura do cartão");
    expect(t("en", "nao_e_gasto")).toBe("not spending");
    expect(t("en", "gasto_categoria")).toBe("Spending by category");
    expect(t("en", "col_valor")).toBe("Amount");
    expect(t("pt-BR", "badge_evitavel")).toBe("Evitável");
  });
});

describe("faturas no idioma do livro", () => {
  it("rótulo em inglês e vencimento", () => {
    expect(rotuloFatura(9, "XP", "en")).toBe("Statement October · Card XP");
    const linhas = listarFaturas(
      [{ id: 1, tipo: "gasto", valor: 40, forma_pagamento: "Crédito", cartao_id: 2, data_lancamento: "2026-09-18", meta_id: null }],
      [{ id: 2, nome: "XP", dia_fechamento: 5, dia_vencimento: 10 }],
      2026,
      8,
      { hoje: new Date(2026, 8, 24), idioma: "en" },
    );
    expect(linhas[0].label).toBe("Statement October · Card XP");
    expect(linhas[0].vencimento).toBe("due day 10");
  });
});

describe("agente fala a moeda e o idioma do livro", () => {
  it("o bloco em inglês usa dólar e proíbe conversão", () => {
    const bloco = blocoMoedaIdioma("USD", "en");
    expect(bloco).toContain("ONLY in English");
    expect(bloco).toContain("USD");
    expect(bloco).toContain("Do NOT convert");
    expect(formatarValorAgente(40, "USD")).toMatch(/\$40\.00/);
    expect(formatarValorAgente(40, "DKK").toLowerCase()).toContain("kr");
  });

  it("português continua o padrão", () => {
    expect(blocoMoedaIdioma("BRL", "pt-BR")).toContain("português brasileiro");
    expect(aplicarComando("seco").resposta).toContain("registro");
    expect(aplicarComando("seco", "en").resposta).toContain("Just the record");
    expect(detectarComando("shut up")).toBe("silencio");
  });
});
