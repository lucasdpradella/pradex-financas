// Tokens da identidade visual do app escuro (mobile + Planejamento Financeiro).
// Direção aprovada em 2026-09-11 — ver Chave Mestre, Projetos/PRADEX/direcao-visual.md.
//
// Antes daqui o app tinha 127 hex distintos espalhados (424 literais só no App.jsx),
// 18 cinzas puros quase idênticos e DOIS indigos de marca brigando (#6366f1 no mobile,
// #4F46E5 no shell desktop). Este arquivo passa a ser a fonte única da cor no app escuro.
//
// O shell desktop (>=1024px) continua em components/desktop/theme.js — é um tema CLARO,
// e migrá-lo é decisão à parte. Não misturar os dois.

export const theme = {
  // Superfícies, do fundo pra cima
  bg: "#0C0E14",
  surface: "#151821",
  surfaceRaised: "#1E2330",
  border: "#2C3344",

  // Texto, do mais forte pro mais fraco
  text: "#F1F2F4",
  textMuted: "#8B93A1",
  textFaint: "#5C6570",

  // Marca. O indigo morreu em 2026-09-11: no Brasil roxo é Nubank, no código era o
  // default do Tailwind, e ainda havia dois hex concorrentes.
  accent: "#C6A46B",
  // Bronze é CLARO (luminância ~0.41). Texto branco em cima dele dá ~2.3:1 e reprova em
  // qualquer critério. Quando o acento for fundo, o texto usa isto — dá ~8:1.
  onAccent: "#0C0E14",

  // Semânticas. Valem pra variação, nunca pro número-herói do saldo:
  // pintar o saldo ensina o usuário a ter medo do próprio número.
  positive: "#2FBF8A",
  negative: "#E06C65",
  warning: "#E8943A",
};

// Fundo tingido do acento, pra chip e card sutil. O sufixo é alpha em hex (00–FF).
export const accentTint = (alpha = "18") => theme.accent + alpha;

// Escala tipográfica. Tamanhos em px; o número de dinheiro é sempre tabular.
export const type = {
  overline: { fontSize: 11, fontWeight: 500, letterSpacing: "0.12em", textTransform: "uppercase" },
  meta: { fontSize: 12, fontWeight: 400 },
  label: { fontSize: 13, fontWeight: 500 },
  body: { fontSize: 14, fontWeight: 400 },
  heroUnit: { fontSize: 15, fontWeight: 500 }, // o "R$" e os centavos do herói
  section: { fontSize: 16, fontWeight: 600, letterSpacing: "-0.01em" },
  screen: { fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" },
  hero: { fontSize: 34, fontWeight: 600, letterSpacing: "-0.03em" },
};

// Dinheiro nunca "dança" quando o valor muda de dígito.
export const tabular = { fontVariantNumeric: "tabular-nums" };
