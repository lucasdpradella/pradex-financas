import { describe, it, expect } from "vitest";
import {
  PLANOS,
  LINK_CHECKOUT_ASSISTENTE,
  normalizePlano,
  temAssistente,
  mostraCadeado,
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

describe("temAssistente — quem abre WhatsApp e Diagnóstico FP", () => {
  it("só o assistente libera", () => {
    expect(temAssistente("assistente")).toBe(true);
    expect(temAssistente("essencial")).toBe(false);
    expect(temAssistente("none")).toBe(false);
  });

  // Regressão da Fase 0: acesso_pago = (plano = 'assistente'), não plano <> 'none'.
  // Se o Essencial liberar WhatsApp/FP, a assinatura mais barata entrega o produto caro.
  it("essencial NÃO herda o que o Assistente vende", () => {
    expect(temAssistente("essencial")).toBe(false);
  });

  it("valor inválido não libera", () => {
    expect(temAssistente(undefined)).toBe(false);
    expect(temAssistente("assistente ")).toBe(false);
  });
});

describe("mostraCadeado", () => {
  it("é o inverso do acesso — o item fica no menu, só que trancado", () => {
    expect(mostraCadeado("none")).toBe(true);
    expect(mostraCadeado("essencial")).toBe(true);
    expect(mostraCadeado("assistente")).toBe(false);
  });
});

describe("conteudoUpgrade", () => {
  it("manda none e essencial pro mesmo checkout do Assistente", () => {
    for (const p of ["none", "essencial"]) {
      for (const ctx of ["whatsapp", "fp"]) {
        expect(conteudoUpgrade(p, ctx).href).toBe(LINK_CHECKOUT_ASSISTENTE);
      }
    }
  });

  it("muda a copy: none conhece, essencial faz upgrade", () => {
    expect(conteudoUpgrade("none", "fp").cta).toBe("Conhecer o Assistente");
    expect(conteudoUpgrade("essencial", "fp").cta).toBe("Fazer upgrade");
    expect(conteudoUpgrade("none", "fp").nota).toMatch(/Assistente/);
    expect(conteudoUpgrade("essencial", "fp").nota).toMatch(/Essencial/);
  });

  it("o título acompanha o contexto de onde a pessoa bateu no bloqueio", () => {
    expect(conteudoUpgrade("none", "whatsapp").titulo).toMatch(/WhatsApp/);
    expect(conteudoUpgrade("none", "fp").titulo).toMatch(/Planejamento Financeiro/);
  });

  it("contexto desconhecido não quebra a tela", () => {
    const r = conteudoUpgrade("none", "inexistente");
    expect(r.titulo).toBeTruthy();
    expect(r.href).toBe(LINK_CHECKOUT_ASSISTENTE);
  });

  it("plano inválido é tratado como none", () => {
    expect(conteudoUpgrade("premium", "fp").cta).toBe(conteudoUpgrade("none", "fp").cta);
  });
});
