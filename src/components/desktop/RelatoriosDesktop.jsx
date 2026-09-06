import { useMemo } from "react";
import { desktopTheme as t } from "./theme";
import { calcularFechamento, formatarBRL } from "../../lib/fechamento";
import { calcularDisciplina } from "../../lib/disciplina";

// Relatórios v1 — fechamento do mês + score de disciplina (desktop-only).
// Recebe os lançamentos que o App já carregou: nenhuma query nova, tudo agregação
// client-side em src/lib/fechamento.js e src/lib/disciplina.js.
//
// Export é print-ready: o botão chama window.print() e o @media print abaixo esconde
// o shell (sidebar, top-bar, botões) pra sair só o relatório. O "Salvar como PDF" do
// navegador gera um PDF de verdade, com texto selecionável, sem dependência nova.

const BAR_COLORS = ["#4F46E5", "#0891B2", "#7C3AED", "#DB2777", "#EA580C"];

// WhatsApp da assessoria (site pessoal), NÃO o número do agente Pradex — mandar um
// lead de planejamento pro bot de lançar gasto seria o pior destino possível.
const WHATSAPP_NOBEL = "5511966298633";
const MSG_NOBEL = encodeURIComponent(
  "Oi! Uso o Pradex e queria falar sobre planejamento financeiro completo (proteção, previdência, imóvel)."
);

