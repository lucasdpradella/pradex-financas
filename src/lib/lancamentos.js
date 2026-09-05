// Lógica pura de lançamentos, extraída do App.jsx em 2026-09-05 para poder ser
// testada. NADA aqui muda de comportamento — o código é o mesmo que rodava
// dentro do componente; só saiu de lá para virar módulo importável.
//
// Por que estas funções e não outras: agruparLancamentos é o funil por onde todo
// lançamento passa antes de aparecer na tela. Um bug aqui não dá erro — ele faz
// lançamento SUMIR da lista silenciosamente, que é a classe de falha mais cara
// deste app (ver o incidente de 2026-06-01).

export const normalizeText = (value = "") => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!/[ÃÂ ]/.test(text)) return text;
  try {
    return decodeURIComponent(escape(text));
  } catch (e) {
    return text
      .replace(/Ã¡/g, "á").replace(/Ã¢/g, "â").replace(/Ã£/g, "ã").replace(/Ã /g, "à")
      .replace(/Ã©/g, "é").replace(/Ãª/g, "ê").replace(/Ã­/g, "í").replace(/Ã³/g, "ó")
      .replace(/Ã´/g, "ô").replace(/Ãµ/g, "õ").replace(/Ãº/g, "ú").replace(/Ã§/g, "ç")
      .replace(/Ã/g, "Á").replace(/Ã‰/g, "É").replace(/Ã/g, "Í").replace(/Ã"/g, "Ó")
      .replace(/Ãš/g, "Ú").replace(/Ã‡/g, "Ç").replace(/Â·/g, "·").replace(/Â/g, "");
  }
};

export const limparDescricaoParcela = (descricao = "") => descricao.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
export const montarDescricaoParcela = (descricao, parcelaAtual, totalParcelas) => `${limparDescricaoParcela(descricao)} (${parcelaAtual}/${totalParcelas})`;
export const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export function agruparPorParcelaGrupo(lancamentos) {
  const grupos = new Map();
  const avulsos = [];
  for (const l of lancamentos) {
    if (l.parcela_grupo_id) {
      const arr = grupos.get(l.parcela_grupo_id);
      if (arr) arr.push(l);
      else grupos.set(l.parcela_grupo_id, [l]);
    } else {
      avulsos.push(l);
    }
  }
  const compras = [];
  for (const [gid, parcelas] of grupos.entries()) {
    parcelas.sort((a, b) => (a.parcela_atual || 0) - (b.parcela_atual || 0));
    const primeira = parcelas[0];
    const ultima = parcelas[parcelas.length - 1];
    const valorParcela = Number(primeira.valor) || 0;
    const nParcelas = primeira.total_parcelas || parcelas.length;
    const valorTotal = Math.round(valorParcela * nParcelas * 100) / 100;
    compras.push({
      id: `compra-${gid}`,
      _compraParcelada: true,
      _grupoParcelaId: gid,
      _parcelas: parcelas,
      _valorParcela: valorParcela,
      _nParcelas: nParcelas,
      _dataInicio: primeira.data_lancamento,
      _dataFim: ultima.data_lancamento,
      _idMax: parcelas.reduce((m, p) => Math.max(m, Number(p.id) || 0), 0),
      // Campos "compat" pra filtros + ordenação trabalharem igual antes
      descricao: limparDescricaoParcela(primeira.descricao || ""),
      valor: valorTotal,
      tipo: primeira.tipo || "gasto",
      categoria: primeira.categoria || "",
      forma_pagamento: primeira.forma_pagamento || "Crédito",
      cartao_id: primeira.cartao_id,
      data_lancamento: primeira.data_lancamento,
      total_parcelas: nParcelas,
      parcela_atual: 1,
      poderia_ter_evitado: false,
      recorrente: false,
    });
  }
  return { compras, avulsos };
}

export function agruparLancamentos(lancamentos) {
  const { compras, avulsos } = agruparPorParcelaGrupo(lancamentos);
  const grupos = {};
  const naoRecorrentes = avulsos.filter(l => !l.recorrente);
  const recorrentes = avulsos.filter(l => l.recorrente);
  for (const l of recorrentes) {
    const chave = l.recorrente_grupo_id || `${l.descricao}||${l.valor}||${l.categoria}`;
    if (!grupos[chave]) {
      grupos[chave] = { ...l, _totalMeses: 1, _idsGrupo: [l.id], _grupoId: l.recorrente_grupo_id || null };
    } else {
      grupos[chave]._totalMeses += 1;
      grupos[chave]._idsGrupo.push(l.id);
      if (l.data_lancamento < grupos[chave].data_lancamento) grupos[chave].data_lancamento = l.data_lancamento;
    }
  }
  const recorrentesAgrupados = Object.values(grupos);
  const todos = [...compras, ...recorrentesAgrupados, ...naoRecorrentes];
  // Ordem de CRIAÇÃO (recém-lançado no topo), como era antes do agrupamento.
  // Compra usa o maior id entre as parcelas; id sintético "compra-uuid" nunca entra na conta.
  const chaveOrdem = (l) => l._idMax || (typeof l.id === "number" ? l.id : 0);
  todos.sort((a, b) => chaveOrdem(b) - chaveOrdem(a));
  return todos;
}
