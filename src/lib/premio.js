// Prêmio por disciplina — a recompensa de quem fecha o mês com nota alta.
//
// Regra (decisão do PRADELLA, 2026-09-12):
//   bateu 80 de disciplina  →  20% no PRIMEIRO mês + 14 dias de trial
//   uma vez na vida do usuário
//
// Lógica pura, como o resto de lib/: o App só pergunta, não decide. Isso mantém a
// regra testável sem montar componente.

// Nota mínima. 80 é alto de propósito: prêmio que todo mundo ganha não é prêmio.
export const NOTA_MINIMA = 80;

// Piso anti-fraude. O score mede se a pessoa LANÇOU, não o que ela gastou — então
// alguém poderia lançar 20 despesas de R$ 1 e bater 80.
//
// O piso é em DIAS DISTINTOS, nunca em valor mínimo. Valor penalizaria quem ganha
// pouco, que é exatamente o público que o score foi desenhado pra não punir (ver a
// regra inegociável no topo de disciplina.js). Dias distintos medem hábito, e hábito
// é o que se quer premiar.
export const DIAS_DISTINTOS_MINIMO = 15;

export const PERCENTUAL_DESCONTO = 20;
export const DIAS_TRIAL_PREMIO = 14;

// Único ponto que decide se o prêmio aparece. Devolve sempre o mesmo formato pra a
// tela não precisar de if — `elegivel` manda, `motivo` explica o não.
export function avaliarPremio({ score = 0, diasDistintos = 0, resgatadoEm = null, plano = "none" } = {}) {
  const base = {
    elegivel: false,
    motivo: null,
    faltaNota: Math.max(0, NOTA_MINIMA - Number(score || 0)),
    faltaDias: Math.max(0, DIAS_DISTINTOS_MINIMO - Number(diasDistintos || 0)),
    percentual: PERCENTUAL_DESCONTO,
    diasTrial: DIAS_TRIAL_PREMIO,
  };

  // Já usou: é uma vez na vida, e isso vale mesmo que ele tenha voltado pro Free.
  if (resgatadoEm) return { ...base, motivo: "ja_resgatado" };

  // Quem já paga não precisa de desconto pra assinar o que já assinou. Oferecer seria
  // ensinar o cliente pagante que existia um preço menor.
  if (plano && plano !== "none") return { ...base, motivo: "ja_assinante" };

  if (Number(score || 0) < NOTA_MINIMA) return { ...base, motivo: "nota_baixa" };
  if (Number(diasDistintos || 0) < DIAS_DISTINTOS_MINIMO) return { ...base, motivo: "poucos_dias" };

  return { ...base, elegivel: true, faltaNota: 0, faltaDias: 0 };
}

// Texto curto do que falta, pra tela não montar frase na mão. Só é chamado quando
// `elegivel` é false e o motivo é recuperável — "já resgatado" e "já assinante" não
// viram cobrança, viram silêncio.
export function oQueFalta(av) {
  if (!av || av.elegivel) return null;
  if (av.motivo === "ja_resgatado" || av.motivo === "ja_assinante") return null;
  const partes = [];
  if (av.faltaNota > 0) partes.push(`${av.faltaNota} ponto${av.faltaNota > 1 ? "s" : ""} de disciplina`);
  if (av.faltaDias > 0) partes.push(`${av.faltaDias} dia${av.faltaDias > 1 ? "s" : ""} com lançamento`);
  return partes.length ? `Falta ${partes.join(" e ")}.` : null;
}
