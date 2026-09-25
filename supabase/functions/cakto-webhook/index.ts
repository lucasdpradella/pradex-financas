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
import {
  type Plano,
  resolverPlanoDaOferta,
  calcularPlanoAte,
  decidirLiberacao,
  revogacaoSeAplica,
} from "./regras.ts";

// ===== CONFIG =====
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CAKTO_WEBHOOK_SECRET = Deno.env.get("CAKTO_WEBHOOK_SECRET") ?? "";
// Quando "true", recusa webhook sem assinatura HMAC. Fica desligado ate os logs
// confirmarem que todo evento real da Cakto chega assinado — ligar as cegas derruba
// processamento de pagamento.
const CAKTO_EXIGIR_HMAC = (Deno.env.get("CAKTO_EXIGIR_HMAC") ?? "").toLowerCase() === "true";
const CAKTO_OFFER_ESSENCIAL = Deno.env.get("CAKTO_OFFER_ESSENCIAL") ?? "";
const CAKTO_OFFER_ASSISTENTE = Deno.env.get("CAKTO_OFFER_ASSISTENTE") ?? "";
// Fallback: se a Cakto mandar um id de oferta diferente do mapeado (order bump,
// upsell, oferta nova criada no painel), ainda dá pra resolver pelo produto.
const CAKTO_PRODUCT_ESSENCIAL = Deno.env.get("CAKTO_PRODUCT_ESSENCIAL") ?? "";
const CAKTO_PRODUCT_ASSISTENTE = Deno.env.get("CAKTO_PRODUCT_ASSISTENTE") ?? "";
// Plano Casal (2026-09-25). As ofertas '344ridx' e '344ridx_1135957' já são
// reconhecidas SEM secret (OFERTAS_CASAL_FIXAS em ./regras.ts). Estas duas variáveis
// são OPCIONAIS, pra oferta/produto adicional do Casal (upsell, oferta nova):
//   supabase secrets set CAKTO_OFFER_CASAL=<codigo> CAKTO_PRODUCT_CASAL=<id> --project-ref sjvuhqqsjboncwpboclv
const CAKTO_OFFER_CASAL = Deno.env.get("CAKTO_OFFER_CASAL") ?? "";
const CAKTO_PRODUCT_CASAL = Deno.env.get("CAKTO_PRODUCT_CASAL") ?? "";

// Tolerância de replay na assinatura. A Cakto reentrega por até 30min, então a
// janela precisa cobrir isso — o que barra é replay de payload antigo, não retry.
const TOLERANCIA_TIMESTAMP_S = 60 * 45;

// ===== AVISO DE VENDA E KIT DE BOAS-VINDAS (2026-09-17) =====
//
// POR QUE ISTO EXISTE. Em 16/09 o Augusto assinou o Essencial, o pagamento passou, o
// webhook liberou o plano — e o Lucas só soube porque ele contou. A primeira venda do
// produto chegou em silêncio. Não era bug: o webhook nunca teve pra onde avisar.
//
// São dois envios, com propósitos opostos:
//   1. pro LUCAS  — "vendeu" / "vendeu mas não liberou" / "cancelou". Operacional.
//   2. pro CLIENTE — o kit de boas-vindas: o que ele acabou de comprar e como usar.
//
// ⚠️ NENHUM dos dois pode derrubar o webhook. O plano já foi gravado quando o envio
// acontece; se a Z-API estiver fora, a pessoa tem que continuar com acesso. Por isso
// tudo aqui é try/catch que só loga, e o resultado do envio NUNCA muda a resposta.
//
// SECRETS. No Supabase o secret é do PROJETO, não da função — todas as Edge
// Functions enxergam os mesmos. Então ZAPI_INSTANCE, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN
// já estão disponíveis aqui, porque `trial-lembretes` as usa. A única que falta é:
//
//   supabase secrets set ALERTA_WHATSAPP=55DDNNNNNNNNN --project-ref sjvuhqqsjboncwpboclv
//   supabase functions deploy cakto-webhook --project-ref sjvuhqqsjboncwpboclv
//
// O deploy é obrigatório: push no `main` publica o FRONT na Vercel e não toca nas
// Edge Functions. Sem ele este arquivo fica no repo e a função em produção continua
// a versão antiga, sem avisar nada.
//
// Sem ALERTA_WHATSAPP o aviso é pulado e o log diz isso em alto e bom som — o
// silêncio de 16/09 não pode acontecer de novo por variável esquecida.
const ZAPI_INSTANCE = Deno.env.get("ZAPI_INSTANCE") ?? "";
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN") ?? "";
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";
const ALERTA_WHATSAPP = Deno.env.get("ALERTA_WHATSAPP") ?? "";
const TIMEOUT_ZAPI = 10000;

