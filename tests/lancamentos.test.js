import { describe, it, expect } from "vitest";
import {
  agruparLancamentos,
  agruparPorParcelaGrupo,
  limparDescricaoParcela,
  montarDescricaoParcela,
  getMonthKey,
  normalizeText,
} from "../src/lib/lancamentos";

// Helper: monta um lançamento com os campos que o app realmente usa.
let seq = 0;
const lanc = (over = {}) => ({
  id: ++seq,
  descricao: "Mercado",
  valor: 100,
  tipo: "gasto",
  categoria: "Alimentação",
  forma_pagamento: "Débito",
  data_lancamento: "2026-06-10",
  recorrente: false,
  parcela_grupo_id: null,
  ...over,
});

// ===========================================================================
// A INVARIANTE QUE IMPORTA: nada pode desaparecer.
//
// agruparLancamentos é o funil por onde TODO lançamento passa antes de chegar
// na tela. Um bug aqui não estoura erro — ele some com o lançamento em silêncio,
// que é justamente a classe de falha do incidente de 2026-06-01 (~87 lançamentos
// perdidos). Estes testes existem pra que "sumiu da lista" vire teste vermelho.
// ===========================================================================
describe("agruparLancamentos — conservação (nada some)", () => {
  it("lançamento avulso sempre sobrevive ao agrupamento", () => {
    const entrada = [lanc(), lanc({ descricao: "Uber" }), lanc({ descricao: "Farmácia" })];
    const saida = agruparLancamentos(entrada);
    expect(saida).toHaveLength(3);
    expect(saida.map((l) => l.descricao).sort()).toEqual(["Farmácia", "Mercado", "Uber"]);
  });

  it("TODA parcela original continua acessível dentro da compra agrupada", () => {
    const parcelas = [1, 2, 3].map((n) =>
      lanc({
        descricao: montarDescricaoParcela("Notebook", n, 3),
        valor: 1000,
        parcela_grupo_id: "g1",
        parcela_atual: n,
        total_parcelas: 3,
        forma_pagamento: "Crédito",
      })
    );
    const saida = agruparLancamentos(parcelas);
    expect(saida).toHaveLength(1); // 3 parcelas viram 1 compra na tela
    expect(saida[0]._parcelas).toHaveLength(3); // mas nenhuma se perdeu
    expect(saida[0]._parcelas.map((p) => p.parcela_atual)).toEqual([1, 2, 3]);
  });

  it("conservação com mistura de avulso + parcelado + recorrente", () => {
    const entrada = [
      lanc({ descricao: "Uber" }),
      lanc({ descricao: "Notebook (1/2)", parcela_grupo_id: "g1", parcela_atual: 1, total_parcelas: 2 }),
      lanc({ descricao: "Notebook (2/2)", parcela_grupo_id: "g1", parcela_atual: 2, total_parcelas: 2 }),
      lanc({ descricao: "Netflix", recorrente: true, recorrente_grupo_id: "r1" }),
      lanc({ descricao: "Netflix", recorrente: true, recorrente_grupo_id: "r1", data_lancamento: "2026-07-10" }),
      lanc({ descricao: "Mercado" }),
    ];
    const saida = agruparLancamentos(entrada);

    // Nenhum id de entrada pode sumir: ou está solto, ou dentro de _parcelas, ou em _idsGrupo.
    const idsVistos = new Set();
    for (const item of saida) {
      if (item._parcelas) item._parcelas.forEach((p) => idsVistos.add(p.id));
      else if (item._idsGrupo) item._idsGrupo.forEach((id) => idsVistos.add(id));
      else idsVistos.add(item.id);
    }
    expect([...idsVistos].sort((a, b) => a - b)).toEqual(entrada.map((l) => l.id).sort((a, b) => a - b));
  });

  it("lista vazia não quebra", () => {
    expect(agruparLancamentos([])).toEqual([]);
  });

  it("parcela solta (grupo com uma linha só) não some", () => {
    const saida = agruparLancamentos([
      lanc({ parcela_grupo_id: "g9", parcela_atual: 1, total_parcelas: 1 }),
    ]);
    expect(saida).toHaveLength(1);
    expect(saida[0]._parcelas).toHaveLength(1);
  });
});

