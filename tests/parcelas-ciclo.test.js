import { describe, it, expect } from "vitest";
import { cicloDaParcela, dataDaParcelaNoCiclo, listarFaturas, parcelasQueAindaVem } from "../src/lib/faturas";
import { extrairParcelaDaDescricao, indiceEfetivo, rotuloParcela } from "../src/lib/parcelaDescricao";

const xp = { id: 1, nome: "XP", dia_fechamento: 1, dia_vencimento: 12 };

describe("ciclo da parcela", () => {
  it("compra no dia do fechamento fica na fatura que fecha nesse dia", () => {
    const c = cicloDaParcela("2026-10-01", 1, 1, 12);
    expect(c.inicio).toBe("2026-09-02");
    expect(c.fim).toBe("2026-10-01");
    expect(c.atePagamento).toBe("2026-10-12");
    const seguinte = cicloDaParcela("2026-10-01", 2, 1, 12);
    expect(seguinte.inicio).toBe("2026-10-02");
    expect(seguinte.fim).toBe("2026-11-01");
    expect(seguinte.atePagamento).toBe("2026-11-12");
  });

  it("fechamento no dia 1: a 2/2 de 19/08 vence em 12/10", () => {
    const c = cicloDaParcela("2026-08-19", 2, 1, 12);
    expect(c).toMatchObject({ inicio: "2026-09-02", fim: "2026-10-01", atePagamento: "2026-10-12", mesVenc: 9 });
  });

  it("vira o ano", () => {
    const c = cicloDaParcela("2026-12-20", 2, 5, 10);
    expect(c.inicio).toBe("2027-01-06");
    expect(c.fim).toBe("2027-02-05");
    expect(c.atePagamento).toBe("2027-02-10");
    expect(c.anoVenc).toBe(2027);
  });

  it("fevereiro com 28 dias e fechamento 31", () => {
    expect(cicloDaParcela("2026-01-31", 1, 31, 10).fim).toBe("2026-01-31");
    expect(cicloDaParcela("2026-01-31", 2, 31, 10)).toMatchObject({ inicio: "2026-02-01", fim: "2026-02-28" });
    expect(cicloDaParcela("2026-01-31", 3, 31, 10)).toMatchObject({ inicio: "2026-03-01", fim: "2026-03-31" });
  });

  it("mês de 30 dias: compra no fechamento efetivo (dia 30, cartão fecha 31)", () => {
    expect(cicloDaParcela("2026-04-30", 1, 31, 8).fim).toBe("2026-04-30");
    expect(cicloDaParcela("2026-04-30", 2, 31, 8)).toMatchObject({ inicio: "2026-05-01", fim: "2026-05-31" });
  });

  it("29/02 em ano bissexto não estoura o ciclo", () => {
    expect(cicloDaParcela("2028-02-29", 1, 31, 10).fim).toBe("2028-02-29");
    expect(cicloDaParcela("2028-02-29", 2, 31, 10)).toMatchObject({ inicio: "2028-03-01", fim: "2028-03-31" });
  });

  it("31/01 + fechamento dia 30: somar um mês cairia na fatura da parcela 1", () => {
    // 31/01 + 1 mês vira 28/02, que ainda é o ciclo da primeira parcela.
    // A data gravada tem que ser 01/03, primeiro dia do ciclo seguinte.
    expect(dataDaParcelaNoCiclo("2026-01-31", 1, 30, 12)).toBe("2026-01-31");
    expect(dataDaParcelaNoCiclo("2026-01-31", 2, 30, 12)).toBe("2026-03-01");
    expect(cicloDaParcela("2026-01-31", 2, 30, 12)).toMatchObject({ inicio: "2026-03-01", fim: "2026-03-30" });
  });

  it("19/08 fecha dia 1: a segunda parcela pode ficar em 19/09, dentro do ciclo", () => {
    expect(dataDaParcelaNoCiclo("2026-08-19", 2, 1, 12)).toBe("2026-09-19");
  });
});

describe("descrição n/m só no fim, e só quando é parcela", () => {
  it("reconhece (2/2), 2/3, 4/4 e 15/15", () => {
    expect(extrairParcelaDaDescricao("Vortech (2/2)")).toEqual({ atual: 2, total: 2 });
    expect(extrairParcelaDaDescricao("TotalAcesso 2/3")).toEqual({ atual: 2, total: 3 });
    expect(extrairParcelaDaDescricao("Centauro 4/4")).toEqual({ atual: 4, total: 4 });
    expect(extrairParcelaDaDescricao("Curso 15/15")).toEqual({ atual: 15, total: 15 });
  });

  it("não confunde data, faixa nem valor no meio", () => {
    expect(extrairParcelaDaDescricao("compra 19/08")).toBeNull();
    expect(extrairParcelaDaDescricao("algo 02/10/2026")).toBeNull();
    expect(extrairParcelaDaDescricao("iPhone 14/15")).toBeNull();
    expect(extrairParcelaDaDescricao("parcela 2/3 no meio do texto livre")).toBeNull();
    expect(extrairParcelaDaDescricao("Seguro (auto)")).toBeNull();
  });

  it("campo preenchido ganha do texto", () => {
    const l = { descricao: "Vortech (2/2)", parcela_atual: 5, total_parcelas: 6 };
    expect(indiceEfetivo(l)).toEqual({ atual: 5, total: 6, fonte: "campos" });
    expect(rotuloParcela(l)).toBe("5/6x");
    expect(rotuloParcela({ descricao: "Vortech 2/2" })).toBe("2/2x");
  });
});