const CSS = `
.pdx-rel { display: flex; flex-direction: column; gap: 1rem; font-family: 'DM Sans', 'Helvetica Neue', sans-serif; }
.pdx-rel__head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.pdx-rel__titulo { margin: 0; font-size: 1.05rem; font-weight: 700; color: ${t.textPrimary}; }
.pdx-rel__sub { margin: 0.15rem 0 0; font-size: 0.8rem; color: ${t.textSecondary}; }
.pdx-rel__print { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.55rem 1rem; border: 1px solid ${t.surfaceBorder}; border-radius: 9px; background: ${t.surface}; color: ${t.textSecondary}; font-family: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.pdx-rel__print:hover { background: ${t.mainBg}; color: ${t.textPrimary}; }

.pdx-rel-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1rem; }
.pdx-rcard { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1.1rem 1.25rem; }
.pdx-rcard__label { margin: 0 0 0.45rem; font-size: 0.72rem; font-weight: 600; color: ${t.textSecondary}; text-transform: uppercase; letter-spacing: 0.07em; }
.pdx-rcard__value { margin: 0; font-size: 1.35rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.pdx-rcard__hint { margin: 0.35rem 0 0; font-size: 0.75rem; color: ${t.textSecondary}; }

.pdx-rdelta { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.78rem; font-weight: 600; font-variant-numeric: tabular-nums; }
.pdx-rdelta--up { background: #FEF2F2; color: ${t.gasto}; }
.pdx-rdelta--down { background: #ECFDF5; color: ${t.receita}; }
.pdx-rdelta--flat { background: ${t.mainBg}; color: ${t.textSecondary}; }

.pdx-rfrase { background: ${t.chipBg}; border: 1px solid ${t.surfaceBorder}; border-left: 3px solid ${t.accent}; border-radius: 0 12px 12px 0; padding: 0.9rem 1.25rem; }
.pdx-rfrase p { margin: 0; font-size: 0.92rem; color: ${t.textPrimary}; }

.pdx-rel-panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(370px, 1fr)); gap: 1rem; align-items: start; }
.pdx-rpanel { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1.25rem 1.35rem; min-width: 0; }
.pdx-rpanel__title { margin: 0 0 1.1rem; font-size: 0.75rem; font-weight: 600; color: ${t.textSecondary}; text-transform: uppercase; letter-spacing: 0.07em; }
.pdx-rpanel__empty { margin: 0; font-size: 0.88rem; color: ${t.textSecondary}; padding: 1.5rem 0; text-align: center; }

.pdx-rcat { margin-bottom: 0.95rem; }
.pdx-rcat:last-child { margin-bottom: 0; }
.pdx-rcat__row { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.35rem; }
.pdx-rcat__nome { font-size: 0.86rem; color: ${t.textPrimary}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdx-rcat__val { font-size: 0.86rem; font-weight: 600; color: ${t.textPrimary}; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pdx-rcat__val span { margin-left: 0.4rem; font-weight: 500; color: ${t.textSecondary}; }
.pdx-rcat__track { background: ${t.mainBg}; border-radius: 999px; height: 8px; overflow: hidden; }
.pdx-rcat__fill { height: 100%; border-radius: 999px; }

.pdx-rsplit { display: flex; gap: 0.6rem; margin-bottom: 0.8rem; }
.pdx-rsplit__seg { height: 12px; border-radius: 999px; }
.pdx-rlegend { display: flex; flex-wrap: wrap; gap: 0.4rem 1.25rem; font-size: 0.82rem; color: ${t.textSecondary}; }
.pdx-rlegend b { color: ${t.textPrimary}; font-variant-numeric: tabular-nums; }
.pdx-rlegend i { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 0.4rem; }

.pdx-rscore { display: flex; align-items: center; gap: 1.25rem; margin-bottom: 1.1rem; }
.pdx-rscore__num { font-size: 2.6rem; font-weight: 700; color: ${t.accent}; line-height: 1; font-variant-numeric: tabular-nums; }
.pdx-rscore__num small { font-size: 0.9rem; font-weight: 600; color: ${t.textSecondary}; }
.pdx-rscore__resumo { margin: 0; font-size: 0.88rem; color: ${t.textPrimary}; }
.pdx-rbadges { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.5rem; }
.pdx-rbadge { padding: 0.25rem 0.7rem; border-radius: 999px; background: ${t.chipBg}; color: ${t.chipText}; font-size: 0.75rem; font-weight: 600; }
.pdx-rcomp { display: flex; align-items: baseline; justify-content: space-between; gap: 0.75rem; padding: 0.55rem 0; border-top: 1px solid ${t.surfaceBorder}; font-size: 0.83rem; }
.pdx-rcomp__nome { color: ${t.textPrimary}; }
.pdx-rcomp__det { display: block; font-size: 0.75rem; color: ${t.textSecondary}; }
.pdx-rcomp__pts { font-weight: 600; color: ${t.textPrimary}; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pdx-rcomp--na .pdx-rcomp__nome, .pdx-rcomp--na .pdx-rcomp__pts { color: ${t.textSecondary}; }
.pdx-rnota { margin: 0.9rem 0 0; font-size: 0.75rem; color: ${t.textSecondary}; line-height: 1.5; }

.pdx-rnobel { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1.25rem 1.35rem; display: flex; align-items: center; justify-content: space-between; gap: 1.25rem; flex-wrap: wrap; }
.pdx-rnobel h3 { margin: 0 0 0.3rem; font-size: 0.95rem; font-weight: 700; color: ${t.textPrimary}; }
.pdx-rnobel p { margin: 0; font-size: 0.85rem; color: ${t.textSecondary}; max-width: 620px; }
.pdx-rnobel a { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.6rem 1.1rem; border-radius: 9px; background: ${t.accent}; color: #fff; font-size: 0.87rem; font-weight: 600; text-decoration: none; white-space: nowrap; }
.pdx-rnobel a:hover { background: ${t.accentHover}; }

/* ---------- IMPRESSÃO ---------- */
/* O relatório mora dentro do shell; na impressão o shell inteiro sai de cena. */
@media print {
  @page { margin: 14mm; }
  .pdx-sb, .pdx-top, .pdx-rel__print, .fab-whatsapp { display: none !important; }
  body { background: #fff !important; }
  .pradex-shell { padding-left: 0 !important; }
  .pdx-content { max-width: none !important; padding: 0 !important; }
  .pdx-rel { gap: 12px; }
  .pdx-rcard, .pdx-rpanel, .pdx-rnobel, .pdx-rfrase { border-color: #D8DCE8 !important; box-shadow: none !important; break-inside: avoid; }
  .pdx-rel-panels { grid-template-columns: 1fr 1fr !important; }
  .pdx-rnobel { break-inside: avoid; }
  .pdx-rel__head { border-bottom: 1px solid #D8DCE8; padding-bottom: 8px; }
}
`;

