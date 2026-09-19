// supabase/functions/agente-cutucada/index.ts
//
// O PRADEX FALANDO PRIMEIRO. Job diário: varre quem usa o agente, procura um motivo
// pra cutucar, e manda UMA mensagem pelo Z-API.
//
// Direção do Lucas (19/09): "esses modos não é o cliente que vai falar, é o Pradex
// que vai instigar". O modo caos que entrou de manhã é a VOZ; isto é a iniciativa.
//
// NÃO é agendado sozinho — agendar é ação de produção. Runbook no fim do arquivo.
//
// Auth: segredo no header, igual ao trial-lembretes (verify_jwt = false, porque quem
// chama é um cron e não um usuário logado).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { montarCutucada, comAvisoDeModoPesado, escolherAlvo, Alvo, Gatilho, Tom } from "./mensagens.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CUTUCADA_CRON_SECRET") ?? "";
const ZAPI_INSTANCE = Deno.env.get("ZAPI_INSTANCE") ?? "";
const ZAPI_TOKEN = Deno.env.get("ZAPI_TOKEN") ?? "";
const ZAPI_CLIENT_TOKEN = Deno.env.get("ZAPI_CLIENT_TOKEN") ?? "";

// AS DUAS TRAVAS QUE IMPEDEM O PRADEX DE VIRAR SPAM.
//
// Errar aqui não custa uma métrica pior: custa a pessoa bloquear o número — e aí nem
// o lançamento por WhatsApp funciona mais. O produto inteiro morre junto com o
// sarcasmo. Por isso os números são conservadores e ficam no topo do arquivo, onde
// quem for afrouxar tem que passar por este comentário.
const DIAS_ENTRE_CUTUCADAS = 3;    // por pessoa, qualquer gatilho
const DIAS_MESMO_ASSUNTO = 14;     // mesmo gatilho sobre a mesma coisa
const DIAS_META_PARADA = 30;       // a partir de quando "parada" é verdade
const DIAS_PRAZO_APERTADO = 15;    // "em risco" olha só o prazo que está chegando
const LIMITE_VARREDURA = 1000;     // PostgREST corta em 1000 sem avisar

const NIVEL_PLANO: Record<string, number> = { none: 0, essencial: 1, assistente: 2 };

const log = (evento: string, dados: unknown = {}) =>
  console.log(JSON.stringify({ evento, ...(dados as object), ts: new Date().toISOString() }));

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Mesma regra de plano do agente reativo (espelha podeUsarWhatsapp de lib/plano.js):
// pago OU trial ativo. Cutucar quem não pode nem responder seria propaganda.
function podeUsarAgente(p: any): boolean {
  if ((NIVEL_PLANO[String(p?.plano ?? "none")] ?? 0) >= 1) return true;
  if (!p?.trial_inicio) return false;
  const ate = new Date(String(p?.trial_ate ?? ""));
  return !isNaN(ate.getTime()) && Date.now() < ate.getTime();
}

