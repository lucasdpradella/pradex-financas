// MODO CAOS — os comandos de tom.
//
// Testa `supabase/functions/agente-pradex/tom.ts`, que roda no Deno e não no bundle
// do app. É a lógica mais fácil de quebrar sem ninguém perceber: o efeito de um
// falso-negativo só aparece na conversa de um cliente já irritado, e ninguém vai
// reportar "o agente não me obedeceu quando pedi pra calar" — vai só cancelar.
import { describe, it, expect } from "vitest";
import {
  normalizar, detectarComando, aplicarComando, tomVigente, estaEmSilencio, instrucaoDeTom, LIMITES, HORAS_24,
} from "../supabase/functions/agente-pradex/tom.ts";

const daquiA = (ms) => new Date(Date.now() + ms).toISOString();

describe("normalizar", () => {
  it("tira acento, pontuação e caixa", () => {
    expect(normalizar("SILÊNCIO!!!")).toBe("silencio");
    expect(normalizar("  Fica   Sério.  ")).toBe("fica serio");
  });

  // O colapso de letra repetida é o que faz o dicionário funcionar no WhatsApp de
  // verdade, onde ninguém escreve como no dicionário.
  it("colapsa letra repetida", () => {
    expect(normalizar("caaaala")).toBe("cala");
    expect(normalizar("shhhhh")).toBe("sh");
  });
});

describe("detectarComando", () => {
  it("reconhece pedido de silêncio em várias formas", () => {
    for (const t of ["cala", "CALA A BOCA", "cala a boca!!", "me deixa em paz", "xiu", "chega disso", "modo silêncio"]) {
      expect(detectarComando(t)).toBe("silencio");
    }
  });

  it("reconhece caos, seco e elogio", () => {
    expect(detectarComando("modo caos")).toBe("caos");
    expect(detectarComando("me zoa")).toBe("caos");
    expect(detectarComando("fica sério")).toBe("seco");
    expect(detectarComando("me elogia")).toBe("elogio");
  });

  // O DETALHE QUE FAZ OU QUEBRA ISTO (está no brief): "para" dentro de um lançamento
  // não é pedido de silêncio. Sem esta regra, metade dos lançamentos com "para"
  // calaria o agente — e o cliente jamais associaria uma coisa à outra.
  it("NÃO cala num lançamento que só contém a palavra", () => {
    expect(detectarComando("paguei 50 para o joão ontem no pix")).toBe(null);
    expect(detectarComando("gastei 120 no mercado, chega de compra esse mês viu")).toBe(null);
    expect(detectarComando("transferi 200 para minha mãe")).toBe(null);
  });

  it("aceita o comando no começo de frase curta", () => {
    expect(detectarComando("cala essa boca")).toBe("silencio");
    expect(detectarComando("caos por favor")).toBe("caos");
  });

  // "chega de elogio" começa com "chega" (silêncio) mas É pedido de caos. O mais
  // específico tem que ganhar, senão quem quer o sarro de volta é calado.
  it("o mais específico ganha do mais genérico", () => {
    expect(detectarComando("chega de elogio")).toBe("caos");
    expect(detectarComando("para de me elogiar")).toBe("caos");
    expect(detectarComando("chega")).toBe("silencio");
  });

  it("mensagem normal não é comando", () => {
    expect(detectarComando("gastei 50 no mercado")).toBe(null);
    expect(detectarComando("")).toBe(null);
    expect(detectarComando("quanto eu gastei esse mês?")).toBe(null);
  });

  // Fronteira de palavra: sem ela, "seco" casaria com "secou" e "para" com "parabéns".
  it("não casa no meio de outra palavra", () => {
    expect(detectarComando("secou a conta")).toBe(null);
    expect(detectarComando("parabens pelo app")).toBe(null);
  });
});

describe("aplicarComando", () => {
  it("cala por 24h e responde a frase do brief", () => {
    const { patch, resposta } = aplicarComando("silencio");
    const ate = new Date(patch.agente_silencio_ate).getTime() - Date.now();
    expect(ate).toBeGreaterThan(HORAS_24 - 5000);
    expect(ate).toBeLessThanOrEqual(HORAS_24);
    expect(resposta).toContain("calo por 24h");
  });

  // Quem pede caos estando em silêncio quer barulho AGORA. Manter o silêncio seria
  // obedecer o pedido de ontem em vez do de hoje.
  it("qualquer comando zera o silêncio", () => {
    for (const c of ["caos", "seco", "elogio"]) {
      expect(aplicarComando(c).patch.agente_silencio_ate).toBe(null);
    }
  });

  it("caos e seco mudam o tom base e saem do elogio", () => {
    expect(aplicarComando("caos").patch).toMatchObject({ agente_tom: "caos", agente_elogio_ate: null });
    expect(aplicarComando("seco").patch).toMatchObject({ agente_tom: "seco", agente_elogio_ate: null });
  });

  // Elogio não toca no tom base: passadas as 24h, a pessoa volta pro que era antes.
  it("elogio é temporário e não apaga o tom base", () => {
    const { patch } = aplicarComando("elogio");
    expect(patch.agente_tom).toBeUndefined();
    expect(new Date(patch.agente_elogio_ate).getTime()).toBeGreaterThan(Date.now());
  });
});

describe("tomVigente e silêncio", () => {
  it("o padrão é seco", () => {
    expect(tomVigente({})).toBe("seco");
    expect(tomVigente({ agente_tom: null })).toBe("seco");
  });

  it("elogio vigente ganha do tom base", () => {
    expect(tomVigente({ agente_tom: "caos", agente_elogio_ate: daquiA(60000) })).toBe("elogio");
  });

  // Expirado é o mesmo que nunca ter existido — é o que dispensa cron de limpeza.
  it("data no passado simplesmente deixa de valer", () => {
    expect(tomVigente({ agente_tom: "caos", agente_elogio_ate: daquiA(-60000) })).toBe("caos");
    expect(estaEmSilencio({ agente_silencio_ate: daquiA(-1000) })).toBe(false);
    expect(estaEmSilencio({ agente_silencio_ate: daquiA(60000) })).toBe(true);
    expect(estaEmSilencio({})).toBe(false);
  });
});

describe("prompt", () => {
  it("cada tom tem instrução própria e com exemplo", () => {
    for (const t of ["seco", "caos", "elogio"]) {
      expect(instrucaoDeTom(t).length).toBeGreaterThan(80);
      expect(instrucaoDeTom(t)).toContain("TOM:");
    }
    expect(instrucaoDeTom("caos")).not.toBe(instrucaoDeTom("seco"));
  });

  // Os cinco limites do brief são a parte que NÃO muda com o tom: cruzar qualquer
  // uma custa o cliente, no elogio ou no caos.
  it("os cinco limites estão todos no prompt", () => {
    for (const marca of ["patrimônio", "pobreza", "caráter", "XP", "feed"]) {
      expect(LIMITES).toContain(marca);
    }
  });
});
