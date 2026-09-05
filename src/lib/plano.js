// Regras de plano do SaaS — quem vê o quê, e com que texto.
//
// Lógica pura de propósito: o App só pergunta, não decide. Isso mantém a matriz de
// planos testável no Vitest sem montar componente (mesmo padrão de lancamentos.js).
//
// Fonte da verdade é a coluna `plano` de fp_perfil ('none' | 'essencial' | 'assistente').
// `acesso_pago` continua no banco, derivada por trigger, mas o front não lê mais.

export const PLANOS = ["none", "essencial", "assistente"];

export const LINK_CHECKOUT_ASSISTENTE = "https://pay.cakto.com.br/4pteia8";

// Plano ausente, nulo ou desconhecido cai em 'none': o default é sempre o mais fechado.
export const normalizePlano = (valor) => (PLANOS.includes(valor) ? valor : "none");

// WhatsApp e Diagnóstico FP são o que o Assistente vende. Essencial e none não têm.
export const temAssistente = (plano) => normalizePlano(plano) === "assistente";

// O item continua no menu, com cadeado — a Fase 2 existe justamente pra parar de
// esconder recurso sem contexto.
export const mostraCadeado = (plano) => !temAssistente(plano);

const COPY = {
  whatsapp: {
    titulo: "Lance seus gastos pelo WhatsApp",
    descricao: "Manda texto ou áudio — \"gastei 50 no mercado\" — e o Pradex registra sozinho, sem abrir o app.",
  },
  fp: {
    titulo: "Planejamento Financeiro completo",
    descricao: "Perfil, objetivos, rendas, investimentos e o Diagnóstico FP: o raio-x da sua vida financeira em um lugar só.",
  },
};

// Mesmo destino de checkout pros dois planos — o que muda é de onde a pessoa vem.
// none está conhecendo o Assistente; essencial já paga e está subindo de plano.
export function conteudoUpgrade(plano, contexto) {
  const p = normalizePlano(plano);
  const base = COPY[contexto] || COPY.fp;
  return {
    titulo: base.titulo,
    descricao: base.descricao,
    nota: p === "essencial"
      ? "Você está no plano Essencial. Isso faz parte do Assistente."
      : "Disponível no plano Assistente.",
    cta: p === "essencial" ? "Fazer upgrade" : "Conhecer o Assistente",
    href: LINK_CHECKOUT_ASSISTENTE,
  };
}