const URL_APP = "https://pradex.com.br";
const URL_GUIA = "https://pradex.com.br/guia";
const WA_AGENTE = "https://wa.me/5511924568633";

const ROTULO_PLANO: Record<string, string> = { essencial: "Essencial", assistente: "Assistente", casal: "Casal" };

// Mesmo helper de `trial-lembretes`. Duplicado de propósito: Edge Functions não
// compartilham módulo entre si sem um pacote publicado, e copiar 15 linhas custa
// menos que criar essa dependência agora.
async function enviarZap(phone: string, message: string): Promise<{ ok: boolean; detalhe: string }> {
  if (!phone) return { ok: false, detalhe: "sem numero" };
  if (!ZAPI_INSTANCE || !ZAPI_TOKEN || !ZAPI_CLIENT_TOKEN) return { ok: false, detalhe: "zapi nao configurada" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_ZAPI);
  try {
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone, message }),
      signal: controller.signal,
    });
    return { ok: res.ok, detalhe: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, detalhe: String(e) };
  } finally {
    clearTimeout(timer);
  }
}

const brl = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  // A Cakto manda `amount` em reais nos eventos que vimos até aqui. Se um dia vier em
  // centavos, o número vai aparecer 100x maior no aviso — visível na hora, e é por
  // isso que o valor vai no aviso do Lucas e não em lugar nenhum que o cliente veja.
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

// Aviso pro Lucas. Curto e escaneável: ele vai ler isso no celular, provavelmente no
// meio de outra coisa.
function avisoVenda(tipo: "venda" | "sem_conta" | "cancelou", dados: {
  plano: string; email: string; nome?: string; valor?: unknown; motivo?: string; nota?: string;
}): string {
  const rotulo = ROTULO_PLANO[dados.plano] ?? dados.plano;
  const quem = dados.nome ? `${dados.nome} (${dados.email})` : dados.email;

  if (tipo === "venda") {
    return `💰 *Venda no Pradex*\n\n` +
      `*${rotulo}* — ${brl(dados.valor)}\n` +
      `${quem}\n\n` +
      (dados.nota ? dados.nota : `Acesso liberado e kit de boas-vindas enviado.`);
  }
  if (tipo === "sem_conta") {
    return `⚠️ *Pagou e NÃO liberou*\n\n` +
      `*${rotulo}* — ${brl(dados.valor)}\n` +
      `${quem}\n\n` +
      `Motivo: ${dados.motivo ?? "sem conta no app"}.\n` +
      `Está em \`pendencias_assinatura\` — precisa amarrar na mão. O cliente pagou e não tem acesso.`;
  }
  return `🔻 *Assinatura encerrada*\n\n*${rotulo}* — ${quem}\n\nAcesso removido.`;
}

