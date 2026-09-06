// Score de disciplina v0 — Relatórios v1.
//
// REGRA INEGOCIÁVEL: pontua COMPORTAMENTO, nunca dinheiro. Saldo, patrimônio, renda
// e valor investido não entram em nenhum componente. Quem ganha R$ 3 mil e lança
// todo dia tira mais que quem ganha R$ 30 mil e lança uma vez no mês — é isso mesmo.
//
// O único componente que olha valor é o do evitável, e mesmo assim compara a pessoa
// com ela mesma no mês anterior, nunca com um patamar de renda.

import { formatarBRL } from "./fechamento";

// Pesos ajustáveis. Somam 100 quando tudo é aplicável; o score é normalizado sobre
// os aplicáveis, então mudar um número aqui não quebra a escala.
export const PONTOS = {
  constancia: 40,
  mesPreenchido: 30,
  evitavel: 30,
  teto: 25,
};

// "Mês preenchido" em mês fechado. No mês corrente vira proporcional aos dias já
// decorridos (ver limiarPreenchido).
export const DIAS_MES_PREENCHIDO = 20;

export const limiarPreenchido = ({ diasNoMes, diasConsiderados, mesCorrente }) => {
  if (!mesCorrente) return DIAS_MES_PREENCHIDO;
  const proporcional = Math.ceil((DIAS_MES_PREENCHIDO * diasConsiderados) / (diasNoMes || 1));
  return Math.max(1, Math.min(DIAS_MES_PREENCHIDO, proporcional));
};

/**
 * Score 0–100 a partir de um fechamento (ver fechamento.js).
 *
 * `tetos` é a lista de tetos de categoria cadastrados. Hoje o produto NÃO tem
 * orçamento, então a lista chega vazia e esse componente fica inaplicável: sai do
 * numerador E do denominador. Se ficasse só no denominador, ninguém passaria de
 * ~75/100 por causa de uma feature que não existe. Quando tetos existirem, o
 * componente entra sozinho sem rebaixar quem já pontuava.
 */
export function calcularDisciplina(fechamento, { tetos = [] } = {}) {
  const f = fechamento || {};

  // Mês sem lançamento nenhum é zero, não "sem dados". Sem esta guarda o componente
  // do evitável premiaria um mês vazio (zero evitável é ótimo... se houve mês).
  if (!f.temLancamentos) {
    return {
      score: 0,
      vazio: true,
      componentes: [],
      badges: [],
      resumo: "Nenhum lançamento neste mês.",
    };
  }

  const componentes = [];

  // 1. Constância — proporção de dias com lançamento sobre os dias que já contam.
  const diasBase = f.diasConsiderados || f.diasNoMes || 1;
  const proporcao = Math.min(1, (f.diasComLancamento || 0) / diasBase);
  componentes.push({
    chave: "constancia",
    label: "Constância",
    aplicavel: true,
    max: PONTOS.constancia,
    pontos: Math.round(PONTOS.constancia * proporcao),
    detalhe: `${f.diasComLancamento} de ${diasBase} dias com lançamento`,
  });

  // 2. Mês preenchido — binário.
  const limiar = limiarPreenchido(f);
  const preenchido = (f.diasComLancamento || 0) >= limiar;
  componentes.push({
    chave: "mesPreenchido",
    label: "Mês preenchido",
    aplicavel: true,
    max: PONTOS.mesPreenchido,
    pontos: preenchido ? PONTOS.mesPreenchido : 0,
    detalhe: preenchido ? `${f.diasComLancamento} dias registrados` : `faltam ${limiar - f.diasComLancamento} dias pra meta de ${limiar}`,
  });

  // 3. Evitável em queda — precisa de mês anterior com dado pra comparar.
  // Zerar o evitável pontua mesmo sem queda: não dá pra cair abaixo de zero, e o
  // melhor comportamento possível não pode valer menos que uma queda qualquer.
  if (f.temMesAnterior) {
    const caiu = f.evitavel < f.evitavelAnterior || f.evitavel === 0;
    componentes.push({
      chave: "evitavel",
      label: "Gasto evitável",
      aplicavel: true,
      max: PONTOS.evitavel,
      pontos: caiu ? PONTOS.evitavel : 0,
      detalhe: caiu
        ? `${formatarBRL(f.evitavel)} contra ${formatarBRL(f.evitavelAnterior)} em ${f.labelAnterior}`
        : `subiu pra ${formatarBRL(f.evitavel)} (era ${formatarBRL(f.evitavelAnterior)})`,
    });
  } else {
    componentes.push({
      chave: "evitavel",
      label: "Gasto evitável",
      aplicavel: false,
      max: PONTOS.evitavel,
      pontos: 0,
      detalhe: "sem mês anterior pra comparar",
    });
  }

  // 4. Teto de categoria — inaplicável enquanto orçamento não existir no produto.
  const comTeto = (tetos || []).filter((t) => t && t.categoria && Number(t.limite) > 0);
  if (comTeto.length > 0) {
    const porCat = new Map((f.categorias || []).map((c) => [c.cat, c.total]));
    const dentro = comTeto.filter((t) => (porCat.get(t.categoria) || 0) <= Number(t.limite));
    componentes.push({
      chave: "teto",
      label: "Dentro do teto",
      aplicavel: true,
      max: PONTOS.teto,
      pontos: Math.round(PONTOS.teto * (dentro.length / comTeto.length)),
      detalhe: `${dentro.length} de ${comTeto.length} categorias dentro do teto`,
    });
  } else {
    componentes.push({
      chave: "teto",
      label: "Dentro do teto",
      aplicavel: false,
      max: PONTOS.teto,
      pontos: 0,
      detalhe: "nenhum teto cadastrado",
    });
  }

  const aplicaveis = componentes.filter((c) => c.aplicavel);
  const somaMax = aplicaveis.reduce((s, c) => s + c.max, 0);
  const somaPontos = aplicaveis.reduce((s, c) => s + c.pontos, 0);
  const score = somaMax > 0 ? Math.round((somaPontos / somaMax) * 100) : 0;

  return {
    score,
    vazio: false,
    componentes,
    badges: montarBadges(f, { preenchido, score }),
    resumo: resumoDoScore(score),
  };
}

function montarBadges(f, { preenchido, score }) {
  const badges = [];
  if (f.streak >= 3) badges.push(`${f.streak} dias seguidos lançando`);
  if (preenchido) badges.push("Mês preenchido");
  if (f.temMesAnterior && f.evitavel === 0 && f.evitavelAnterior > 0) badges.push("Zerou o evitável");
  else if (f.temMesAnterior && f.evitavel < f.evitavelAnterior) badges.push("Evitável em queda");
  if (score === 100) badges.push("Mês impecável");
  return badges;
}

const resumoDoScore = (score) => {
  if (score >= 85) return "Disciplina alta: o hábito está firme.";
  if (score >= 60) return "Bom ritmo. Faltam alguns dias pra fechar o mês inteiro.";
  if (score >= 30) return "Começou, mas o registro ainda está furado.";
  return "Poucos dias registrados neste mês.";
};
