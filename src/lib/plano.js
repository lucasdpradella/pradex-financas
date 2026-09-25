// Regras de plano do SaaS — quem vê o quê, e com que texto.
//
// Lógica pura de propósito: o App só pergunta, não decide. Isso mantém a matriz de
// planos testável no Vitest sem montar componente (mesmo padrão de lancamentos.js).
//
// Fonte da verdade é a coluna `plano` de fp_perfil ('none' | 'essencial' | 'assistente' | 'casal').

export const PLANOS = ["none", "essencial", "assistente", "casal"];

// Os planos são ordinais: quem tem Assistente tem tudo do Essencial junto. É isso que
// dispensa listar recurso por plano — basta comparar nível.
//
// Casal (2026-09-25) é o nível 3: tudo do Assistente, pago por UM e usado pelos dois
// membros do mesmo livro. Não existe recurso exclusivo do Casal — o que ele vende é o
// segundo acesso —, por isso nenhum item de RECURSOS aponta pra ele.
const NIVEL = { none: 0, essencial: 1, assistente: 2, casal: 3 };

// Nível ordinal do plano (desconhecido = 0). Exportado pra quem precisa comparar
// plano com plano (convite, anti-downgrade) em vez de plano com recurso.
export const nivelPlano = (plano) => NIVEL[normalizePlano(plano)];

export const CHECKOUT = {
  essencial: "https://pay.cakto.com.br/a2xpq3u",
  assistente: "https://pay.cakto.com.br/4pteia8",
  // Oferta do Casal criada em 2026-09-25. O webhook reconhece '344ridx' e
  // '344ridx_1135957' (ver cakto-webhook/regras.ts). Se um dia virar null, o convite
  // `?plano=casal` some sozinho (planoDaUrl) em vez de mostrar botão sem destino.
  casal: "https://pay.cakto.com.br/344ridx_1135957",
};

// Preço só pra COPY — quem cobra é a Cakto. Casal: R$ 249,00/mês de tabela; a primeira
// cobrança pode vir com cupom (ex.: rodri30, 12% → ~R$ 219,12). Nada no sistema
// valida plano por valor — o plano sai SEMPRE da oferta. Se divergir do painel, o painel vence.
// O Assistente ficou meses marcado como indefinido no vault; foi confirmado em
// 2026-09-15 na aba "Minhas Assinaturas".
export const PRECO = { essencial: "R$ 29,90", assistente: "R$ 79,90", casal: "R$ 249,00" };

// Plano pedido pela URL: `?plano=essencial`, `?plano=assistente` ou `?plano=casal`.
//
// Existe pro Lucas mandar o link pra quem ele JÁ convenceu pessoalmente. Essa pessoa
// não precisa de 14 dias pra decidir — precisa de botão. Qualquer outro valor (ou
// nenhum) devolve null e o app segue como sempre foi: convite de teste, sem cobrança
// na cara de quem acabou de chegar.
export function planoDaUrl(search) {
  const bruto = String(search ?? "");
  const m = bruto.match(/[?&]plano=([^&]+)/i);
  if (!m) return null;
  const valor = decodeURIComponent(m[1]).trim().toLowerCase();
  // 'none' entra em PLANOS mas não é plano vendável — convite pra ele é ruído.
  if (valor === "essencial" || valor === "assistente") return valor;
  // Casal só vira convite quando existe checkout pra ele — convite sem botão é pior
  // que nenhum convite.
  if (valor === "casal" && CHECKOUT.casal) return valor;
  return null;
}

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
//
// `trial` é opcional pra não quebrar call site antigo, mas quem gateia recurso do
// trial PRECISA passar — sem ele, quem está testando levaria paywall no save de uma
// coisa que o trial deveria ter liberado.
export function paywallNoSave(plano, recurso, trial = null) {
  if (podeUsarRecurso(plano, recurso, trial)) return null;
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

// Recursos que o trial libera junto com o agente.
//
// Decisão do PRADELLA em 2026-09-13. O trial existe pra demonstrar o agente, e agente
// sem teto não tem o que comentar: dois dos cinco gatilhos do modo caos dependem de
// orçamento. Liberar só o Zap entregava meia experiência — a pessoa conversava com um
// agente mudo justamente sobre a parte que mais vende.
//
// Continua valendo o limite da regra original: FP e Relatórios NÃO entram. Trial de 14
// dias não é upgrade disfarçado — é o Essencial inteiro por 14 dias, não o Assistente.
const RECURSOS_DO_TRIAL = new Set(["whatsapp", "orcamento"]);

// O gate que as telas devem usar quando existir trial em jogo. `temAcesso` sozinho
// continua certo pra decisão puramente de plano (menu, rótulo, checkout).
export const podeUsarRecurso = (plano, recurso, trial, hoje = new Date()) =>
  temAcesso(plano, recurso) || (RECURSOS_DO_TRIAL.has(recurso) && trialAtivo(trial, hoje));

export const checkoutPara = (recurso) => CHECKOUT[planoNecessario(recurso)];

/**
 * Acrescenta `?email=` ao link do checkout.
 *
 * POR QUE ISTO EXISTE (2026-09-18). O Augusto comprou o Essencial às 17:12 com
 * `augusto.santosalmeida@outlook.com` e criou a conta no app às 19:46 com
 * `guto@innovabr.com.br`. Duas horas e dois e-mails — e como o webhook casa compra
 * com conta PELO E-MAIL, a assinatura dele não virou acesso. Ficou dois dias pagando
 * sem ter o que comprou, e ninguém ficou sabendo.
 *
 * Não foi erro dele: o checkout da Cakto e o app são sistemas que não se conhecem, e
 * o fluxo deixava a pessoa digitar qualquer e-mail. Pré-preencher com o e-mail da
 * SESSÃO fecha a maior parte dessa porta — quem já está logado chega na Cakto com o
 * campo certo preenchido.
 *
 * Não resolve 100%: o campo continua editável, e quem paga ANTES de criar conta não
 * passa por aqui. Por isso o aviso de "pagou e não liberou" (cakto-webhook) continua
 * sendo a rede de segurança, não um extra.
 *
 * Verificado contra o checkout real em 18/09: `?email=` preenche o campo.
 */
export function checkoutComEmail(url, email) {
  if (!url) return url;
  const limpo = String(email ?? "").trim();
  // Sem e-mail, devolve a URL intacta em vez de um `?email=` vazio, que só sujaria o
  // link e o analytics da Cakto.
  if (!limpo) return url;
  const separador = url.includes("?") ? "&" : "?";
  return `${url}${separador}email=${encodeURIComponent(limpo)}`;
}

export const ROTULO = { essencial: "Essencial", assistente: "Assistente", casal: "Casal" };

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
      // ⚠️ A SEGUNDA SAÍDA. Até 16/09 este card tinha um botão só, e quem já estava
      // convencido — indicação, alguém que o Lucas mostrou pessoalmente — não tinha
      // caminho nenhum pro checkout: ou esperava os 14 dias vencerem, ou tropeçava no
      // paywall de outro recurso. Trial é pra quem duvida; quem já decidiu quer pagar
      // e pronto. Oferecer os dois no mesmo card não canibaliza o teste, porque quem
      // ia testar continua vendo o teste primeiro, em botão cheio.
      ctaSecundario: `Já quero assinar — ${PRECO[alvo]}/mês`,
      hrefSecundario: CHECKOUT[alvo],
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
