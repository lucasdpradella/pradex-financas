// Regras puras do cakto-webhook (supabase/functions/cakto-webhook/regras.ts):
// oferta → plano, plano_ate e o ANTI-DOWNGRADE.
import { describe, it, expect } from "vitest";
import {
  NIVEL_PLANO,
  resolverPlanoDaOferta,
  calcularPlanoAte,
  decidirLiberacao,
  planoVigente,
  CANDIDATOS_PROXIMA_COBRANCA,
  revogacaoSeAplica,
  OFERTAS_CASAL_FIXAS,
} from "../supabase/functions/cakto-webhook/regras.ts";

const CFG = {
  offerEssencial: "of_ess", offerAssistente: "of_ast", offerCasal: "of_cas",
  productEssencial: "pr_ess", productAssistente: "pr_ast", productCasal: "pr_cas",
};
const AGORA = new Date("2026-09-25T12:00:00Z");
const dias = (n) => new Date(AGORA.getTime() + n * 86400000).toISOString();

describe("NIVEL_PLANO", () => {
  it("casal é o nível 3, acima do assistente", () => {
    expect(NIVEL_PLANO).toEqual({ none: 0, essencial: 1, assistente: 2, casal: 3 });
  });
});

describe("resolverPlanoDaOferta", () => {
  it("mapeia as três ofertas", () => {
    expect(resolverPlanoDaOferta({ offer: { id: "of_ess" } }, CFG)).toBe("essencial");
    expect(resolverPlanoDaOferta({ offer: { id: "of_ast" } }, CFG)).toBe("assistente");
    expect(resolverPlanoDaOferta({ offer: { id: "of_cas" } }, CFG)).toBe("casal");
  });
  it("cai pro produto quando a oferta não bate", () => {
    expect(resolverPlanoDaOferta({ offer: { id: "outra" }, product: { id: "pr_cas" } }, CFG)).toBe("casal");
  });
  it("sem variável do casal configurada, oferta do casal fica fora do mapa", () => {
    expect(resolverPlanoDaOferta({ offer: { id: "of_cas" } }, { ...CFG, offerCasal: "", productCasal: "" })).toBeNull();
  });
  it("variável vazia não casa com id vazio", () => {
    expect(resolverPlanoDaOferta({}, { offerCasal: "" })).toBeNull();
  });
  it("id repetido em duas variáveis resolve pro plano MAIOR", () => {
    expect(resolverPlanoDaOferta({ offer: { id: "x" } }, { offerEssencial: "x", offerCasal: "x" })).toBe("casal");
  });
});

describe("ofertas fixas do Casal (344ridx)", () => {
  it("código curto e completo viram casal, mesmo sem variável de ambiente", () => {
    expect(OFERTAS_CASAL_FIXAS).toEqual(["344ridx", "344ridx_1135957"]);
    expect(resolverPlanoDaOferta({ offer: { id: "344ridx" } }, {})).toBe("casal");
    expect(resolverPlanoDaOferta({ offer: { id: "344ridx_1135957" } }, {})).toBe("casal");
  });
  it("o valor com cupom (rodri30, ~R$ 219,12) não muda nada — plano sai da oferta", () => {
    expect(resolverPlanoDaOferta({ offer: { id: "344ridx_1135957" }, amount: 219.12 }, CFG)).toBe("casal");
    expect(resolverPlanoDaOferta({ offer: { id: "344ridx" }, amount: 249 }, CFG)).toBe("casal");
  });
  it("oferta do Essencial continua Essencial", () => {
    expect(resolverPlanoDaOferta({ offer: { id: "a2xpq3u" } }, { offerEssencial: "a2xpq3u" })).toBe("essencial");
  });
});

describe("cenário Steffani: Essencial (a2xpq3u) → Casal (344ridx)", () => {
  const cfg = { offerEssencial: "a2xpq3u" };
  it("pagamento do Casal com plano atual assistente (manual) sobe pra casal", () => {
    const plano = resolverPlanoDaOferta({ offer: { id: "344ridx_1135957" } }, cfg);
    const d = decidirLiberacao({ plano: "assistente", plano_ate: dias(31) }, plano, dias(30), AGORA, true);
    expect(d).toMatchObject({ plano: "casal", manteveSuperior: false });
  });
  it("pagamento do Casal com plano atual essencial sobe pra casal", () => {
    const d = decidirLiberacao({ plano: "essencial", plano_ate: dias(31) }, "casal", dias(30), AGORA, true);
    expect(d.plano).toBe("casal");
  });
  it("renovação atrasada do Essencial depois do Casal NÃO rebaixa", () => {
    const plano = resolverPlanoDaOferta({ offer: { id: "a2xpq3u" } }, cfg);
    const d = decidirLiberacao({ plano: "casal", plano_ate: dias(30) }, plano, dias(31), AGORA, true);
    expect(d).toMatchObject({ plano: "casal", plano_ate: dias(30), manteveSuperior: true });
  });
  it("cancelamento/reembolso da assinatura Essencial é IGNORADO com Casal ativo", () => {
    const plano = resolverPlanoDaOferta({ offer: { id: "a2xpq3u" } }, cfg);
    expect(plano).toBe("essencial");
    expect(revogacaoSeAplica("casal", plano)).toBe(false);
    expect(revogacaoSeAplica("assistente", plano)).toBe(false);
  });
  it("cancelamento do próprio Casal revoga", () => {
    expect(revogacaoSeAplica("casal", "casal")).toBe(true);
  });
});

