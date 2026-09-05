// supabase/functions/cakto-webhook/index.ts
//
// Webhook da Cakto → plano em fp_perfil.
// Recebe evento → valida origem (HMAC-SHA256, com fallback pro secret no corpo) →
// mapeia oferta → plano → acha o usuário por e-mail → grava plano/plano_ate.
// Compra sem conta correspondente vai pra pendencias_assinatura (não falha o webhook).
//
// Idempotência por (event, data.id) em cakto_eventos, que também guarda o payload cru.
//
// Contrato da Cakto (docs.cakto.com.br/conceitos/webhooks):
//   envelope: { secret, event, data }
//   data: { id, status, amount, customer{email,...}, offer{id,...}, product{id,...},
//           subscription, subscription_period, paidAt, ... }
//   assinatura: X-Cakto-Signature: v1=<hmac-sha256 de "{timestamp}.{corpo cru}">
//               X-Cakto-Timestamp: unix seconds
//   resposta: 2xx em até 8s. Retentativa SÓ em falha de rede/timeout — 5xx do nosso
//   código não é reentregue. Por isso aqui devolve 200 quase sempre e registra o erro
//   em cakto_eventos.resultado='erro' (reenvio vira ação manual no painel).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ===== CONFIG =====
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CAKTO_WEBHOOK_SECRET = Deno.env.get("CAKTO_WEBHOOK_SECRET") ?? "";
const CAKTO_OFFER_ESSENCIAL = Deno.env.get("CAKTO_OFFER_ESSENCIAL") ?? "";
const CAKTO_OFFER_ASSISTENTE = Deno.env.get("CAKTO_OFFER_ASSISTENTE") ?? "";
// Fallback: se a Cakto mandar um id de oferta diferente do mapeado (order bump,
// upsell, oferta nova criada no painel), ainda dá pra resolver pelo produto.
const CAKTO_PRODUCT_ESSENCIAL = Deno.env.get("CAKTO_PRODUCT_ESSENCIAL") ?? "";
const CAKTO_PRODUCT_ASSISTENTE = Deno.env.get("CAKTO_PRODUCT_ASSISTENTE") ?? "";

// Tolerância de replay na assinatura. A Cakto reentrega por até 30min, então a
// janela precisa cobrir isso — o que barra é replay de payload antigo, não retry.
const TOLERANCIA_TIMESTAMP_S = 60 * 45;

const DIAS_PADRAO_CICLO = 31;

type Plano = "essencial" | "assistente";

// Eventos que liberam acesso. purchase_approved entra porque a primeira cobrança de
// uma assinatura chega como compra aprovada (com o objeto subscription preenchido).
const EVENTOS_LIBERAM = new Set([
  "purchase_approved",
  "subscription_created",
  "subscription_renewed",
  "subscription_resumed",
]);

// Eventos que revogam. A revogação é ESCOPADA na oferta (ver o bloco de revogação):
// só derruba o acesso se o plano atual do usuário veio da oferta deste evento.
const EVENTOS_REVOGAM = new Set([
  "subscription_canceled",
  "subscription_renewal_refused",
  "subscription_paused",
  "purchase_refused",
  "refund",
  "chargeback",
]);

// Ruído de funil: chegam no mesmo webhook e não mexem em acesso.
const EVENTOS_IGNORADOS = new Set([
  "initiate_checkout",
  "checkout_abandonment",
  "pix_gerado",
  "boleto_gerado",
  "picpay_gerado",
  "openfinance_nubank_gerado",
]);