const chipDelta = (delta, pct) => {
  if (!delta) return { cls: "pdx-rdelta--flat", txt: "estável" };
  const sinal = delta > 0 ? "▲" : "▼";
  const cls = delta > 0 ? "pdx-rdelta--up" : "pdx-rdelta--down";
  const txt = pct === null ? `${sinal} ${formatarBRL(Math.abs(delta))}` : `${sinal} ${Math.abs(Math.round(pct * 100))}%`;
  return { cls, txt };
};

export default function RelatoriosDesktop({ lancamentos, ano, mes, normalizeText = (x) => x }) {
  const f = useMemo(
    () => calcularFechamento(lancamentos, ano, mes, { normalizar: normalizeText }),
    [lancamentos, ano, mes, normalizeText],
  );
  const d = useMemo(() => calcularDisciplina(f), [f]);

  const delta = chipDelta(f.deltaGasto, f.deltaGastoPct);
  const totalSplit = f.debito + f.cartao;

  return (
    <div className="pdx-rel">
      <style>{CSS}</style>

      <div className="pdx-rel__head">
        <div>
          <h2 className="pdx-rel__titulo">Fechamento de {f.label}</h2>
          <p className="pdx-rel__sub">
            {f.temLancamentos
              ? `${f.diasComLancamento} ${f.diasComLancamento === 1 ? "dia" : "dias"} com lançamento${f.mesCorrente ? " · mês em andamento" : ""}`
              : "Sem lançamentos neste mês"}
          </p>
        </div>
        <button className="pdx-rel__print" onClick={() => window.print()}>
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
          </svg>
          Baixar PDF
        </button>
      </div>

      {/* 1. Capa do mês */}
      <div className="pdx-rel-cards">
        <div className="pdx-rcard">
          <p className="pdx-rcard__label">Receitas</p>
          <p className="pdx-rcard__value" style={{ color: t.receita }}>{formatarBRL(f.receitas)}</p>
        </div>
        <div className="pdx-rcard">
          <p className="pdx-rcard__label">Gastos</p>
          <p className="pdx-rcard__value" style={{ color: t.gasto }}>{formatarBRL(f.gastoTotal)}</p>
          <p className="pdx-rcard__hint">
            <span className={`pdx-rdelta ${delta.cls}`}>{delta.txt}</span> vs {f.labelAnterior}
          </p>
        </div>
        <div className="pdx-rcard">
          <p className="pdx-rcard__label">Saldo</p>
          <p className="pdx-rcard__value" style={{ color: f.saldo >= 0 ? t.receita : t.gasto }}>{formatarBRL(f.saldo)}</p>
        </div>
        <div className="pdx-rcard">
          <p className="pdx-rcard__label">Gasto evitável</p>
          <p className="pdx-rcard__value" style={{ color: t.evitavel }}>{formatarBRL(f.evitavel)}</p>
          <p className="pdx-rcard__hint">
            {f.temMesAnterior ? `${formatarBRL(f.evitavelAnterior)} em ${f.labelAnterior}` : "sem base de comparação"}
          </p>
        </div>
      </div>

      <div className="pdx-rfrase"><p>{f.destaque}</p></div>

      <div className="pdx-rel-panels">
        {/* 2. Por categoria */}
        <div className="pdx-rpanel">
          <p className="pdx-rpanel__title">Top 5 categorias</p>
          {f.topCategorias.length === 0 ? (
            <p className="pdx-rpanel__empty">Nenhum gasto lançado neste mês.</p>
          ) : f.topCategorias.map((c, i) => (
            <div className="pdx-rcat" key={c.cat}>
              <div className="pdx-rcat__row">
                <span className="pdx-rcat__nome">{c.cat}</span>
                <span className="pdx-rcat__val">{formatarBRL(c.total)}<span>{Math.round(c.pct * 100)}%</span></span>
              </div>
              <div className="pdx-rcat__track">
                <div className="pdx-rcat__fill" style={{ width: `${(c.total / f.maxCategoria) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
              </div>
            </div>
          ))}
        </div>

        {/* 5. Score de disciplina */}
        <div className="pdx-rpanel">
          <p className="pdx-rpanel__title">Score de disciplina</p>
          <div className="pdx-rscore">
            <div className="pdx-rscore__num">{d.score}<small>/100</small></div>
            <div>
              <p className="pdx-rscore__resumo">{d.resumo}</p>
              {d.badges.length > 0 && (
                <div className="pdx-rbadges">
                  {d.badges.map((b) => <span className="pdx-rbadge" key={b}>{b}</span>)}
                </div>
              )}
            </div>
          </div>

          {d.componentes.map((c) => (
            <div className={`pdx-rcomp${c.aplicavel ? "" : " pdx-rcomp--na"}`} key={c.chave}>
              <span className="pdx-rcomp__nome">
                {c.label}
                <span className="pdx-rcomp__det">{c.detalhe}</span>
              </span>
              <span className="pdx-rcomp__pts">{c.aplicavel ? `${c.pontos}/${c.max}` : "n/a"}</span>
            </div>
          ))}

          <p className="pdx-rnota">
            O score mede <strong>hábito de registro</strong>, não dinheiro: saldo, patrimônio e renda
            não entram na conta. O que não pode ser avaliado (como teto de categoria, que ainda não
            existe no app) fica de fora do cálculo em vez de contar como zero.
          </p>
        </div>
      </div>

      {/* 3. Cartão vs débito/PIX */}
      <div className="pdx-rpanel">
        <p className="pdx-rpanel__title">Como você pagou</p>
        {totalSplit === 0 ? (
          <p className="pdx-rpanel__empty">Nenhum gasto lançado neste mês.</p>
        ) : (
          <>
            <div className="pdx-rsplit">
              <div className="pdx-rsplit__seg" style={{ width: `${(f.debito / totalSplit) * 100}%`, background: BAR_COLORS[0] }} />
              <div className="pdx-rsplit__seg" style={{ width: `${(f.cartao / totalSplit) * 100}%`, background: BAR_COLORS[1] }} />
            </div>
            <div className="pdx-rlegend">
              <span><i style={{ background: BAR_COLORS[0] }} />Débito/PIX <b>{formatarBRL(f.debito)}</b> ({Math.round((f.debito / totalSplit) * 100)}%)</span>
              <span><i style={{ background: BAR_COLORS[1] }} />Crédito <b>{formatarBRL(f.cartao)}</b> ({Math.round((f.cartao / totalSplit) * 100)}%)</span>
            </div>
          </>
        )}
      </div>

      {/* 6. CTA Nobel */}
      <div className="pdx-rnobel">
        <div>
          <h3>Organizar é o começo. Planejar é o passo seguinte.</h3>
          <p>
            O Pradex mostra pra onde o seu dinheiro foi. Proteção da família, previdência e compra
            de imóvel entram num planejamento financeiro completo — que é o trabalho que eu e a
            equipe da Nobel fazemos com cliente, fora do app.
          </p>
        </div>
        <a href={`https://wa.me/${WHATSAPP_NOBEL}?text=${MSG_NOBEL}`} target="_blank" rel="noopener noreferrer">
          Falar sobre planejamento
        </a>
      </div>
    </div>
  );
}