describe("fatura pelo fechamento e parcelas que ainda vêm", () => {
  const hoje = new Date(2026, 9, 5); // 05/10/2026

  it("não soma duas vezes a parcela cuja data já está no ciclo certo", () => {
    const lancamentos = [
      { id: 1, tipo: "gasto", valor: 100, forma_pagamento: "Crédito", cartao_id: 1, data_lancamento: "2026-08-19", parcela_atual: 1, total_parcelas: 2, parcela_grupo_id: "g", meta_id: null },
      { id: 2, tipo: "gasto", valor: 100, forma_pagamento: "Crédito", cartao_id: 1, data_lancamento: "2026-09-19", parcela_atual: 2, total_parcelas: 2, parcela_grupo_id: "g", meta_id: null },
    ];
    const linhas = listarFaturas(lancamentos, [xp], 2026, 8, { hoje });
    expect(linhas[0].valor).toBe(100);
    expect(linhas[0].projetado).toBe(0);
  });

  it("linha única com parcela_atual preenchido e data da compra também cai na fatura de 12/10", () => {
    const lancamentos = [
      { id: 1, tipo: "gasto", valor: 923, forma_pagamento: "Crédito", cartao_id: 1, data_lancamento: "2026-08-19", parcela_atual: 2, total_parcelas: 2, descricao: "Vortech", meta_id: null },
    ];
    const linhas = listarFaturas(lancamentos, [xp], 2026, 8, { hoje });
    expect(linhas[0].valor).toBe(923);
    expect(linhas[0].fim).toBe("2026-10-01");
    expect(linhas[0].atePagamento).toBe("2026-10-12");
  });

  it("duas linhas na mesma data: só a 2/2 entra na fatura de 12/10", () => {
    const lancamentos = [
      { id: 1, tipo: "gasto", valor: 400, forma_pagamento: "Crédito", cartao_id: 1, data_lancamento: "2026-08-19", descricao: "Vortech (1/2)", meta_id: null },
      { id: 2, tipo: "gasto", valor: 523, forma_pagamento: "Crédito", cartao_id: 1, data_lancamento: "2026-08-19", descricao: "Vortech (2/2)", meta_id: null },
    ];
    const linhas = listarFaturas(lancamentos, [xp], 2026, 8, { hoje });
    expect(linhas[0].valor).toBe(523);
  });

  it("projeta 5/6x nas faturas que ainda não fecharam e não inventa a que já fechou", () => {
    const lancamentos = [
      { id: 9, tipo: "gasto", valor: 80, forma_pagamento: "Crédito", cartao_id: 1, data_lancamento: "2026-08-19", parcela_atual: 1, total_parcelas: 6, meta_id: null, descricao: "Curso" },
    ];
    // Ciclo 02/09–01/10 já fechou em 01/10. Sem a linha da 2/6, ela não é inventada.
    const faturaOutubro = listarFaturas(lancamentos, [xp], 2026, 8, { hoje });
    expect(faturaOutubro).toHaveLength(0);

    const futuras = parcelasQueAindaVem(lancamentos, [xp], { hoje });
    expect(futuras.itens.map((i) => i.rotulo)).toEqual(["3/6x", "4/6x", "5/6x"]);
    expect(futuras.itens.every((i) => i.projetada)).toBe(true);
    expect(futuras.alem).toBe(1); // a 6/6 fecha depois da janela de 3 meses
  });

  it("pagamento de fatura continua abatendo, e meta não entra", () => {
    const lancamentos = [
      { id: 1, tipo: "gasto", valor: 200, forma_pagamento: "Crédito", cartao_id: 1, data_lancamento: "2026-09-10", meta_id: null },
      { id: 2, tipo: "gasto", valor: 50, forma_pagamento: "Crédito", cartao_id: 1, data_lancamento: "2026-09-10", meta_id: 3, descricao: "aporte" },
      { id: 3, tipo: "gasto", valor: 200, forma_pagamento: "PIX", cartao_id: 1, data_lancamento: "2026-10-08", categoria: "Pagamento fatura", abate_saldo: false, meta_id: null },
    ];
    const linhas = listarFaturas(lancamentos, [xp], 2026, 8, { hoje });
    expect(linhas[0].valor).toBe(0);
    expect(linhas[0].pago).toBe(200);
  });
});
