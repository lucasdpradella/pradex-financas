// Normalização do que o modelo devolve antes do RPC.
// Espelha src/lib/formaPagamento.js — o fechamento e o agente precisam concordar,
// e a edge function não importa o bundle do app. O SQL (`normalizar_forma_pagamento`)
// é a terceira rede, pra insert que escapar daqui: ele só canônica a string já
// gravada em forma_pagamento. A mensagem do WhatsApp não chega no RPC, então
// "no crédito" com forma omitida ou chutada como Débito se resolve aqui.

export const CATEGORIA_PAGAMENTO_FATURA = "Pagamento fatura";

export function semAcento(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizarFormaPagamento(value: unknown): string | null {
  if (value == null) return null;
  const bruto = String(value).trim();
  if (!bruto) return null;
  const n = semAcento(bruto);
  // "cartão de débito" tem que vencer "cartão …", senão o nome do cartão vira crédito.
  if (n === "debito" || n === "debito em conta" || n === "cartao de debito" || n.startsWith("cartao de debito")) {
    return "Débito";
  }
  if (
    n === "credito" || n === "cartao" || n === "cartao de credito" ||
    n === "credito parcelado" || n.startsWith("credito ") || n.startsWith("cartao ")
  ) return "Crédito";
  if (n === "pix") return "PIX";
  if (n === "pix/debito" || n === "pix / debito") return "PIX/Débito";
  if (n === "saldo da conta") return "Saldo da conta";
  if (n === "dinheiro" || n === "especie") return "Dinheiro";
  if (n === "outros") return "Outros";
  return bruto;
}

const RE_PAGAMENTO = /\b(paguei|pago|pagar|pagamento|quitei|quitacao|quitar)\b.{0,40}\b(fatura|cartao|cartoes)\b/;

export function textoEhPagamentoFatura(texto: unknown): boolean {
  return RE_PAGAMENTO.test(semAcento(texto));
}

function escaparRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function acharCartaoNoTexto(
  texto: unknown,
  cartoes: Array<{ id: number; nome?: string }>,
): { id: number; nome?: string } | null {
  const n = semAcento(texto);
  if (!n) return null;
  const hits = (cartoes || []).filter((c) => {
    const nome = semAcento(c?.nome);
    // Palavra inteira: "XP" não pode casar dentro de "experiência".
    if (nome.length < 2) return false;
    return new RegExp(`(?:^|[^a-z0-9])${escaparRegex(nome)}(?:[^a-z0-9]|$)`).test(n);
  });
  hits.sort((a, b) => semAcento(b.nome).length - semAcento(a.nome).length);
  return hits[0] || null;
}

// "crédito" / "cartão de crédito" na fala. "cartão de débito" não entra.
const RE_CREDITO_NA_FALA = /\bcreditos?\b|\bcartao de credito\b/;
const RE_DEBITO_NA_FALA = /\bdebito\b/;
const RE_PIX_NA_FALA = /\bpix\b/;
const RE_DINHEIRO_NA_FALA = /\bdinheiro\b|\bespecie\b/;

/**
 * O que o cliente disse que foi a forma — não o que o modelo chutou.
 * Crédito ganha se a fala citar crédito e também débito/PIX.
 */
export function formaDitaPeloTexto(texto: unknown): "Crédito" | "Débito" | "PIX" | "Dinheiro" | null {
  const n = semAcento(texto);
  if (!n) return null;
  if (RE_CREDITO_NA_FALA.test(n)) return "Crédito";
  const debito = RE_DEBITO_NA_FALA.test(n);
  const pix = RE_PIX_NA_FALA.test(n);
  const dinheiro = RE_DINHEIRO_NA_FALA.test(n);
  const marcas = [debito, pix, dinheiro].filter(Boolean).length;
  if (marcas !== 1) return null;
  if (debito) return "Débito";
  if (pix) return "PIX";
  return "Dinheiro";
}

/**
 * Uma ação do tool-use, pronta pro RPC.
 * `textoUsuario` só entra na detecção quando a mensagem gerou UMA ação — senão
 * "paguei a fatura e gastei 20 no mercado" marcaria os dois como pagamento.
 */
export function prepararAcao(
  acao: any,
  textoUsuario: string,
  cartoes: Array<{ id: number; nome?: string }>,
  acoesNaMensagem: number,
): any {
  const dados = acao?.dados;
  if (!dados || (acao.tipo !== "criar" && acao.tipo !== "editar")) return acao;

  const next = { ...dados, forma_pagamento: normalizarFormaPagamento(dados.forma_pagamento) };
  const proprio = `${next.descricao || ""} ${next.categoria || ""}`;
  const contexto = acoesNaMensagem === 1 ? `${proprio} ${textoUsuario || ""}` : proprio;
  const pagamento = textoEhPagamentoFatura(contexto)
    || semAcento(next.categoria) === "pagamento fatura"
    || semAcento(next.categoria) === "pagamento de fatura";

  if (pagamento && next.tipo !== "receita") {
    next.tipo = "gasto";
    next.categoria = CATEGORIA_PAGAMENTO_FATURA;
    next.abate_saldo = false;
    next.parcelado = false;
    next.total_parcelas = null;
    if (!next.forma_pagamento || next.forma_pagamento === "Crédito") next.forma_pagamento = "Débito";
    if (next.cartao_id == null) {
      const hit = acharCartaoNoTexto(contexto, cartoes);
      if (hit) next.cartao_id = hit.id;
    }
  } else if (next.tipo !== "receita" && next.meta_id == null) {
    // Compra. O modelo omite a forma ou grava Débito mesmo quando a fala foi
    // "no crédito" / "cartão XP". A fatura some do crédito e o fechamento conta
    // como débito. Aporte de meta (meta_id) não entra aqui.
    const mencionado = acharCartaoNoTexto(contexto, cartoes);
    if (next.cartao_id == null && mencionado) next.cartao_id = mencionado.id;
    const dita = formaDitaPeloTexto(contexto);
    if (dita) {
      next.forma_pagamento = dita;
    } else if (mencionado) {
      next.forma_pagamento = "Crédito";
    }
  }

  return { ...acao, dados: next };
}

export function prepararAcoes(
  acoes: any[],
  textoUsuario: string,
  cartoes: Array<{ id: number; nome?: string }>,
): any[] {
  const lista = acoes || [];
  return lista.map((acao) => prepararAcao(acao, textoUsuario, cartoes, lista.length));
}