describe("revogacaoSeAplica", () => {
  it("só revoga quando o plano atual é exatamente o da oferta", () => {
    expect(revogacaoSeAplica("essencial", "essencial")).toBe(true);
    expect(revogacaoSeAplica("assistente", "essencial")).toBe(false);
    expect(revogacaoSeAplica("essencial", "assistente")).toBe(false);
    expect(revogacaoSeAplica("none", "essencial")).toBe(false);
    expect(revogacaoSeAplica(null, "casal")).toBe(false);
  });
});

describe("calcularPlanoAte", () => {
  it("usa subscription.next_payment_date (formato real da Cakto)", () => {
    const r = calcularPlanoAte({ subscription: { next_payment_date: "2026-10-25T01:08:59.244913-03:00" } }, AGORA);
    expect(r.origem).toBe("subscription.next_payment_date");
    expect(r.valor).toBe(new Date("2026-10-25T01:08:59.244913-03:00").toISOString());
  });
  it("next_payment_date nulo (purchase_approved) cai no fallback de 31 dias", () => {
    const r = calcularPlanoAte({ paidAt: "2026-09-25T12:00:00Z", subscription: { next_payment_date: null } }, AGORA);
    expect(r.origem).toBe("fallback_31d");
    expect(r.valor).toBe("2026-10-26T12:00:00.000Z");
  });
  it("next_payment_date é o primeiro candidato", () => {
    expect(CANDIDATOS_PROXIMA_COBRANCA[0]).toBe("next_payment_date");
  });
});

describe("planoVigente", () => {
  it("plano pago sem prazo conta como vigente (concessão manual)", () => {
    expect(planoVigente({ plano: "assistente", plano_ate: null }, AGORA)).toBe(true);
  });
  it("vencido não vale", () => {
    expect(planoVigente({ plano: "assistente", plano_ate: dias(-1) }, AGORA)).toBe(false);
  });
  it("none nunca é vigente", () => {
    expect(planoVigente({ plano: "none", plano_ate: dias(10) }, AGORA)).toBe(false);
  });
});

describe("decidirLiberacao — anti-downgrade", () => {
  it("none → compra libera o plano da oferta", () => {
    const d = decidirLiberacao({ plano: "none", plano_ate: null }, "essencial", dias(31), AGORA);
    expect(d).toMatchObject({ plano: "essencial", plano_ate: dias(31), manteveSuperior: false });
  });
  it("upgrade essencial → casal grava casal", () => {
    const d = decidirLiberacao({ plano: "essencial", plano_ate: dias(10) }, "casal", dias(30), AGORA);
    expect(d).toMatchObject({ plano: "casal", plano_ate: dias(30), manteveSuperior: false });
  });
  it("NUNCA rebaixa: assistente vigente + compra de essencial mantém assistente e o prazo", () => {
    const d = decidirLiberacao({ plano: "assistente", plano_ate: dias(10) }, "essencial", dias(31), AGORA);
    expect(d).toMatchObject({ plano: "assistente", plano_ate: dias(10), manteveSuperior: true });
  });
  it("NUNCA rebaixa: casal vigente + renovação de assistente mantém casal", () => {
    const d = decidirLiberacao({ plano: "casal", plano_ate: dias(5) }, "assistente", dias(31), AGORA);
    expect(d.plano).toBe("casal");
    expect(d.manteveSuperior).toBe(true);
  });
  it("não estende o prazo do plano maior com a compra do menor", () => {
    const d = decidirLiberacao({ plano: "casal", plano_ate: dias(2) }, "essencial", dias(31), AGORA);
    expect(d.plano_ate).toBe(dias(2));
  });
  it("plano maior sem prazo (manual) também é protegido", () => {
    const d = decidirLiberacao({ plano: "assistente", plano_ate: null }, "essencial", dias(31), AGORA);
    expect(d).toMatchObject({ plano: "assistente", plano_ate: null, manteveSuperior: true });
  });
  it("plano maior VENCIDO pode ser substituído pelo menor", () => {
    const d = decidirLiberacao({ plano: "assistente", plano_ate: dias(-3) }, "essencial", dias(31), AGORA);
    expect(d).toMatchObject({ plano: "essencial", plano_ate: dias(31), manteveSuperior: false });
  });
  it("mesmo plano com data de fallback: plano_ate só anda pra frente", () => {
    const d = decidirLiberacao({ plano: "essencial", plano_ate: dias(40) }, "essencial", dias(31), AGORA);
    expect(d.plano_ate).toBe(new Date(dias(40)).toISOString());
  });
  it("mesmo plano com data da Cakto: a data da Cakto manda (corrige o fallback do purchase_approved)", () => {
    const d = decidirLiberacao({ plano: "essencial", plano_ate: dias(31) }, "essencial", dias(30), AGORA, true);
    expect(d.plano_ate).toBe(dias(30));
  });
  it("perfil nulo é tratado como none", () => {
    const d = decidirLiberacao(null, "assistente", dias(31), AGORA);
    expect(d).toMatchObject({ plano: "assistente", manteveSuperior: false });
  });
});
