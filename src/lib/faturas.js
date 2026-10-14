// Fatura aberta por cartão — a terceira camada da home.
//
// Ciclo: compras depois do dia de fechamento caem na fatura que fecha no mês
// seguinte. O rótulo usa o mês do VENCIMENTO ("Fatura outubro · Cartão XP"), que
// pode ser o mês seguinte ao calendário que a home está mostrando. Sem dia de
// fechamento, a fatura é o próprio mês selecionado.
//
// Parcela: a 1 cai no ciclo da data da compra. A parcela k cai k-1 ciclos depois,
// pelo dia de fechamento do cartão — não pelo mês calendário da data gravada.
// Lançamento antigo com todas as parcelas na data da compra (e "2/2" só no texto)
// entra na fatura em que o banco cobra. A home "por data da compra" não usa isto:
// ela continua somando data_lancamento (ver fechamento.js).
//
// Pagamento de fatura (ver formaPagamento.js) abate desta linha e não entra no
// Saiu — as compras já contaram.

import { ehCredito, ehPagamentoFatura, semAcento } from "./formaPagamento";
import { descricaoBaseParcela, indiceEfetivo } from "./parcelaDescricao";

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

/** O ciclo seguinte: abre no dia depois do fechamento deste. */
export function avancarCiclo(ciclo, diaFechamento, diaVencimento) {
  if (!ciclo?.fim) return null;
  const seguinte = cicloQueContem(addDias(ciclo.fim, 1), diaFechamento, diaVencimento);
  if (!seguinte || seguinte.fim <= ciclo.fim) return null;
  return seguinte;
}

/**
 * Ciclo em que o banco cobra a parcela `indice` (1 = a primeira).
 * A data é a da compra, não a data gravada de cada linha.
 */
export function cicloDaParcela(dataCompra, indice, diaFechamento, diaVencimento) {
  const n = Math.max(1, Math.floor(Number(indice) || 1));
  let ciclo = cicloQueContem(dataCompra, diaFechamento, diaVencimento);
  if (!ciclo) return null;
  for (let i = 1; i < n; i++) {
    const seguinte = avancarCiclo(ciclo, diaFechamento, diaVencimento);
    if (!seguinte) return null;
    ciclo = seguinte;
  }
  return ciclo;
}

export function addMesesISO(dataISO, meses) {
  const [ys, ms, ds] = String(dataISO || "").split("-").map(Number);
  if (!ys || !ms || !ds) return null;
  const total = ys * 12 + (ms - 1) + (Number(meses) || 0);
  const ano = Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  return iso(ano, mes, Math.min(ds, ultimoDia(ano, mes)));
}

/**
 * Data para gravar a parcela `passos` (1 = a âncora). Prefere o mesmo dia no mês
 * seguinte quando ele cai dentro do ciclo de cobrança; senão, o primeiro dia do
 * ciclo. Assim janeiro/31 não escorrega para fevereiro e continua na fatura errada.
 */
export function dataDaParcelaNoCiclo(dataAncora, passos, diaFechamento, diaVencimento) {
  const n = Math.max(1, Math.floor(Number(passos) || 1));
  const ciclo = cicloDaParcela(dataAncora, n, diaFechamento, diaVencimento);
  if (!ciclo) return dataAncora || null;
  const deslocada = addMesesISO(dataAncora, n - 1);
  if (deslocada && deslocada >= ciclo.inicio && deslocada <= ciclo.fim) return deslocada;
  return ciclo.inicio;
}

function isoDeHoje(hoje) {
  if (typeof hoje === "string" && /^\d{4}-\d{2}-\d{2}/.test(hoje)) return hoje.slice(0, 10);
  const d = hoje instanceof Date && !Number.isNaN(hoje.getTime()) ? hoje : new Date();
  return iso(d.getFullYear(), d.getMonth(), d.getDate());
}

function compraCredito(l) {
  if (!l || l.tipo !== "gasto" || l.meta_id != null) return false;
  if (ehPagamentoFatura(l)) return false;
  return ehCredito(l.forma_pagamento) || !l.forma_pagamento;
}

