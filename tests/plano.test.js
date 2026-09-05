import { describe, it, expect } from "vitest";
import {
  PLANOS,
  CHECKOUT,
  RECURSOS,
  normalizePlano,
  planoNecessario,
  temAcesso,
  mostraCadeado,
  checkoutPara,
  conteudoUpgrade,
} from "../src/lib/plano";

describe("normalizePlano", () => {
  it("aceita os três planos válidos", () => {
    for (const p of PLANOS) expect(normalizePlano(p)).toBe(p);
  });

  // O default fechado é o que impede acesso de graça quando o fetch do perfil falha
  // ou a linha ainda não existe.
  it("cai em none pra valor ausente, nulo ou desconhecido", () => {
    expect(normalizePlano(undefined)).toBe("none");
    expect(normalizePlano(null)).toBe("none");
    expect(normalizePlano("")).toBe("none");
    expect(normalizePlano("premium")).toBe("none");
    expect(normalizePlano("ASSISTENTE")).toBe("none");
  });
});

describe("temAcesso — a matriz de planos", () => {
  // A tabela é a especificação: free tem o core inteiro, paga-se pelo Zap (Essencial)
  // e por FP/Relatórios (Assistente).
  const MATRIZ = {
    none: { whatsapp: false, fp: false, relatorios: false },
    essencial: { whatsapp: true, fp: false, relatorios: false },
    assistente: { whatsapp: true, fp: true, relatorios: true },
  };

  for (const [plano, esperado] of Object.entries(MATRIZ)) {
    for (const [recurso, liberado] of Object.entries(esperado)) {
      it(`${plano} ${liberado ? "tem" : "NÃO tem"} ${recurso}`, () => {
        expect(temAcesso(plano, recurso)).toBe(liberado);
      });
    }
  }

  // "Top inclui o meio": é o que dispensa listar recurso por plano.
  it("assistente herda tudo do essencial", () => {
    for (const recurso of Object.keys(RECURSOS)) {
      if (temAcesso("essencial", recurso)) expect(temAcesso("assistente", recurso)).toBe(true);
    }
  });

  it("plano inválido não libera nada", () => {
    for (const recurso of Object.keys(RECURSOS)) {
      expect(temAcesso("premium", recurso)).toBe(false);
      expect(temAcesso(undefined, recurso)).toBe(false);
    }
  });

  // Falha fechada: o catálogo só tem recurso pago, então errar o nome não pode virar
  // liberação de graça.
  it("recurso desconhecido exige o plano mais alto", () => {
    expect(planoNecessario("inexistente")).toBe("assistente");
    expect(temAcesso("none", "inexistente")).toBe(false);
    expect(temAcesso("essencial", "inexistente")).toBe(false);
    expect(temAcesso("assistente", "inexistente")).toBe(true);
  });
});

describe("mostraCadeado", () => {
  it("é o inverso do acesso — o item fica no menu, só que trancado", () => {
    expect(mostraCadeado("none", "whatsapp")).toBe(true);
    expect(mostraCadeado("essencial", "whatsapp")).toBe(false);
    expect(mostraCadeado("essencial", "fp")).toBe(true);
    expect(mostraCadeado("assistente", "fp")).toBe(false);
  });
});

describe("checkoutPara — cada bloqueio manda pro checkout certo", () => {
  it("falta Zap manda pro Essencial", () => {
    expect(checkoutPara("whatsapp")).toBe(CHECKOUT.essencial);
    expect(CHECKOUT.essencial).toContain("a2xpq3u");
  });

  it("falta FP ou Relatórios manda pro Assistente", () => {
    expect(checkoutPara("fp")).toBe(CHECKOUT.assistente);
    expect(checkoutPara("relatorios")).toBe(CHECKOUT.assistente);
    expect(CHECKOUT.assistente).toContain("4pteia8");
  });

  it("os dois checkouts são diferentes", () => {
    expect(CHECKOUT.essencial).not.toBe(CHECKOUT.assistente);
  });
});

describe("conteudoUpgrade", () => {
  it("free conhece o plano; quem já paga faz upgrade", () => {
    expect(conteudoUpgrade("none", "whatsapp").cta).toBe("Conhecer o Essencial");
    expect(conteudoUpgrade("none", "fp").cta).toBe("Conhecer o Assistente");
    expect(conteudoUpgrade("essencial", "fp").cta).toBe("Fazer upgrade");
  });

  it("a nota diz de onde a pessoa está saindo", () => {
    expect(conteudoUpgrade("none", "fp").nota).toBe("Disponível no plano Assistente.");
    expect(conteudoUpgrade("essencial", "fp").nota).toMatch(/Essencial.*Assistente/);
  });

  it("o link acompanha o recurso bloqueado, não o plano atual", () => {
    expect(conteudoUpgrade("none", "whatsapp").href).toBe(CHECKOUT.essencial);
    expect(conteudoUpgrade("none", "fp").href).toBe(CHECKOUT.assistente);
  });

  it("o título acompanha o contexto de onde a pessoa bateu no bloqueio", () => {
    expect(conteudoUpgrade("none", "whatsapp").titulo).toMatch(/WhatsApp/);
    expect(conteudoUpgrade("none", "fp").titulo).toMatch(/Planejamento Financeiro/);
  });

  // Relatórios ainda não existe: a copy lidera pelo FP e cita Relatórios como o que vem.
  it("Relatórios não é vendido como pronto", () => {
    const r = conteudoUpgrade("essencial", "relatorios");
    expect(r.titulo).toMatch(/Planejamento Financeiro/);
    expect(r.descricao).toMatch(/em breve/);
    expect(r.href).toBe(CHECKOUT.assistente);
  });

  it("recurso desconhecido não quebra a tela", () => {
    const r = conteudoUpgrade("none", "inexistente");
    expect(r.titulo).toBeTruthy();
    expect(r.href).toBe(CHECKOUT.assistente);
  });
});