// Kit de boas-vindas pro cliente. Uma mensagem só, no WhatsApp, logo depois do
// pagamento — é onde a pessoa está olhando naquele minuto. O manual completo mora em
// /guia (página viva, não PDF: o guia anterior virou desatualizado em 4 meses).
function kitBoasVindas(nome: string, plano: string): string {
  const primeiroNome = String(nome || "").trim().split(/\s+/)[0] || "tudo certo";
  const base = `Oi, ${primeiroNome}! 👋 Seu *${ROTULO_PLANO[plano] ?? plano}* está ativo.\n\n`;

  if (plano === "casal") {
    return base +
      `*O que você destravou (pra vocês dois):*\n` +
      `• Tudo do Assistente: WhatsApp, teto por categoria, Planejamento Financeiro e Relatórios\n` +
      `• Um livro só pro casal — os dois lançam e enxergam as mesmas contas\n\n` +
      `*Comece por aqui:* me manda _"gastei 50 no mercado"_ nesta conversa. Eu registro e você confere no app.\n\n` +
      `📘 Manual completo: ${URL_GUIA}\n` +
      `📱 App: ${URL_APP}\n\n` +
      `Qualquer dúvida é só responder aqui.`;
  }

  if (plano === "assistente") {
    return base +
      `*O que você destravou:*\n` +
      `• Lançar por aqui mesmo, no WhatsApp — texto ou áudio\n` +
      `• Teto por categoria, pra não estourar sem perceber\n` +
      `• Planejamento Financeiro e Relatórios no app\n\n` +
      `*Comece por aqui:* me manda _"gastei 50 no mercado"_ nesta conversa. Eu registro e você confere no app.\n\n` +
      `📘 Manual completo: ${URL_GUIA}\n` +
      `📱 App: ${URL_APP}\n\n` +
      `Qualquer dúvida é só responder aqui.`;
  }

  return base +
    `*O que você destravou:*\n` +
    `• Lançar por aqui mesmo, no WhatsApp — texto ou áudio\n` +
    `• Teto por categoria, pra não estourar sem perceber\n\n` +
    `*Comece por aqui:* me manda _"gastei 50 no mercado"_ nesta conversa. Eu registro e você confere no app.\n\n` +
    `📘 Manual completo: ${URL_GUIA}\n` +
    `📱 App: ${URL_APP}\n\n` +
    `Qualquer dúvida é só responder aqui.`;
}


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
    // Achado 5 da auditoria de 2026-09-12: este caminho é mais fraco que o HMAC.
    //
    // O secret no corpo é a MESMA senha em toda requisição — quem interceptar um
    // webhook consegue forjar infinitos. A assinatura HMAC muda com o conteúdo, então
    // interceptar "fulano comprou" não permite gerar "sicrano comprou". E o corpo vaza
    // mais fácil que header: vai parar em log, em proxy, em print de debug.
    //
    // Por que ele não foi simplesmente removido: se a Cakto estiver mandando eventos
    // reais sem o header, cortar aqui derruba o processamento de PAGAMENTO. Então o
    // caminho é medir antes de fechar — o log abaixo grita toda vez que o fallback é
    // usado. Confirmado nos logs que todo evento real chega com HMAC, basta setar:
    //
    //   supabase secrets set CAKTO_EXIGIR_HMAC=true --project-ref sjvuhqqsjboncwpboclv
    //
    // e o caminho fraco morre sem tocar em código.
    if (CAKTO_EXIGIR_HMAC) {
      return { ok: false, via: "secret_corpo", motivo: "CAKTO_EXIGIR_HMAC ligado e webhook veio sem assinatura" };
    }
    if (!constantTimeEquals(secretNoCorpo, CAKTO_WEBHOOK_SECRET)) return { ok: false, via: "secret_corpo", motivo: "secret nao confere" };
    console.warn(JSON.stringify({
      level: "warn",
      evento: "cakto_sem_hmac",
      detalhe: "webhook aceito pelo secret do corpo, sem assinatura. Caminho fraco — ver CAKTO_EXIGIR_HMAC.",
      ts: new Date().toISOString(),
    }));
    return { ok: true, via: "secret_corpo" };
  }

  return { ok: false, via: "nenhum", motivo: "sem header de assinatura e sem secret no corpo" };
}

// Mapa oferta → plano e cálculo de plano_ate moram em ./regras.ts (lógica pura,
// testada no Vitest). Aqui só entra a configuração vinda dos secrets.
function planoDaOferta(data: Record<string, any>): Plano | null {
  return resolverPlanoDaOferta(data, {
    offerEssencial: CAKTO_OFFER_ESSENCIAL, offerAssistente: CAKTO_OFFER_ASSISTENTE, offerCasal: CAKTO_OFFER_CASAL,
    productEssencial: CAKTO_PRODUCT_ESSENCIAL, productAssistente: CAKTO_PRODUCT_ASSISTENTE, productCasal: CAKTO_PRODUCT_CASAL,
  });
}

