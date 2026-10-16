// supabase/functions/excluir-conta/index.ts
//
// "Excluir minha conta" — o site (Perfil) e o app iOS chamam isto. A App Store exige
// que a exclusão aconteça dentro do app (guideline 5.1.1(v)), não por e-mail.
//
// Fluxo:
//   1. JWT do próprio usuário (verify_jwt = true no config.toml) → quem é.
//   2. Corpo { "confirmar": "EXCLUIR" } — trava contra chamada acidental.
//   3. excluir_conta_preparar(user_id) com service role: casal → Livro fica com o
//      parceiro; sozinho → Livro apagado; limpa as FKs sem cascade.
//   4. auth.admin.deleteUser → o cascade leva os dados pessoais.
//   5. Aviso pro Lucas no WhatsApp. Se havia assinatura paga, o aviso diz para
//      cancelar na Cakto (decisão 2026-10-16: não bloqueia a exclusão).
//
// O aviso NUNCA derruba a exclusão: a conta já foi apagada quando ele sai.
//
// Deploy (push no main não publica Edge Function):
//   supabase functions deploy excluir-conta --project-ref sjvuhqqsjboncwpboclv
// Secrets já existem no projeto (ZAPI_*, ALERTA_WHATSAPP — os mesmos do cakto-webhook).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";
import { type Preparo, montarAviso, precisaCancelarNaCakto } from "./aviso.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ZAPI_INSTANCE = Deno.env.get("ZAPI_INSTANCE") ?? "";
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN") ?? "";
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";
const ALERTA_WHATSAPP = Deno.env.get("ALERTA_WHATSAPP") ?? "";
const TIMEOUT_ZAPI = 10000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { erro: "use POST" });

  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return json(401, { erro: "sem sessão" });

  let corpo: { confirmar?: string } = {};
  try { corpo = await req.json(); } catch { /* corpo vazio cai na checagem abaixo */ }
  if (corpo.confirmar !== "EXCLUIR") return json(400, { erro: 'envie { "confirmar": "EXCLUIR" }' });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: quem, error: erroUser } = await admin.auth.getUser(jwt);
  if (erroUser || !quem?.user) return json(401, { erro: "sessão inválida" });
  const userId = quem.user.id;
  const email = quem.user.email ?? "(sem e-mail)";

  const { data: preparo, error: erroPrep } = await admin.rpc("excluir_conta_preparar", { p_user_id: userId });
  if (erroPrep) {
    console.error(JSON.stringify({ evento: "preparar_falhou", user_id: userId, erro: erroPrep.message }));
    return json(500, { erro: "não foi possível excluir agora, tente de novo" });
  }

  // Se falhar aqui, o Livro já foi resolvido mas o login segue vivo. Tentar de novo é
  // seguro: excluir_conta_preparar é idempotente.
  const { error: erroDel } = await admin.auth.admin.deleteUser(userId);
  if (erroDel) {
    console.error(JSON.stringify({ evento: "delete_user_falhou", user_id: userId, erro: erroDel.message }));
    return json(500, { erro: "não foi possível excluir agora, tente de novo" });
  }

  const p = preparo as Preparo;
  console.log(JSON.stringify({ evento: "conta_excluida", user_id: userId, modo: p.modo, plano: p.plano, cancelar_cakto: precisaCancelarNaCakto(p) }));

  if (!ALERTA_WHATSAPP) {
    console.warn(JSON.stringify({ evento: "aviso_pulado", motivo: "ALERTA_WHATSAPP vazio" }));
  } else {
    try {
      const r = await enviarZap(ALERTA_WHATSAPP, montarAviso(email, p));
      if (!r.ok) console.warn(JSON.stringify({ evento: "aviso_falhou", detalhe: r.detalhe }));
    } catch (e) {
      console.warn(JSON.stringify({ evento: "aviso_falhou", detalhe: String(e) }));
    }
  }

  return json(200, { ok: true, modo: p.modo });
});
