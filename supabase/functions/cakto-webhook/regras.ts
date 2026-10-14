// supabase/functions/cakto-webhook/regras.ts
//
// Lógica pura do webhook da Cakto — sem Deno, sem Supabase, sem rede. Separada do
// index.ts pra ser testada no Vitest (tests/cakto-regras.test.js), no mesmo padrão de
// agente-cutucada/mensagens.ts.

export type Plano = "essencial" | "assistente" | "casal";

// Espelha src/lib/plano.js. Planos são ordinais: o de cima tem tudo do de baixo.
export const NIVEL_PLANO: Record<string, number> = { none: 0, essencial: 1, assistente: 2, casal: 3 };

export const nivel = (plano: unknown): number => NIVEL_PLANO[String(plano ?? "none")] ?? 0;

// Ofertas do Casal fixas no código (2026-09-25): o link é
// https://pay.cakto.com.br/344ridx_1135957 e a Cakto pode mandar em data.offer.id
// tanto o código curto quanto o completo. As variáveis CAKTO_OFFER_CASAL /
// CAKTO_PRODUCT_CASAL continuam valendo como adicionais (oferta nova, upsell).
//
// ⚠️ NUNCA decidir plano pelo valor (`amount`): a primeira cobrança do Casal pode vir
// com cupom (rodri30 = 12% → ~R$ 219,12 em vez de R$ 249,00).
export const OFERTAS_CASAL_FIXAS = ["344ridx", "344ridx_1135957"];

export type ConfigOfertas = {
  offerEssencial?: string; offerAssistente?: string; offerCasal?: string;
  productEssencial?: string; productAssistente?: string; productCasal?: string;
};

// Oferta → plano. Mapa 100% por variável de ambiente (CAKTO_OFFER_* / CAKTO_PRODUCT_*):
// código de oferta nunca fica fixo no código. Do mais alto pro mais baixo, pra que um
// id repetido por engano em duas variáveis resolva pro plano maior, nunca pro menor.
export function resolverPlanoDaOferta(data: Record<string, any>, cfg: ConfigOfertas): Plano | null {
  const offerId = String(data?.offer?.id ?? "");
  if (offerId) {
    if (OFERTAS_CASAL_FIXAS.includes(offerId)) return "casal";
    if (cfg.offerCasal && offerId === cfg.offerCasal) return "casal";
    if (cfg.offerAssistente && offerId === cfg.offerAssistente) return "assistente";
    if (cfg.offerEssencial && offerId === cfg.offerEssencial) return "essencial";
  }
  const productId = String(data?.product?.id ?? "");
  if (productId) {
    if (cfg.productCasal && productId === cfg.productCasal) return "casal";
    if (cfg.productAssistente && productId === cfg.productAssistente) return "assistente";
    if (cfg.productEssencial && productId === cfg.productEssencial) return "essencial";
  }
  return null;
}

export const DIAS_PADRAO_CICLO = 31;

// plano_ate — a doc da Cakto não especifica os campos de `subscription`, então sonda
// candidatos. `next_payment_date` vem PRIMEIRO: é o campo que os payloads reais
// guardados em cakto_eventos mostraram (data.subscription.next_payment_date — vem
// preenchido no subscription_created e NULO no purchase_approved do mesmo pedido).
// Até 2026-09-25 ele não estava na lista e todo plano_ate caía no fallback de 31 dias.
export const CANDIDATOS_PROXIMA_COBRANCA = [
  "next_payment_date", "nextPaymentDate",
  "nextChargeDate", "next_charge_date", "nextBillingDate", "next_billing_date",
  "nextPayment", "next_payment", "currentPeriodEnd", "current_period_end",
  "expiresAt", "expires_at", "renewsAt", "renews_at",
];

export function calcularPlanoAte(data: Record<string, any>, agora: Date = new Date()): { valor: string; origem: string } {
  const sub = data?.subscription;
  if (sub && typeof sub === "object") {
    for (const chave of CANDIDATOS_PROXIMA_COBRANCA) {
      const bruto = sub[chave];
      if (!bruto) continue;
      const d = new Date(bruto);
      if (!isNaN(d.getTime())) return { valor: d.toISOString(), origem: `subscription.${chave}` };
    }
  }
  const base = data?.paidAt ? new Date(data.paidAt) : new Date(agora.getTime());
  const partida = isNaN(base.getTime()) ? new Date(agora.getTime()) : base;
  partida.setDate(partida.getDate() + DIAS_PADRAO_CICLO);
  return { valor: partida.toISOString(), origem: `fallback_${DIAS_PADRAO_CICLO}d` };
}

