// Fechamento do mês — agregações do relatório (Relatórios v1).
//
// Lógica pura, sem React e sem query: recebe os lançamentos que o App já carregou.
// Fica testável no Vitest do mesmo jeito que lancamentos.js e plano.js.
//
// NOTA: o DashboardDesktop tem agregação quase idêntica inline (receitas, gastos,
// débito × cartão, evitável, por categoria). Não unifiquei aqui de propósito — mexer
// numa tela que funciona não estava no escopo. Unificar depois é barato: o dashboard
// passaria a chamar calcularFechamento e jogar fora o próprio useMemo.

export const MESES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const prefixoMes = (ano, mes) => `${ano}-${String(mes + 1).padStart(2, "0")}`;

export const passoMes = (ano, mes, delta) => {
  const total = ano * 12 + mes + delta;
  return { ano: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
};

export const diasDoMes = (ano, mes) => new Date(ano, mes + 1, 0).getDate();

const soma = (arr) => arr.reduce((s, l) => s + Number(l.valor || 0), 0);

export const lancamentosDoMes = (lancamentos, ano, mes) => {
  const p = prefixoMes(ano, mes);
  return (lancamentos || []).filter((l) => String(l?.data_lancamento || "").startsWith(p));
};

// Dias do mês que têm pelo menos um lançamento. Chave é o dia (1..31) extraído da
// string ISO — não usa Date pra não escorregar em fuso.
export const diasComLancamento = (lancamentosMes) => {
  const dias = new Set();
  for (const l of lancamentosMes || []) {
    const dia = Number(String(l?.data_lancamento || "").slice(8, 10));
    if (dia >= 1 && dia <= 31) dias.add(dia);
  }
  return dias;
};

// Maior sequência de dias consecutivos com lançamento dentro do mês.
export const maiorSequencia = (dias) => {
  const ordenados = [...dias].sort((a, b) => a - b);
  let melhor = 0, atual = 0, anterior = null;
  for (const d of ordenados) {
    atual = anterior !== null && d === anterior + 1 ? atual + 1 : 1;
    if (atual > melhor) melhor = atual;
    anterior = d;
  }
  return melhor;
};

const agruparPorCategoria = (gastos, normalizar) => {
  const mapa = new Map();
  for (const l of gastos) {
    const cat = normalizar(l.categoria || "") || "Sem categoria";
    mapa.set(cat, (mapa.get(cat) || 0) + Number(l.valor || 0));
  }
  return mapa;
};

// Frase do mês: a categoria que mais subiu em reais contra o mês anterior. Sem base
// de comparação (primeiro mês), cai pra maior categoria do próprio mês.
function montarDestaque(catAtual, catAnterior, temMesAnterior) {
  if (catAtual.size === 0) return "Nenhum gasto lançado neste mês.";

  const maior = [...catAtual.entries()].sort((a, b) => b[1] - a[1])[0];

  if (temMesAnterior) {
    let alta = null;
    for (const [cat, total] of catAtual) {
      const antes = catAnterior.get(cat) || 0;
      const delta = total - antes;
      if (delta > 0 && (!alta || delta > alta.delta)) alta = { cat, delta, antes, total };
    }
    if (alta) {
      // Categoria que apareceu agora não tem percentual — evita divisão por zero e
      // evita dizer "subiu ∞%".
      if (alta.antes === 0) return `${alta.cat} apareceu neste mês e já é ${formatarBRL(alta.delta)}.`;
      const pct = Math.round((alta.delta / alta.antes) * 100);
      return `${alta.cat} foi a que mais subiu: ${pct}% a mais que no mês passado.`;
    }
    return `Nenhuma categoria subiu contra o mês passado. ${maior[0]} segue sendo a maior.`;
  }

  return `${maior[0]} é a sua maior categoria do mês.`;
}

export const formatarBRL = (valor) =>
  Number(valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Agrega o mês inteiro. `hoje` é injetável pra o teste não depender da data real.
 * `normalizar` conserta mojibake na chave da categoria (senão "Alimentação" e
 * "AlimentaÃ§Ã£o" viram duas linhas diferentes no top 5).
 */
export function calcularFechamento(lancamentos, ano, mes, { hoje = new Date(), normalizar = (x) => x } = {}) {
  const doMes = lancamentosDoMes(lancamentos, ano, mes);
  const gastos = doMes.filter((l) => l.tipo === "gasto");

  const ant = passoMes(ano, mes, -1);
  const doMesAnterior = lancamentosDoMes(lancamentos, ant.ano, ant.mes);
  const gastosAnterior = doMesAnterior.filter((l) => l.tipo === "gasto");

  const receitas = soma(doMes.filter((l) => l.tipo === "receita"));
  const gastoTotal = soma(gastos);
  const gastoAnterior = soma(gastosAnterior);

  const catAtual = agruparPorCategoria(gastos, normalizar);
  const catAnterior = agruparPorCategoria(gastosAnterior, normalizar);

  const categorias = [...catAtual.entries()]
    .map(([cat, total]) => ({ cat, total, pct: gastoTotal > 0 ? total / gastoTotal : 0 }))
    .sort((a, b) => b.total - a.total);

  const dias = diasComLancamento(doMes);
  const totalDias = diasDoMes(ano, mes);

  // Mês corrente conta só os dias já decorridos — cobrar 30 dias no dia 5 reprovaria
  // todo mundo. Mês futuro não tem dia decorrido nenhum.
  const mesDeHoje = hoje.getFullYear() === ano && hoje.getMonth() === mes;
  const noFuturo = ano > hoje.getFullYear() || (ano === hoje.getFullYear() && mes > hoje.getMonth());
  const diasConsiderados = noFuturo ? 0 : mesDeHoje ? hoje.getDate() : totalDias;

  return {
    ano, mes,
    label: `${MESES_CURTO[mes]}/${ano}`,
    labelAnterior: `${MESES_CURTO[ant.mes]}/${ant.ano}`,

    temLancamentos: doMes.length > 0,
    temMesAnterior: doMesAnterior.length > 0,

    receitas,
    gastoTotal,
    saldo: receitas - gastoTotal,

    debito: soma(gastos.filter((l) => l.forma_pagamento !== "Crédito")),
    cartao: soma(gastos.filter((l) => l.forma_pagamento === "Crédito")),

    evitavel: soma(gastos.filter((l) => l.poderia_ter_evitado)),
    evitavelAnterior: soma(gastosAnterior.filter((l) => l.poderia_ter_evitado)),

    gastoAnterior,
    deltaGasto: gastoTotal - gastoAnterior,
    deltaGastoPct: gastoAnterior > 0 ? (gastoTotal - gastoAnterior) / gastoAnterior : null,

    categorias,
    topCategorias: categorias.slice(0, 5),
    maxCategoria: Math.max(...categorias.map((c) => c.total), 1),

    diasComLancamento: dias.size,
    diasConsiderados,
    diasNoMes: totalDias,
    mesCorrente: mesDeHoje,
    streak: maiorSequencia(dias),

    destaque: montarDestaque(catAtual, catAnterior, doMesAnterior.length > 0),
  };
}
