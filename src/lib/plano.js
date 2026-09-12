// Regras de plano do SaaS — quem vê o quê, e com que texto.
//
// Lógica pura de propósito: o App só pergunta, não decide. Isso mantém a matriz de
// planos testável no Vitest sem montar componente (mesmo padrão de lancamentos.js).
//
// Fonte da verdade é a coluna `plano` de fp_perfil ('none' | 'essencial' | 'assistente').

export const PLANOS = ["none", "essencial", "assistente"];

// Os planos são ordinais: quem tem Assistente tem tudo do Essencial junto. É isso que
// dispensa listar recurso por plano — basta comparar nível.
const NIVEL = { none: 0, essencial: 1, assistente: 2 };

export const CHECKOUT = {
  essencial: "https://pay.cakto.com.br/a2xpq3u",
  assistente: "https://pay.cakto.com.br/4pteia8",
};

// Só recursos PAGOS entram aqui. O core do app (dashboard, lançar, histórico, cartões,
// bancos, categorias) é livre pros três planos e nunca passa por temAcesso.
export const RECURSOS = {
  whatsapp: "essencial",
  // Teto por categoria. No Essencial (e não no Assistente) porque o modo caos é do
  // Essencial: sem teto, o assinante não teria o que estourar e o agente ficaria sem
  // gatilho. Ver Chave Mestre, Projetos/PRADEX/orcamento-e-disciplina.md.
  orcamento: "essencial",
  fp: "assistente",
  relatorios: "assistente",
};

// Plano ausente, nulo ou desconhecido cai em 'none': o default é sempre o mais fechado.
export const normalizePlano = (valor) => (PLANOS.includes(valor) ? valor : "none");

// Recurso desconhecido também falha fechado (exige o plano mais alto). Como o catálogo
// só tem coisa paga, errar o nome de um recurso não pode virar liberação de graça.
export const planoNecessario = (recurso) => RECURSOS[recurso] || "assistente";

export const temAcesso = (plano, recurso) =>
  NIVEL[normalizePlano(plano)] >= NIVEL[planoNecessario(recurso)];

// O item continua no menu, com cadeado — parar de esconder recurso sem contexto é o
// ponto inteiro do paywall.
//
// ⚠️ APOSENTADO em 2026-09-12, mantido só pelos usos antigos. O padrão novo é "deixa
// tentar e cobra no save": a tela abre, a pessoa preenche, e o paywall só aparece
// quando ela TENTA salvar — porque aí a intenção já está formada. Cadeado ainda é
// porta fechada, e porta fechada faz desistir antes de tocar. Recurso novo usa
// `paywallNoSave()`; nenhum recurso novo deve ganhar cadeado.
export const mostraCadeado = (plano, recurso) => !temAcesso(plano, recurso);

// ===== PAYWALL NO SAVE (padrão novo, 2026-09-12) =====
//
// Responde à única pergunta que a tela precisa fazer na hora de salvar: "deixo passar,
// ou abro o paywall?". A tela em si nunca pergunta se pode RENDERIZAR — ela sempre
// renderiza. É isso que separa este padrão do cadeado.
//
// Devolve null quando pode salvar; quando não, devolve o que o paywall precisa saber.
export function paywallNoSave(plano, recurso) {
  if (temAcesso(plano, recurso)) return null;
  const exigido = planoNecessario(recurso);
  return { recurso, planoAtual: normalizePlano(plano), planoExigido: exigido, checkout: CHECKOUT[exigido] || null };
}

// Prévia borrada: telas de gráfico (Planejamento, Relatórios) não seguram ninguém
// vazias — o gancho é ver que existe uma forma e não conseguir ler.
//
// ⚠️ Quem chama isto NUNCA pode borrar o gráfico real com `filter: blur()`. Os números
// continuariam no DOM e qualquer um os lê no DevTools — é dado financeiro. A prévia
// tem que ser desenhada com dado falso plausível.
export const mostraPreviaBorrada = (plano, recurso) => !temAcesso(plano, recurso);

// ===== TRIAL DO WHATSAPP =====
// O trial libera SÓ o agente do WhatsApp, e sem tocar em `plano`: quem manda no plano
// pago continua sendo o webhook da Cakto. FP e Relatórios seguem só no Assistente —
// trial de 14 dias não é upgrade disfarçado.

export const DIAS_TRIAL = 14;

// `trial` é { trial_inicio, trial_ate } vindo de fp_perfil. Data inválida ou ausente
// conta como sem trial: o default é sempre o mais fechado.
const dataValida = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d;
};

export const temTrial = (trial) => Boolean(dataValida(trial?.trial_inicio));

