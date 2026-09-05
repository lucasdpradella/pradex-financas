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
export const mostraCadeado = (plano, recurso) => !temAcesso(plano, recurso);

export const checkoutPara = (recurso) => CHECKOUT[planoNecessario(recurso)];

const ROTULO = { essencial: "Essencial", assistente: "Assistente" };

const COPY = {
  whatsapp: {
    titulo: "Lance seus gastos pelo WhatsApp",
    descricao: "Manda texto ou áudio — \"gastei 50 no mercado\" — e o Pradex registra sozinho, sem abrir o app.",
  },
  fp: {
    titulo: "Planejamento Financeiro completo",
    descricao: "Perfil, objetivos, rendas, investimentos e o Diagnóstico FP: o raio-x da sua vida financeira em um lugar só.",
  },
  // Relatórios ainda não existe. A copy lidera pelo FP, que está pronto hoje, e cita
  // Relatórios como o que vem — vender como entregue geraria pedido de reembolso.
  relatorios: {
    titulo: "Planejamento Financeiro completo",
    descricao: "Perfil, objetivos, rendas, investimentos e o Diagnóstico FP, disponíveis agora. Os Relatórios entram em breve, no mesmo plano.",
  },
};

export function conteudoUpgrade(plano, recurso) {
  const atual = normalizePlano(plano);
  const alvo = planoNecessario(recurso);
  const base = COPY[recurso] || COPY.fp;
  const rotulo = ROTULO[alvo];

  return {
    titulo: base.titulo,
    descricao: base.descricao,
    // Quem já paga e está subindo de plano merece um texto diferente de quem nunca pagou.
    nota: NIVEL[atual] > 0
      ? `Você está no plano ${ROTULO[atual]}. Isso faz parte do ${rotulo}.`
      : `Disponível no plano ${rotulo}.`,
    cta: NIVEL[atual] > 0 ? "Fazer upgrade" : `Conhecer o ${rotulo}`,
    href: CHECKOUT[alvo],
  };
}