function resolverAncora(linhas) {
  const ordenadas = [...linhas].sort((a, b) => {
    const diff = indiceEfetivo(a).atual - indiceEfetivo(b).atual;
    if (diff) return diff;
    return String(a.data_lancamento).localeCompare(String(b.data_lancamento));
  });
  const primeira = ordenadas[0];
  const datas = new Set(linhas.map((l) => l.data_lancamento).filter(Boolean));
  // Uma data só (ou uma linha só): é a data da compra, mesmo que o texto diga 2/2.
  // Datas já espalhadas mês a mês: a menor parcela guarda a data em que ELA é cobrada
  // (a tela deixa começar da "parcela atual", não da 1).
  if (datas.size <= 1) return { dataCompra: primeira.data_lancamento, indiceAncora: 1 };
  return { dataCompra: primeira.data_lancamento, indiceAncora: indiceEfetivo(primeira).atual };
}

/**
 * Uma entrada por parcela que o banco cobra, real ou prevista.
 * Prevista = índice que ainda não tem linha, só daqui pra frente (ciclo ainda
 * não fechou). Não inventa parcela em fatura que já fechou.
 */
export function encargosDasParcelas(lancamentos, cartoes, { hoje = new Date() } = {}) {
  const hojeISO = isoDeHoje(hoje);
  const porCartao = new Map((cartoes || []).map((c) => [String(c.id), c]));
  const candidatos = (lancamentos || []).filter((l) => compraCredito(l) && indiceEfetivo(l) && l.data_lancamento);

  const porGrupo = new Map();
  const legado = new Map();
  for (const l of candidatos) {
    if (l.parcela_grupo_id) {
      const key = `g:${l.parcela_grupo_id}`;
      if (!porGrupo.has(key)) porGrupo.set(key, []);
      porGrupo.get(key).push(l);
    } else {
      const indice = indiceEfetivo(l);
      const base = descricaoBaseParcela(l.descricao).toLowerCase();
      const valor = Math.round(Number(l.valor || 0) * 100);
      const key = `l:${l.cartao_id ?? ""}|${base}|${indice.total}|${valor}`;
      if (!legado.has(key)) legado.set(key, []);
      legado.get(key).push(l);
    }
  }

  const grupos = [];
  for (const linhas of porGrupo.values()) grupos.push({ linhas, projetar: true });
  for (const linhas of legado.values()) {
    const idxs = linhas.map((l) => indiceEfetivo(l).atual);
    const semConflito = new Set(idxs).size === idxs.length;
    if (semConflito) grupos.push({ linhas, projetar: true });
    else linhas.forEach((l) => grupos.push({ linhas: [l], projetar: false }));
  }

  const encargos = [];
  for (const grupo of grupos) {
    const linhas = grupo.linhas;
    const cartao = porCartao.get(String(linhas[0].cartao_id)) || null;
    const fecha = cartao?.dia_fechamento;
    const vence = cartao?.dia_vencimento;
    const ancora = resolverAncora(linhas);
    if (!ancora?.dataCompra) continue;

    const conhecidos = new Set();
    let total = 0;
    for (const l of linhas) {
      const indice = indiceEfetivo(l);
      total = Math.max(total, indice.total);
      if (conhecidos.has(indice.atual)) continue;
      conhecidos.add(indice.atual);
      const ciclo = cicloDaParcela(ancora.dataCompra, 1 + (indice.atual - ancora.indiceAncora), fecha, vence);
      if (!ciclo) continue;
      encargos.push({
        id: l.id,
        projetada: false,
        cartaoId: l.cartao_id ?? null,
        valor: Number(l.valor || 0),
        descricao: descricaoBaseParcela(l.descricao) || l.descricao || "",
        atual: indice.atual,
        total: indice.total,
        ciclo,
        dataCompra: ancora.dataCompra,
      });
    }

    if (!grupo.projetar || conhecidos.size === 0) continue;
    const maxConhecido = Math.max(...conhecidos);
    const modelo = [...linhas].sort((a, b) => indiceEfetivo(a).atual - indiceEfetivo(b).atual)[0];
    const base = descricaoBaseParcela(modelo.descricao) || modelo.descricao || "Parcela";
    for (let k = maxConhecido + 1; k <= total; k++) {
      const ciclo = cicloDaParcela(ancora.dataCompra, 1 + (k - ancora.indiceAncora), fecha, vence);
      if (!ciclo || ciclo.fim <= hojeISO) continue;
      encargos.push({
        id: `proj-${modelo.parcela_grupo_id || modelo.id}-${k}`,
        projetada: true,
        cartaoId: modelo.cartao_id ?? null,
        valor: Number(modelo.valor || 0),
        descricao: base,
        atual: k,
        total,
        ciclo,
        dataCompra: ancora.dataCompra,
      });
    }
  }

  return encargos;
}

