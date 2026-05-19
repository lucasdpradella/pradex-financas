// supabase/functions/agente-pradex/index.ts
//
// Agente IA do Pradex Finanças via WhatsApp.
// Recebe webhook Z-API → identifica cliente pelo telefone → processa msg (texto/áudio)
// → extrai gastos via Claude API com tool use → lança no Pradex via RPC transacional
// → responde no WhatsApp.
//
// Helpers isolados (Codex): callAnthropic, transcribeAudio, sendWhatsappText, lookupUserByPhone.
// Idempotência claim/done/failed. Auth com Client-Token em tempo constante.
// Observabilidade: correlation_id=messageId, latency, tokens, model.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ===== CONFIG =====
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY_AGENT") ?? "";
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";
const ZAPI_INSTANCE = Deno.env.get("ZAPI_INSTANCE") ?? "";
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN") ?? "";
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// Roteamento SDR (Opção 4): SDR e Pradex compartilham 1 Z-API; Edge consulta CRM Pradella e encaminha prospects pro n8n.
const CRM_SUPABASE_URL = Deno.env.get("CRM_SUPABASE_URL") ?? "";
const CRM_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("CRM_SUPABASE_SERVICE_ROLE_KEY") ?? "";
const N8N_SDR_WEBHOOK_URL = Deno.env.get("N8N_SDR_WEBHOOK_URL") ?? "";

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const ANTHROPIC_VERSION = "2023-06-01";
const TIMEOUTS = { anthropic: 30000, whisper: 30000, zapi: 10000, sdr_forward: 10000 };

// ===== HELPERS =====
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function normalizePhone(phone: unknown): string {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.length === 11) digits = "55" + digits;
  return digits;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
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

// ===== ROTEAMENTO SDR (Opção 4) =====
// Antes de processar como Pradex, checa se o telefone é um prospect ativo no CRM Pradella.
// Se for, encaminha o payload original pro webhook do n8n IA SDR e devolve true (handler retorna 200 e para).
// Try/catch envolve TUDO: se CRM cair ou n8n falhar, retorna false → fluxo Pradex segue normal (defesa em profundidade).
async function checkAndForwardToSdr(telefone: string, payloadOriginal: unknown, cid: string): Promise<boolean> {
  if (!CRM_SUPABASE_URL || !CRM_SUPABASE_SERVICE_ROLE_KEY || !N8N_SDR_WEBHOOK_URL) {
    return false;
  }
  try {
    const crm = createClient(CRM_SUPABASE_URL, CRM_SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await crm.from("leads").select("id").eq("telefone", telefone).eq("status", "Prospectado").limit(1).maybeSingle();
    if (error) { logErro(cid, "sdr_lookup_failed", error); return false; }
    if (!data) return false;
    logInfo(cid, "sdr_match_found", { lead_id: data.id });
    const res = await fetchWithTimeout(N8N_SDR_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadOriginal),
    }, TIMEOUTS.sdr_forward);
    logInfo(cid, "forwarded_to_sdr", { status: res.status, ok: res.ok });
    return true;
  } catch (e) {
    logErro(cid, "sdr_forward_exception", e);
    return false;
  }
}

// ===== Z-API =====
async function sendWhatsappText(phone: string, message: string, cid: string): Promise<boolean> {
  try {
    const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`;
    const res = await fetchWithTimeout(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
      body: JSON.stringify({ phone, message }),
    }, TIMEOUTS.zapi);
    if (!res.ok) { logErro(cid, "zapi_send_failed", res.status); return false; }
    logInfo(cid, "zapi_send_ok", { phone, len: message.length });
    return true;
  } catch (e) { logErro(cid, "zapi_send_exception", e); return false; }
}

async function downloadAudio(audioUrl: string, cid: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetchWithTimeout(audioUrl, { headers: { "Client-Token": ZAPI_CLIENT_TOKEN } }, TIMEOUTS.zapi);
    if (!res.ok) { logErro(cid, "audio_download_failed", res.status); return null; }
    return await res.arrayBuffer();
  } catch (e) { logErro(cid, "audio_download_exception", e); return null; }
}

// ===== WHISPER =====
async function transcribeAudio(audioBuffer: ArrayBuffer, cid: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), "audio.ogg");
    formData.append("model", "whisper-1");
    formData.append("language", "pt");
    formData.append("response_format", "text");
    const res = await fetchWithTimeout("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}` },
      body: formData,
    }, TIMEOUTS.whisper);
    if (!res.ok) { logErro(cid, "whisper_failed", res.status); return null; }
    const text = (await res.text()).trim();
    logInfo(cid, "whisper_ok", { length: text.length });
    return text;
  } catch (e) { logErro(cid, "whisper_exception", e); return null; }
}

