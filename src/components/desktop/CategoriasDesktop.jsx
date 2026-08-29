import { useMemo, useState } from "react";
import { desktopTheme as t } from "./theme";

// Tela "Categorias" do desktop (Fase B). Mesma tabela `categorias` que o mobile e o
// agente de WhatsApp já enxergam — as default vêm do array hardcoded do App, as custom
// do banco. Nenhuma query nova: a contagem de uso sai dos lançamentos já em memória.
//
// Renomear é a única ação que escreve em `Lancamentos` — a categoria é gravada lá como
// texto, então o histórico precisa migrar junto. O aviso antes de confirmar diz quantos
// lançamentos serão tocados.

const CSS = `
.pdx-cat2 { font-family: 'DM Sans', 'Helvetica Neue', sans-serif; display: flex; flex-direction: column; gap: 1rem; }
.pdx-cat2__head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.pdx-cat2__sub { margin: 0; font-size: 0.85rem; color: ${t.textSecondary}; }
.pdx-cat2__cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 1rem; align-items: start; }
.pdx-cat2__col { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1.25rem 1.35rem; min-width: 0; }
.pdx-cat2__coltitle { margin: 0 0 1.1rem; font-size: 0.75rem; font-weight: 600; color: ${t.textSecondary}; text-transform: uppercase; letter-spacing: 0.07em; }
.pdx-cat2__row { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0; border-bottom: 1px solid ${t.surfaceBorder}; }
.pdx-cat2__row:last-child { border-bottom: none; }
.pdx-cat2__row--oculta .pdx-cat2__nome { color: ${t.textSecondary}; text-decoration: line-through; }
.pdx-cat2__info { flex: 1; min-width: 0; }
.pdx-cat2__nome { margin: 0; font-size: 0.9rem; color: ${t.textPrimary}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdx-cat2__meta { margin: 0.1rem 0 0; font-size: 0.74rem; color: ${t.textSecondary}; }
.pdx-cat2__tag { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; background: ${t.chipBg}; color: ${t.chipText}; font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
.pdx-cat2__acoes { display: flex; gap: 0.4rem; flex-shrink: 0; }
.pdx-cat2__edit { display: flex; gap: 0.5rem; align-items: center; flex: 1; min-width: 0; }
.pdx-cat2__edit input { flex: 1; min-width: 0; box-sizing: border-box; padding: 0.45rem 0.65rem; border: 1px solid ${t.accent}; border-radius: 8px; background: ${t.surface}; color: ${t.textPrimary}; font-family: inherit; font-size: 0.88rem; }
.pdx-cat2__edit input:focus { outline: none; box-shadow: 0 0 0 3px ${t.chipBg}; }
.pdx-cat2__aviso { margin: 0.55rem 0 0; padding: 0.6rem 0.75rem; border-radius: 8px; background: #FFFBEB; color: ${t.evitavel}; font-size: 0.78rem; }
.pdx-cat2__erro { margin: 0.55rem 0 0; font-size: 0.8rem; color: ${t.gasto}; }
.pdx-cat2__empty { margin: 0; padding: 1.25rem 0; text-align: center; font-size: 0.86rem; color: ${t.textSecondary}; }
.pdx-cat2__form { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1.25rem 1.35rem; }
.pdx-cat2__formtitle { margin: 0 0 1rem; font-size: 0.75rem; font-weight: 600; color: ${t.textSecondary}; text-transform: uppercase; letter-spacing: 0.07em; }
.pdx-cat2__formlinha { display: flex; gap: 0.6rem; flex-wrap: wrap; }
.pdx-cat2__formlinha input { flex: 1; min-width: 200px; box-sizing: border-box; padding: 0.6rem 0.75rem; border: 1px solid ${t.surfaceBorder}; border-radius: 8px; background: ${t.surface}; color: ${t.textPrimary}; font-family: inherit; font-size: 0.9rem; }
.pdx-cat2__formlinha input:focus { outline: none; border-color: ${t.accent}; box-shadow: 0 0 0 3px ${t.chipBg}; }
.pdx-cat2__tipos { display: flex; gap: 0.4rem; }
.pdx-cat2__tipo { padding: 0.6rem 1rem; border-radius: 8px; border: 1px solid ${t.surfaceBorder}; background: ${t.surface}; color: ${t.textSecondary}; font-family: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; }
.pdx-cat2__tipo.is-on { border-color: ${t.accent}; background: ${t.chipBg}; color: ${t.chipText}; }
.pdx-btn { padding: 0.5rem 1rem; border-radius: 8px; font-family: inherit; font-size: 0.83rem; font-weight: 600; cursor: pointer; border: 1px solid ${t.surfaceBorder}; background: ${t.surface}; color: ${t.textSecondary}; white-space: nowrap; }
.pdx-btn:hover:not(:disabled) { background: ${t.mainBg}; color: ${t.textPrimary}; }
.pdx-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.pdx-btn--primary { background: ${t.accent}; border-color: ${t.accent}; color: #fff; }
.pdx-btn--primary:hover:not(:disabled) { background: ${t.accentHover}; color: #fff; }
.pdx-btn--danger { color: ${t.gasto}; }
.pdx-btn--danger:hover:not(:disabled) { background: #FEF2F2; color: ${t.gasto}; }
`;