export function parcelasQueAindaVem(lancamentos, cartoes, { hoje = new Date(), horizonteMeses = 3, idioma = "pt-BR" } = {}) {
  const hojeISO = isoDeHoje(hoje);
  const limite = addMesesISO(hojeISO, horizonteMeses);
  const porId = new Map((cartoes || []).map((c) => [String(c.id), c]));
  const futuras = encargosDasParcelas(lancamentos, cartoes, { hoje })
    .filter((e) => e.ciclo && e.ciclo.fim > hojeISO);
  const noHorizonte = futuras.filter((e) => !limite || e.ciclo.fim <= limite);
  noHorizonte.sort((a, b) => a.ciclo.fim.localeCompare(b.ciclo.fim) || String(a.descricao).localeCompare(String(b.descricao), "pt-BR") || a.atual - b.atual);
  return {
    itens: noHorizonte.map((e) => {
      const cartao = e.cartaoId == null ? null : porId.get(String(e.cartaoId));
      return {
        ...e,
        rotulo: `${e.atual}/${e.total}x`,
        fatura: rotuloFatura(e.ciclo.mesVenc, cartao?.nome || "", idioma),
        nomeCartao: cartao?.nome || null,
      };
    }),
    alem: futuras.length - noHorizonte.length,
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
  const encargos = encargosDasParcelas(lancamentos, cartoes, { hoje });
  const linhas = [];

  for (const cartao of cartoes || []) {
    const ciclo = cicloQueContem(ref, cartao.dia_fechamento, cartao.dia_vencimento);
    if (!ciclo) continue;

    // Parcela não entra pela data gravada: a 2/2 datada na compra cairia no ciclo
    // errado. O encargo já aponta o ciclo em que o banco cobra.
    const compras = (lancamentos || []).filter(
      (l) => compraDoCartao(l, cartao.id) && !indiceEfetivo(l) && dentro(l.data_lancamento, ciclo.inicio, ciclo.fim),
    );
    const parcelas = encargos.filter(
      (e) => String(e.cartaoId) === String(cartao.id) && e.ciclo?.inicio === ciclo.inicio && e.ciclo?.fim === ciclo.fim,
    );
    const pagamentos = (lancamentos || []).filter((l) => {
      if (!ehPagamentoFatura(l)) return false;
      if (String(l.cartao_id) !== String(cartao.id)) return false;
      return dentro(l.data_lancamento, ciclo.inicio, ciclo.atePagamento);
    });

    if (compras.length === 0 && parcelas.length === 0 && pagamentos.length === 0) continue;

    const bruto = somar([...compras, ...parcelas]);
    const projetado = somar(parcelas.filter((e) => e.projetada));
    const pago = somar(pagamentos);
    const nome = normalizar(cartao.nome || "") || cartao.nome || "cartão";
    linhas.push({
      cartaoId: cartao.id,
      nome,
      label: rotuloFatura(ciclo.mesVenc, nome, idioma),
      valor: Math.max(0, Math.round((bruto - pago) * 100) / 100),
      bruto,
      projetado,
      pago,
      diaVencimento: ciclo.diaVencimento,
      vencimento: ciclo.diaVencimento ? (idioma === "en" ? `due day ${ciclo.diaVencimento}` : `vence dia ${ciclo.diaVencimento}`) : null,
      inicio: ciclo.inicio,
      fim: ciclo.fim,
      atePagamento: ciclo.atePagamento,
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

/**
 * Fatura do mês "por data da compra" (home, out/2026): junta `cartaoPorCartao` do
 * fechamento com o cadastro do cartão. Valor cheio das compras no crédito com
 * data no mês — sem ciclo de fechamento e sem descontar pagamento. Os dias de
 * fechamento/vencimento só aparecem como texto de apoio.
 */
export function faturaPorDataDaCompra(cartaoPorCartao, cartoes, { normalizar = (x) => x } = {}) {
  const porId = new Map((cartoes || []).map((c) => [String(c.id), c]));
  return (cartaoPorCartao || [])
    .filter((x) => Number(x.total) > 0)
    .map((x) => {
      const cartao = x.cartaoId == null ? null : porId.get(String(x.cartaoId));
      return {
        cartaoId: x.cartaoId,
        nome: cartao ? (normalizar(cartao.nome || "") || cartao.nome || "") : null,
        total: x.total,
        diaFechamento: cartao?.dia_fechamento || null,
        diaVencimento: cartao?.dia_vencimento || null,
      };
    });
}
