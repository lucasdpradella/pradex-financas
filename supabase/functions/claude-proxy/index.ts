import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://pradex-financas.vercel.app",
  "http://localhost:5173",
];
const MODEL = "claude-haiku-4-5-20251001";
const API_VERSION = "2023-06-01";
const MAX_TOKENS = 2000;

const SYSTEM_PROMPT = `Você é um extrator de lançamentos financeiros a partir de textos crus (faturas, extratos colados, mensagens, listas).

REGRAS DE EXTRAÇÃO:
- Cada lançamento tem: data_lancamento (YYYY-MM-DD), descricao (texto curto), valor (número positivo, em reais), tipo ("gasto" ou "receita"), categoria (texto, da lista informada), forma_pagamento ("Débito" | "Crédito" | "Dinheiro" | "PIX" | "Outros"), cartao_id (number ou null), poderia_ter_evitado (boolean, default false)
- Valores em formato BR ("R$ 1.234,56") convertem pra decimal (1234.56). Sempre positivo.
- Datas: use a data de referência informada pelo usuário; se não especificar ano, use o ano da data de referência. Para contas a vencer, use a data de vencimento.
- Categorias: escolha SEMPRE uma da lista informada (gasto vs receita conforme o tipo). Se não encaixar em nenhuma, use "Outros".
- forma_pagamento: identifique pelo contexto. Se mencionar "cartão" sem mais info, é "Crédito". Se mencionar "débito" ou "no cartão de débito", é "Débito". PIX e Dinheiro pelo texto explícito.
- cartao_id: se forma_pagamento for "Crédito" e o usuário mencionar um cartão que está na lista de cartões cadastrados, use o id correspondente. Caso contrário, null.
- poderia_ter_evitado: sempre false (o usuário marca depois).
- Ignore palavras soltas como "cartão" ou "dinheiro" sem valor associado.
- Cash back é receita.
- Não duplique lançamentos óbvios.
- SEMPRE devolva via tool use \`registrar_transacoes\`, NUNCA em texto livre.`;

const TOOLS = [
  {
    name: "registrar_transacoes",
    description: "Registra a lista de lançamentos financeiros extraídos do texto.",
    input_schema: {
      type: "object",
      properties: {
        transacoes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              data_lancamento: { type: "string", description: "Data no formato YYYY-MM-DD" },
              descricao: { type: "string", description: "Descrição curta do lançamento" },
              valor: { type: "number", description: "Valor positivo em reais" },
              tipo: { type: "string", enum: ["gasto", "receita"] },
              categoria: { type: "string", description: "Categoria da lista informada (ou 'Outros')" },
              forma_pagamento: {
                type: "string",
                enum: ["Débito", "Crédito", "Dinheiro", "PIX", "Outros"],
              },
              cartao_id: {
                type: ["integer", "null"],
                description: "ID do cartão cadastrado (apenas se forma_pagamento=Crédito e cartão identificado); senão null",
              },
              poderia_ter_evitado: { type: "boolean", description: "Default false" },
            },
            required: [
              "data_lancamento",
              "descricao",
              "valor",
              "tipo",
              "categoria",
              "forma_pagamento",
              "cartao_id",
              "poderia_ter_evitado",
            ],
          },
        },
      },
      required: ["transacoes"],
    },
  },
];

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const requestId = crypto.randomUUID();
  const t0 = Date.now();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, origin);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, 401, origin);
  }
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "unauthorized" }, 401, origin);
  }
  const userId = userData.user.id;

  let prompt: string;
  let dataReferencia: string | undefined;
  try {
    const body = await req.json();
    prompt = body.prompt;
    dataReferencia = body.data_referencia;
    if (!prompt || typeof prompt !== "string") {
      return jsonResponse({ error: "prompt_required" }, 400, origin);
    }
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY_IMPORT");
  if (!apiKey) {
    console.error(`[${requestId}] missing ANTHROPIC_API_KEY_IMPORT`);
    return jsonResponse({ error: "config_error" }, 500, origin);
  }

  const userMessage = dataReferencia
    ? `Data de referência: ${dataReferencia}\n\n${prompt}`
    : prompt;

  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        tool_choice: { type: "tool", name: "registrar_transacoes" },
        messages: [{ role: "user", content: userMessage }],
      }),
    });
  } catch (e) {
    console.error(`[${requestId}] anthropic_fetch_failed`, e);
    return jsonResponse({ error: "upstream_unreachable" }, 502, origin);
  }

  const upstreamData = await upstream.json();

  if (upstream.status === 429) {
    return jsonResponse({ error: "rate_limit" }, 429, origin);
  }
  if (!upstream.ok) {
    console.error(`[${requestId}] anthropic_err status=${upstream.status}`, upstreamData);
    return jsonResponse({ error: "upstream_error", status: upstream.status }, 502, origin);
  }

  const toolUse = (upstreamData.content || []).find((c: any) => c.type === "tool_use");
  if (!toolUse) {
    console.error(`[${requestId}] no_tool_use`, upstreamData);
    return jsonResponse({ error: "no_tool_use" }, 502, origin);
  }

  const latency = Date.now() - t0;
  console.log(
    `[${requestId}] ok user=${userId} model=${MODEL} ` +
      `tokens_in=${upstreamData.usage?.input_tokens} tokens_out=${upstreamData.usage?.output_tokens} ` +
      `latency_ms=${latency} transacoes=${toolUse.input?.transacoes?.length ?? 0}`,
  );

  return jsonResponse(
    {
      transacoes: toolUse.input.transacoes,
      meta: {
        request_id: requestId,
        latency_ms: latency,
        tokens: upstreamData.usage,
      },
    },
    200,
    origin,
  );
});
