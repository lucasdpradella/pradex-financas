// METAS — caixinhas de guardar dinheiro. Lógica pura, sem React e sem query.
//
// Brief: Chave Mestre, Projetos/PRADEX/briefs/2026-09-16_metas-caixinhas.md
//
// REGRA QUE EXPLICA O ARQUIVO INTEIRO (Lucas, 16/09): guardar = aplicar = debitar da
// conta. O aporte é um lançamento de verdade, tipo 'gasto', com `meta_id`. Resgate é
// 'receita' com o mesmo `meta_id`. Não existe tabela de aportes: o histórico da
// caixinha É o histórico de lançamentos.
//
// COM UMA EXCEÇÃO, a partir de 18/09: `abate_saldo = false` marca o dinheiro que JÁ
// estava guardado antes de a caixinha existir. Ele enche a barra e não toca no mês —
// senão quem cria "Viagem" com R$ 2.000 já juntados nasce com R$ 2.000 de saldo
// negativo por um dinheiro que saiu da conta meses atrás. Continua sendo lançamento
// (uma fonte só); o que muda é se as agregações do mês o contam.
//
// Por isso tudo aqui recebe `lancamentos` e devolve conta — não há segunda fonte pra
// consultar, e é isso que impede as duas de divergirem.

// Categoria reservada do aporte. Fixa e não editável no cadastro de categorias: se o
// usuário renomeasse, o filtro por categoria de outros relatórios se perderia.
export const CATEGORIA_META = "Metas";

// De onde o dinheiro saiu pra entrar na caixinha. Crédito FICA DE FORA de propósito:
// guardar dinheiro no crédito geraria fatura e dívida fingindo de poupança.
//
// "Saldo da conta" entrou em 19/09 e é o caso mais comum de todos — mover dinheiro
// pra caixinha do próprio banco não é PIX nem débito, e quem fazia isso não achava a
// própria resposta na lista. "PIX" e "Débito" viraram uma opção só porque a diferença
// entre os dois não muda nada em lugar nenhum do app: os dois são dinheiro que saiu
// da conta na hora. Menos opção, menos gente parada decidindo.
//
// São rótulos novos, não migração: aporte antigo gravado como "Débito" ou "PIX"
// continua válido no banco e aparece como sempre apareceu — `forma_pagamento` é texto
// livre e o resto do app só pergunta se é "Crédito".
export const FORMAS_APORTE = ["Saldo da conta", "PIX/Débito", "Dinheiro"];

// Quantas caixinhas cada plano guarda. Free tem uma — decisão do Lucas (16/09):
// caixinha é a feature mais compartilhável do app, e travar tudo mata a aquisição.
// O limite é sobre metas ATIVAS; arquivada não ocupa vaga.
export const LIMITE_FREE = 1;

const num = (v) => Number(v || 0);

export const ehAporte = (lancamento) => lancamento?.meta_id != null;

/**
 * Este lançamento entra nas contas do mês (saldo, guardado, resgatado)?
 *
 * Lê `!== false` e não `=== true` de propósito: a coluna nasceu em 18/09 e tudo que
 * veio antes — e tudo que chega de um cliente antigo em cache — vem com o campo
 * ausente. Ausente tem que significar "abate", que é o comportamento de sempre.
 */
export const abateSaldo = (lancamento) => lancamento?.abate_saldo !== false;

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
 * `abateSaldo = false` é o dinheiro que já estava guardado — enche a caixinha sem
 * mexer no mês (ver o cabeçalho do arquivo).
 */