// ===== ANTHROPIC =====
const SYSTEM_PROMPT = `Você é o assistente IA do Pradex Finanças. Atende clientes do Lucas Pradella (assessor de investimentos da Nobel Capital). Sua função é ajudar o cliente a registrar gastos e receitas no app Pradex via WhatsApp.

REGRAS DURAS:
1. Tom profissional descontraído. Direto, claro, com 👊 ocasional. Sem lowercase exagerado.
2. SEMPRE em português brasileiro.
3. SEMPRE chame a tool 'registrar_acoes' (mesmo se não houver ação, use 'acoes: []').
4. NUNCA invente lançamentos. Só registre o que o cliente disse explicitamente.
5. Edição/Deleção SÓ com lancamento_id explícito dos últimos 5 lançamentos do contexto. Ambiguidade → 'precisa_confirmar=true'.
6. Após cada ação, confirme: "✅ Lancei R$X,XX em [Categoria] 👊" ou similar.
7. Categorias: use SEMPRE uma da lista do cliente. Se nenhuma encaixar, use a mais próxima e avise: "_categorizei em [X], se for outra ajuste no app_"
8. Múltiplos gastos numa msg: lance todos, confirme num bloco só.
9. Receitas: "recebi 5000" → tipo='receita', categoria da lista.
10. Parcelamento: "comprei celular 3000 em 10x no nubank" → parcelado=true, total_parcelas=10. RPC divide automaticamente.
11. Cartões: use cartao_id se mencionar nome. "no crédito" sem nome → forma_pagamento="crédito", cartao_id=null.
12. Datas: default HOJE. "ontem" → data de ontem. Formato ISO YYYY-MM-DD.

EDIÇÃO/DELEÇÃO:
- "esquece o último", "errei", "apaga aquilo" → DELETAR mais recente.
- "era 35 não 50" referindo ao último → EDITAR valor.
- "aquele do mercado" sem clareza → precisa_confirmar=true, perguntar "qual deles? recentes: 1) X | 2) Y".

DADOS NÃO CLAROS:
- Valor obrigatório. Sem valor → peça "qual o valor exato?"
- Categoria: mais próxima.
- Data: default HOJE.

Sempre chame a tool 'registrar_acoes'. mensagem_resposta é o que o cliente lê no WhatsApp.`;

const TOOL_REGISTRAR_ACOES = {
  name: "registrar_acoes",
  description: "Registra ações no app Pradex (criar/editar/deletar) e define a mensagem ao cliente.",
  input_schema: {
    type: "object",
    properties: {
      acoes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            tipo: { type: "string", enum: ["criar", "editar", "deletar"] },
            lancamento_id: { type: ["integer", "null"] },
            dados: {
              type: "object",
              properties: {
                descricao: { type: "string" },
                valor: { type: "number", minimum: 0.01 },
                tipo: { type: "string", enum: ["gasto", "receita"] },
                categoria: { type: "string" },
                data_lancamento: { type: "string" },
                forma_pagamento: { type: ["string", "null"] },
                cartao_id: { type: ["integer", "null"] },
                parcelado: { type: "boolean" },
                total_parcelas: { type: ["integer", "null"], minimum: 2 },
              },
              required: ["valor", "tipo", "categoria"],
            },
          },
          required: ["tipo", "dados"],
        },
      },
      mensagem_resposta: { type: "string" },
      precisa_confirmar: { type: "boolean" },
    },
    required: ["mensagem_resposta", "precisa_confirmar"],
  },
};

