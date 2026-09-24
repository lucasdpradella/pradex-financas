// Normalização do que o modelo devolve antes do RPC.
// Espelha src/lib/formaPagamento.js — o fechamento e o agente precisam concordar,
// e a edge function não importa o bundle do app. O SQL (`normalizar_forma_pagamento`)
// é a terceira rede, pra insert que escapar daqui.

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
  if (
    n === "credito" || n === "cartao" || n === "cartao de credito" ||
    n === "credito parcelado" || n.startsWith("credito ")
  ) return "Crédito";
  if (n === "debito" || n === "debito em conta" || n === "cartao de debito") return "Débito";
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

export function acharCartaoNoTexto(
  texto: unknown,
  cartoes: Array<{ id: number; nome?: string }>,
): { id: number; nome?: string } | null {
  const n = semAcento(texto);
  if (!n) return null;
  const hits = (cartoes || []).filter((c) => {
    const nome = semAcento(c?.nome);
    return nome.length >= 2 && n.includes(nome);
  });
  hits.sort((a, b) => semAcento(b.nome).length - semAcento(a.nome).length);
  return hits[0] || null;
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
