import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import HomeResumo, { FATURA_PELO_FECHAMENTO } from "../src/components/HomeResumo";
import { calcularFechamento } from "../src/lib/fechamento";

const formatBRL = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const cartoes = [
  { id: 1, nome: "Cartão XP", dia_fechamento: 5, dia_vencimento: 12 },
  { id: 2, nome: "Cartão Santander", dia_fechamento: 25, dia_vencimento: 3 },
];

const lanc = [
  { id: 1, tipo: "receita", valor: 9000, categoria: "Salário", data_lancamento: "2026-10-01" },
  { id: 2, tipo: "gasto", valor: 1111.11, forma_pagamento: "Crédito", cartao_id: 1, categoria: "Moradia", data_lancamento: "2026-10-03" },
  { id: 3, tipo: "gasto", valor: 765.43, forma_pagamento: "crédito", cartao_id: 2, categoria: "Lazer", data_lancamento: "2026-10-04" },
  { id: 4, tipo: "gasto", valor: 2222.22, forma_pagamento: "PIX", categoria: "Alimentação", data_lancamento: "2026-10-05" },
  { id: 5, tipo: "gasto", valor: 700, forma_pagamento: "Débito", categoria: "Pagamento fatura", abate_saldo: false, cartao_id: 2, data_lancamento: "2026-10-20" },
];

const render = (props) => renderToStaticMarkup(React.createElement(HomeResumo, { formatBRL, cartoes, ...props }));

describe("HomeResumo — fatura do cartão, débito e receitas", () => {
  const fluxo = calcularFechamento(lanc, 2026, 9, { hoje: new Date(2026, 9, 1) });

  it("mostra os três blocos com valores cheios do mês (desktop)", () => {
    const html = render({ variant: "desktop", fluxo });
    expect(html).toContain("Fatura do cartão");
    expect(html).toContain("1.876,54");
    expect(html).toContain("Cartão XP");
    expect(html).toContain("1.111,11");
    expect(html).toContain("Cartão Santander");
    expect(html).toContain("765,43");
    expect(html).toContain("Fecha dia 5 · Vence dia 12");
    expect(html).toContain("Fecha dia 25 · Vence dia 3");
    expect(html).toContain("Débito do mês");
    expect(html).toContain("2.222,22");
    expect(html).toContain("Receitas do mês");
    expect(html).toContain("9.000,00");
    expect(html).toMatch(/Pagamento de fatura \(R\$\s700,00\) não entra no Débito/);
    expect(html.indexOf("Fatura do cartão")).toBeLessThan(html.indexOf("Débito do mês"));
    expect(html.indexOf("Débito do mês")).toBeLessThan(html.indexOf("Receitas do mês"));
  });

  it("não tem mais Entrou/Saiu/Diferença nem Nas contas agora", () => {
    const html = render({ variant: "mobile", fluxo });
    for (const fora of ["Fluxo do mês", "Entrou", "Saiu", "Diferença", "Nas contas agora", "Disponível"]) {
      expect(html).not.toContain(fora);
    }
  });

  it("só a face 'Por data da compra' existe enquanto a flag está desligada", () => {
    expect(FATURA_PELO_FECHAMENTO).toBe(false);
    const html = render({ variant: "mobile", fluxo });
    expect(html).toContain('data-face="compra"');
    expect(html).not.toContain('data-face="fechamento"');
    expect(html).not.toContain("Pelo fechamento");
  });

  it("com a flag ligada, a segunda face aparece (mobile: pontos; desktop: abas)", () => {
    const mobile = render({ variant: "mobile", fluxo, pelaDataDoFechamento: true });
    expect(mobile).toContain('data-face="fechamento"');
    expect(mobile).toContain('aria-label="Pelo fechamento"');
    const desktop = render({ variant: "desktop", fluxo, pelaDataDoFechamento: true });
    expect(desktop).toContain('role="tablist"');
    expect(desktop).toContain("Por data da compra");
  });

  it("mostra parcelas que ainda vêm no formato 5/6x, sem mexer no total da fatura do mês", () => {
    const lancamentos = [
      { id: 1, tipo: "gasto", valor: 80, forma_pagamento: "Crédito", cartao_id: 1, data_lancamento: "2026-08-19", parcela_atual: 1, total_parcelas: 6, descricao: "Curso", meta_id: null },
    ];
    const html = render({
      variant: "mobile",
      fluxo,
      lancamentos,
      ano: 2026,
      mes: 9,
      hoje: new Date(2026, 9, 5),
    });
    expect(html).toContain("Parcelas que ainda vêm");
    expect(html).toContain("5/6x");
    expect(html).toContain("Curso");
    expect(html).toContain("1.876,54");
  });

  it("pelo fechamento, a 2/2 de 19/08 entra na fatura que vence em outubro", () => {
    const lancamentos = [
      { id: 1, tipo: "gasto", valor: 923, forma_pagamento: "Crédito", cartao_id: 1, data_lancamento: "2026-08-19", descricao: "Vortech 2/2", meta_id: null },
    ];
    const html = render({
      variant: "mobile",
      fluxo,
      cartoes: [{ id: 1, nome: "XP", dia_fechamento: 1, dia_vencimento: 12 }],
      lancamentos,
      ano: 2026,
      mes: 8,
      hoje: new Date(2026, 9, 5),
      pelaDataDoFechamento: true,
    });
    expect(html).toContain("Quando você paga");
    expect(html).toContain("02/09–01/10");
    expect(html).toContain("923,00");
  });

  it("mês sem crédito mostra o vazio da fatura", () => {
    const vazio = calcularFechamento([], 2026, 9, { hoje: new Date(2026, 9, 1) });
    const html = render({ variant: "mobile", fluxo: vazio });
    expect(html).toContain("Nenhuma compra no crédito neste mês.");
    expect(html).toContain("Pagamento de fatura não entra no Débito");
  });
});