async function callAnthropic(userMessage: string, contexto: any, cid: string): Promise<any | null> {
  const userContextual = `MENSAGEM DO CLIENTE (${contexto.nomeCliente}, ${contexto.telefone}):
${userMessage}

CONTEXTO:
- Data de hoje: ${contexto.dataHoje}
- Últimos 5 lançamentos (mais recente primeiro):
${contexto.ultimosLancamentos.length === 0 ? "  (nenhum)" : contexto.ultimosLancamentos.map((l: any) => `  - ID ${l.id}: ${l.tipo} R$${Number(l.valor).toFixed(2)} | ${l.categoria} | ${l.descricao} | ${l.data}`).join("\n")}
- Categorias disponíveis (use SEMPRE uma desta lista):
${contexto.categorias.map((c: any) => `  - "${c.nome}" (${c.tipo})`).join("\n")}
- Cartões cadastrados:
${contexto.cartoes.length === 0 ? "  (nenhum)" : contexto.cartoes.map((c: any) => `  - ID ${c.id}: "${c.nome}"`).join("\n")}

Responda chamando a tool 'registrar_acoes'.`;

  const startTime = Date.now();
  try {
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": ANTHROPIC_VERSION },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools: [TOOL_REGISTRAR_ACOES],
        tool_choice: { type: "tool", name: "registrar_acoes" },
        messages: [{ role: "user", content: userContextual }],
      }),
    }, TIMEOUTS.anthropic);
    const latency = Date.now() - startTime;
    if (!res.ok) { logErro(cid, "anthropic_failed", `${res.status} ${await res.text().catch(() => "")}`); return null; }
    const data = await res.json();
    const toolUse = data.content?.find((c: any) => c.type === "tool_use" && c.name === "registrar_acoes");
    if (!toolUse) { logErro(cid, "anthropic_no_tool_use", JSON.stringify(data).substring(0, 500)); return null; }
    const input = toolUse.input;
    if (typeof input.mensagem_resposta !== "string" || typeof input.precisa_confirmar !== "boolean") {
      logErro(cid, "anthropic_invalid_schema", JSON.stringify(input).substring(0, 500));
      return null;
    }
    logInfo(cid, "anthropic_ok", { latency_ms: latency, model: CLAUDE_MODEL, tokens_in: data.usage?.input_tokens, tokens_out: data.usage?.output_tokens, acoes_count: input.acoes?.length ?? 0 });
    return { acoes: input.acoes ?? [], mensagem_resposta: input.mensagem_resposta, precisa_confirmar: input.precisa_confirmar };
  } catch (e) { logErro(cid, "anthropic_exception", e); return null; }
}

// ===== LOOKUP =====
async function lookupUserByPhone(supabase: SupabaseClient, phone: string) {
  const { data } = await supabase.from("fp_perfil").select("user_id, nome").eq("telefone", phone).limit(1).maybeSingle();
  return data;
}

// Categorias padrão (espelha `defaultCategories` em src/App.jsx). Frontend mostra essas + customs do banco;
// backend antes só via customs, então o agente perdia "Alimentação", "Transporte", etc.
// User pode "remover" uma padrão (vira row com removida=true no banco) — respeitamos isso aqui.
const DEFAULT_CATEGORIAS: Record<string, string[]> = {
  gasto: ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Assinaturas", "Outros"],
  receita: ["Salário", "Freelance", "Investimentos", "Aluguel recebido", "Outros"],
};

