// Fatura aberta por cartão — a terceira camada da home.
//
// Ciclo: compras depois do dia de fechamento caem na fatura que fecha no mês
// seguinte. O rótulo usa o mês do VENCIMENTO ("Fatura outubro · Cartão XP"), que
// pode ser o mês seguinte ao calendário que a home está mostrando. Sem dia de
// fechamento, a fatura é o próprio mês selecionado.
//
// Pagamento de fatura (ver formaPagamento.js) abate desta linha e não entra no
// Saiu — as compras já contaram.

import { ehCredito, ehPagamentoFatura, semAcento } from "./formaPagamento";

export const MESES_FATURA = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const MESES_FATURA_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export const rotuloMes = (mesIndex, idioma = "pt-BR") => {
  const lista = idioma === "en" ? MESES_FATURA_EN : MESES_FATURA;
  const n = lista[mesIndex] || "";
  return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
};

const iso = (ano, mes, dia) =>
  `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

const ultimoDia = (ano, mes) => new Date(ano, mes + 1, 0).getDate();

const clampDia = (ano, mes, dia) => Math.min(Math.max(1, Number(dia) || 1), ultimoDia(ano, mes));

const somar = (arr) => Math.round(arr.reduce((s, l) => s + Number(l.valor || 0), 0) * 100) / 100;

const addDias = (dataISO, dias) => {
  const [y, m, d] = dataISO.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dias);
  return iso(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

/**
 * Ciclo de fatura que contém `dataISO`.
 * `inicio`/`fim` são inclusivos (YYYY-MM-DD). `atePagamento` é até quando um
 * pagamento ainda quita ESTA fatura (o vencimento, que pode ser depois do fechamento).
 */
export function cicloQueContem(dataISO, diaFechamento, diaVencimento) {
  const [ys, ms, ds] = String(dataISO || "").split("-").map(Number);
  if (!ys || !ms || !ds) return null;
  const ano = ys;
  const mes = ms - 1;
  const dia = ds;
  const fecha = Number(diaFechamento);
  const vence = Number(diaVencimento);

  if (!fecha) {
    const fim = iso(ano, mes, ultimoDia(ano, mes));
    return {
      inicio: iso(ano, mes, 1),
      fim,
      anoVenc: ano,
      mesVenc: mes,
      atePagamento: vence ? iso(ano, mes, clampDia(ano, mes, vence)) : fim,
      diaVencimento: vence || null,
    };
  }

  let anoFecha = ano;
  let mesFecha = mes;
  if (dia > clampDia(ano, mes, fecha)) {
    mesFecha += 1;
    if (mesFecha > 11) { mesFecha = 0; anoFecha += 1; }
  }

  let anoAbre = anoFecha;
  let mesAbre = mesFecha - 1;
  if (mesAbre < 0) { mesAbre = 11; anoAbre -= 1; }
  const fechamentoAnterior = iso(anoAbre, mesAbre, clampDia(anoAbre, mesAbre, fecha));
  const fim = iso(anoFecha, mesFecha, clampDia(anoFecha, mesFecha, fecha));

  let anoVenc = anoFecha;
  let mesVenc = mesFecha;
  if (vence && vence <= fecha) {
    mesVenc += 1;
    if (mesVenc > 11) { mesVenc = 0; anoVenc += 1; }
  }
  const atePagamento = vence
    ? iso(anoVenc, mesVenc, clampDia(anoVenc, mesVenc, vence))
    : fim;

  return {
    inicio: addDias(fechamentoAnterior, 1),
    fim,
    anoVenc,
    mesVenc,
    atePagamento,
    diaVencimento: vence || null,
  };
}

export function dataReferenciaDoMes(ano, mes, hoje = new Date()) {
  const corrente = hoje.getFullYear() === ano && hoje.getMonth() === mes;
  const dia = corrente ? hoje.getDate() : Math.min(15, ultimoDia(ano, mes));
  return iso(ano, mes, Math.min(dia, ultimoDia(ano, mes)));
}

export function rotuloFatura(mesVencimento, nomeCartao, idioma = "pt-BR") {
  const en = idioma === "en";
  const nome = String(nomeCartao || "").trim() || (en ? "card" : "cartão");
  const jaTem = en ? /^(card|cart[aã]o)\b/i.test(nome) : /^cart[aã]o\b/i.test(nome);
  const mes = (en ? MESES_FATURA_EN : MESES_FATURA)[mesVencimento] || "";
  const mesLabel = en ? mes : mes;
  const prefixo = en ? "Card" : "Cartão";
  const titulo = en ? "Statement" : "Fatura";
  return `${titulo} ${mesLabel} · ${jaTem ? nome : `${prefixo} ${nome}`}`;
}

const dentro = (data, inicio, fim) => Boolean(data) && data >= inicio && data <= fim;

function compraDoCartao(l, cartaoId) {
  if (!l || l.tipo !== "gasto" || l.meta_id != null) return false;
  if (ehPagamentoFatura(l)) return false;
  if (String(l.cartao_id) !== String(cartaoId)) return false;
  return ehCredito(l.forma_pagamento) || !l.forma_pagamento;
}

/**
 * Uma linha por cartão com movimento no ciclo que a home está olhando.
 * `valor` já desconta pagamento de fatura daquele cartão.
 */
export function listarFaturas(lancamentos, cartoes, ano, mes, { hoje = new Date(), normalizar = (x) => x, idioma = "pt-BR" } = {}) {
  const ref = dataReferenciaDoMes(ano, mes, hoje);
  const linhas = [];

  for (const cartao of cartoes || []) {
    const ciclo = cicloQueContem(ref, cartao.dia_fechamento, cartao.dia_vencimento);
    if (!ciclo) continue;

    const compras = (lancamentos || []).filter(
      (l) => compraDoCartao(l, cartao.id) && dentro(l.data_lancamento, ciclo.inicio, ciclo.fim),
    );
    const pagamentos = (lancamentos || []).filter((l) => {
      if (!ehPagamentoFatura(l)) return false;
      if (String(l.cartao_id) !== String(cartao.id)) return false;
      return dentro(l.data_lancamento, ciclo.inicio, ciclo.atePagamento);
    });

    if (compras.length === 0 && pagamentos.length === 0) continue;

    const bruto = somar(compras);
    const pago = somar(pagamentos);
    const nome = normalizar(cartao.nome || "") || cartao.nome || "cartão";
    linhas.push({
      cartaoId: cartao.id,
      nome,
      label: rotuloFatura(ciclo.mesVenc, nome, idioma),
      valor: Math.max(0, Math.round((bruto - pago) * 100) / 100),
      bruto,
      pago,
      diaVencimento: ciclo.diaVencimento,
      vencimento: ciclo.diaVencimento ? (idioma === "en" ? `due day ${ciclo.diaVencimento}` : `vence dia ${ciclo.diaVencimento}`) : null,
      inicio: ciclo.inicio,
      fim: ciclo.fim,
    });
  }

  return linhas;
}

/** Casa "paguei o cartão XP" com o cartão cadastrado. O nome mais longo vence. */
export function acharCartaoNoTexto(texto, cartoes) {
  const n = semAcento(texto);
  if (!n) return null;
  const hits = (cartoes || []).filter((c) => {
    const nome = semAcento(c?.nome);
    return nome.length >= 2 && n.includes(nome);
  });
  hits.sort((a, b) => semAcento(b.nome).length - semAcento(a.nome).length);
  return hits[0] || null;
}
