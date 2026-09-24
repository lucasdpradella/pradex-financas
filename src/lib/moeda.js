import { createContext, useContext } from "react";

export const MOEDAS = ["BRL", "USD", "DKK"];
export const IDIOMAS = ["pt-BR", "en"];

const SPEC = {
  BRL: { locale: "pt-BR", currency: "BRL" },
  USD: { locale: "en-US", currency: "USD" },
  DKK: { locale: "da-DK", currency: "DKK" },
};

export function normalizarMoeda(value) {
  return value === "USD" || value === "DKK" ? value : "BRL";
}

export function normalizarIdioma(value) {
  return value === "en" ? "en" : "pt-BR";
}

export function simboloMoeda(moeda) {
  const m = normalizarMoeda(moeda);
  if (m === "USD") return "$";
  if (m === "DKK") return "kr";
  return "R$";
}

/** Valor na moeda do livro. Não converte — só formata. */
export function formatMoney(value, moeda = "BRL") {
  const spec = SPEC[normalizarMoeda(moeda)];
  const n = Number(value);
  const seguro = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat(spec.locale, {
    style: "currency",
    currency: spec.currency,
  }).format(seguro);
}

export function iniciaisDe(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "";
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export const LivroContext = createContext({ moeda: "BRL", idioma: "pt-BR" });

export function useLivro() {
  return useContext(LivroContext);
}

export function useFormatMoney() {
  const { moeda } = useLivro();
  return (value) => formatMoney(value, moeda || "BRL");
}

export function useSimboloMoeda() {
  const { moeda } = useLivro();
  return simboloMoeda(moeda);
}
