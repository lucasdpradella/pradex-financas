import { describe, it, expect } from "vitest";
import {
  NOTA_MINIMA,
  DIAS_DISTINTOS_MINIMO,
  avaliarPremio,
  oQueFalta,
} from "../src/lib/premio";

const base = { score: 90, diasDistintos: 20, resgatadoEm: null, plano: "none" };

describe("avaliarPremio — o caminho feliz", () => {
  it("libera quem bate nota e dias", () => {
    const av = avaliarPremio(base);
    expect(av.elegivel).toBe(true);
    expect(av.percentual).toBe(20);
    expect(av.diasTrial).toBe(14);
  });

  it("o limite é inclusivo nos dois critérios", () => {
    expect(avaliarPremio({ ...base, score: NOTA_MINIMA }).elegivel).toBe(true);
    expect(avaliarPremio({ ...base, diasDistintos: DIAS_DISTINTOS_MINIMO }).elegivel).toBe(true);
  });
});

describe("avaliarPremio — o que barra", () => {
  it("nota abaixo de 80 não passa", () => {
    const av = avaliarPremio({ ...base, score: 79 });
    expect(av.elegivel).toBe(false);
    expect(av.motivo).toBe("nota_baixa");
    expect(av.faltaNota).toBe(1);
  });

  // O piso anti-fraude: 20 lançamentos de R$ 1 no mesmo dia não viram prêmio.
  it("nota alta com poucos dias distintos não passa", () => {
    const av = avaliarPremio({ ...base, score: 100, diasDistintos: 3 });
    expect(av.elegivel).toBe(false);
    expect(av.motivo).toBe("poucos_dias");
    expect(av.faltaDias).toBe(DIAS_DISTINTOS_MINIMO - 3);
  });

  // Uma vez na vida: vale mesmo que a pessoa tenha voltado pro Free depois.
  it("quem já resgatou nunca mais é elegível, mesmo com nota perfeita", () => {
    const av = avaliarPremio({ ...base, score: 100, resgatadoEm: "2026-08-01T00:00:00Z" });
    expect(av.elegivel).toBe(false);
    expect(av.motivo).toBe("ja_resgatado");
  });

  // Oferecer desconto a quem já paga é ensinar que existia um preço menor.
  it("assinante não recebe oferta de desconto", () => {
    expect(avaliarPremio({ ...base, plano: "essencial" }).motivo).toBe("ja_assinante");
    expect(avaliarPremio({ ...base, plano: "assistente" }).motivo).toBe("ja_assinante");
  });

  // A ordem importa: "já resgatou" tem que vencer "nota baixa", senão a tela diria
  // "falta 1 ponto" pra quem nunca mais vai poder ganhar.
  it("já resgatado vence nota baixa na ordem das checagens", () => {
    const av = avaliarPremio({ score: 10, diasDistintos: 0, resgatadoEm: "2026-08-01T00:00:00Z" });
    expect(av.motivo).toBe("ja_resgatado");
  });
});

describe("avaliarPremio — entrada ruim não quebra a tela", () => {
  it("sem argumento nenhum devolve inelegível, não erro", () => {
    const av = avaliarPremio();
    expect(av.elegivel).toBe(false);
    expect(av.motivo).toBe("nota_baixa");
  });

  it("null e undefined viram zero", () => {
    const av = avaliarPremio({ score: null, diasDistintos: undefined, plano: "none" });
    expect(av.elegivel).toBe(false);
    expect(av.faltaNota).toBe(NOTA_MINIMA);
  });
});

describe("oQueFalta", () => {
  it("diz os dois quando faltam os dois", () => {
    const t = oQueFalta(avaliarPremio({ score: 70, diasDistintos: 10, plano: "none" }));
    expect(t).toMatch(/10 pontos/);
    expect(t).toMatch(/5 dias/);
  });

  it("concorda o singular", () => {
    const t = oQueFalta(avaliarPremio({ score: 79, diasDistintos: 14, plano: "none" }));
    expect(t).toMatch(/1 ponto de/);
    expect(t).toMatch(/1 dia com/);
  });

  it("cala pra quem já resgatou ou já assina — não vira cobrança", () => {
    expect(oQueFalta(avaliarPremio({ ...base, resgatadoEm: "2026-08-01" }))).toBeNull();
    expect(oQueFalta(avaliarPremio({ ...base, plano: "essencial" }))).toBeNull();
  });

  it("devolve null pra quem já é elegível", () => {
    expect(oQueFalta(avaliarPremio(base))).toBeNull();
  });
});
