import { useMemo } from "react";
import { desktopTheme as t } from "./theme";
import { ehPagamentoFatura } from "../../lib/formaPagamento";
import { calcularFechamento } from "../../lib/fechamento";
import HomeResumo from "../HomeResumo";
import { t as tr } from "../../lib/i18n";

// Dashboard analytics (Fase 2, desktop-only). Recebe os lançamentos que o App.jsx
// já carregou — nenhuma query nova, tudo é agregação client-side.
// O mês vem por prop (seletor da top-bar): cards, categorias, comparação e evitável
// são do mês selecionado. A tendência de 6 meses mora em Relatórios (out/2026).

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
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
.pdx-ult { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 1rem; padding: 0.6rem 0; border-bottom: 1px solid ${t.surfaceBorder}; cursor: pointer; }
.pdx-ult:last-child { border-bottom: none; padding-bottom: 0; }
.pdx-ult:hover .pdx-ult__desc { color: ${t.accent}; }
.pdx-ult__desc { margin: 0; font-size: 0.9rem; color: ${t.textPrimary}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdx-ult__meta { margin: 0.1rem 0 0; font-size: 0.72rem; color: ${t.textSecondary}; }
.pdx-ult__val { min-width: 120px; text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pdx-chip { font-size: 0.7rem; background: ${t.chipBg}; color: ${t.chipText}; border-radius: 999px; padding: 0.12rem 0.55rem; white-space: nowrap; }
.pdx-tag { margin-left: 0.4rem; font-size: 0.65rem; font-weight: 600; background: ${t.chipBg}; color: ${t.chipText}; border-radius: 999px; padding: 0.1rem 0.5rem; }
`;


export default function DashboardDesktop({
  lancamentos, ano, mes, formatBRL,
  rascunhos = [], onConfirmarRascunho, onRejeitarRascunho, normalizeText = (x) => x,
  tetos = [],
  cartoes = [],
  ultimos = [], onEditar, formaLabel = (f) => f || "—",
  idioma = "pt-BR",
}) {
  const s = (key) => tr(idioma, key);
  const meses = idioma === "en" ? MESES_EN : MESES;
  const dados = useMemo(() => {
    // A conta mora em lib/fechamento.js. Esta tela já divergiu uma vez (aporte de
    // meta aparecendo como gasto) — débito/cartão, pagamento de fatura e Guardou
    // não podem ter uma segunda implementação aqui.
    const f = calcularFechamento(lancamentos, ano, mes, { normalizar: normalizeText });

    return {
      ...f,
      vazio: !f.temLancamentos,
      maxCat: f.maxCategoria,
      mesAnterior: f.labelAnterior,
    };
  }, [lancamentos, ano, mes, normalizeText]);

  const dataCurta = (d) => {
    if (!d) return "";
    const [, m, dia] = String(d).split("-");
    return `${dia} ${meses[parseInt(m, 10) - 1] || ""}`;
  };

  // Δ do gasto total vs mês anterior. Sem base de comparação, não inventa percentual.
  const deltaAbs = dados.gastoTotal - dados.gastoAnterior;
  const deltaPct = dados.gastoAnterior > 0 ? (deltaAbs / dados.gastoAnterior) * 100 : null;
  const deltaClasse = Math.abs(deltaAbs) < 0.005 ? "flat" : deltaAbs > 0 ? "up" : "down";


  return (
    <div className="pdx-dash">
      <style>{CSS}</style>

      {/* Rascunhos do agente WhatsApp — ação pendente, precisa existir no desktop também. */}
      {rascunhos.length > 0 && (
        <div className="pdx-panel">
          <div className="pdx-panel__head">
            <p className="pdx-panel__title">{s("pendentes_zap")} ({rascunhos.length})</p>
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
                <button className="pdx-btn2" onClick={() => onRejeitarRascunho?.(r.id)}>{s("rejeitar")}</button>
                <button className="pdx-btn2 pdx-btn2--ok" onClick={() => onConfirmarRascunho?.(r)}>{s("confirmar")}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <HomeResumo
        variant="desktop"
        fluxo={dados}
        cartoes={cartoes}
        lancamentos={lancamentos}
        ano={ano}
        mes={mes}
        formatBRL={formatBRL}
        idioma={idioma}
        normalizar={normalizeText}
      />

      <div className="pdx-strip">
        <span className="pdx-strip__item">
          {s("gasto_total")} <b>{formatBRL(dados.gastoTotal)}</b> {s("gasto_total_sub")}
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
            {deltaAbs >= 0 ? "+" : "−"}{formatBRL(Math.abs(deltaAbs))} {s("vs_anterior")}
          </span>
        )}
        {dados.evitavel > 0 && (
          <span className="pdx-strip__evit">
            {formatBRL(dados.evitavel)} {s("evitavel")}
            {dados.gastoTotal > 0 && ` · ${((dados.evitavel / dados.gastoTotal) * 100).toFixed(0)}% ${s("do_gasto")}`}
          </span>
        )}
      </div>

      <div className="pdx-dash-panels">
        <div className="pdx-panel">
          <div className="pdx-panel__head">
            <p className="pdx-panel__title">{s("gasto_categoria")}</p>
            <p className="pdx-panel__sub">{meses[mes]}/{ano}</p>
          </div>
          {dados.categorias.length === 0 ? (
            <p className="pdx-panel__empty">{s("sem_gastos")}</p>
          ) : (
            dados.categorias.map((item, i) => {
              // Com teto, a barra mede contra o que a pessoa PROMETEU e o rotulo vira
              // "gasto / teto · N% usado". Sem teto, segue medindo contra a maior
              // categoria do mes, que e so leitura relativa.
              const teto = tetos.find((t) => t.categoria === item.cat);
              const limite = teto ? Number(teto.limite) : 0;
              const pctTeto = limite > 0 ? (item.total / limite) * 100 : 0;
              const estourou = limite > 0 && item.total > limite;
              const perto = limite > 0 && !estourou && pctTeto >= 90;
              const corBarra = estourou ? "#DC2626" : perto ? "#B45309" : BAR_COLORS[i % BAR_COLORS.length];
              const largura = limite > 0 ? Math.min(100, pctTeto) : (item.total / dados.maxCat) * 100;
              return (
              <div className="pdx-cat" key={item.cat}>
                <div className="pdx-cat__row">
                  <span className="pdx-cat__nome" title={item.cat}>{item.cat}</span>
                  <span className="pdx-cat__val">
                    {formatBRL(item.total)}
                    {limite > 0
                      ? <span style={{ color: corBarra }}>{" / "}{formatBRL(limite)} · {Math.round(pctTeto)}% {s("pct_usado")}</span>
                      : <span>{dados.gastoTotal > 0 ? `${((item.total / dados.gastoTotal) * 100).toFixed(0)}%` : "—"}</span>}
                  </span>
                </div>
                <div className="pdx-cat__track">
                  <div className="pdx-cat__fill" style={{ width: `${largura}%`, background: corBarra }} />
                </div>
              </div>
              );
            })
          )}
        </div>


        <div className="pdx-panel">
          <div className="pdx-panel__head">
            <p className="pdx-panel__title">{s("ultimos")}</p>
          </div>
          {ultimos.length === 0 ? (
            <p className="pdx-panel__empty">{s("painel_vazio")}</p>
          ) : ultimos.map((l) => {
            const pagamento = ehPagamentoFatura(l);
            const receita = l.tipo === "receita";
            return (
              <div className="pdx-ult" key={l.id} onClick={() => onEditar?.(l)}>
                <div style={{ minWidth: 0 }}>
                  <p className="pdx-ult__desc" title={normalizeText(l.descricao)}>
                    {normalizeText(l.descricao)}
                    {pagamento && <span className="pdx-tag">{s("nao_e_gasto")}</span>}
                  </p>
                  <p className="pdx-ult__meta">{dataCurta(l.data_lancamento)} · {formaLabel(l.forma_pagamento)}</p>
                </div>
                <span className="pdx-chip">{normalizeText(l.categoria) || "—"}</span>
                <span className="pdx-ult__val" style={{ color: pagamento ? t.textSecondary : receita ? t.receita : t.gasto }}>
                  {pagamento ? "" : receita ? "+" : "−"}{formatBRL(l.valor)}
                </span>
              </div>
            );
          })}
        </div>

      </div>

      {dados.vazio && (
        <div className="pdx-panel">
          <p className="pdx-panel__empty">{s("nenhum_no_mes")} {meses[mes]}/{ano}.</p>
        </div>
      )}
    </div>
  );
}