async function enviar(telefone: string, mensagem: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.z-api.io/instances/${ZAPI_INSTANCE}/token/${ZAPI_TOKEN}/send-text`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Token": ZAPI_CLIENT_TOKEN },
        body: JSON.stringify({ phone: telefone, message: mensagem }),
      },
    );
    return res.ok;
  } catch (e) {
    log("zapi_excecao", { erro: String(e).slice(0, 120) });
    return false;
  }
}

/** Categorias estouradas ou perto disso, no mês corrente. */
async function alvosDeTeto(supabase: SupabaseClient, userId: string): Promise<Alvo[]> {
  const hoje = new Date();
  const primeiroDia = `${hoje.getUTCFullYear()}-${String(hoje.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const [orc, gastos] = await Promise.all([
    supabase.from("orcamentos").select("categoria, limite, mes")
      .eq("user_id", userId).lte("mes", primeiroDia).order("mes", { ascending: false }),
    // `meta_id is null`: aporte de meta não consome teto de categoria — mesma regra
    // do app desde 16/09.
    supabase.from("Lancamentos").select("valor, categoria")
      .eq("user_id", userId).eq("tipo", "gasto").is("meta_id", null).gte("data_lancamento", primeiroDia),
  ]);
  if (orc.error || !orc.data?.length) return [];

  const gasto = new Map<string, number>();
  for (const l of gastos.data ?? []) {
    const k = String((l as any).categoria ?? "");
    gasto.set(k, (gasto.get(k) ?? 0) + Number((l as any).valor ?? 0));
  }

  // O teto mais recente de cada categoria vence; o resto é histórico.
  const vistos = new Set<string>();
  const alvos: Alvo[] = [];
  for (const o of orc.data as Array<{ categoria: string; limite: number }>) {
    const k = String(o.categoria ?? "").toLowerCase();
    if (!k || vistos.has(k)) continue;
    vistos.add(k);

    const limite = Number(o.limite);
    if (!(limite > 0)) continue;
    const pct = Math.round(((gasto.get(o.categoria) ?? 0) / limite) * 100);
    if (pct >= 100) alvos.push({ gatilho: "teto_estourado", referencia: o.categoria, pct });
    else if (pct >= 90) alvos.push({ gatilho: "teto_90", referencia: o.categoria, pct });
  }
  return alvos;
}

/** Metas paradas, em risco de prazo, ou recém-concluídas. */
async function alvosDeMeta(supabase: SupabaseClient, userId: string): Promise<Alvo[]> {
  const { data: metas, error } = await supabase
    .from("metas").select("id, nome, valor_alvo, dificuldade, prazo, concluida_em")
    .eq("user_id", userId).eq("arquivada", false);
  if (error || !metas?.length) return [];

  const ids = metas.map((m: any) => m.id);
  const { data: aportes } = await supabase
    .from("Lancamentos").select("meta_id, valor, tipo, data_lancamento")
    .eq("user_id", userId).in("meta_id", ids);

  const agora = Date.now();
  const alvos: Alvo[] = [];

  for (const m of metas as any[]) {
    const meus = (aportes ?? []).filter((a: any) => String(a.meta_id) === String(m.id));
    const acumulado = meus.reduce((s: number, a: any) =>
      s + (a.tipo === "gasto" ? Number(a.valor) : -Number(a.valor)), 0);
    const alvo = Number(m.valor_alvo) || 0;
    const falta = Math.max(0, alvo - acumulado);
    const base = { referencia: m.nome, dificuldade: m.dificuldade ?? "moderada", falta, prazo: m.prazo ?? null };

    if (m.concluida_em) {
      // Só vale como notícia enquanto É notícia. A janela de 2 dias evita que a
      // varredura diária anuncie amanhã, e depois de amanhã, uma meta fechada hoje.
      const dias = (agora - new Date(m.concluida_em).getTime()) / 86400000;
      if (dias <= 2) alvos.push({ ...base, gatilho: "meta_concluida" });
      continue;   // meta batida não é cobrada por estar parada
    }

    // Meta que nunca recebeu aporte NÃO é meta parada: quem acabou de criar não
    // merece cobrança, e cobrar no primeiro mês é o jeito mais rápido de ensinar a
    // pessoa a não criar metas.
    const ultima = meus.filter((a: any) => a.tipo === "gasto").map((a: any) => a.data_lancamento).sort().pop();
    if (ultima) {
      const dias = Math.floor((agora - new Date(`${ultima}T12:00:00Z`).getTime()) / 86400000);
      if (dias >= DIAS_META_PARADA) alvos.push({ ...base, gatilho: "meta_parada", dias });
    }

    if (m.prazo && falta > 0) {
      const diasPrazo = Math.ceil((new Date(`${m.prazo}T12:00:00Z`).getTime() - agora) / 86400000);
      if (diasPrazo > 0 && diasPrazo <= DIAS_PRAZO_APERTADO) {
        alvos.push({ ...base, gatilho: "meta_risco" });
      }
    }
  }
  return alvos;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const recebido = req.headers.get("x-cron-secret") ?? "";
  if (!CRON_SECRET || !constantTimeEquals(recebido, CRON_SECRET)) {
    log("auth_failed");
    return new Response("Unauthorized", { status: 401 });
  }

  // ?dry=1 relata o que faria sem mandar nem gravar. É o modo em que se roda pela
  // primeira vez — uma varredura errada aqui manda mensagem não solicitada pra base
  // inteira, e isso não tem desfazer.
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: perfis, error } = await supabase
    .from("fp_perfil")
    .select("user_id, nome, telefone, plano, trial_inicio, trial_ate, agente_tom, agente_silencio_ate, agente_elogio_ate")
    .not("telefone", "is", null)
    .limit(LIMITE_VARREDURA);

  if (error) {
    log("varredura_falhou", { erro: error.message });
    return new Response(JSON.stringify({ erro: error.message }), { status: 500 });
  }

  const relatorio: any[] = [];
  let enviadas = 0;

  for (const p of perfis ?? []) {
    if (!podeUsarAgente(p)) continue;

    // Silêncio pedido pelo cliente vale AQUI acima de tudo. Cutucar quem mandou
    // calar a boca é a forma mais eficiente de perder a pessoa.
    if (p.agente_silencio_ate && new Date(p.agente_silencio_ate).getTime() > Date.now()) {
      relatorio.push({ user: p.user_id, pulou: "em_silencio" });
      continue;
    }

    const { data: recentes } = await supabase
      .from("agente_cutucadas").select("gatilho, referencia, enviada_em")
      .eq("user_id", p.user_id)
      .gte("enviada_em", new Date(Date.now() - DIAS_MESMO_ASSUNTO * 86400000).toISOString());

    const ultima = (recentes ?? []).map((c: any) => new Date(c.enviada_em).getTime()).sort().pop();
    if (ultima && Date.now() - ultima < DIAS_ENTRE_CUTUCADAS * 86400000) {
      relatorio.push({ user: p.user_id, pulou: "cutucado_recentemente" });
      continue;
    }

    const alvos = [...await alvosDeTeto(supabase, p.user_id), ...await alvosDeMeta(supabase, p.user_id)];

    // Tira o que já foi dito sobre a mesma coisa dentro da janela.
    const ditos = new Set((recentes ?? []).map((c: any) => `${c.gatilho}|${c.referencia}`));
    const novos = alvos.filter((a) => !ditos.has(`${a.gatilho}|${a.referencia}`));

    const alvo = escolherAlvo(novos);
    if (!alvo) { relatorio.push({ user: p.user_id, pulou: "sem_gatilho" }); continue; }

    // Elogio vigente ganha do tom base, igual ao agente reativo.
    const emElogio = p.agente_elogio_ate && new Date(p.agente_elogio_ate).getTime() > Date.now();
    const tom: Tom = emElogio ? "elogio" : (p.agente_tom === "caos" ? "caos" : "seco");

    // Quantas cutucadas esta pessoa já recebeu NA VIDA — não na janela de 14 dias
    // que `recentes` cobre. O aviso do modo pesado só vale nas duas primeiras, e
    // contar só as recentes o faria reaparecer sozinho depois de duas semanas
    // quietas, como se fosse novidade de novo.
    const { count: jaCutucado } = await supabase
      .from("agente_cutucadas").select("id", { count: "exact", head: true }).eq("user_id", p.user_id);

    const mensagem = comAvisoDeModoPesado(montarCutucada(alvo, tom), alvo, tom, jaCutucado ?? 0);

    relatorio.push({ user: p.user_id, gatilho: alvo.gatilho, referencia: alvo.referencia, tom, mensagem });
    if (dry) continue;

    const ok = await enviar(String(p.telefone), mensagem);
    if (ok) {
      enviadas++;
      await supabase.from("agente_cutucadas").insert({
        user_id: p.user_id, gatilho: alvo.gatilho, referencia: alvo.referencia, tom, mensagem,
      });
    } else {
      log("envio_falhou", { user: p.user_id });
    }
  }

  log(dry ? "dry_run" : "rodada", { perfis: perfis?.length ?? 0, enviadas, candidatos: relatorio.length });
  return new Response(JSON.stringify({ dry, enviadas, relatorio }, null, 2), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});

// ===== Runbook =====
//
// 1) Secret (uma vez):
//    supabase secrets set CUTUCADA_CRON_SECRET=<valor> --project-ref sjvuhqqsjboncwpboclv
//
// 2) Deploy:
//    supabase functions deploy agente-cutucada --project-ref sjvuhqqsjboncwpboclv --no-verify-jwt
//
// 3) SEMPRE o dry-run primeiro. Sem ?dry=1 isto manda mensagem NÃO SOLICITADA pra
//    quem tiver gatilho hoje, e isso não tem desfazer:
//
//    curl -X POST "https://sjvuhqqsjboncwpboclv.supabase.co/functions/v1/agente-cutucada?dry=1" \
//      -H "x-cron-secret: <valor>"
//
//    Ler o `relatorio`: cada linha traz o texto exato que sairia, pra quem, em qual
//    tom. Só agendar depois de concordar com TODAS.
//
// 4) Agendar 1x/dia, de manhã (13:00 UTC = 10:00 em São Paulo):
//    select cron.schedule('agente-cutucada-diaria', '0 13 * * *', $$
//      select net.http_post(
//        url := 'https://sjvuhqqsjboncwpboclv.supabase.co/functions/v1/agente-cutucada',
//        headers := '{"x-cron-secret": "<valor>"}'::jsonb
//      );
//    $$);
//
//    ⚠️ Roda no MESMO horário do trial-lembretes. Quem está em trial e tem gatilho
//    receberia duas mensagens seguidas do Pradex. Se incomodar, mudar esta pra 16:00
//    UTC (13h SP) — é uma linha, e o cron aceita reagendar por cima.
