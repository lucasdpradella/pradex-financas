// Forma de pagamento e pagamento de fatura.
//
// O fechamento comparava `forma_pagamento === "Crédito"` com match exato. Lançamento
// gravado como "crédito" (o agente fazia isso — ver o prompt antigo) caía no chip
// Débito. A comparação do app inteiro passa por aqui, case-insensitive e sem acento.
//
// Pagamento de fatura NÃO é um gasto novo: as compras no crédito já entraram no Saiu.
// Contar o PIX que quita o cartão de novo dobraria o mês. A marca é a categoria
// "Pagamento fatura" e/ou `abate_saldo = false` sem meta (o aporte de caixinha também
// usa abate_saldo false, mas sempre com meta_id — os dois não se misturam).

export const CATEGORIA_PAGAMENTO_FATURA = "Pagamento fatura";

const SEM_ACENTO = [
  [/[\u00e1\u00e0\u00e2\u00e3\u00e4]/g, "a"],
  [/[\u00e9\u00e8\u00ea\u00eb]/g, "e"],
  [/[\u00ed\u00ec\u00ee\u00ef]/g, "i"],
  [/[\u00f3\u00f2\u00f4\u00f5\u00f6]/g, "o"],
  [/[\u00fa\u00f9\u00fb\u00fc]/g, "u"],
  [/[\u00e7]/g, "c"],
  [/[\u00f1]/g, "n"],
];

export const semAcento = (value) => {
  let s = String(value ?? "").trim().toLowerCase();
  for (const [re, ch] of SEM_ACENTO) s = s.replace(re, ch);
  return s.replace(/\s+/g, " ");
};

/**
 * Canônico que o banco deve guardar. O que não reconhecemos volta aparado, sem
 * inventar — "Saldo da conta" e "PIX/Débito" são rótulos de aporte e continuam
 * válidos.
 */
export function normalizarFormaPagamento(value) {
  if (value == null) return null;
  const bruto = String(value).trim();
  if (!bruto) return null;
  const n = semAcento(bruto);
  if (n === "debito" || n === "debito em conta" || n === "cartao de debito" || n.startsWith("cartao de debito")) {
    return "Débito";
  }
  if (
    n === "credito" || n === "cartao" || n === "cartao de credito" || n === "credito parcelado" ||
    n.startsWith("credito ") || n.startsWith("cartao ")
  ) {
    return "Crédito";
  }
  if (n === "pix") return "PIX";
  if (n === "pix/debito" || n === "pix / debito") return "PIX/Débito";
  if (n === "saldo da conta") return "Saldo da conta";
  if (n === "dinheiro" || n === "especie") return "Dinheiro";
  if (n === "outros") return "Outros";
  return bruto;
}

export const ehCredito = (forma) => normalizarFormaPagamento(forma) === "Crédito";

// "paguei a fatura", "paguei o cartão", "pagamento da fatura do nubank".
// Não pode casar com "no crédito" — isso é compra, não quitação.
const RE_PAGAMENTO = /\b(paguei|pago|pagar|pagamento|quitei|quitacao|quitar)\b.{0,40}\b(fatura|cartao|cartoes)\b/;

export function textoEhPagamentoFatura(texto) {
  return RE_PAGAMENTO.test(semAcento(texto));
}

export function ehPagamentoFatura(lancamento) {
  if (!lancamento || lancamento.tipo === "receita") return false;
  const cat = semAcento(lancamento.categoria);
  if (cat === "pagamento fatura" || cat === "pagamento de fatura") return true;
  if (lancamento.abate_saldo === false && lancamento.meta_id == null) return true;
  return textoEhPagamentoFatura(lancamento.descricao || "");
}

/**
 * Ajusta o corpo que vai pro banco. Pagamento de fatura sai do crédito (não é
 * compra nova), ganha a categoria reservada e `abate_saldo = false` pra não
 * voltar ao Saiu. O resto só normaliza a forma.
 */
export function completarLancamento(body) {
  const next = { ...body, forma_pagamento: normalizarFormaPagamento(body?.forma_pagamento) };
  if (!ehPagamentoFatura(next)) return next;
  next.tipo = "gasto";
  next.categoria = CATEGORIA_PAGAMENTO_FATURA;
  next.abate_saldo = false;
  if (!next.forma_pagamento || ehCredito(next.forma_pagamento)) next.forma_pagamento = "Débito";
  return next;
}

/** "2.180" (milhar), "2180,5" e "2180.50". Vazio não vira zero. */
export function parseValorConta(texto) {
  if (texto == null) return null;
  const t = String(texto).trim();
  if (!t) return null;
  let n;
  if (t.includes(",")) n = Number(t.replace(/\./g, "").replace(",", "."));
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) n = Number(t.replace(/\./g, ""));
  else n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}