describe("agruparLancamentos — ordem (recém-lançado no topo)", () => {
  it("ordena por id decrescente, ou seja, ordem de criação", () => {
    const a = lanc({ descricao: "primeiro" });
    const b = lanc({ descricao: "segundo" });
    const c = lanc({ descricao: "terceiro" });
    expect(agruparLancamentos([a, b, c]).map((l) => l.descricao)).toEqual([
      "terceiro",
      "segundo",
      "primeiro",
    ]);
  });

  it("compra parcelada entra na ordem pelo MAIOR id das parcelas", () => {
    const antigo = lanc({ descricao: "antigo" });
    const p1 = lanc({ descricao: "TV (1/2)", parcela_grupo_id: "g2", parcela_atual: 1, total_parcelas: 2 });
    const p2 = lanc({ descricao: "TV (2/2)", parcela_grupo_id: "g2", parcela_atual: 2, total_parcelas: 2 });
    const saida = agruparLancamentos([antigo, p1, p2]);
    expect(saida[0]._compraParcelada).toBe(true); // a compra é mais recente
    expect(saida[0]._idMax).toBe(p2.id);
  });

  it("o id sintético 'compra-uuid' nunca vira NaN na ordenação", () => {
    const saida = agruparLancamentos([
      lanc({ parcela_grupo_id: "gx", parcela_atual: 1, total_parcelas: 1 }),
      lanc(),
    ]);
    expect(saida.every((l) => !Number.isNaN(l._idMax ?? 0))).toBe(true);
  });
});

describe("agruparPorParcelaGrupo — valor total da compra", () => {
  it("soma o valor da compra como parcela x número de parcelas", () => {
    const parcelas = [1, 2, 3].map((n) =>
      lanc({ valor: 333.33, parcela_grupo_id: "g3", parcela_atual: n, total_parcelas: 3 })
    );
    const { compras } = agruparPorParcelaGrupo(parcelas);
    expect(compras[0]._valorParcela).toBe(333.33);
    expect(compras[0].valor).toBe(999.99); // sem lixo de ponto flutuante
  });

  it("ordena as parcelas mesmo chegando fora de ordem do banco", () => {
    const fora = [3, 1, 2].map((n) =>
      lanc({ parcela_grupo_id: "g4", parcela_atual: n, total_parcelas: 3 })
    );
    const { compras } = agruparPorParcelaGrupo(fora);
    expect(compras[0]._parcelas.map((p) => p.parcela_atual)).toEqual([1, 2, 3]);
    expect(compras[0]._dataInicio).toBe(compras[0]._parcelas[0].data_lancamento);
  });

  it("separa avulsos de parcelados sem misturar", () => {
    const { compras, avulsos } = agruparPorParcelaGrupo([
      lanc({ descricao: "Uber" }),
      lanc({ parcela_grupo_id: "g5", parcela_atual: 1, total_parcelas: 2 }),
      lanc({ parcela_grupo_id: "g5", parcela_atual: 2, total_parcelas: 2 }),
    ]);
    expect(compras).toHaveLength(1);
    expect(avulsos).toHaveLength(1);
    expect(avulsos[0].descricao).toBe("Uber");
  });

  it("a descrição da compra perde o sufixo (1/3)", () => {
    const { compras } = agruparPorParcelaGrupo([
      lanc({ descricao: "Notebook Dell (1/3)", parcela_grupo_id: "g6", parcela_atual: 1, total_parcelas: 3 }),
    ]);
    expect(compras[0].descricao).toBe("Notebook Dell");
  });
});

