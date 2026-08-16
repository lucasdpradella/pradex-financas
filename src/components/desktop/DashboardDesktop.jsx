import { useMemo } from "react";
import { desktopTheme as t } from "./theme";

// Dashboard analytics (Fase 2, desktop-only). Recebe os lançamentos que o App.jsx
// já carregou — nenhuma query nova, tudo é agregação client-side.
// O mês vem por prop (seletor da top-bar): cards, categorias, comparação e evitável
// são do mês selecionado; a tendência são os 6 meses até ele.

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const BAR_COLORS = ["#4F46E5", "#0891B2", "#7C3AED", "#DB2777", "#EA580C", "#059669", "#CA8A04", "#475569"];

const CSS = `
.pdx-dash { display: flex; flex-direction: column; gap: 1rem; font-family: 'DM Sans', 'Helvetica Neue', sans-serif; }
.pdx-dash-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1rem; }
.pdx-card { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1.1rem 1.25rem; }
.pdx-card__label { margin: 0 0 0.45rem; font-size: 0.72rem; font-weight: 600; color: ${t.textSecondary}; text-transform: uppercase; letter-spacing: 0.07em; }
.pdx-card__value { margin: 0; font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pdx-card__hint { margin: 0.35rem 0 0; font-size: 0.75rem; color: ${t.textSecondary}; }
.pdx-strip { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem 1.5rem; background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 0.9rem 1.25rem; }
.pdx-strip__item { display: flex; align-items: baseline; gap: 0.5rem; font-size: 0.85rem; color: ${t.textSecondary}; }
.pdx-strip__item b { font-size: 1rem; color: ${t.textPrimary}; font-variant-numeric: tabular-nums; }
.pdx-delta { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.pdx-delta--up { background: #FEF2F2; color: ${t.gasto}; }
.pdx-delta--down { background: #ECFDF5; color: ${t.receita}; }
.pdx-delta--flat { background: ${t.mainBg}; color: ${t.textSecondary}; }
.pdx-strip__evit { margin-left: auto; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.3rem 0.75rem; border-radius: 999px; background: #FFFBEB; color: ${t.evitavel}; font-size: 0.82rem; font-weight: 600; }
.pdx-dash-panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(370px, 1fr)); gap: 1rem; align-items: start; }
.pdx-panel { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1.25rem 1.35rem; min-width: 0; }
.pdx-panel__head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-bottom: 1.1rem; }
.pdx-panel__title { margin: 0; font-size: 0.75rem; font-weight: 600; color: ${t.textSecondary}; text-transform: uppercase; letter-spacing: 0.07em; }
.pdx-panel__sub { margin: 0; font-size: 0.75rem; color: ${t.textSecondary}; }
.pdx-panel__empty { margin: 0; font-size: 0.88rem; color: ${t.textSecondary}; padding: 1.5rem 0; text-align: center; }
.pdx-cat { margin-bottom: 0.95rem; }
.pdx-cat:last-child { margin-bottom: 0; }
.pdx-cat__row { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.35rem; }
.pdx-cat__nome { font-size: 0.86rem; color: ${t.textPrimary}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdx-cat__val { font-size: 0.86rem; font-weight: 600; color: ${t.textPrimary}; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pdx-cat__val span { margin-left: 0.4rem; font-weight: 500; color: ${t.textSecondary}; }
.pdx-cat__track { background: ${t.mainBg}; border-radius: 999px; height: 8px; overflow: hidden; }
.pdx-cat__fill { height: 100%; border-radius: 999px; }
.pdx-rasc { display: flex; align-items: center; gap: 0.9rem; padding: 0.7rem 0; border-bottom: 1px solid ${t.surfaceBorder}; }
.pdx-rasc:last-child { border-bottom: none; padding-bottom: 0; }
.pdx-rasc__info { flex: 1; min-width: 0; }
.pdx-rasc__desc { margin: 0 0 0.15rem; font-size: 0.9rem; color: ${t.textPrimary}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdx-rasc__meta { margin: 0; font-size: 0.75rem; color: ${t.textSecondary}; }
.pdx-rasc__val { font-size: 0.92rem; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pdx-rasc__acoes { display: flex; gap: 0.5rem; }
.pdx-btn2 { padding: 0.4rem 0.85rem; border-radius: 8px; font-family: inherit; font-size: 0.82rem; font-weight: 600; cursor: pointer; border: 1px solid ${t.surfaceBorder}; background: ${t.surface}; color: ${t.textSecondary}; white-space: nowrap; }
.pdx-btn2:hover { background: ${t.mainBg}; color: ${t.textPrimary}; }
.pdx-btn2--ok { background: ${t.accent}; border-color: ${t.accent}; color: #fff; }
.pdx-btn2--ok:hover { background: ${t.accentHover}; color: #fff; }
.pdx-legend { display: flex; gap: 1rem; font-size: 0.78rem; color: ${t.textSecondary}; }
.pdx-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 0.35rem; }
.pdx-chart { width: 100%; height: auto; display: block; overflow: visible; }
.pdx-chart text { font-family: inherit; font-size: 13px; fill: ${t.textSecondary}; }
`;

