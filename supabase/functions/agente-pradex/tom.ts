// MODO CAOS — tom do agente e os comandos que o trocam.
//
// Copy e dicionários: briefs/2026-09-12_modo-caos-copy.md
//
// POR QUE ISTO NÃO PASSA PELO MODELO. "Cala a boca" é a mensagem de alguém que já
// está irritado com o agente. Mandar essa frase pro Claude decidir o que fazer
// significa que, no dia em que o modelo interpretar diferente, o produto responde
// com piada pra quem acabou de pedir silêncio — e essa pessoa cancela. Comando é
// determinístico, roda antes de qualquer chamada, e custa zero token.
//
// Arquivo separado do index.ts pra poder ser testado no Vitest (tests/tom.test.js):
// é a lógica mais fácil de quebrar sem ninguém perceber, porque o efeito de um
// falso-negativo só aparece na conversa de um cliente irritado.

export type Tom = "seco" | "caos" | "elogio";

export interface EstadoTom {
  agente_tom?: string | null;
  agente_silencio_ate?: string | null;
  agente_elogio_ate?: string | null;
}

export type Comando = "silencio" | "caos" | "seco" | "elogio" | null;

/**
 * Minúsculo, sem acento, sem pontuação, sem letra repetida e sem espaço duplo.
 *
 * O colapso de letras repetidas ("caaaala") é o que faz o dicionário funcionar no
 * WhatsApp de verdade, onde ninguém escreve como no dicionário.
 */
