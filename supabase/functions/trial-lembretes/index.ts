// supabase/functions/trial-lembretes/index.ts
//
// Job diário dos lembretes do trial de 14 dias do WhatsApp.
// Varre quem está em trial ativo, calcula o dia do trial e, nos marcos D5/D8/D10/D13/D14,
// manda uma mensagem pelo Z-API. A idempotência é a unique (user_id, dia) da tabela
// trial_lembretes: rodar o job duas vezes no mesmo dia não manda a mensagem duas vezes.
//
// NÃO é agendado sozinho — agendar é ação de produção. Ver o runbook no fim do arquivo.
//
// Auth: segredo compartilhado no header, igual ao cakto-webhook (verify_jwt = false,
// porque quem chama é um cron, não um usuário logado).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const TRIAL_CRON_SECRET = Deno.env.get("TRIAL_CRON_SECRET") ?? "";
const ZAPI_INSTANCE = Deno.env.get("ZAPI_INSTANCE") ?? "";
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN") ?? "";
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";

const CHECKOUT_ESSENCIAL = "https://pay.cakto.com.br/a2xpq3u";
const TIMEOUT_ZAPI = 10000;

// PostgREST corta em 1000 linhas sem avisar. Com a base atual não chega perto, mas o
// log avisa se um dia encostar no teto em vez de silenciosamente pular gente.
const LIMITE_VARREDURA = 1000;

// Marcos e copies. Sem palavrão, curtas, e só o D14 tem pressão de fato — o D5 é um
// "oi" sem venda, como o brief pede.
const MARCOS: Record<number, (nome: string) => string> = {
  5: (nome) => `Oi, ${nome}! 👋 Só passando pra ver como está indo o Pradex no WhatsApp.\n\n` +
    `Se ainda não testou, é só mandar aqui: _"gastei 50 no mercado"_ — eu registro e você confere no app.`,

  8: (nome) => `${nome}, uma dica que faz diferença: dá pra mandar *áudio*. 🎙️\n\n` +
    `Falar "almoço 38 no crédito" no meio da rua é mais rápido que abrir o app — e cai organizado do mesmo jeito.`,

  10: (nome) => `${nome}, seu teste do Pradex no WhatsApp vai até daqui a 4 dias.\n\n` +
    `Depois disso o app continua seu, de graça e completo. O que sai é só o lançamento por aqui.`,

  13: (nome) => `${nome}, seu teste termina *amanhã*. ⏳\n\n` +
    `Pra continuar lançando pelo WhatsApp são R$ 29,90/mês, sem fidelidade:\n${CHECKOUT_ESSENCIAL}`,

  14: (nome) => `${nome}, hoje é o último dia do seu teste no WhatsApp.\n\n` +
    `A partir de amanhã eu paro de registrar por aqui — seus lançamentos e o app seguem normais, de graça.\n\n` +
    `Se quiser manter o WhatsApp: R$ 29,90/mês, cancela quando quiser.\n${CHECKOUT_ESSENCIAL}`,
};

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function log(nivel: string, evento: string, data?: unknown) {
  const linha = { level: nivel, evento, ...(data ? { data } : {}), ts: new Date().toISOString() };
  if (nivel === "error") console.error(JSON.stringify(linha));
  else console.log(JSON.stringify(linha));
}