const prefixoDe = (ano, mes) => `${ano}-${String(mes + 1).padStart(2, "0")}`;
const passoMes = (ano, mes, delta) => {
  const total = ano * 12 + mes + delta;
  return { ano: Math.floor(total / 12), mes: ((total % 12) + 12) % 12 };
};
const soma = (arr) => arr.reduce((s, l) => s + Number(l.valor || 0), 0);

export default function DashboardDesktop({
  lancamentos, ano, mes, formatBRL,
  rascunhos = [], onConfirmarRascunho, onRejeitarRascunho, normalizeText = (x) => x,
}) {
  const dados = useMemo(() => {
    const doMes = (a, m) => {
      const p = prefixoDe(a, m);
      return lancamentos.filter((l) => l.data_lancamento?.startsWith(p));
    };

    const lancMes = doMes(ano, mes);
    const gastosMes = lancMes.filter((l) => l.tipo === "gasto");
    const receitas = soma(lancMes.filter((l) => l.tipo === "receita"));
    const gastoTotal = soma(gastosMes);
    const debito = soma(gastosMes.filter((l) => l.forma_pagamento !== "Crédito"));
    const cartao = soma(gastosMes.filter((l) => l.forma_pagamento === "Crédito"));
    const evitavel = soma(gastosMes.filter((l) => l.poderia_ter_evitado));

    // Gasto por categoria do mês, desc. Deriva das categorias presentes nos próprios
    // lançamentos (não da lista de categorias) pra não perder gasto de categoria removida.
    const porCat = {};
    gastosMes.forEach((l) => {
      const cat = l.categoria || "Sem categoria";
      porCat[cat] = (porCat[cat] || 0) + Number(l.valor || 0);
    });
    const categorias = Object.entries(porCat)
      .map(([cat, total]) => ({ cat, total }))
      .sort((a, b) => b.total - a.total);
    const maxCat = Math.max(...categorias.map((c) => c.total), 1);

    // Mês anterior, só pro delta do gasto total.
    const ant = passoMes(ano, mes, -1);
    const gastoAnterior = soma(doMes(ant.ano, ant.mes).filter((l) => l.tipo === "gasto"));

    // Tendência: os 6 meses até o selecionado (inclusive).
    const tendencia = Array.from({ length: 6 }, (_, i) => {
      const { ano: a, mes: m } = passoMes(ano, mes, i - 5);
      const doPeriodo = doMes(a, m);
      return {
        key: prefixoDe(a, m),
        label: MESES[m],
        ano: a,
        receita: soma(doPeriodo.filter((l) => l.tipo === "receita")),
        gasto: soma(doPeriodo.filter((l) => l.tipo === "gasto")),
      };
    });
    const maxTend = Math.max(...tendencia.flatMap((x) => [x.receita, x.gasto]), 1);

    return {
      vazio: lancMes.length === 0,
      receitas, gastoTotal, debito, cartao, evitavel,
      saldo: receitas - gastoTotal,
      categorias, maxCat,
      gastoAnterior, mesAnterior: `${MESES[ant.mes]}/${ant.ano}`,
      tendencia, maxTend,
    };
  }, [lancamentos, ano, mes]);

  const cards = [
    { label: "Receitas", value: dados.receitas, color: t.receita },
    { label: "Débito", value: dados.debito, color: t.gasto },
    { label: "Cartão", value: dados.cartao, color: t.gasto },
    { label: "Saldo", value: dados.saldo, color: dados.saldo >= 0 ? t.receita : t.gasto },
  ];

  // Δ do gasto total vs mês anterior. Sem base de comparação, não inventa percentual.
  const deltaAbs = dados.gastoTotal - dados.gastoAnterior;
  const deltaPct = dados.gastoAnterior > 0 ? (deltaAbs / dados.gastoAnterior) * 100 : null;
  const deltaClasse = Math.abs(deltaAbs) < 0.005 ? "flat" : deltaAbs > 0 ? "up" : "down";

  // Geometria do gráfico de tendência (SVG puro, sem lib).
  const W = 600, H = 210, BASE = 160, ALTURA = 130, PASSO = W / 6, LARG = 26;

  return (
    <div className="pdx-dash">
      <style>{CSS}</style>

      {/* Rascunhos do agente WhatsApp — ação pendente, precisa existir no desktop também. */}
      {rascunhos.length > 0 && (
        <div className="pdx-panel">
          <div className="pdx-panel__head">
            <p className="pdx-panel__title">Pendentes do WhatsApp ({rascunhos.length})</p>
          </div>
          {rascunhos.map((r) => (
            <div className="pdx-rasc" key={r.id}>
              <div className="pdx-rasc__info">
                <p className="pdx-rasc__desc" title={normalizeText(r.descricao)}>{normalizeText(r.descricao)}</p>
                <p className="pdx-rasc__meta">
                  {normalizeText(r.categoria)}
                  {r.texto_original && ` · "${r.texto_original}"`}
                </p>
              </div>
              <span className="pdx-rasc__val" style={{ color: r.tipo === "receita" ? t.receita : t.gasto }}>
                {r.tipo === "receita" ? "+" : "−"}{formatBRL(r.valor)}
              </span>
              <div className="pdx-rasc__acoes">
                <button className="pdx-btn2" onClick={() => onRejeitarRascunho?.(r.id)}>Rejeitar</button>
                <button className="pdx-btn2 pdx-btn2--ok" onClick={() => onConfirmarRascunho?.(r)}>Confirmar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pdx-dash-cards">
        {cards.map((c) => (
          <div className="pdx-card" key={c.label}>
            <p className="pdx-card__label">{c.label}</p>
            <p className="pdx-card__value" style={{ color: c.color }}>{formatBRL(c.value)}</p>
          </div>
        ))}
      </div>

      <div className="pdx-strip">
        <span className="pdx-strip__item">
          Gasto total do mês <b>{formatBRL(dados.gastoTotal)}</b>
        </span>
        <span className={`pdx-delta pdx-delta--${deltaClasse}`}>
          {deltaClasse === "flat" ? "=" : deltaClasse === "up" ? "▲" : "▼"}
          {deltaPct === null
            ? formatBRL(Math.abs(deltaAbs))
            : `${Math.abs(deltaPct).toFixed(0)}%`}
          <span style={{ fontWeight: 500 }}>vs {dados.mesAnterior}</span>
        </span>
        {deltaPct !== null && (
          <span className="pdx-strip__item" style={{ fontSize: "0.8rem" }}>
            {deltaAbs >= 0 ? "+" : "−"}{formatBRL(Math.abs(deltaAbs))} em relação ao mês anterior
          </span>
        )}
        {dados.evitavel > 0 && (
          <span className="pdx-strip__evit">
            {formatBRL(dados.evitavel)} evitável
            {dados.gastoTotal > 0 && ` · ${((dados.evitavel / dados.gastoTotal) * 100).toFixed(0)}% do gasto`}
          </span>
        )}
      </div>

      <div className="pdx-dash-panels">
        <div className="pdx-panel">
          <div className="pdx-panel__head">
            <p className="pdx-panel__title">Gasto por categoria</p>
            <p className="pdx-panel__sub">{MESES[mes]}/{ano}</p>
          </div>
          {dados.categorias.length === 0 ? (
            <p className="pdx-panel__empty">Sem gastos neste mês.</p>
          ) : (
            dados.categorias.map((item, i) => (
              <div className="pdx-cat" key={item.cat}>
                <div className="pdx-cat__row">
                  <span className="pdx-cat__nome" title={item.cat}>{item.cat}</span>
                  <span className="pdx-cat__val">
                    {formatBRL(item.total)}
                    <span>{dados.gastoTotal > 0 ? `${((item.total / dados.gastoTotal) * 100).toFixed(0)}%` : "—"}</span>
                  </span>
                </div>
                <div className="pdx-cat__track">
                  <div
                    className="pdx-cat__fill"
                    style={{ width: `${(item.total / dados.maxCat) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="pdx-panel">
          <div className="pdx-panel__head">
            <p className="pdx-panel__title">Tendência 6 meses</p>
            <div className="pdx-legend">
              <span><i style={{ background: t.receita }} />Receita</span>
              <span><i style={{ background: t.gasto }} />Gasto</span>
            </div>
          </div>
          <svg className="pdx-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Receita e gasto por mês nos últimos 6 meses">
            <line x1="0" y1={BASE} x2={W} y2={BASE} stroke={t.surfaceBorder} strokeWidth="1" />
            {dados.tendencia.map((m, i) => {
              const centro = i * PASSO + PASSO / 2;
              const hR = (m.receita / dados.maxTend) * ALTURA;
              const hG = (m.gasto / dados.maxTend) * ALTURA;
              const atual = m.key === prefixoDe(ano, mes);
              return (
                <g key={m.key}>
                  <rect x={centro - LARG - 2} y={BASE - hR} width={LARG} height={hR} rx="3" fill={t.receita}>
                    <title>{`${m.label}/${m.ano} · receita ${formatBRL(m.receita)}`}</title>
                  </rect>
                  <rect x={centro + 2} y={BASE - hG} width={LARG} height={hG} rx="3" fill={t.gasto}>
                    <title>{`${m.label}/${m.ano} · gasto ${formatBRL(m.gasto)}`}</title>
                  </rect>
                  <text x={centro} y={BASE + 22} textAnchor="middle" fontWeight={atual ? 700 : 500} fill={atual ? t.textPrimary : t.textSecondary}>
                    {m.label}
                  </text>
                  <text x={centro} y={BASE + 40} textAnchor="middle" fontSize="11" opacity="0.75">
                    {m.ano}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {dados.vazio && (
        <div className="pdx-panel">
          <p className="pdx-panel__empty">Nenhum lançamento em {MESES[mes]}/{ano}. Troque o mês na barra do topo ou registre um lançamento.</p>
        </div>
      )}
    </div>
  );
}