const dataValida = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
};

// Plano atual ainda vale? plano_ate nulo num plano pago = concessão manual sem prazo
// (o Lucas liberando na mão) — conta como ativo, pra não ser atropelada.
export function planoVigente(atual: { plano?: unknown; plano_ate?: unknown } | null, agora: Date = new Date()): boolean {
  if (!atual || nivel(atual.plano) === 0) return false;
  const ate = dataValida(atual.plano_ate);
  return ate === null || ate.getTime() > agora.getTime();
}

export type Decisao = {
  plano: string;
  plano_ate: string | null;
  // true quando o plano gravado NÃO é o da oferta (anti-downgrade).
  manteveSuperior: boolean;
  motivo: string;
};

// ANTI-DOWNGRADE (2026-09-25). Antes, toda liberação fazia `update plano = <oferta>`
// às cegas: quem tinha Assistente (ou Casal, propagado pelo parceiro) e pagava um
// Essencial — ou tinha uma renovação atrasada do Essencial antigo chegando depois do
// upgrade — CAÍA de plano. Regras:
//   - plano atual MAIOR e ainda vigente → mantém plano e plano_ate como estão. Não
//     estende o prazo do plano maior com dinheiro do menor (seria dar o plano maior
//     de graça).
//   - mesmo plano → renova. Se a data veio da própria Cakto (`dataDaCakto`), ela
//     manda: é a próxima cobrança real, e o fallback de 31d gravado pelo
//     purchase_approved do mesmo pedido precisa ser corrigido por ela. Se a data é
//     fallback, plano_ate só anda pra frente (nunca encurta).
//   - plano atual menor, ou maior mas vencido → grava o da oferta.
export function decidirLiberacao(
  atual: { plano?: unknown; plano_ate?: unknown } | null,
  novoPlano: Plano,
  novoAte: string,
  agora: Date = new Date(),
  dataDaCakto = false,
): Decisao {
  const nAtual = nivel(atual?.plano);
  const nNovo = nivel(novoPlano);

  if (nAtual > nNovo && planoVigente(atual, agora)) {
    return {
      plano: String(atual!.plano),
      plano_ate: (atual!.plano_ate as string | null) ?? null,
      manteveSuperior: true,
      motivo: `anti-downgrade: mantido '${atual!.plano}' (oferta era '${novoPlano}')`,
    };
  }

  if (nAtual === nNovo) {
    if (dataDaCakto) return { plano: novoPlano, plano_ate: novoAte, manteveSuperior: false, motivo: "renovacao/mesmo plano (data da Cakto)" };
    const ateAtual = dataValida(atual?.plano_ate);
    const ateNovo = dataValida(novoAte);
    const maior = ateAtual && ateNovo && ateAtual.getTime() > ateNovo.getTime() ? ateAtual.toISOString() : novoAte;
    return { plano: novoPlano, plano_ate: maior, manteveSuperior: false, motivo: "renovacao/mesmo plano" };
  }

  return { plano: novoPlano, plano_ate: novoAte, manteveSuperior: false, motivo: nAtual < nNovo ? "upgrade/liberacao" : "plano superior vencido" };
}

// REVOGAÇÃO ESCOPADA. Cancelamento/reembolso/chargeback só derruba o acesso se o
// plano ATUAL do usuário é exatamente o plano da oferta do evento. Exemplo real
// (2026-09-25): a Steffani assinou o Essencial (oferta a2xpq3u), subiu pro Casal, e o
// Lucas cancela a assinatura antiga do Essencial — esse cancelamento NÃO pode tirar o
// Casal dela. Plano atual maior, menor ou diferente → ignora.
export function revogacaoSeAplica(planoAtual: unknown, planoDaOfertaDoEvento: Plano): boolean {
  return String(planoAtual ?? "none") === planoDaOfertaDoEvento;
}
