// CUTUCADA — o que o Pradex diz quando fala primeiro.
//
// Testa `supabase/functions/agente-cutucada/mensagens.ts`. Importa mais que o teste
// do agente reativo porque aqui a mensagem NÃO foi pedida: uma frase infeliz numa
// resposta é um tropeço; a mesma frase chegando sozinha às 10h é invasão.
import { describe, it, expect } from "vitest";
import {
  montarCutucada, comAvisoDeModoPesado, escolherAlvo, PRIORIDADE,
} from "../supabase/functions/agente-cutucada/mensagens.ts";

const TONS = ["seco", "caos", "elogio"];
const GATILHOS = ["teto_estourado", "teto_90", "meta_parada", "meta_risco", "meta_concluida"];

const alvo = (over = {}) => ({
  gatilho: "meta_parada", referencia: "Viagem", dificuldade: "moderada",
  pct: 95, dias: 45, falta: 2000, prazo: "2026-10-01", ...over,
});

describe("montarCutucada", () => {
  it("todo gatilho tem texto em todo tom", () => {
    for (const g of GATILHOS) {
      for (const t of TONS) {
        const msg = montarCutucada(alvo({ gatilho: g }), t);
        expect(typeof msg).toBe("string");
        expect(msg.length).toBeGreaterThan(15);
      }
    }
  });

  it("sempre cita a coisa de que está falando", () => {
    for (const g of GATILHOS) {
      for (const t of TONS) {
        expect(montarCutucada(alvo({ gatilho: g, referencia: "Viagem" }), t)).toContain("Viagem");
      }
    }
  });

  // A dificuldade é a única coisa que o app sabe sobre o esforço, e foi o cliente
  // que a declarou — é o que dá ao Pradex o direito de cobrar em cima dela.
  it("meta parada cobra de acordo com o que a pessoa declarou", () => {
    const facil = montarCutucada(alvo({ dificuldade: "facil" }), "caos");
    const dificil = montarCutucada(alvo({ dificuldade: "dificil" }), "caos");
    expect(facil).toContain("Fácil pra quem?");
    expect(dificil).toContain("Difícil era o plano");
    expect(facil).not.toBe(dificil);
  });

  it("os três tons produzem textos diferentes entre si", () => {
    for (const g of GATILHOS) {
      const [s, c, e] = TONS.map((t) => montarCutucada(alvo({ gatilho: g }), t));
      expect(new Set([s, c, e]).size).toBe(3);
    }
  });

  // OS CINCO LIMITES DO BRIEF, conferidos no texto que realmente sai. O prompt do
  // agente reativo pede pro modelo respeitá-los; aqui não há modelo, então dá pra
  // exigir de verdade.
  it("nenhum texto cruza os limites do brief", () => {
    for (const g of GATILHOS) {
      for (const t of TONS) {
        const m = montarCutucada(alvo({ gatilho: g }), t).toLowerCase();
        expect(m).not.toContain("patrimônio");   // 1. não é extrato
        expect(m).not.toContain("quebrado");     // 2. não zoa aperto
        expect(m).not.toMatch(/xp\b|nível \d/);  // 4. não gamifica estrago
        expect(m).not.toContain("das pessoas");  // 5. não compara com os outros
        expect(m).not.toContain("do pessoal");
      }
    }
  });

  // Meta batida é a única hora de celebrar (regra do brief). Nem o caos pode
  // transformar a conquista em piada às custas dela.
  it("meta concluída reconhece, inclusive no caos", () => {
    expect(montarCutucada(alvo({ gatilho: "meta_concluida", dificuldade: "dificil" }), "caos")).toContain("chegou");
    expect(montarCutucada(alvo({ gatilho: "meta_concluida" }), "elogio")).toContain("cumprida");
  });

  it("prazo vira dia/mês legível, e sem prazo não quebra", () => {
    expect(montarCutucada(alvo({ gatilho: "meta_risco", prazo: "2026-10-01" }), "seco")).toContain("01/10");
    expect(montarCutucada(alvo({ gatilho: "meta_risco", prazo: null }), "seco")).toContain("em breve");
  });
});

describe("escolherAlvo", () => {
  // UMA por vez: mandar as três juntas é a diferença entre um aviso e um sermão.
  it("boa notícia vem antes de qualquer cobrança", () => {
    const escolhido = escolherAlvo([
      alvo({ gatilho: "teto_estourado" }),
      alvo({ gatilho: "meta_parada" }),
      alvo({ gatilho: "meta_concluida" }),
    ]);
    expect(escolhido.gatilho).toBe("meta_concluida");
  });

  // Dinheiro escapando agora ganha de dinheiro que não entrou: o primeiro ainda dá
  // pra interromper hoje.
  it("teto estourado ganha de meta parada", () => {
    const escolhido = escolherAlvo([alvo({ gatilho: "meta_parada" }), alvo({ gatilho: "teto_estourado" })]);
    expect(escolhido.gatilho).toBe("teto_estourado");
  });

  it("sem alvo, não cutuca", () => {
    expect(escolherAlvo([])).toBe(null);
  });

  it("a prioridade cobre todos os gatilhos — nenhum fica órfão", () => {
    expect([...PRIORIDADE].sort()).toEqual([...GATILHOS].sort());
  });
});

// ============================================================================
// O aviso do modo pesado (Lucas, 19/09)
// ============================================================================
// "modo leve é claro kk — mas avisa que se continuarem sem disciplina o modo pesado
// chegará em breve". Todo mundo começa no seco (o leve); o aviso transforma isso
// numa promessa em vez de uma configuração escondida.
describe("aviso do modo pesado", () => {
  const cobranca = alvo({ gatilho: "teto_estourado" });

  it("aparece nas duas primeiras cutucadas do modo leve", () => {
    for (const n of [0, 1]) {
      expect(comAvisoDeModoPesado("base", cobranca, "seco", n)).toContain("modo pesado");
    }
  });

  // Repetido em toda mensagem vira assinatura de rodapé — ninguém lê rodapé, e a
  // ameaça perde a graça por ser constante.
  it("some a partir da terceira", () => {
    for (const n of [2, 3, 10]) {
      expect(comAvisoDeModoPesado("base", cobranca, "seco", n)).toBe("base");
    }
  });

  // Celebração com ameaça anexada não é celebração — é elogio com cobrança no fim,
  // que é o que faz alguém parar de contar as próprias vitórias.
  it("NUNCA acompanha meta cumprida", () => {
    const vitoria = alvo({ gatilho: "meta_concluida" });
    expect(comAvisoDeModoPesado("base", vitoria, "seco", 0)).toBe("base");
  });

  it("não aparece no caos nem no elogio", () => {
    // No caos ele JÁ é o modo pesado; prometer o que já está acontecendo é bobagem.
    expect(comAvisoDeModoPesado("base", cobranca, "caos", 0)).toBe("base");
    expect(comAvisoDeModoPesado("base", cobranca, "elogio", 0)).toBe("base");
  });

  it("o aviso diz que hoje é leve e que o pesado vem", () => {
    const m = comAvisoDeModoPesado("base", cobranca, "seco", 0).toLowerCase();
    expect(m).toContain("modo leve");
    expect(m).toContain("em breve");
  });
});
