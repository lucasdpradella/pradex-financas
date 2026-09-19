// CUTUCADA — o que o Pradex diz quando fala primeiro.
//
// Copy base: briefs/2026-09-12_modo-caos-copy.md
// Direção do Lucas (19/09): "esses modos não é o cliente que vai falar, é o Pradex
// que vai instigar".
//
// ============================================================================
// POR QUE TEXTO FIXO E NÃO O CLAUDE
// ============================================================================
// O agente reativo chama o modelo porque precisa ENTENDER uma frase livre. Aqui não
// há frase pra entender: o gatilho já foi decidido por uma query, e o que falta é
// dizer uma coisa só. Chamar o modelo custaria ~US$0,03 por pessoa por dia pra
// reescrever a mesma frase, e traria o risco que menos se quer numa mensagem NÃO
// SOLICITADA — um dia ele escorrega num dos cinco limites e a pessoa recebe isso
// sem ter perguntado nada.
//
// Texto fixo é barato, previsível e testável. A variação vem de combinar gatilho ×
// tom × dificuldade declarada, que já dá 30+ mensagens diferentes.

export type Tom = "seco" | "caos" | "elogio";
export type Gatilho = "teto_estourado" | "teto_90" | "meta_parada" | "meta_risco" | "meta_concluida";

export interface Alvo {
  gatilho: Gatilho;
  referencia: string;              // nome da categoria ou da meta
  dificuldade?: string;            // só em gatilho de meta
  pct?: number;                    // % do teto, ou % da meta
  dias?: number;                   // dias parada
  falta?: number;                  // R$ que falta pra meta
  prazo?: string | null;
}

const brl = (v?: number) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * A frase. Recebe o alvo e o tom, devolve o texto pronto pro WhatsApp.
 *
 * A DIFICULDADE SÓ MUDA O TEXTO EM META, e muda porque foi o próprio cliente que a
 * declarou — é o que dá ao Pradex o direito de cobrar em cima dela. Cobrar esforço
 * que o app inferiu sozinho seria chute; cobrar o que a pessoa escreveu é lembrá-la
 * do que ela mesma disse.
 */
export function montarCutucada(alvo: Alvo, tom: Tom): string {
  const r = alvo.referencia;
  const dificil = alvo.dificuldade === "dificil";
  const facil = alvo.dificuldade === "facil";

  switch (alvo.gatilho) {
    case "teto_estourado":
      return {
        seco: `*${r}* passou do teto do mês. Está em ${alvo.pct}%.`,
        caos: `Teto de *${r}* foi. Não foi inflação. Foi você.`,
        elogio: `*${r}* passou do teto, mas o mês foi intenso. Você sabe o que está fazendo.`,
      }[tom];

    case "teto_90":
      return {
        seco: `*${r}* está em ${alvo.pct}% do teto do mês.`,
        caos: `${alvo.pct}% de *${r}* e o mês não acabou. O teto não é sugestão.`,
        elogio: `${alvo.pct}% em *${r}* e ainda dentro. Controle é isso.`,
      }[tom];

    case "meta_parada":
      // Os dois exemplos que o Lucas escreveu à mão, quase literais. Eles funcionam
      // porque devolvem à pessoa a palavra que ela mesma escolheu no cadastro.
      if (tom === "caos") {
        if (facil) return `Aquela meta *${r}* que você mesmo disse que era fácil está parada há ${alvo.dias} dias. Fácil pra quem?`;
        if (dificil) return `Você marcou *${r}* como difícil e depois sentou. Difícil era o plano, não a desculpa.`;
        return `*${r}* está parada há ${alvo.dias} dias. A meta não se enche sozinha.`;
      }
      if (tom === "elogio") return `*${r}* está esperando você há ${alvo.dias} dias. Quando voltar, volta forte — você sempre volta.`;
      return `Sua meta *${r}* está sem depósito há ${alvo.dias} dias.`;

    case "meta_risco":
      if (tom === "caos") {
        return dificil
          ? `*${r}* vence ${fmtPrazo(alvo.prazo)} e faltam ${brl(alvo.falta)}. Você disse que ia doer. Doer sem chegar é o pior dos dois.`
          : `*${r}* vence ${fmtPrazo(alvo.prazo)} e faltam ${brl(alvo.falta)}. Nesse ritmo não chega. Não é o universo, é a transferência que você não fez.`;
      }
      if (tom === "elogio") return `*${r}* está apertada — faltam ${brl(alvo.falta)} até ${fmtPrazo(alvo.prazo)}. Mas você sempre dá um jeito.`;
      return `Meta *${r}*: faltam ${brl(alvo.falta)} e o prazo é ${fmtPrazo(alvo.prazo)}. No ritmo atual não chega.`;

    case "meta_concluida":
      // A única hora de celebrar de verdade (regra do brief). No caos, o elogio vem
      // embrulhado em provocação — mas vem.
      if (tom === "caos") {
        return dificil
          ? `Meta *${r}* feita. Essa era a difícil, e você chegou. Sem show — o show é não desfazer amanhã.`
          : `Meta *${r}* feita. Até que enfim uma decisão adulta. Guardei.`;
      }
      if (tom === "elogio") return `Meta *${r}* cumprida. Eu já sabia. Você é assim.`;
      return `Meta *${r}* cumprida.`;
  }
}

function fmtPrazo(prazo?: string | null): string {
  if (!prazo) return "em breve";
  const [a, m, d] = String(prazo).split("-");
  return d && m ? `${d}/${m}` : String(prazo);
}

/**
 * Qual gatilho vale a pena quando mais de um está valendo.
 *
 * UMA CUTUCADA POR VEZ, e a escolha importa: mandar as três coisas juntas é a
 * diferença entre um aviso e um sermão. Dinheiro escapando agora (teto estourado)
 * ganha de dinheiro que não entrou (meta parada), porque o primeiro ainda dá pra
 * interromper hoje.
 *
 * `meta_concluida` vem primeiro de todas: é a única boa notícia da lista, e engolir
 * uma conquista pra avisar de um teto seria o produto só sabendo reclamar.
 */
export const PRIORIDADE: Gatilho[] = [
  "meta_concluida",
  "teto_estourado",
  "meta_risco",
  "teto_90",
  "meta_parada",
];

export function escolherAlvo(alvos: Alvo[]): Alvo | null {
  for (const g of PRIORIDADE) {
    const achou = alvos.find((a) => a.gatilho === g);
    if (achou) return achou;
  }
  return null;
}