export function trialAtivo(trial, hoje = new Date()) {
  if (!temTrial(trial)) return false;
  const ate = dataValida(trial?.trial_ate);
  return ate !== null && hoje < ate;
};

// Já usou e acabou. Diferente de "nunca testou": é o que decide se o CTA oferece o
// teste ou manda direto pro checkout.
export const trialExpirado = (trial, hoje = new Date()) => temTrial(trial) && !trialAtivo(trial, hoje);

// `trial` ausente (null/undefined) significa "não sei", não "nunca testou": quem não
// passou a informação não recebe oferta de teste. Nunca-testou é o objeto com
// trial_inicio null, que é o que fp_perfil devolve. Sem essa distinção, qualquer call
// site que esquecesse de passar o trial ofereceria 14 dias grátis a quem já usou.
export const podeIniciarTrial = (plano, trial) =>
  trial != null && !temTrial(trial) && !temAcesso(plano, "whatsapp");

// Dias inteiros que ainda restam, arredondando pra cima: no último dia mostra "1 dia",
// não "0 dias". Zero quando não há trial ativo.
export function diasRestantesTrial(trial, hoje = new Date()) {
  if (!trialAtivo(trial, hoje)) return 0;
  const ate = dataValida(trial.trial_ate);
  return Math.max(1, Math.ceil((ate - hoje) / 86400000));
}

// O gate do Zap. Pago ignora o trial; o trial não expira pra quem paga.
export const podeUsarWhatsapp = (plano, trial, hoje = new Date()) =>
  temAcesso(plano, "whatsapp") || trialAtivo(trial, hoje);

export const checkoutPara = (recurso) => CHECKOUT[planoNecessario(recurso)];

const ROTULO = { essencial: "Essencial", assistente: "Assistente" };

const COPY = {
  whatsapp: {
    titulo: "Lance seus gastos pelo WhatsApp",
    descricao: "Manda texto ou áudio — \"gastei 50 no mercado\" — e o Pradex registra sozinho, sem abrir o app.",
  },
  fp: {
    titulo: "Planejamento Financeiro completo",
    descricao: "Perfil, objetivos, rendas, investimentos e o Diagnóstico: o raio-x da sua vida financeira em um lugar só.",
  },
  // Relatórios ainda não existe. A copy lidera pelo FP, que está pronto hoje, e cita
  // Relatórios como o que vem — vender como entregue geraria pedido de reembolso.
  relatorios: {
    titulo: "Planejamento Financeiro completo",
    descricao: "Perfil, objetivos, rendas, investimentos e o Diagnóstico, disponíveis agora. Os Relatórios entram em breve, no mesmo plano.",
  },
};

export function conteudoUpgrade(plano, recurso, { trial = null, hoje = new Date() } = {}) {
  const atual = normalizePlano(plano);
  const alvo = planoNecessario(recurso);
  const base = COPY[recurso] || COPY.fp;
  const rotulo = ROTULO[alvo];

  // Só o WhatsApp tem trial. Em FP/Relatórios o CTA é sempre checkout, mesmo com
  // trial ativo — o teste do Zap não abre o Assistente.
  if (recurso === "whatsapp" && podeIniciarTrial(atual, trial)) {
    return {
      modo: "trial",
      titulo: base.titulo,
      descricao: base.descricao,
      nota: `${DIAS_TRIAL} dias grátis. Sem cartão, sem cobrança automática.`,
      cta: `Testar ${DIAS_TRIAL} dias grátis`,
      href: CHECKOUT[alvo],
    };
  }

  return {
    modo: "checkout",
    titulo: base.titulo,
    descricao: base.descricao,
    // Quem já paga e está subindo de plano merece um texto diferente de quem nunca
    // pagou; e quem acabou de queimar o trial merece um terceiro, que reconhece isso
    // em vez de oferecer o mesmo "conheça" de quem nunca testou.
    nota: NIVEL[atual] > 0
      ? `Você está no plano ${ROTULO[atual]}. Isso faz parte do ${rotulo}.`
      : recurso === "whatsapp" && trialExpirado(trial, hoje)
      ? `Seu teste de ${DIAS_TRIAL} dias terminou. O app continua livre; o WhatsApp é do ${rotulo}.`
      : `Disponível no plano ${rotulo}.`,
    cta: NIVEL[atual] > 0
      ? "Fazer upgrade"
      : recurso === "whatsapp" && trialExpirado(trial, hoje)
      ? `Assinar o ${rotulo}`
      : `Conhecer o ${rotulo}`,
    href: CHECKOUT[alvo],
  };
}