describe("recorrentes", () => {
  it("N meses do mesmo recorrente viram UMA linha com a contagem certa", () => {
    const meses = ["2026-06-05", "2026-07-05", "2026-08-05"].map((d) =>
      lanc({ descricao: "Netflix", valor: 55, recorrente: true, recorrente_grupo_id: "r9", data_lancamento: d })
    );
    const saida = agruparLancamentos(meses);
    expect(saida).toHaveLength(1);
    expect(saida[0]._totalMeses).toBe(3);
    expect(saida[0]._idsGrupo).toHaveLength(3);
  });

  it("a linha agrupada mostra a data do PRIMEIRO mês", () => {
    const meses = ["2026-08-05", "2026-06-05", "2026-07-05"].map((d) =>
      lanc({ descricao: "Netflix", recorrente: true, recorrente_grupo_id: "r10", data_lancamento: d })
    );
    expect(agruparLancamentos(meses)[0].data_lancamento).toBe("2026-06-05");
  });

  it("recorrente legado sem grupo_id agrupa por descrição+valor+categoria", () => {
    const meses = ["2026-06-05", "2026-07-05"].map((d) =>
      lanc({ descricao: "Academia", valor: 120, categoria: "Saúde", recorrente: true, data_lancamento: d })
    );
    const saida = agruparLancamentos(meses);
    expect(saida).toHaveLength(1);
    expect(saida[0]._totalMeses).toBe(2);
  });

  it("recorrentes de valores diferentes NÃO se fundem", () => {
    const saida = agruparLancamentos([
      lanc({ descricao: "Academia", valor: 120, recorrente: true }),
      lanc({ descricao: "Academia", valor: 150, recorrente: true }),
    ]);
    expect(saida).toHaveLength(2);
  });
});

describe("descrição de parcela", () => {
  it("monta o sufixo (n/total)", () => {
    expect(montarDescricaoParcela("Notebook", 2, 12)).toBe("Notebook (2/12)");
  });

  it("é idempotente — reeditar não empilha sufixo", () => {
    const uma = montarDescricaoParcela("Notebook", 2, 12);
    expect(montarDescricaoParcela(uma, 2, 12)).toBe("Notebook (2/12)");
    expect(montarDescricaoParcela(montarDescricaoParcela(uma, 3, 12), 4, 12)).toBe("Notebook (4/12)");
  });

  it("limpar remove só o sufixo do fim, não parênteses do meio", () => {
    expect(limparDescricaoParcela("Notebook (2/12)")).toBe("Notebook");
    expect(limparDescricaoParcela("Seguro (auto) do carro")).toBe("Seguro (auto) do carro");
    expect(limparDescricaoParcela("Curso (turma 2) (3/6)")).toBe("Curso (turma 2)");
  });

  it("descrição vazia não vira 'undefined'", () => {
    expect(limparDescricaoParcela("")).toBe("");
    expect(limparDescricaoParcela()).toBe("");
  });
});

describe("getMonthKey", () => {
  it("zera à esquerda pra chave ordenável", () => {
    expect(getMonthKey(new Date(2026, 0, 15))).toBe("2026-01");
    expect(getMonthKey(new Date(2026, 11, 1))).toBe("2026-12");
  });

  it("ordenação alfabética das chaves = ordem cronológica", () => {
    const chaves = [new Date(2026, 9, 1), new Date(2026, 0, 1), new Date(2025, 11, 1)].map(getMonthKey);
    expect([...chaves].sort()).toEqual(["2025-12", "2026-01", "2026-10"]);
  });
});

describe("normalizeText (acento vindo torto do banco)", () => {
  it("não estraga texto que já está certo", () => {
    for (const ok of ["Alimentação", "Saúde", "Mercado", "Uber", ""]) {
      expect(normalizeText(ok)).toBe(ok);
    }
  });

  it("null e undefined viram string vazia (não 'null' na tela)", () => {
    expect(normalizeText(null)).toBe("");
    expect(normalizeText(undefined)).toBe("");
  });
});
