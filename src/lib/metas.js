// METAS — caixinhas de guardar dinheiro. Lógica pura, sem React e sem query.
//
// Brief: Chave Mestre, Projetos/PRADEX/briefs/2026-09-16_metas-caixinhas.md
//
// REGRA QUE EXPLICA O ARQUIVO INTEIRO (Lucas, 16/09): guardar = aplicar = debitar da
// conta. O aporte é um lançamento de verdade, tipo 'gasto', com `meta_id`. Resgate é
// 'receita' com o mesmo `meta_id`. Não existe tabela de aportes: o histórico da
// caixinha É o histórico de lançamentos.
//
// Por isso tudo aqui recebe `lancamentos` e devolve conta — não há segunda fonte pra
// consultar, e é isso que impede as duas de divergirem.

// Categoria reservada do aporte. Fixa e não editável no cadastro de categorias: se o
// usuário renomeasse, o filtro por categoria de outros relatórios se perderia.
export const CATEGORIA_META = "Metas";

// Formas de pagamento aceitas num aporte. Crédito FICA DE FORA de propósito: guardar
// dinheiro no crédito geraria fatura e dívida fingindo de poupança.
export const FORMAS_APORTE = ["Débito", "PIX", "Dinheiro"];

// Quantas caixinhas cada plano guarda. Free tem uma — decisão do Lucas (16/09):
// caixinha é a feature mais compartilhável do app, e travar tudo mata a aquisição.
// O limite é sobre metas ATIVAS; arquivada não ocupa vaga.
export const LIMITE_FREE = 1;

const num = (v) => Number(v || 0);

export const ehAporte = (lancamento) => lancamento?.meta_id != null;

// Lançamentos de consumo — o que a pessoa realmente gastou. É o filtro que impede o
// dinheiro guardado de se disfarçar de gasto no relatório.
export const semAportes = (lancamentos) => (lancamentos || []).filter((l) => !ehAporte(l));

export const apenasAportes = (lancamentos) => (lancamentos || []).filter(ehAporte);

/**
 * Acumulado de uma meta: guardado menos resgatado.
 *
 * Pode dar negativo se a pessoa resgatar mais do que guardou (aconteceria por erro de
 * digitação, ou por resgatar em meses fora da janela carregada). Quem exibe trata —
 * aqui a conta é a conta, sem piso artificial, senão o número da tela nunca fecharia
 * com o histórico.
 */
export function acumuladoDaMeta(lancamentos, metaId) {
  if (metaId == null) return 0;
  return (lancamentos || [])
    .filter((l) => String(l?.meta_id) === String(metaId))
    .reduce((s, l) => s + (l.tipo === "gasto" ? num(l.valor) : -num(l.valor)), 0);
}

/**
 * A meta com o que a tela precisa. `progresso` é limitado a 1 só na exibição da barra
 * — `acumulado` e `falta` continuam crus, porque quem guardou a mais merece ver.
 */
export function comProgresso(meta, lancamentos) {
  const acumulado = acumuladoDaMeta(lancamentos, meta?.id);
  const alvo = num(meta?.valor_alvo);
  const bruto = alvo > 0 ? acumulado / alvo : 0;
  return {
    ...meta,
    acumulado,
    falta: Math.max(0, alvo - acumulado),
    progresso: Math.max(0, Math.min(1, bruto)),
    // `concluida_em` vem do banco (trigger) e manda. O cálculo local é só pro instante
    // entre salvar o aporte e o refetch chegar — sem ele, a barra chega a 100% e a
    // comemoração só apareceria depois de uma volta no servidor.
    concluida: Boolean(meta?.concluida_em) || (alvo > 0 && acumulado >= alvo),
  };
}

export const metasAtivas = (metas) => (metas || []).filter((m) => m && !m.arquivada);

/**
 * Pode criar mais uma? Devolve null quando pode, ou o motivo do bloqueio.
 *
 * Mesmo formato de `paywallNoSave` (lib/plano.js) de propósito: a tela trata os dois
 * bloqueios do mesmo jeito. E, como lá, a checagem é no SAVE — a tela de criar sempre
 * abre, porque cadeado faz desistir antes de tocar.
 */
export function limiteDeMetas(plano, metas, { temAcessoPago = false } = {}) {
  if (temAcessoPago) return null;
  const ativas = metasAtivas(metas).length;
  if (ativas < LIMITE_FREE) return null;
  return { motivo: "limite", ativas, limite: LIMITE_FREE };
}

/**
 * Monta o lançamento do aporte. Existe pra que os três caminhos de entrada (tela de
 * Metas, tela de Lançar, WhatsApp) produzam a MESMA linha — três montagens diferentes
 * seria a forma mais fácil de o aporte do WhatsApp não bater com o da tela.
 *
 * `resgate` inverte o tipo: o dinheiro está voltando pra conta.
 */
export function montarLancamentoAporte({ meta, valor, data, userId, resgate = false, forma = null }) {
  const v = Number(valor);
  if (!meta?.id) return { erro: "Meta inválida." };
  if (!Number.isFinite(v) || v <= 0) return { erro: "Informe um valor maior que zero." };
  // Crédito nunca: viraria fatura fingindo de poupança.
  const formaOk = forma && FORMAS_APORTE.includes(forma) ? forma : null;

  return {
    lancamento: {
      descricao: resgate ? `Resgate — ${meta.nome}` : `Guardei — ${meta.nome}`,
      valor: Math.round(v * 100) / 100,
      tipo: resgate ? "receita" : "gasto",
      categoria: CATEGORIA_META,
      data_lancamento: data,
      user_id: userId,
      forma_pagamento: formaOk,
      cartao_id: null,
      meta_id: meta.id,
      // Guardar dinheiro nunca é gasto evitável — é o oposto do que o campo mede.
      poderia_ter_evitado: false,
      recorrente: false,
      recorrente_grupo_id: null,
      parcela_atual: null,
      total_parcelas: null,
      parcela_grupo_id: null,
    },
  };
}

/**
 * Guardou em alguma meta no mês? É o componente `guardou` do score de disciplina.
 *
 * BINÁRIO de propósito, e sem olhar valor: `disciplina.js` tem regra inegociável de
 * pontuar comportamento e nunca dinheiro. Um aporte de R$ 5 vale o mesmo que um de
 * R$ 5.000 — senão quem ganha mais pontuaria mais, que é o que o score existe pra
 * não fazer. Binário e não proporcional (metas alimentadas ÷ ativas) porque
 * proporcional puniria quem cria muitas metas, e criar meta é o comportamento que o
 * produto quer causar.
 */
export function guardouNoMes(lancamentosDoMes) {
  return (lancamentosDoMes || []).some((l) => ehAporte(l) && l.tipo === "gasto" && num(l.valor) > 0);
}