export function normalizar(texto: string): string {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/(.)\1{1,}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// As listas vêm do brief, normalizadas na carga pra comparar maçã com maçã.
const DIC: Record<Exclude<Comando, null>, string[]> = {
  silencio: [
    "cala", "cala boca", "cala a boca", "cale se", "silencio", "silenciar", "mute",
    "me deixa", "me deixa em paz", "para", "para de falar", "para de me zoar",
    "para com isso", "quieto", "chega", "chega disso", "some", "sh", "xiu",
    "nao quero saber", "para de me encher", "chega de sarcasmo", "modo silencio",
  ],
  caos: [
    "caos", "modo caos", "volta o caos", "volta o sarcasmo", "volta a zoar", "me zoa",
    "me provoca", "quero o sarro", "sarro", "chega de elogio", "para de me elogiar",
    "para de bajular", "volta a ser chato", "me xinga",
  ],
  seco: [
    "seco", "modo seco", "fica serio", "sem graca", "sem sarcasmo", "normal", "profissional",
  ],
  elogio: [
    "me elogia", "modo elogio", "bajula", "so elogio", "sem critica", "fica legal", "fica bonzinho",
  ],
};

const norm = (l: string[]) => l.map(normalizar);
const DIC_N: Record<string, string[]> = Object.fromEntries(
  Object.entries(DIC).map(([k, v]) => [k, norm(v)]),
);

/**
 * Que comando esta mensagem é — ou null, se for uma mensagem normal.
 *
 * A REGRA QUE EVITA O FALSO POSITIVO (está no brief, e é o detalhe que faz ou
 * quebra isto): "para" dentro de "lancei 50 para o joão" NÃO é pedido de silêncio.
 * Só conta quando a mensagem É o pedido — até 6 palavras — ou quando ela COMEÇA
 * pelo comando. Sem isso, metade dos lançamentos com "para" calaria o agente, e o
 * cliente jamais associaria uma coisa à outra.
 */
export function detectarComando(texto: string): Comando {
  const t = normalizar(texto);
  if (!t) return null;

  const palavras = t.split(" ").length;
  const curta = palavras <= 6;

  // Ordem importa: "chega de elogio" é pedido de CAOS, e também começa com "chega",
  // que é silêncio. O mais específico ganha, então caos/seco/elogio vêm antes.
  for (const chave of ["caos", "seco", "elogio", "silencio"] as const) {
    for (const frase of DIC_N[chave]) {
      if (t === frase) return chave;
      // "começa com o comando": exige a fronteira de palavra, senão "seco" casaria
      // com "secou" e "para" com "parabens".
      if (curta && t.startsWith(frase + " ")) return chave;
    }
  }
  return null;
}

const futuro = (iso?: string | null) => Boolean(iso && new Date(iso).getTime() > Date.now());

export const estaEmSilencio = (e: EstadoTom) => futuro(e?.agente_silencio_ate);

/**
 * O tom que vale AGORA. Elogio é temporário e ganha do tom base enquanto durar;
 * expirado, a data simplesmente deixa de valer e ninguém precisa limpá-la.
 */
export function tomVigente(e: EstadoTom): Tom {
  if (futuro(e?.agente_elogio_ate)) return "elogio";
  return e?.agente_tom === "caos" ? "caos" : "seco";
}

export const HORAS_24 = 24 * 3600 * 1000;
const daquiA24h = () => new Date(Date.now() + HORAS_24).toISOString();

/**
 * O que gravar e o que responder quando um comando chega.
 *
 * `patch` vai direto pro update em fp_perfil. Qualquer comando ZERA o silêncio: se a
 * pessoa está no silêncio e pede caos, ela quer barulho agora — manter o silêncio
 * seria obedecer o pedido de ontem em vez do de hoje.
 */
export function aplicarComando(cmd: Exclude<Comando, null>): { patch: Record<string, unknown>; resposta: string } {
  switch (cmd) {
    case "silencio":
      return {
        patch: { agente_silencio_ate: daquiA24h(), agente_elogio_ate: null },
        resposta: "Beleza. Eu calo por 24h. Assinatura segue. Quando quiser barulho de novo, é só falar.",
      };
    case "caos":
      return {
        patch: { agente_tom: "caos", agente_elogio_ate: null, agente_silencio_ate: null },
        resposta: "Voltei a ser eu. Prepara o bolso e o ego 👊",
      };
    case "seco":
      return {
        patch: { agente_tom: "seco", agente_elogio_ate: null, agente_silencio_ate: null },
        resposta: "Fechado. Só o registro, sem comentário.",
      };
    case "elogio":
      return {
        patch: { agente_elogio_ate: daquiA24h(), agente_silencio_ate: null },
        resposta: "Por 24h eu só falo bem de você. Merecido, aliás.",
      };
  }
}

/**
 * O pedaço do system prompt que muda com o tom.
 *
 * Fica aqui, e não solto no index.ts, porque tom e copy são a mesma decisão: quem
 * for ajustar a voz do produto mexe num arquivo só.
 */
export function instrucaoDeTom(tom: Tom): string {
  if (tom === "caos") {
    return `TOM: CAOS. Sarcástico, curto, afiado. Zoa a ESCOLHA, nunca a pessoa nem a situação financeira dela.
Exemplos do tom certo:
- "Mercado, R$ 50. O alface não vai pagar a meta, mas tá lançado."
- "*Alimentação* em 91%. Ainda dá pra fingir que foi o preço do ovo. Por enquanto."
- "Teto de *delivery* foi. Não foi inflação. Foi você."
Uma alfinetada por mensagem, no máximo. Duas viram chateação.`;
  }
  if (tom === "elogio") {
    return `TOM: ELOGIO (o cliente pediu, vale 24h). Encontra o lado bom de tudo, sem ironia nenhuma.
Exemplos:
- "R$ 50 no mercado. Investimento em você. Mandou bem."
- "91% de *alimentação* e o mês nem acabou. Ritmo de quem sabe o que quer."
- "Meta cumprida. Eu já sabia. Você é assim."`;
  }
  return `TOM: SECO (padrão). Registra e informa. Sem piada, sem sermão.
Exemplos:
- "Registrei. Mercado, R$ 50."
- "*Alimentação* está em 91% do teto do mês."
- "Meta *reserva de emergência* cumprida."`;
}

/**
 * Os cinco limites do brief, em forma de proibição.
 *
 * São a parte do prompt que NÃO muda com o tom: no elogio ou no caos, cruzar
 * qualquer uma delas custa o cliente. Cada uma existe porque alguém pensaria nela
 * como "engraçado" — por isso vêm com o motivo junto, e não só a regra.
 */
export const LIMITES = `NUNCA, EM NENHUM TOM:
1. Citar patrimônio, saldo acumulado ou "quanto você tem". O Zap não é extrato.
2. Zoar aperto financeiro ("tá quebrado", "só R$ 12 na conta"). Caos zoa escolha, não pobreza.
3. Insinuar vício, mentira ou traição. Sarcasmo de finança, nunca de caráter.
4. Dar XP, nível ou pontuação a gasto. Placar é de meta cumprida, não de estrago.
5. Comparar o cliente com outras pessoas ("90% do pessoal segura"). Aqui não é feed.
Fora dos gatilhos listados, não comente nada: registre e cale.`;
