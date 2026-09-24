import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomeResumo from "../src/components/HomeResumo";

const formatBRL = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

describe("HomeResumo", () => {
  it("empilha Fluxo, contas e faturas com o rótulo combinado", () => {
    const html = renderToStaticMarkup(
      React.createElement(HomeResumo, {
        variant: "desktop",
        fluxo: { entrou: 40000, saiu: 35000, diferenca: 5000, debito: 15000, cartao: 20000, guardado: 500 },
        faturas: [{ cartaoId: 2, label: "Fatura outubro · Cartão XP", valor: 4820, vencimento: "vence dia 10" }],
        bancos: [
          { id: 1, nome: "XP Conta digital", saldo_atual: 2180 },
          { id: 2, nome: "Santander", saldo_atual: 1420 },
        ],
        formatBRL,
      }),
    );
    expect(html).toContain("Fluxo do mês");
    expect(html).toContain("Entrou");
    expect(html).toContain("Saiu");
    expect(html).toContain("Diferença");
    expect(html).toContain("Guardou");
    expect(html).toContain("não entra no Saiu");
    expect(html).toContain("Nas contas agora");
    expect(html).toContain("XP Conta digital");
    expect(html).toContain("Santander");
    expect(html).toContain("Disponível");
    expect(html).toContain("3.600");
    expect(html).toContain("Fatura outubro · Cartão XP");
    expect(html).toContain("vence dia 10");
    expect(html).toContain("pagamento de fatura não conta de novo no Saiu");
    expect(html.indexOf("Fluxo do mês")).toBeLessThan(html.indexOf("Nas contas agora"));
    expect(html.indexOf("Nas contas agora")).toBeLessThan(html.indexOf("Faturas"));
  });
});