// Membros ativos do livro do usuário, fora ele. `livro_membros.user_id` é único
// (uma pessoa, um livro), então há no máximo um livro.
async function outrosMembrosDoLivro(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data: minha } = await supabase
    .from("livro_membros").select("livro_id").eq("user_id", userId).eq("ativo", true).maybeSingle();
  if (!minha?.livro_id) return [];
  const { data: membros } = await supabase
    .from("livro_membros").select("user_id").eq("livro_id", minha.livro_id).eq("ativo", true).neq("user_id", userId);
  return (membros ?? []).map((m: { user_id: string }) => m.user_id);
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
  //
  // Devolve `true` só quando a linha foi REALMENTE inserida. Com `ignoreDuplicates`
  // o insert vira ON CONFLICT DO NOTHING, então `.select()` volta vazio numa
  // reentrega — e é isso que dá idempotência aos avisos de graça, sem tabela nova.
  // Sem essa checagem, a Cakto reentregando o mesmo evento (ela reentrega por até
  // 30min em falha de rede) mandaria o kit de boas-vindas duas, três vezes.
  let idRegistrado: number | null = null;
  const registrar = async (resultado: string, detalhe: string, plano: string | null, userId: string | null): Promise<boolean> => {
    const { data: inseridas, error } = await supabase.from("cakto_eventos").upsert({
      event, event_id: eventId, resultado, detalhe,
      email: email || null, plano, user_id: userId, payload: envelope,
    }, { onConflict: "event,event_id", ignoreDuplicates: true }).select("id");
    if (error) { logErro(cid, "registro_evento_falhou", error.message); return false; }
    const nova = Array.isArray(inseridas) && inseridas.length > 0;
    if (nova) idRegistrado = Number(inseridas[0].id);
    return nova;
  };

  // Avisa o Lucas. Engole qualquer falha: o plano já está gravado a esta altura, e
  // Z-API fora do ar não pode virar erro de webhook.
  const avisarLucas = async (texto: string) => {
    if (!ALERTA_WHATSAPP) {
      logErro(cid, "alerta_sem_destino", "ALERTA_WHATSAPP nao configurada — venda nao avisada");
      return;
    }
    try {
      const r = await enviarZap(ALERTA_WHATSAPP, texto);
      logInfo(cid, "aviso_lucas", { ok: r.ok, detalhe: r.detalhe });
    } catch (e) {
      logErro(cid, "aviso_lucas_falhou", String(e));
    }
  };

  // true se ESTE evento é o primeiro do pedido (mesmo data.id) com um destes
  // resultados. Critério: o menor `cakto_eventos.id` vence. Comparar com "existe
  // outro?" falharia na corrida — se os dois eventos gravassem antes de qualquer um
  // conferir, cada um veria o outro e NINGUÉM avisaria. Com o menor id, exatamente
  // um avisa. Em erro de leitura, prefere avisar em dobro a não avisar.
  const primeiroDoPedido = async (resultados: string[]): Promise<boolean> => {
    if (idRegistrado === null) return true;
    try {
      const { data: primeiro, error } = await supabase
        .from("cakto_eventos").select("id")
        .eq("event_id", eventId).in("resultado", resultados)
        .order("id", { ascending: true }).limit(1).maybeSingle();
      if (error) { logErro(cid, "dedupe_pedido_falhou", error.message); return true; }
      return !primeiro || Number(primeiro.id) === idRegistrado;
    } catch (e) {
      logErro(cid, "dedupe_pedido_falhou", String(e));
      return true;
    }
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
      let detalhePendencia = "";
      if (libera) {
        // O insert pode falhar (ex.: check constraint de plano sem a migration do
        // Casal). Antes o erro era engolido e a pendência sumia sem rastro — agora vai
        // pro log e pro detalhe do evento.
        const { error: erroPend } = await supabase.from("pendencias_assinatura")
          .insert({ email, plano, event, event_id: eventId, motivo: "sem_auth_user" });
        if (erroPend) {
          logErro(cid, "pendencia_insert_falhou", erroPend.message);
          detalhePendencia = ` | ATENCAO: pendencia NAO gravada: ${erroPend.message}`;
        }
      }
      const novo = await registrar("sem_conta", `e-mail da compra nao tem conta no app${detalhePendencia}`, plano, null);
      logInfo(cid, "sem_conta", { email, plano, libera });
      // Este é o aviso MAIS urgente dos três: alguém pagou e está sem acesso agora.
      if (libera && novo && await primeiroDoPedido(["sem_conta"])) {
        await avisarLucas(avisoVenda("sem_conta", {
          plano, email, nome: data?.customer?.name, valor: data?.amount,
          motivo: "o e-mail da compra não tem conta no app",
        }));
      }
      return new Response("ok", { status: 200 });
    }

    if (revoga) {
      // Revogação escopada: só derruba se o plano atual veio DESTA oferta. Sem isso,
      // um purchase_refused de Essencial derrubaria o Assistente ativo de quem só
      // tentou comprar outra coisa.
      const { data: perfil } = await supabase
        .from("fp_perfil").select("plano, plano_ate").eq("user_id", userId).maybeSingle();
      if (!perfil) {
        await registrar("sem_conta", "auth.users existe mas nao ha fp_perfil", plano, userId);
        return new Response("ok", { status: 200 });
      }
      if (!revogacaoSeAplica(perfil.plano, plano)) {
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
      // Casal: derruba junto o parceiro que recebeu o plano POR PROPAGAÇÃO. Critério:
      // plano 'casal' com o MESMO plano_ate do pagador (é o que a propagação grava).
      // Quem tem Casal próprio, com outra data, não é tocado.
      let detalheCasal = "";
      if (plano === "casal") {
        try {
          const outros = await outrosMembrosDoLivro(supabase, userId);
          if (outros.length > 0 && perfil.plano_ate) {
            const { data: derrubados, error: erroProp } = await supabase.from("fp_perfil")
              .update({ plano: "none", plano_ate: null })
              .in("user_id", outros).eq("plano", "casal").eq("plano_ate", perfil.plano_ate)
              .select("user_id");
            if (erroProp) logErro(cid, "casal_revogacao_propagada_falhou", erroProp.message);
            detalheCasal = ` | casal: ${derrubados?.length ?? 0} membro(s) revogado(s)`;
          }
        } catch (e) {
          logErro(cid, "casal_revogacao_propagada_falhou", String(e));
        }
      }
      const novoRevog = await registrar("revogado", `${event} -> plano none${detalheCasal}`, plano, userId);
      logInfo(cid, "revogado", { event, plano_anterior: plano });
      // Cancelamento/reembolso também precisa chegar — churn silencioso é tão ruim
      // quanto venda silenciosa. O CLIENTE não recebe nada aqui: quem cancelou não
      // quer mensagem do produto que acabou de deixar.
      if (novoRevog && await primeiroDoPedido(["revogado"])) await avisarLucas(avisoVenda("cancelou", { plano, email, nome: data?.customer?.name }));
      return new Response("ok", { status: 200 });
    }

    const { valor: planoAteOferta, origem: origemData } = calcularPlanoAte(data);

    // Plano atual primeiro: é ele que decide se a oferta sobe, renova ou é ignorada
    // (ANTI-DOWNGRADE — ver decidirLiberacao em ./regras.ts).
    const { data: perfilAtual, error: erroAtual } = await supabase
      .from("fp_perfil").select("plano, plano_ate").eq("user_id", userId).maybeSingle();
    if (erroAtual) {
      await registrar("erro", `leitura do perfil falhou: ${erroAtual.message}`, plano, userId);
      logErro(cid, "leitura_perfil_falhou", erroAtual.message);
      return new Response("ok", { status: 200 });
    }

    // auth.users existe mas fp_perfil não: conta criada fora do fluxo de cadastro do
    // app. Vira pendência em vez de inserir perfil pela metade (nome/telefone têm
    // constraint e o app depende deles).
    if (!perfilAtual) {
      const { error: erroPend } = await supabase.from("pendencias_assinatura")
        .insert({ email, plano, event, event_id: eventId, motivo: "sem_fp_perfil" });
      if (erroPend) logErro(cid, "pendencia_insert_falhou", erroPend.message);
      const novo = await registrar(
        "sem_conta",
        `usuario existe mas nao tem linha em fp_perfil${erroPend ? ` | ATENCAO: pendencia NAO gravada: ${erroPend.message}` : ""}`,
        plano, userId,
      );
      logInfo(cid, "sem_fp_perfil", { email, plano });
      if (novo && await primeiroDoPedido(["sem_conta"])) {
        await avisarLucas(avisoVenda("sem_conta", {
          plano, email, nome: data?.customer?.name, valor: data?.amount,
          motivo: "a conta existe mas não tem perfil (`fp_perfil`)",
        }));
      }
      return new Response("ok", { status: 200 });
    }

    const decisao = decidirLiberacao(perfilAtual, plano, planoAteOferta, new Date(), origemData.startsWith("subscription."));
    const planoAte = decisao.plano_ate;
    if (!decisao.manteveSuperior) {
      const { error } = await supabase.from("fp_perfil")
        .update({ plano: decisao.plano, plano_ate: planoAte }).eq("user_id", userId);
      if (error) {
        await registrar("erro", `update de liberacao falhou: ${error.message}`, plano, userId);
        logErro(cid, "liberacao_falhou", error.message);
        return new Response("ok", { status: 200 });
      }
    }

    // Casal: o plano vale pros DOIS membros do livro do pagador. Propaga com o mesmo
    // plano_ate (é essa igualdade que a revogação usa pra saber quem derrubar).
    // Nunca rebaixa ninguém — casal é o nível mais alto — e nunca encurta um Casal
    // próprio do parceiro com data maior.
    let detalheCasal = "";
    if (decisao.plano === "casal" && !decisao.manteveSuperior && planoAte) {
      try {
        const outros = await outrosMembrosDoLivro(supabase, userId);
        let propagados = 0;
        for (const outroId of outros) {
          const { data: p } = await supabase
            .from("fp_perfil").select("plano, plano_ate").eq("user_id", outroId).maybeSingle();
          if (!p) continue;
          if (p.plano === "casal" && p.plano_ate && new Date(p.plano_ate).getTime() > new Date(planoAte).getTime()) continue;
          const { error: erroProp } = await supabase.from("fp_perfil")
            .update({ plano: "casal", plano_ate: planoAte }).eq("user_id", outroId);
          if (erroProp) logErro(cid, "casal_propagacao_falhou", erroProp.message);
          else propagados++;
        }
        detalheCasal = ` | casal: propagado a ${propagados} membro(s)`;
      } catch (e) {
        logErro(cid, "casal_propagacao_falhou", String(e));
      }
    }

    const novaVenda = await registrar(
      "aplicado",
      decisao.manteveSuperior
        ? `${event} -> ${decisao.motivo}`
        : `${event} -> ${plano} (plano_ate via ${origemData}; ${decisao.motivo})${detalheCasal}`,
      plano, userId,
    );
    logInfo(cid, "aplicado", { event, plano, gravado: decisao.plano, manteve_superior: decisao.manteveSuperior, plano_ate: planoAte, origem_data: origemData, via_auth: auth.via });

    // ===== Os dois envios. Nada daqui pra baixo pode falhar o webhook: o plano já
    // está gravado, e a resposta já seria 200 mesmo sem nenhum destes blocos. =====
    //
    // DEDUPE POR PEDIDO (2026-09-25). A Cakto manda purchase_approved E
    // subscription_created pro MESMO pedido (mesmo data.id), com segundos de
    // diferença — visto em produção em 25/09. A idempotência por (event, event_id)
    // tratava os dois como eventos novos, e o cliente recebia o kit duas vezes (e o
    // Lucas, dois avisos de venda). Agora só o PRIMEIRO evento 'aplicado' do pedido
    // dispara WhatsApp.
    if (novaVenda && await primeiroDoPedido(["aplicado"])) {
      // O kit vai pro telefone do PERFIL, nunca pro que veio no evento da Cakto: o
      // número do app é o que o agente reconhece, e mandar pro outro entregaria um
      // "me manda gastei 50" numa conversa que não vai funcionar.
      let nome = String(data?.customer?.name ?? "");
      let telefone = "";
      try {
        const { data: perfil } = await supabase
          .from("fp_perfil").select("nome,telefone").eq("user_id", userId).maybeSingle();
        if (perfil?.nome) nome = perfil.nome;
        telefone = String(perfil?.telefone ?? "");
      } catch (e) {
        logErro(cid, "perfil_para_kit_falhou", String(e));
      }

      // Anti-downgrade: quem já tem plano maior não recebe kit de um plano menor
      // (a mensagem diria "seu Essencial está ativo" pra quem está no Assistente).
      if (decisao.manteveSuperior) {
        logInfo(cid, "kit_pulado_anti_downgrade", { atual: decisao.plano, oferta: plano });
      } else if (telefone) {
        try {
          const r = await enviarZap(telefone, kitBoasVindas(nome, plano));
          logInfo(cid, "kit_boas_vindas", { ok: r.ok, detalhe: r.detalhe });
        } catch (e) {
          logErro(cid, "kit_falhou", String(e));
        }
      } else {
        logErro(cid, "kit_sem_telefone", "perfil sem telefone — cliente pagou e nao recebeu o kit");
      }

      await avisarLucas(avisoVenda("venda", {
        plano, email, nome, valor: data?.amount,
        nota: decisao.manteveSuperior
          ? `⚠️ Cliente já tinha o *${ROTULO_PLANO[decisao.plano] ?? decisao.plano}* vigente — plano mantido, kit NÃO enviado. Conferir se é compra duplicada.`
          : undefined,
      }));
    }

    return new Response("ok", { status: 200 });
  } catch (e) {
    logErro(cid, "erro_inesperado", e);
    try { await registrar("erro", `excecao: ${String(e)}`, null, null); } catch (_) { /* ja logado */ }
    // 200 de propósito: a Cakto não reentrega 5xx, então devolver erro só perderia o
    // evento. O registro em cakto_eventos.resultado='erro' é o que permite reprocessar.
    return new Response("ok", { status: 200 });
  }
});
