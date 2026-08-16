import { desktopTheme as t } from "./theme";

const CSS = `
.pdx-top { position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 1rem; padding: 0.9rem 2rem; background: ${t.surface}; border-bottom: 1px solid ${t.surfaceBorder}; font-family: 'DM Sans', 'Helvetica Neue', sans-serif; }
.pdx-top__title { margin: 0; font-size: 1.15rem; font-weight: 700; color: ${t.textPrimary}; letter-spacing: -0.01em; }
.pdx-top__spacer { flex: 1; }
.pdx-top__period { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.45rem 0.8rem; border: 1px solid ${t.surfaceBorder}; border-radius: 9px; background: ${t.mainBg}; color: ${t.textSecondary}; font-size: 0.85rem; font-weight: 500; }
.pdx-top__period b { min-width: 68px; text-align: center; color: ${t.textPrimary}; font-weight: 600; }
.pdx-top__nav { background: none; border: none; padding: 0 0.2rem; margin: 0; color: ${t.textSecondary}; font-family: inherit; font-size: 1rem; line-height: 1; cursor: pointer; border-radius: 5px; }
.pdx-top__nav:hover { color: ${t.accent}; background: ${t.chipBg}; }
.pdx-top__novo { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.55rem 1rem; border: none; border-radius: 9px; background: ${t.accent}; color: #fff; font-size: 0.88rem; font-weight: 600; font-family: inherit; cursor: pointer; transition: background 0.15s; }
.pdx-top__novo:hover { background: ${t.accentHover}; }
`;

// Top-bar do shell desktop: título da seção + seletor de período + "Novo lançamento".
// O período vira navegável (‹ mês ›) quando a seção passa onPeriodoStep — hoje só o
// Dashboard (Fase 2). Sem o callback, segue como o indicador estático da Fase 0.
export default function TopBar({ title, periodoLabel, onNovoLancamento, onPeriodoStep }) {
  return (
    <header className="pdx-top">
      <style>{CSS}</style>
      <h1 className="pdx-top__title">{title}</h1>
      <div className="pdx-top__spacer" />
      <span className="pdx-top__period">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        {onPeriodoStep ? (
          <>
            <button className="pdx-top__nav" onClick={() => onPeriodoStep(-1)} aria-label="Mês anterior">‹</button>
            <b>{periodoLabel}</b>
            <button className="pdx-top__nav" onClick={() => onPeriodoStep(1)} aria-label="Próximo mês">›</button>
          </>
        ) : periodoLabel}
      </span>
      <button className="pdx-top__novo" onClick={onNovoLancamento}>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        Novo lançamento
      </button>
    </header>
  );
}