// ===== HELPERS =====
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function getSupabase(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function logInfo(cid: string, evento: string, data?: unknown) {
  console.log(JSON.stringify({ level: "info", correlation_id: cid, evento, ...(data ? { data } : {}), ts: new Date().toISOString() }));
}

function logErro(cid: string, evento: string, erro: unknown) {
  console.error(JSON.stringify({ level: "error", correlation_id: cid, evento, erro: String(erro), ts: new Date().toISOString() }));
}

async function hmacSha256Hex(segredo: string, mensagem: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const assinatura = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(mensagem));
  return Array.from(new Uint8Array(assinatura)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Valida a origem. Preferência pelo HMAC; se a Cakto não mandar o header (o painel
// permite webhook só com o secret no corpo), cai pra comparação do campo `secret`.
async function origemValida(
  rawBody: string,
  headerAssinatura: string,
  headerTimestamp: string,
  secretNoCorpo: string,
): Promise<{ ok: boolean; via: string; motivo?: string }> {
  if (!CAKTO_WEBHOOK_SECRET) return { ok: false, via: "nenhum", motivo: "CAKTO_WEBHOOK_SECRET ausente" };

  if (headerAssinatura) {
    const ts = Number(headerTimestamp);
    if (!Number.isFinite(ts)) return { ok: false, via: "hmac", motivo: "timestamp invalido" };
    const idade = Math.abs(Date.now() / 1000 - ts);
    if (idade > TOLERANCIA_TIMESTAMP_S) return { ok: false, via: "hmac", motivo: `timestamp fora da janela (${Math.round(idade)}s)` };

    const esperado = await hmacSha256Hex(CAKTO_WEBHOOK_SECRET, `${headerTimestamp}.${rawBody}`);
    const recebido = headerAssinatura.startsWith("v1=") ? headerAssinatura.slice(3) : headerAssinatura;
    if (!constantTimeEquals(recebido.toLowerCase(), esperado)) return { ok: false, via: "hmac", motivo: "assinatura nao confere" };
    return { ok: true, via: "hmac" };
  }

  if (secretNoCorpo) {
    if (!constantTimeEquals(secretNoCorpo, CAKTO_WEBHOOK_SECRET)) return { ok: false, via: "secret_corpo", motivo: "secret nao confere" };
    return { ok: true, via: "secret_corpo" };
  }

  return { ok: false, via: "nenhum", motivo: "sem header de assinatura e sem secret no corpo" };
}

function planoDaOferta(data: Record<string, any>): Plano | null {
  const offerId = String(data?.offer?.id ?? "");
  if (offerId && CAKTO_OFFER_ASSISTENTE && offerId === CAKTO_OFFER_ASSISTENTE) return "assistente";
  if (offerId && CAKTO_OFFER_ESSENCIAL && offerId === CAKTO_OFFER_ESSENCIAL) return "essencial";

  const productId = String(data?.product?.id ?? "");
  if (productId && CAKTO_PRODUCT_ASSISTENTE && productId === CAKTO_PRODUCT_ASSISTENTE) return "assistente";
  if (productId && CAKTO_PRODUCT_ESSENCIAL && productId === CAKTO_PRODUCT_ESSENCIAL) return "essencial";

  return null;
}

// plano_ate — ATENÇÃO: a doc da Cakto documenta que existe um objeto `subscription`
// mas NÃO especifica os campos dele. Em vez de fixar um nome inventado, sonda os
// candidatos plausíveis e, não achando, cai num ciclo padrão. O payload cru fica em
// cakto_eventos.payload: depois do primeiro evento real dá pra fixar o campo certo.
const CANDIDATOS_PROXIMA_COBRANCA = [
  "nextChargeDate", "next_charge_date", "nextBillingDate", "next_billing_date",
  "nextPayment", "next_payment", "currentPeriodEnd", "current_period_end",
  "expiresAt", "expires_at", "renewsAt", "renews_at",
];

function calcularPlanoAte(data: Record<string, any>): { valor: string; origem: string } {
  const sub = data?.subscription;
  if (sub && typeof sub === "object") {
    for (const chave of CANDIDATOS_PROXIMA_COBRANCA) {
      const bruto = sub[chave];
      if (!bruto) continue;
      const d = new Date(bruto);
      if (!isNaN(d.getTime())) return { valor: d.toISOString(), origem: `subscription.${chave}` };
    }
  }
  const base = data?.paidAt ? new Date(data.paidAt) : new Date();
  const partida = isNaN(base.getTime()) ? new Date() : base;
  partida.setDate(partida.getDate() + DIAS_PADRAO_CICLO);
  return { valor: partida.toISOString(), origem: `fallback_${DIAS_PADRAO_CICLO}d` };
}

// ===== MAIN HANDLER =====
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Corpo cru: o HMAC é sobre os bytes recebidos. Reserializar o JSON invalida.
  const rawBody = await req.text();

  let secretNoCorpo = "";
  try { secretNoCorpo = String(JSON.parse(rawBody)?.secret ?? ""); } catch { secretNoCorpo = ""; }

  const auth = await origemValida(
    rawBody,
    req.headers.get("x-cakto-signature") ?? "",
    req.headers.get("x-cakto-timestamp") ?? "",
    secretNoCorpo,
  );
  if (!auth.ok) {
    console.error(JSON.stringify({ level: "warn", evento: "auth_failed", via: auth.via, motivo: auth.motivo, ts: new Date().toISOString() }));
    return new Response("Unauthorized", { status: 401 });
  }

  let envelope: Record<string, any>;
  try {
    envelope = JSON.parse(rawBody);
  } catch (e) {
    logErro("unknown", "json_invalido", e);
    return new Response("ok", { status: 200 });
  }

  const event = String(envelope?.event ?? "");
  const data = (envelope?.data ?? {}) as Record<string, any>;
  const eventId = String(data?.id ?? "");
  const email = String(data?.customer?.email ?? "").trim();
  const cid = eventId || crypto.randomUUID();
  const supabase = getSupabase();

  // Registra o desfecho junto com o payload cru. `resultado` é o que o runbook lê.
  const registrar = async (resultado: string, detalhe: string, plano: string | null, userId: string | null) => {
    const { error } = await supabase.from("cakto_eventos").upsert({
      event, event_id: eventId, resultado, detalhe,
      email: email || null, plano, user_id: userId, payload: envelope,
    }, { onConflict: "event,event_id", ignoreDuplicates: true });
    if (error) logErro(cid, "registro_evento_falhou", error.message);
  };

  try {
    if (!event || !eventId) {
      logErro(cid, "envelope_incompleto", { event, eventId });
      return new Response("ok", { status: 200 });
    }

    // Idempotência: a Cakto reentrega em falha de rede e tem reenvio manual no painel.
    const { data: jaVisto } = await supabase
      .from("cakto_eventos").select("id, resultado")
      .eq("event", event).eq("event_id", eventId).maybeSingle();
    if (jaVisto) {
      logInfo(cid, "evento_duplicado", { event, resultado_anterior: jaVisto.resultado });
      return new Response("ok", { status: 200 });
    }

    if (EVENTOS_IGNORADOS.has(event)) {
      await registrar("ignorado", "evento de funil, nao mexe em acesso", null, null);
      return new Response("ok", { status: 200 });
    }

    const libera = EVENTOS_LIBERAM.has(event);
    const revoga = EVENTOS_REVOGAM.has(event);
    if (!libera && !revoga) {
      await registrar("ignorado", `evento nao mapeado: ${event}`, null, null);
      logInfo(cid, "evento_nao_mapeado", { event });
      return new Response("ok", { status: 200 });
    }

    const plano = planoDaOferta(data);
    if (!plano) {
      await registrar("ignorado", `oferta fora do mapa (offer=${data?.offer?.id ?? "-"}, product=${data?.product?.id ?? "-"})`, null, null);
      logInfo(cid, "oferta_nao_mapeada", { offer: data?.offer?.id, product: data?.product?.id });
      return new Response("ok", { status: 200 });
    }

    // Só libera com dinheiro confirmado. Boleto/pix gerado chega como waiting_payment
    // e não pode virar acesso — quem libera é o evento de pagamento aprovado.
    const status = String(data?.status ?? "");
    if (libera && status !== "paid") {
      await registrar("ignorado", `evento de liberacao com status '${status}'`, plano, null);
      logInfo(cid, "liberacao_sem_pagamento", { event, status });
      return new Response("ok", { status: 200 });
    }

    if (!email) {
      await registrar("erro", "evento sem customer.email", plano, null);
      logErro(cid, "sem_email", { event });
      return new Response("ok", { status: 200 });
    }

    // auth.users não sai pelo PostgREST — RPC security definer (ver migration).
    const { data: userId, error: erroLookup } = await supabase.rpc("fp_user_id_por_email", { p_email: email });
    if (erroLookup) {
      await registrar("erro", `lookup de e-mail falhou: ${erroLookup.message}`, plano, null);
      logErro(cid, "lookup_falhou", erroLookup.message);
      return new Response("ok", { status: 200 });
    }

    if (!userId) {
      // Brief item 4: comprou e não tem conta. Fila pro Lucas amarrar, sem falhar.
      if (libera) {
        await supabase.from("pendencias_assinatura").insert({ email, plano, event, event_id: eventId, motivo: "sem_auth_user" });
      }
      await registrar("sem_conta", "e-mail da compra nao tem conta no app", plano, null);
      logInfo(cid, "sem_conta", { email, plano, libera });
      return new Response("ok", { status: 200 });
    }

    if (revoga) {
      // Revogação escopada: só derruba se o plano atual veio DESTA oferta. Sem isso,
      // um purchase_refused de Essencial derrubaria o Assistente ativo de quem só
      // tentou comprar outra coisa.
      const { data: perfil } = await supabase
        .from("fp_perfil").select("plano").eq("user_id", userId).maybeSingle();
      if (!perfil) {
        await registrar("sem_conta", "auth.users existe mas nao ha fp_perfil", plano, userId);
        return new Response("ok", { status: 200 });
      }
      if (perfil.plano !== plano) {
        await registrar("ignorado", `revogacao ignorada: plano atual '${perfil.plano}' nao veio desta oferta ('${plano}')`, plano, userId);
        logInfo(cid, "revogacao_fora_de_escopo", { atual: perfil.plano, oferta: plano });
        return new Response("ok", { status: 200 });
      }

      const { error } = await supabase.from("fp_perfil")
        .update({ plano: "none", plano_ate: null }).eq("user_id", userId);
      if (error) {
        await registrar("erro", `update de revogacao falhou: ${error.message}`, plano, userId);
        logErro(cid, "revogacao_falhou", error.message);
        return new Response("ok", { status: 200 });
      }
      await registrar("revogado", `${event} -> plano none`, plano, userId);
      logInfo(cid, "revogado", { event, plano_anterior: plano });
      return new Response("ok", { status: 200 });
    }

    const { valor: planoAte, origem: origemData } = calcularPlanoAte(data);
    const { data: linhas, error } = await supabase.from("fp_perfil")
      .update({ plano, plano_ate: planoAte }).eq("user_id", userId).select("user_id");
    if (error) {
      await registrar("erro", `update de liberacao falhou: ${error.message}`, plano, userId);
      logErro(cid, "liberacao_falhou", error.message);
      return new Response("ok", { status: 200 });
    }

    // auth.users existe mas fp_perfil não: conta criada fora do fluxo de cadastro do
    // app. Vira pendência em vez de inserir perfil pela metade (nome/telefone têm
    // constraint e o app depende deles).
    if (!linhas || linhas.length === 0) {
      await supabase.from("pendencias_assinatura").insert({ email, plano, event, event_id: eventId, motivo: "sem_fp_perfil" });
      await registrar("sem_conta", "usuario existe mas nao tem linha em fp_perfil", plano, userId);
      logInfo(cid, "sem_fp_perfil", { email, plano });
      return new Response("ok", { status: 200 });
    }

    await registrar("aplicado", `${event} -> ${plano} (plano_ate via ${origemData})`, plano, userId);
    logInfo(cid, "aplicado", { event, plano, plano_ate: planoAte, origem_data: origemData, via_auth: auth.via });
    return new Response("ok", { status: 200 });
  } catch (e) {
    logErro(cid, "erro_inesperado", e);
    try { await registrar("erro", `excecao: ${String(e)}`, null, null); } catch (_) { /* ja logado */ }
    // 200 de propósito: a Cakto não reentrega 5xx, então devolver erro só perderia o
    // evento. O registro em cakto_eventos.resultado='erro' é o que permite reprocessar.
    return new Response("ok", { status: 200 });
  }
});
