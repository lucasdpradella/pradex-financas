import { describe, it, expect } from "vitest";
import { parseValor } from "../src/components/OrcamentoCategoria";

// O usuário digita do jeito dele. O banco recebe número. O meio de campo é aqui —
// e errar aqui vira teto errado, que vira cobrança errada do agente.
describe("parseValor", () => {
  it("aceita o formato brasileiro com vírgula decimal", () => {
    expect(parseValor("1.200,50")).toBe(1200.5);
    expect(parseValor("600,00")).toBe(600);
    expect(parseValor("0,99")).toBe(0.99);
  });

  it("aceita o formato com ponto decimal", () => {
    expect(parseValor("1200.50")).toBe(1200.5);
    expect(parseValor("600")).toBe(600);
  });

  it("ignora R$ e espaços", () => {
    expect(parseValor("R$ 1.200,50")).toBe(1200.5);
    expect(parseValor(" 600 ")).toBe(600);
  });

  // Vazio e lixo são coisas DIFERENTES: vazio quer dizer "essa categoria não tem
  // teto" e é caminho normal; lixo é erro e tem que barrar o save.
  it("devolve null pra vazio e NaN pra lixo", () => {
    expect(parseValor("")).toBeNull();
    expect(parseValor("   ")).toBeNull();
    expect(parseValor(null)).toBeNull();
    expect(parseValor(undefined)).toBeNull();
    expect(parseValor("abc")).toBeNaN();
    expect(parseValor("R$")).toBeNaN();
  });

  // 1.200 sem casas decimais é mil e duzentos, não um vírgula dois.
  it("trata ponto de milhar sem vírgula como número inteiro grande", () => {
    expect(parseValor("1.200")).toBe(1200);
  });
});
