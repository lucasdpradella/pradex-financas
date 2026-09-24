// Moeda e idioma do livro, isolados do index.ts pra o Vitest cobrir o prompt
// sem subir a edge function. O agente fala na moeda do livro e não converte.

export type MoedaLivro = "BRL" | "USD" | "DKK";
export type IdiomaLivro = "pt-BR" | "en";

export function normalizarMoeda(value: unknown): MoedaLivro {
  return value === "USD" || value === "DKK" ? value : "BRL";
}

export function normalizarIdioma(value: unknown): IdiomaLivro {
  return value === "en" ? "en" : "pt-BR";
}

export function formatarValorAgente(valor: unknown, moeda: MoedaLivro): string {
  const n = Number(valor);
  const seguro = Number.isFinite(n) ? n : 0;
  const locale = moeda === "USD" ? "en-US" : moeda === "DKK" ? "da-DK" : "pt-BR";
  return new Intl.NumberFormat(locale, { style: "currency", currency: moeda }).format(seguro);
}

/**
 * Bloco final do system prompt. Vem por último de propósito: as regras de tom
 * ainda citam R$ como exemplo de voz, e este bloco manda a resposta real.
 */
export function blocoMoedaIdioma(moeda: MoedaLivro, idioma: IdiomaLivro): string {
  const exemplo = formatarValorAgente(40, moeda);
  if (idioma === "en") {
    return `BOOK CURRENCY AND LANGUAGE — this block overrides every other language or currency instruction, including the tone examples above:
- Reply to the client ONLY in English. mensagem_resposta is English.
- Every amount is already in ${moeda}. Write numbers like ${exemplo}. Do NOT convert to another currency. Do not mention reais, BRL, or R$ unless ${moeda} is BRL.
- Confirmation shape: "✅ Logged ${exemplo} in [Category]"`;
  }
  return `MOEDA E IDIOMA DO LIVRO — este bloco vence qualquer outra instrução de língua ou símbolo:
- Responda SEMPRE em português brasileiro.
- Todo valor já está em ${moeda}. Escreva os números como ${exemplo}. Não converta para outra moeda.
- Confirmação: "✅ Lancei ${exemplo} em [Categoria] 👊"`;
}

export function frase(idioma: IdiomaLivro, pt: string, en: string): string {
  return idioma === "en" ? en : pt;
}
