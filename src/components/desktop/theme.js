// Tokens da direção visual "Indigo executiva" (mockup aprovado 2026-07-03).
// Aplicam-se SÓ ao shell desktop (>=1024px). Nenhum estilo mobile usa isto.
// Centralizado aqui pra não espalhar hex pelo código.

export const DESKTOP_MIN = 1024; // breakpoint único
export const SIDEBAR_WIDTH = 240; // px

export const desktopTheme = {
  // Sidebar
  sidebarBg: "#4F46E5",
  sidebarText: "#C7D2FE",
  sidebarLogo: "#FFFFFF",
  sidebarActiveBg: "#4338CA",
  sidebarActiveText: "#FFFFFF",
  // Área principal
  mainBg: "#F1F3F9",
  surface: "#FFFFFF",
  surfaceBorder: "#E4E7F0",
  // Texto
  textPrimary: "#111827",
  textSecondary: "#6B7280",
  // Acento
  accent: "#4F46E5",
  accentHover: "#4338CA",
  // Chips de categoria
  chipBg: "#EEF2FF",
  chipText: "#4338CA",
  // Valores
  receita: "#059669",
  gasto: "#DC2626",
  evitavel: "#B45309",
};
