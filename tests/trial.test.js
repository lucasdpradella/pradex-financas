import { describe, it, expect } from "vitest";
import {
  DIAS_TRIAL,
  CHECKOUT,
  temTrial,
  trialAtivo,
  trialExpirado,
  podeIniciarTrial,
  diasRestantesTrial,
  podeUsarWhatsapp,
  temAcesso,
  conteudoUpgrade,
} from "../src/lib/plano";

const HOJE = new Date("2026-09-07T12:00:00Z");
const dias = (n) => new Date(HOJE.getTime() + n * 86400000).toISOString();

const SEM_TRIAL = { trial_inicio: null, trial_ate: null };
const ATIVO = { trial_inicio: dias(-3), trial_ate: dias(11) };
const EXPIRADO = { trial_inicio: dias(-20), trial_ate: dias(-6) };
const ULTIMO_DIA = { trial_inicio: dias(-13), trial_ate: dias(0.5) };

describe("estados do trial", () => {
  it("distingue nunca testou, testando e já testou", () => {
    expect(temTrial(SEM_TRIAL)).toBe(false);
    expect(trialAtivo(ATIVO, HOJE)).toBe(true);
    expect(trialExpirado(ATIVO, HOJE)).toBe(false);
    expect(trialAtivo(EXPIRADO, HOJE)).toBe(false);
    expect(trialExpirado(EXPIRADO, HOJE)).toBe(true);
  });

  it("trial ausente, nulo ou com data inválida não libera nada", () => {
    for (const t of [null, undefined, {}, { trial_inicio: "banana", trial_ate: "x" }, { trial_inicio: dias(-1), trial_ate: null }]) {
      expect(trialAtivo(t, HOJE)).toBe(false);
      expect(podeUsarWhatsapp("none", t, HOJE)).toBe(false);
    }
  });

  it("expira exatamente na virada, não depois", () => {
    const t = { trial_inicio: dias(-14), trial_ate: HOJE.toISOString() };
    expect(trialAtivo(t, HOJE)).toBe(false);
    expect(trialAtivo(t, new Date(HOJE.getTime() - 1000))).toBe(true);
  });
});

describe("podeUsarWhatsapp — o gate do Zap", () => {
  it("free com trial ativo usa o Zap", () => {
    expect(podeUsarWhatsapp("none", ATIVO, HOJE)).toBe(true);
  });

  it("free sem trial ou com trial expirado não usa", () => {
    expect(podeUsarWhatsapp("none", SEM_TRIAL, HOJE)).toBe(false);
    expect(podeUsarWhatsapp("none", EXPIRADO, HOJE)).toBe(false);
  });

  it("pago ignora o trial — expirado não derruba quem assinou", () => {
    for (const plano of ["essencial", "assistente"]) {
      expect(podeUsarWhatsapp(plano, EXPIRADO, HOJE)).toBe(true);
      expect(podeUsarWhatsapp(plano, SEM_TRIAL, HOJE)).toBe(true);
    }
  });
});

describe("o trial NÃO é upgrade disfarçado", () => {
  // A regra que separa o teste do Zap do plano Assistente. Se isto quebrar, 14 dias
  // de trial passam a dar FP e Relatórios de graça.
  it("trial ativo não abre FP nem Relatórios", () => {
    expect(podeUsarWhatsapp("none", ATIVO, HOJE)).toBe(true);
    expect(temAcesso("none", "fp")).toBe(false);
    expect(temAcesso("none", "relatorios")).toBe(false);
  });

  it("o CTA de FP durante o trial continua sendo checkout do Assistente", () => {
    const r = conteudoUpgrade("none", "fp", { trial: ATIVO, hoje: HOJE });
    expect(r.modo).toBe("checkout");
    expect(r.href).toBe(CHECKOUT.assistente);
  });
});

describe("podeIniciarTrial", () => {
  it("só quem nunca testou e não paga", () => {
    expect(podeIniciarTrial("none", SEM_TRIAL)).toBe(true);
    expect(podeIniciarTrial("none", ATIVO)).toBe(false);
    expect(podeIniciarTrial("none", EXPIRADO)).toBe(false);
    expect(podeIniciarTrial("essencial", SEM_TRIAL)).toBe(false);
    expect(podeIniciarTrial("assistente", SEM_TRIAL)).toBe(false);
  });

  // "Não sei" é diferente de "nunca testou". Sem isso, um call site que esquecesse de
  // passar o trial ofereceria 14 dias grátis a quem já queimou os dele.
  it("trial desconhecido (null) não vira oferta", () => {
    expect(podeIniciarTrial("none", null)).toBe(false);
    expect(podeIniciarTrial("none", undefined)).toBe(false);
    expect(conteudoUpgrade("none", "whatsapp").modo).toBe("checkout");
  });
});

describe("diasRestantesTrial", () => {
  it("arredonda pra cima — no último dia mostra 1, nunca 0", () => {
    expect(diasRestantesTrial(ULTIMO_DIA, HOJE)).toBe(1);
    expect(diasRestantesTrial(ATIVO, HOJE)).toBe(11);
  });

  it("é zero sem trial ativo", () => {
    expect(diasRestantesTrial(SEM_TRIAL, HOJE)).toBe(0);
    expect(diasRestantesTrial(EXPIRADO, HOJE)).toBe(0);
  });
});

describe("copy do CTA por estado", () => {
  it("nunca testou → oferece o teste, não o checkout", () => {
    const r = conteudoUpgrade("none", "whatsapp", { trial: SEM_TRIAL, hoje: HOJE });
    expect(r.modo).toBe("trial");
    expect(r.cta).toBe(`Testar ${DIAS_TRIAL} dias grátis`);
    expect(r.nota).toMatch(/Sem cartão/);
  });

  it("já testou e acabou → reconhece isso e manda assinar", () => {
    const r = conteudoUpgrade("none", "whatsapp", { trial: EXPIRADO, hoje: HOJE });
    expect(r.modo).toBe("checkout");
    expect(r.cta).toBe("Assinar o Essencial");
    expect(r.nota).toMatch(/teste de 14 dias terminou/);
    expect(r.href).toBe(CHECKOUT.essencial);
  });

  it("sem informação de trial, o comportamento antigo continua valendo", () => {
    const r = conteudoUpgrade("essencial", "fp");
    expect(r.modo).toBe("checkout");
    expect(r.cta).toBe("Fazer upgrade");
  });
});