export function montarLancamentoAporte({ meta, valor, data, userId, resgate = false, forma = null, abateSaldo: abate = true }) {
  const v = Number(valor);
  if (!meta?.id) return { erro: "Meta inválida." };
  if (!Number.isFinite(v) || v <= 0) return { erro: "Informe um valor maior que zero." };
  // Crédito nunca: viraria fatura fingindo de poupança.
  // Forma de pagamento só existe quando o dinheiro se moveu agora — num aporte que
  // não abate, dizer "PIX" afirmaria um PIX de hoje que não aconteceu.
  const formaOk = abate !== false && forma && FORMAS_APORTE.includes(forma) ? forma : null;

  const naoAbate = abate === false;

  return {
    lancamento: {
      // A descrição diz de onde veio o dinheiro, porque na lista de lançamentos o
      // aporte que não abate aparece junto dos outros e não teria como se explicar.
      descricao: resgate
        ? `Resgate — ${meta.nome}${naoAbate ? " (não voltou pra conta)" : ""}`
        : `Guardei — ${meta.nome}${naoAbate ? " (já estava guardado)" : ""}`,
      valor: Math.round(v * 100) / 100,
      tipo: resgate ? "receita" : "gasto",
      categoria: CATEGORIA_META,
      data_lancamento: data,
      user_id: userId,
      forma_pagamento: formaOk,
      cartao_id: null,
      meta_id: meta.id,
      abate_saldo: !naoAbate,
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
// `abateSaldo(l)` no filtro (18/09): só pontua o dinheiro que saiu da conta NESTE
// mês. Aporte de dinheiro que já estava guardado é registro retroativo — acontece uma
// vez, quando a caixinha nasce, e dar 20 pontos por isso premiaria o cadastro em vez
// do hábito. O score mede o que a pessoa fez no mês, não o que ela tinha antes.
export function guardouNoMes(lancamentosDoMes) {
  return (lancamentosDoMes || []).some(
    (l) => ehAporte(l) && abateSaldo(l) && l.tipo === "gasto" && num(l.valor) > 0,
  );
}

// ============================================================================
// DIFICULDADE E MARCOS (2026-09-19)
// ============================================================================
// Brief: Chave Mestre, Projetos/PRADEX/briefs/2026-09-19_ranking-e-pontuacao-de-metas.md
//
// O problema que isto resolve, nas palavras do Lucas: "eu coloquei uma meta no meu
// app, casamento, 100 mil. Até juntar 100 mil o cara nunca será recompensado por ter
// chegado?" Até 19/09 existia UM evento de vitória — `concluida_em`. Numa meta grande
// isso é um silêncio de dois anos.
//
// ⚠️ ESPELHO DO BANCO. Pesos, marcos e a conta de pontos existem iguais na trigger
// `metas_marca_conclusao` (migration 2026-09-19). Quem manda é o banco: é ele que
// grava `meta_marcos.pontos`, congelado no instante da conquista. O que está aqui
// serve pra TELA prever e explicar — se divergirem, o número do placar é o do banco.

/**
 * As três dificuldades, declaradas por quem cria a meta.
 *
 * `frase` não é enfeite, é o mecanismo. Se as opções fossem só "fácil/moderada/
 * difícil", todo mundo marcaria difícil — não por má-fé, por otimismo sobre o próprio
 * esforço — e aí o multiplicador não diferenciaria nada. Cada frase descreve o MÊS da
 * pessoa, não o prêmio: ela responde sobre a vida dela e a resposta sai honesta.
 *
 * `peso` é inteiro (4/7/10) pra os pontos fecharem sem arredondamento nenhum. A
 * proporção é 1 : 1,75 : 2,5 e vem de uma âncora que o Lucas deu pronta (19/09):
 *
 *   "quem chega a 100% da fácil equivale a 40% da difícil"
 *
 * Confere: meta fácil inteira = 100 × 4 = 400 pontos; 40% de uma difícil = 40 × 10 =
 * 400. A âncora define a razão difícil/fácil em 2,5 — a primeira versão usava 2, e
 * com ela a fácil inteira valia 50% da difícil, que ele achou generoso demais.
 *
 * O risco conhecido de subir a razão é todo mundo marcar "difícil". Ele fica aceito:
 * a `frase` de cada opção é a defesa (a pessoa responde sobre o próprio mês, não
 * sobre o prêmio), e o Lucas já decidiu em 19/09 não policiar declaração.
 */
export const DIFICULDADES = [
  { chave: "facil",    label: "Fácil",    frase: "dá pra chegar sem mudar nada no meu mês", peso: 4 },
  { chave: "moderada", label: "Moderada", frase: "vou ter que cortar alguma coisa",         peso: 7 },
  { chave: "dificil",  label: "Difícil",  frase: "vai doer todo mês até eu chegar lá",      peso: 10 },
];

export const DIFICULDADE_PADRAO = "moderada";

export const dificuldadeDe = (meta) =>
  DIFICULDADES.find((d) => d.chave === meta?.dificuldade) ||
  DIFICULDADES.find((d) => d.chave === DIFICULDADE_PADRAO);

// 1 = "começou" (qualquer valor, independente de percentual). Os outros são o
// percentual mesmo. O 10 existe por causa da meta grande: em R$ 100.000, o 25% ainda
// é R$ 25.000 — longe demais pra ser o primeiro sinal de vida.
export const MARCOS = [1, 10, 25, 50, 75, 90, 100];

const MARCO_ANTERIOR = { 1: 0, 10: 1, 25: 10, 50: 25, 75: 50, 90: 75, 100: 90 };

/**
 * Pontos de um marco: o INCREMENTO que ele representa, vezes o peso.
 *
 * É o que faz a soma dos sete fechar exatamente 100 × peso — fácil 200, moderada 300,
 * difícil 400 — em vez de 351 × peso, que seria somar os marcos crus.
 */
export function pontosDoMarco(marco, dificuldade) {
  const peso = (DIFICULDADES.find((d) => d.chave === dificuldade) ||
                DIFICULDADES.find((d) => d.chave === DIFICULDADE_PADRAO)).peso;
  return (marco - (MARCO_ANTERIOR[marco] ?? 0)) * peso;
}

/**
 * Marcos que um progresso já alcançou. `acumulado` entra separado do percentual
 * porque o marco 1 pergunta "entrou dinheiro?", não "chegou a 1%".
 */
export function marcosAlcancados(progresso, acumulado) {
  const pct = Number(progresso || 0) * 100;
  return MARCOS.filter((m) => (m === 1 ? Number(acumulado || 0) > 0 : pct >= m));
}

/**
 * O que a tela diz quando um marco cai. Duas partes: a conquista, e a frase que
 * reconhece o que ela custou — esta última varia com a dificuldade DECLARADA, porque
 * é a única coisa que o app sabe sobre o esforço.
 *
 * Tom: o Pradex fala como alguém que estava acompanhando, não como jogo com confete.
 * Nada de "parabéns!!!" — quem guarda R$ 200 por mês há um ano não quer emoji, quer
 * ser visto.
 */
export function mensagemDoMarco(marco, meta) {
  const nome = meta?.nome || "sua meta";
  const dif = dificuldadeDe(meta).chave;

  const titulo = {
    1: "Você começou",
    10: "10% do caminho",
    25: "Um quarto do caminho",
    50: "Metade",
    75: "75%",
    90: "90%",
    100: "Meta batida",
  }[marco] || "Mais um passo";

  // O 100 fala por si e não precisa de consolo nem de empurrão.
  if (marco === 100) {
    return {
      titulo,
      frase: dif === "dificil"
        ? `${nome} era a difícil. Você chegou assim mesmo.`
        : `${nome} é sua. Sem show — o show é não desfazer amanhã.`,
    };
  }

  if (marco === 1) {
    return {
      titulo,
      frase: dif === "dificil"
        ? "O primeiro depósito da meta difícil. Esse é o que mais gente não faz."
        : "Primeiro depósito registrado. É o passo que mais gente não dá.",
    };
  }

  const frase = {
    10: "Saiu do zero. Agora é repetir.",
    25: "Um quarto. O começo já ficou pra trás.",
    50: `Daqui pra frente falta menos do que já foi.`,
    75: "Dá pra ver daqui.",
    90: "É esse mês ou o que vem.",
  }[marco];

  return {
    titulo,
    frase: dif === "dificil" ? `${frase} E você disse que essa ia doer.` : frase,
  };
}