async function enviarZap(phone: string, message: string): Promise<{ ok: boolean; detalhe: string }> {
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

// Dia 1 é o dia em que o trial começou.
export function diaDoTrial(inicio: Date, agora: Date): number {
  return Math.floor((agora.getTime() - inicio.getTime()) / 86400000) + 1;
}

const primeiroNome = (nome: unknown) => String(nome ?? "").trim().split(/\s+/)[0] || "tudo bem";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const recebido = req.headers.get("x-cron-secret") ?? "";
  if (!TRIAL_CRON_SECRET || !constantTimeEquals(recebido, TRIAL_CRON_SECRET)) {
    log("warn", "auth_failed");
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Dry-run: varre e diz o que faria, sem reservar marco e sem mandar zap. Existe
  // porque o smoke manual do runbook dispara mensagem real — sem isso, "testar" e
  // "mandar pra base" são exatamente a mesma chamada.
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  const agora = new Date();
  const resumo = { dry, verificados: 0, enviados: 0, simulados: 0, pulados: 0, erros: 0 };

  try {
    // Só trial ainda vivo. Quem já expirou não recebe mais nada: o D14 é a última
    // mensagem, e ela sai enquanto o trial ainda está de pé.
    const { data: perfis, error } = await supabase
      .from("fp_perfil")
      .select("user_id, nome, telefone, plano, trial_inicio, trial_ate")
      .not("trial_inicio", "is", null)
      .gt("trial_ate", agora.toISOString())
      .limit(LIMITE_VARREDURA);

    if (error) {
      log("error", "consulta_falhou", error.message);
      return new Response(JSON.stringify({ erro: error.message }), { status: 200, headers: { "Content-Type": "application/json" } });
    }

    if ((perfis?.length ?? 0) >= LIMITE_VARREDURA) {
      log("warn", "limite_varredura_atingido", { limite: LIMITE_VARREDURA });
    }

    for (const p of perfis ?? []) {
      resumo.verificados++;

      // Quem assinou durante o trial não recebe lembrete de fim de teste — seria
      // pedir dinheiro a quem já pagou.
      if (p.plano === "essencial" || p.plano === "assistente") { resumo.pulados++; continue; }
      if (!p.telefone) { resumo.pulados++; continue; }

      const dia = diaDoTrial(new Date(p.trial_inicio), agora);
      const montar = MARCOS[dia];
      if (!montar) { resumo.pulados++; continue; }

      // Dry-run para aqui: consulta se o marco já foi processado (em vez de reservar)
      // e reporta. Nada é escrito, nada é enviado.
      if (dry) {
        const { data: jaProcessado } = await supabase
          .from("trial_lembretes")
          .select("dia")
          .eq("user_id", p.user_id).eq("dia", dia)
          .maybeSingle();
        if (jaProcessado) { resumo.pulados++; continue; }
        resumo.simulados++;
        log("info", "lembrete_simulado", { user_id: p.user_id, dia });
        continue;
      }

      // Reserva o marco ANTES de enviar. Se duas execuções correrem juntas, a segunda
      // colide na unique e desiste — melhor não enviar do que enviar em dobro.
      const { error: erroReserva } = await supabase
        .from("trial_lembretes")
        .insert({ user_id: p.user_id, dia, telefone: p.telefone, sucesso: false, detalhe: "enviando" });

      if (erroReserva) {
        // 23505 = já existe: marco já processado, é o caminho normal em re-execução.
        if (erroReserva.code !== "23505") log("error", "reserva_falhou", { user_id: p.user_id, dia, erro: erroReserva.message });
        resumo.pulados++;
        continue;
      }

      const envio = await enviarZap(p.telefone, montar(primeiroNome(p.nome)));

      await supabase.from("trial_lembretes")
        .update({ sucesso: envio.ok, detalhe: envio.detalhe, enviado_em: new Date().toISOString() })
        .eq("user_id", p.user_id).eq("dia", dia);

      if (envio.ok) { resumo.enviados++; log("info", "lembrete_enviado", { user_id: p.user_id, dia }); }
      else { resumo.erros++; log("error", "envio_falhou", { user_id: p.user_id, dia, detalhe: envio.detalhe }); }
    }

    log("info", "execucao_concluida", resumo);
    return new Response(JSON.stringify(resumo), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    log("error", "excecao", e);
    return new Response(JSON.stringify({ erro: String(e), ...resumo }), { status: 200, headers: { "Content-Type": "application/json" } });
  }
});

// ===== Runbook =====
//
// 1) Secret (uma vez):
//    supabase secrets set TRIAL_CRON_SECRET=<valor> --project-ref sjvuhqqsjboncwpboclv
//
// 2) Deploy:
//    supabase functions deploy trial-lembretes --project-ref sjvuhqqsjboncwpboclv
//
// 3) Smoke manual. ATENÇÃO: sem ?dry=1 isto MANDA MENSAGEM DE VERDADE pra quem
//    estiver num marco hoje. Rodar o dry primeiro e conferir o campo `simulados`.
//
//    Dry-run (não escreve, não envia — só relata o que faria):
//    curl -X POST "https://sjvuhqqsjboncwpboclv.supabase.co/functions/v1/trial-lembretes?dry=1" \
//      -H "x-cron-secret: <valor>"
//
//    Pra valer:
//    curl -X POST https://sjvuhqqsjboncwpboclv.supabase.co/functions/v1/trial-lembretes \
//      -H "x-cron-secret: <valor>"
//
// 4) Agendar 1x/dia (pg_cron + pg_net, no SQL Editor). Rodar de manhã, horário de SP:
//    select cron.schedule('trial-lembretes-diario', '0 13 * * *', $$
//      select net.http_post(
//        url := 'https://sjvuhqqsjboncwpboclv.supabase.co/functions/v1/trial-lembretes',
//        headers := '{"x-cron-secret": "<valor>"}'::jsonb
//      );
//    $$);
//
//    13:00 UTC = 10:00 em São Paulo. Conferir agendamentos: select * from cron.job;