async function getContextoUsuario(supabase: SupabaseClient, userId: string) {
  const [lancRes, catRes, cartRes] = await Promise.all([
    supabase.from("Lancamentos").select("id, valor, categoria, descricao, data_lancamento, tipo").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
    supabase.from("categorias").select("nome, tipo, removida").eq("user_id", userId),
    supabase.from("cartoes").select("id, nome").eq("user_id", userId).order("nome"),
  ]);

  const userCats = (catRes.data ?? []) as Array<{ nome: string; tipo: string; removida: boolean }>;
  const removedDefaults = new Set(userCats.filter(c => c.removida).map(c => `${c.tipo}:${c.nome}`));
  const customCats = userCats.filter(c => !c.removida);

  const merged: Array<{ nome: string; tipo: string }> = [];
  for (const tipo of Object.keys(DEFAULT_CATEGORIAS)) {
    for (const nome of DEFAULT_CATEGORIAS[tipo]) {
      if (!removedDefaults.has(`${tipo}:${nome}`)) merged.push({ nome, tipo });
    }
  }
  for (const c of customCats) merged.push({ nome: c.nome ?? "", tipo: c.tipo ?? "gasto" });

  // Dedup por (tipo, nome) caso user tenha custom com mesmo nome de uma padrão, ou duplicatas históricas
  const seen = new Set<string>();
  const categorias = merged.filter(c => {
    const k = `${c.tipo}:${c.nome}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    ultimosLancamentos: (lancRes.data ?? []).map((l: any) => ({ id: l.id, valor: l.valor, categoria: l.categoria ?? "", descricao: l.descricao ?? "", data: l.data_lancamento ?? "", tipo: l.tipo ?? "gasto" })),
    categorias,
    cartoes: (cartRes.data ?? []).map((c: any) => ({ id: c.id, nome: c.nome ?? "" })),
  };
}

// ===== IDEMPOTÊNCIA =====
async function tryClaimMessage(supabase: SupabaseClient, messageId: string, telefone: string): Promise<boolean> {
  const { error } = await supabase.from("agente_msgs_processadas").insert({ message_id: messageId, telefone, status: "processing", locked_at: new Date().toISOString() });
  if (error?.code === "23505") return false;
  if (error) { console.error("claim error:", error); return false; }
  return true;
}

async function markMessageDone(supabase: SupabaseClient, messageId: string, userId: string | null) {
  await supabase.from("agente_msgs_processadas").update({ status: "done", finished_at: new Date().toISOString(), user_id: userId }).eq("message_id", messageId);
}

async function markMessageFailed(supabase: SupabaseClient, messageId: string, errorCode: string) {
  await supabase.from("agente_msgs_processadas").update({ status: "failed", finished_at: new Date().toISOString(), error_code: errorCode }).eq("message_id", messageId);
}

async function gravarLog(supabase: SupabaseClient, log: any) {
  await supabase.from("agente_logs").insert(log);
}

// ===== ONBOARDING =====
async function getOnboardingState(supabase: SupabaseClient, telefone: string) {
  const { data } = await supabase.from("agente_onboarding_estado").select("*").eq("telefone", telefone).gt("expira_em", new Date().toISOString()).maybeSingle();
  return data;
}

async function setOnboardingState(supabase: SupabaseClient, telefone: string, dados: any) {
  await supabase.from("agente_onboarding_estado").upsert({ telefone, ...dados, updated_at: new Date().toISOString() }, { onConflict: "telefone" });
}

async function processarOnboarding(supabase: SupabaseClient, telefone: string, texto: string, cid: string): Promise<{ mensagem: string; concluido: boolean; userId?: string }> {
  let estado = await getOnboardingState(supabase, telefone);
  if (!estado) {
    await setOnboardingState(supabase, telefone, { estado_atual: "aguardando_email", tentativas: 0 });
    return { mensagem: "Oi! Sou o assistente IA do Pradex Finanças 👊\n\nPra eu vincular seu WhatsApp à sua conta no app, me passa o *email* que você usa pra logar no Pradex.", concluido: false };
  }
  if (estado.estado_atual === "aguardando_email") {
    const emailMatch = texto.trim().match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    if (!emailMatch) {
      const tentativas = (estado.tentativas ?? 0) + 1;
      await setOnboardingState(supabase, telefone, { tentativas });
      return { mensagem: "Não entendi seu email. Manda no formato seuemail@dominio.com 👊", concluido: false };
    }
    const email = emailMatch[0].toLowerCase();
    const { data: lookup } = await supabase.rpc("agente_buscar_user_por_email", { p_email: email });
    if (!lookup || !lookup[0]?.user_id) return { mensagem: `Não encontrei conta no Pradex com o email *${email}*.\n\nVerifica se digitou certo, ou cria sua conta primeiro em pradex-financas.vercel.app e depois volta aqui 👊`, concluido: false };
    const userId = lookup[0].user_id;
    const telefoneExistente = lookup[0].telefone_existente;
    if (telefoneExistente && telefoneExistente !== telefone) return { mensagem: `Encontrei sua conta, mas ela já tem outro WhatsApp cadastrado. Pra trocar, entra no app (aba Perfil) e atualiza o telefone primeiro.`, concluido: false };
    await setOnboardingState(supabase, telefone, { estado_atual: "aguardando_lgpd", email_candidato: email, user_id_candidato: userId });
    return { mensagem: `Achei sua conta ✅\n\nAntes de começar, preciso que você concorde:\n\n_"Os dados financeiros que você enviar aqui (gastos, receitas, áudios) serão registrados na sua conta do Pradex e processados por IA. Seus dados são protegidos conforme nossa Política de Privacidade."_\n\nResponde *OK* pra confirmar 👊`, concluido: false };
  }
  if (estado.estado_atual === "aguardando_lgpd") {
    const r = texto.trim().toUpperCase();
    if (r !== "OK" && r !== "CONCORDO" && r !== "SIM") return { mensagem: "Pra liberar o uso, responde *OK* confirmando o termo 👊", concluido: false };
    const { error } = await supabase.from("fp_perfil").update({ telefone }).eq("user_id", estado.user_id_candidato);
    if (error) { logErro(cid, "onboarding_link_failed", error); return { mensagem: "Tive um problema técnico vinculando sua conta. Tenta de novo em alguns minutos.", concluido: false }; }
    await setOnboardingState(supabase, telefone, { estado_atual: "concluido", consentido_em: new Date().toISOString() });
    return { mensagem: "✅ Tudo certo, conta vinculada! 👊\n\nA partir de agora você pode me mandar seus gastos por mensagem ou áudio:\n- _\"gastei 45 no almoço\"_\n- _\"recebi 5000 do salário hoje\"_\n- _\"35 no uber agora\"_\n\nManda aí seu primeiro lançamento.", concluido: true, userId: estado.user_id_candidato };
  }
  await supabase.from("agente_onboarding_estado").delete().eq("telefone", telefone);
  return { mensagem: "Vamos começar de novo. Me manda o email da sua conta no Pradex 👊", concluido: false };
}

// ===== PROCESSAR LANÇAMENTO =====
async function processarLancamento(supabase: SupabaseClient, userId: string, nomeCliente: string, telefone: string, texto: string, cid: string) {
  const dataHoje = new Date().toISOString().split("T")[0];
  const ctx = await getContextoUsuario(supabase, userId);
  const resp = await callAnthropic(texto, { nomeCliente, telefone, dataHoje, ...ctx }, cid);
  if (!resp) return { mensagem: "Tive um problema do meu lado processando sua mensagem. Tenta de novo em alguns segundos 🙏", acoesAplicadas: null };
  if (resp.precisa_confirmar || !resp.acoes || resp.acoes.length === 0) return { mensagem: resp.mensagem_resposta, acoesAplicadas: null };
  const { data: ids, error } = await supabase.rpc("agente_aplicar_acoes", { p_user_id: userId, p_acoes: resp.acoes });
  if (error) { logErro(cid, "rpc_aplicar_acoes_failed", error); return { mensagem: "Entendi mas tive problema gravando os lançamentos. Tenta de novo, e se persistir, lança pelo app 🙏", acoesAplicadas: null }; }
  return { mensagem: resp.mensagem_resposta, acoesAplicadas: ids ?? [] };
}

// ===== MAIN HANDLER =====
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  // Z-API envia o token no header "z-api-token" em webhooks (outbound), não em "client-token" (que é pra inbound).
  // Aceita match contra ZAPI_CLIENT_TOKEN (account-level) OU ZAPI_TOKEN (instance-level) — Z-API usa o instance token em webhooks.
  const receivedToken = req.headers.get("z-api-token") || req.headers.get("client-token") || "";
  const matchesClientToken = constantTimeEquals(receivedToken, ZAPI_CLIENT_TOKEN);
  const matchesInstanceToken = constantTimeEquals(receivedToken, ZAPI_TOKEN);
  if (!matchesClientToken && !matchesInstanceToken) {
    console.error(JSON.stringify({ level: "warn", evento: "auth_failed", ts: new Date().toISOString() }));
    return new Response("Unauthorized", { status: 401 });
  }

  const startTime = Date.now();
  let cid = "unknown";
  const supabase = getSupabase();

  try {
    const rawInput = await req.json();
    const payload = rawInput.body ?? rawInput;
    if (payload.isGroup === true) return new Response("ok", { status: 200 });
    if (payload.fromMe === true) return new Response("ok", { status: 200 });
    if (payload.type !== "ReceivedCallback") return new Response("ok", { status: 200 });

    const messageId = payload.messageId ?? payload.message_id ?? `noid_${Date.now()}`;
    cid = messageId;
    const telefone = normalizePhone(payload.phone ?? payload.from);
    const nomeRem = payload.senderName ?? payload.notifyName ?? "cliente";
    if (!telefone) { logErro(cid, "no_phone", payload); return new Response("ok", { status: 200 }); }

    logInfo(cid, "msg_received", { telefone });

    // Roteamento SDR: se telefone é prospect ativo no CRM Pradella, encaminha pro n8n e para.
    // Não claimamos a mensagem (agente_msgs_processadas é da idempotência do Pradex, não do SDR).
    if (await checkAndForwardToSdr(telefone, payload, cid)) {
      return new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    const claimed = await tryClaimMessage(supabase, messageId, telefone);
    if (!claimed) { logInfo(cid, "msg_already_processed", {}); return new Response("ok", { status: 200 }); }

    let textoMsg = "", tipoMsg = "texto", textoTrans: string | null = null;
    if (payload.text?.message) {
      textoMsg = String(payload.text.message).trim();
    } else if (payload.audio?.audioUrl) {
      tipoMsg = "audio";
      const buf = await downloadAudio(payload.audio.audioUrl, cid);
      if (!buf) { await markMessageFailed(supabase, messageId, "audio_download_failed"); await sendWhatsappText(telefone, "Não consegui baixar seu áudio 😕 manda em texto, por favor.", cid); return new Response("ok", { status: 200 }); }
      const t = await transcribeAudio(buf, cid);
      if (!t) { await markMessageFailed(supabase, messageId, "transcription_failed"); await sendWhatsappText(telefone, "Não consegui transcrever seu áudio. Tenta de novo ou manda em texto 🙏", cid); return new Response("ok", { status: 200 }); }
      textoTrans = t; textoMsg = t;
    } else {
      await markMessageFailed(supabase, messageId, "unsupported_type");
      await sendWhatsappText(telefone, "Por enquanto só processo *texto* e *áudio*. Manda numa dessas formas 👊", cid);
      return new Response("ok", { status: 200 });
    }

    if (!textoMsg) { await markMessageFailed(supabase, messageId, "empty_message"); return new Response("ok", { status: 200 }); }

    const usuario = await lookupUserByPhone(supabase, telefone);
    let mensagemResp: string, acoesApl: any = null, userIdFinal: string | null = null, statusFinal = "sucesso";

    if (!usuario) {
      const onb = await processarOnboarding(supabase, telefone, textoMsg, cid);
      mensagemResp = onb.mensagem;
      userIdFinal = onb.userId ?? null;
      statusFinal = onb.concluido ? "sucesso" : "onboarding";
    } else {
      userIdFinal = usuario.user_id;
      const r = await processarLancamento(supabase, usuario.user_id, usuario.nome, telefone, textoMsg, cid);
      mensagemResp = r.mensagem;
      acoesApl = r.acoesAplicadas;
    }

    await markMessageDone(supabase, messageId, userIdFinal);
    const enviado = await sendWhatsappText(telefone, mensagemResp, cid);
    if (!enviado) logErro(cid, "send_response_failed_after_commit", { user_id: userIdFinal });

    await gravarLog(supabase, {
      user_id: userIdFinal, telefone, message_id: messageId, mensagem_in: textoMsg,
      tipo_mensagem: tipoMsg, texto_transcrito: textoTrans, acoes_extraidas: acoesApl,
      status: statusFinal, erro: enviado ? null : "send_response_failed",
      duracao_ms: Date.now() - startTime,
    });

    logInfo(cid, "request_completed", { duracao_ms: Date.now() - startTime, status: statusFinal });
    return new Response("ok", { status: 200, headers: { "Content-Type": "text/plain" } });
  } catch (e) {
    logErro(cid, "unhandled_exception", e);
    try { await markMessageFailed(supabase, cid, "unhandled_exception"); } catch {}
    return new Response("error", { status: 500 });
  }
});