const TIPOS = [
  { key: "gasto", label: "Gastos" },
  { key: "receita", label: "Receitas" },
];

export default function CategoriasDesktop({
  categories, categoriasRows, defaultCategories, lancamentos, normalizeText,
  onCriar, onRenomear, onRemover, onRestaurar,
}) {
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState("gasto");
  const [criando, setCriando] = useState(false);
  const [erroForm, setErroForm] = useState("");

  const [editando, setEditando] = useState(null); // { id, nome, tipo }
  const [rascunho, setRascunho] = useState("");
  const [confirmando, setConfirmando] = useState(null); // { chave, acao: "renomear" | "remover" }
  const [ocupado, setOcupado] = useState(false);
  const [erroLinha, setErroLinha] = useState({}); // chave -> mensagem

  const chaveDe = (nome, tipo) => `${tipo}::${nome}`;

  // Quantos lançamentos usam cada categoria — agregação client-side, nenhuma query nova.
  const usoPorCategoria = useMemo(() => {
    const mapa = {};
    for (const l of lancamentos) {
      if (!l.categoria) continue;
      const k = chaveDe(l.categoria, l.tipo);
      mapa[k] = (mapa[k] || 0) + 1;
    }
    return mapa;
  }, [lancamentos]);

  // Uma linha por categoria: as default (visíveis ou ocultas) e depois as custom.
  const linhasPorTipo = (tipo) => {
    const custom = categoriasRows.filter(c => c.tipo === tipo && !c.removida);
    const ocultas = new Set(categoriasRows.filter(c => c.tipo === tipo && c.removida).map(c => c.nome));
    const defaults = defaultCategories[tipo].map(nome => ({
      id: `default-${tipo}-${nome}`, nome, tipo, ehDefault: true, oculta: ocultas.has(nome),
    }));
    return [
      ...defaults,
      ...custom.map(c => ({ id: c.id, nome: c.nome, tipo, ehDefault: false, oculta: false, row: c })),
    ];
  };

  const limparEstado = () => {
    setEditando(null); setRascunho(""); setConfirmando(null);
  };

  const setErro = (chave, msg) => setErroLinha(prev => ({ ...prev, [chave]: msg }));
  const limparErro = (chave) => setErroLinha(prev => { const p = { ...prev }; delete p[chave]; return p; });

  const criar = async () => {
    setCriando(true); setErroForm("");
    const res = await onCriar(novoNome, novoTipo);
    setCriando(false);
    if (!res?.ok) { setErroForm(res?.erro || "Não foi possível criar."); return; }
    setNovoNome("");
  };

  const confirmarRenomear = async (linha) => {
    const chave = chaveDe(linha.nome, linha.tipo);
    setOcupado(true); limparErro(chave);
    const res = await onRenomear(linha.row, rascunho);
    setOcupado(false);
    if (!res?.ok) { setErro(chave, res?.erro || "Não foi possível renomear."); return; }
    limparEstado();
  };

  const confirmarRemover = async (linha) => {
    const chave = chaveDe(linha.nome, linha.tipo);
    setOcupado(true); limparErro(chave);
    const res = await onRemover(linha.nome, linha.tipo);
    setOcupado(false);
    if (!res?.ok) { setErro(chave, res?.erro || "Não foi possível excluir."); return; }
    limparEstado();
  };

  const restaurar = async (linha) => {
    const chave = chaveDe(linha.nome, linha.tipo);
    setOcupado(true); limparErro(chave);
    const res = await onRestaurar(linha.nome, linha.tipo);
    setOcupado(false);
    if (!res?.ok) setErro(chave, res?.erro || "Não foi possível restaurar.");
  };

  const totalCustom = categoriasRows.filter(c => !c.removida).length;

  return (
    <div className="pdx-cat2">
      <style>{CSS}</style>

      <div className="pdx-cat2__head">
        <p className="pdx-cat2__sub">
          As mesmas categorias que o app no celular e o agente do WhatsApp enxergam.
          {totalCustom > 0 && ` ${totalCustom} ${totalCustom === 1 ? "criada por você" : "criadas por você"}.`}
        </p>
      </div>

      <div className="pdx-cat2__form">
        <p className="pdx-cat2__formtitle">Nova categoria</p>
        <div className="pdx-cat2__formlinha">
          <div className="pdx-cat2__tipos">
            {TIPOS.map(({ key, label }) => (
              <button
                key={key}
                className={`pdx-cat2__tipo${novoTipo === key ? " is-on" : ""}`}
                onClick={() => setNovoTipo(key)}
                aria-pressed={novoTipo === key}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="text" placeholder="Nome da categoria" value={novoNome}
            onChange={(e) => { setNovoNome(e.target.value); setErroForm(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && novoNome.trim() && !criando) criar(); }}
          />
          <button className="pdx-btn pdx-btn--primary" onClick={criar} disabled={criando || !novoNome.trim()}>
            {criando ? "Criando..." : "Adicionar"}
          </button>
        </div>
        {erroForm && <p className="pdx-cat2__erro">{erroForm}</p>}
      </div>

      <div className="pdx-cat2__cols">
        {TIPOS.map(({ key: tipo, label }) => {
          const linhas = linhasPorTipo(tipo);
          return (
            <div className="pdx-cat2__col" key={tipo}>
              <p className="pdx-cat2__coltitle">{label} · {categories[tipo].length} em uso</p>
              {linhas.length === 0 ? (
                <p className="pdx-cat2__empty">Nenhuma categoria.</p>
              ) : linhas.map((linha) => {
                const chave = chaveDe(linha.nome, linha.tipo);
                const usos = usoPorCategoria[chave] || 0;
                const emEdicao = editando === chave;
                const conf = confirmando?.chave === chave ? confirmando.acao : null;
                const meta = [
                  linha.ehDefault ? "Padrão do app" : "Criada por você",
                  usos > 0 ? `${usos} ${usos === 1 ? "lançamento" : "lançamentos"}` : "sem lançamentos",
                  linha.oculta ? "oculta do seletor" : null,
                ].filter(Boolean).join(" · ");

                return (
                  <div className={`pdx-cat2__row${linha.oculta ? " pdx-cat2__row--oculta" : ""}`} key={linha.id}>
                    {emEdicao ? (
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="pdx-cat2__edit">
                          <input
                            type="text" value={rascunho} autoFocus
                            onChange={(e) => { setRascunho(e.target.value); limparErro(chave); }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") limparEstado();
                              if (e.key === "Enter" && rascunho.trim() && !ocupado) {
                                if (usos > 0 && conf !== "renomear") setConfirmando({ chave, acao: "renomear" });
                                else confirmarRenomear(linha);
                              }
                            }}
                          />
                          {conf === "renomear" ? (
                            <>
                              <button className="pdx-btn pdx-btn--primary" onClick={() => confirmarRenomear(linha)} disabled={ocupado}>
                                {ocupado ? "Renomeando..." : "Confirmar"}
                              </button>
                              <button className="pdx-btn" onClick={limparEstado} disabled={ocupado}>Cancelar</button>
                            </>
                          ) : (
                            <>
                              <button
                                className="pdx-btn pdx-btn--primary"
                                disabled={ocupado || !rascunho.trim()}
                                onClick={() => {
                                  if (usos > 0) setConfirmando({ chave, acao: "renomear" });
                                  else confirmarRenomear(linha);
                                }}
                              >
                                Salvar
                              </button>
                              <button className="pdx-btn" onClick={limparEstado} disabled={ocupado}>Cancelar</button>
                            </>
                          )}
                        </div>
                        {conf === "renomear" && (
                          <p className="pdx-cat2__aviso">
                            Renomear também atualiza {usos} {usos === 1 ? "lançamento já registrado" : "lançamentos já registrados"} de
                            {" "}"{normalizeText(linha.nome)}" para "{normalizeText(rascunho.trim())}".
                          </p>
                        )}
                        {erroLinha[chave] && <p className="pdx-cat2__erro">{erroLinha[chave]}</p>}
                      </div>
                    ) : (
                      <>
                        <div className="pdx-cat2__info">
                          <p className="pdx-cat2__nome">{normalizeText(linha.nome)}</p>
                          <p className="pdx-cat2__meta">{meta}</p>
                          {conf === "remover" && (
                            <p className="pdx-cat2__aviso">
                              {linha.ehDefault
                                ? "A categoria some do seletor. Os lançamentos já registrados nela continuam como estão."
                                : usos > 0
                                  ? `${usos} ${usos === 1 ? "lançamento continua" : "lançamentos continuam"} com esta categoria, mas ela sai do seletor. Para renomear sem deixar o histórico órfão, use Editar.`
                                  : "A categoria será excluída."}
                            </p>
                          )}
                          {erroLinha[chave] && <p className="pdx-cat2__erro">{erroLinha[chave]}</p>}
                        </div>
                        <div className="pdx-cat2__acoes">
                          {conf === "remover" ? (
                            <>
                              <button className="pdx-btn pdx-btn--danger" onClick={() => confirmarRemover(linha)} disabled={ocupado}>
                                {ocupado ? "..." : linha.ehDefault ? "Confirmar ocultar" : "Confirmar exclusão"}
                              </button>
                              <button className="pdx-btn" onClick={() => setConfirmando(null)} disabled={ocupado}>Cancelar</button>
                            </>
                          ) : linha.oculta ? (
                            <button className="pdx-btn" onClick={() => restaurar(linha)} disabled={ocupado}>Restaurar</button>
                          ) : (
                            <>
                              {!linha.ehDefault && (
                                <button
                                  className="pdx-btn"
                                  onClick={() => { limparErro(chave); setConfirmando(null); setEditando(chave); setRascunho(linha.nome); }}
                                  disabled={ocupado}
                                >
                                  Editar
                                </button>
                              )}
                              <button
                                className="pdx-btn pdx-btn--danger"
                                onClick={() => { limparErro(chave); setEditando(null); setConfirmando({ chave, acao: "remover" }); }}
                                disabled={ocupado}
                              >
                                {linha.ehDefault ? "Ocultar" : "Excluir"}
                              </button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
