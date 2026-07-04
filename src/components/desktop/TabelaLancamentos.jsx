import { useState, useMemo } from "react";
import { desktopTheme as t } from "./theme";

// Tabela poderosa de lançamentos (Fase 1, desktop-only). Recebe dados + callbacks
// do App.jsx (que centraliza o acesso ao banco). Regras:
// - Edição inline só em lançamentos avulsos (sem parcela_grupo_id e não recorrente).
//   Parceladas/recorrentes abrem o modal Editar existente (onEdit) — lógica validada.
// - Toda escrita passa por callback que checa res.ok antes de refletir (lição PR #4).
// - Ações em massa: modal de confirmação PRÓPRIO com contagem — nunca window.confirm.

const CSS = `
.pdx-tbl-wrap { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; overflow: hidden; }
.pdx-tbl-tools { display: flex; flex-wrap: wrap; gap: 0.6rem; align-items: center; padding: 0.9rem 1rem; border-bottom: 1px solid ${t.surfaceBorder}; }
.pdx-tbl-search { flex: 1; min-width: 180px; display: flex; align-items: center; gap: 0.45rem; padding: 0.45rem 0.7rem; border: 1px solid ${t.surfaceBorder}; border-radius: 9px; background: ${t.mainBg}; }
.pdx-tbl-search input { border: none; background: transparent; outline: none; width: 100%; font-family: inherit; font-size: 0.88rem; color: ${t.textPrimary}; }
.pdx-tbl-select { padding: 0.45rem 0.6rem; border: 1px solid ${t.surfaceBorder}; border-radius: 9px; background: ${t.surface}; color: ${t.textPrimary}; font-family: inherit; font-size: 0.85rem; cursor: pointer; }
.pdx-tbl { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.pdx-tbl thead th { position: sticky; top: 0; background: ${t.mainBg}; color: ${t.textSecondary}; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; text-align: left; padding: 0.6rem 0.9rem; border-bottom: 1px solid ${t.surfaceBorder}; white-space: nowrap; }
.pdx-tbl thead th.sortable { cursor: pointer; user-select: none; }
.pdx-tbl thead th.sortable:hover { color: ${t.textPrimary}; }
.pdx-tbl tbody td { padding: 0.55rem 0.9rem; border-bottom: 1px solid ${t.surfaceBorder}; color: ${t.textPrimary}; vertical-align: middle; }
.pdx-tbl tbody tr:hover { background: ${t.mainBg}; }
.pdx-tbl tbody tr.is-selected { background: ${t.chipBg}; }
.pdx-chip { display: inline-block; padding: 0.15rem 0.6rem; border-radius: 999px; background: ${t.chipBg}; color: ${t.chipText}; font-size: 0.78rem; font-weight: 500; }
.pdx-val { font-weight: 500; white-space: nowrap; font-variant-numeric: tabular-nums; }
.pdx-val small { color: ${t.textSecondary}; font-weight: 500; }
.pdx-cell-edit { cursor: text; border-radius: 6px; }
.pdx-cell-edit:hover { outline: 1px dashed ${t.surfaceBorder}; }
.pdx-inline { width: 100%; box-sizing: border-box; padding: 0.3rem 0.4rem; border: 1px solid ${t.accent}; border-radius: 6px; font-family: inherit; font-size: 0.86rem; color: ${t.textPrimary}; background: ${t.surface}; outline: none; }
.pdx-iconbtn { background: none; border: none; cursor: pointer; color: ${t.textSecondary}; padding: 0.25rem; border-radius: 6px; display: inline-flex; }
.pdx-iconbtn:hover { color: ${t.accent}; background: ${t.chipBg}; }
.pdx-tbl-empty { text-align: center; padding: 3rem 1rem; color: ${t.textSecondary}; }
.pdx-tbl-foot { padding: 0.7rem 1rem; font-size: 0.8rem; color: ${t.textSecondary}; border-top: 1px solid ${t.surfaceBorder}; }
.pdx-bulkbar { display: flex; align-items: center; gap: 0.75rem; padding: 0.7rem 1rem; background: ${t.chipBg}; border-bottom: 1px solid ${t.surfaceBorder}; }
.pdx-bulkbar b { color: ${t.chipText}; }
.pdx-btn { padding: 0.45rem 0.9rem; border-radius: 8px; font-family: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; border: 1px solid ${t.surfaceBorder}; background: ${t.surface}; color: ${t.textPrimary}; }
.pdx-btn:hover { background: ${t.mainBg}; }
.pdx-btn--danger { border-color: ${t.gasto}; color: ${t.gasto}; }
.pdx-btn--danger:hover { background: #FEF2F2; }
.pdx-btn--primary { background: ${t.accent}; border-color: ${t.accent}; color: #fff; }
.pdx-btn--primary:hover { background: ${t.accentHover}; }
.pdx-modal-ov { position: fixed; inset: 0; background: rgba(17,24,39,0.45); z-index: 120; display: flex; align-items: center; justify-content: center; padding: 1rem; }
.pdx-modal { background: ${t.surface}; border-radius: 14px; padding: 1.5rem; width: 100%; max-width: 420px; box-shadow: 0 20px 50px rgba(0,0,0,0.25); }
.pdx-modal h3 { margin: 0 0 0.5rem; font-size: 1.05rem; color: ${t.textPrimary}; }
.pdx-modal p { margin: 0 0 1rem; font-size: 0.9rem; color: ${t.textSecondary}; line-height: 1.5; }
.pdx-modal-actions { display: flex; gap: 0.6rem; justify-content: flex-end; margin-top: 1.25rem; }
`;

const fmtData = (iso) => {
  if (!iso) return "—";
  const [a, m, d] = iso.split("T")[0].split("-");
  return `${d}/${m}/${a.slice(2)}`;
};

const SETA = (dir) => (dir === "asc" ? " ↑" : " ↓");

export default function TabelaLancamentos({
  lancamentos, cartoes, categories,
  onEdit, onInlineSave, onBulkDelete, onBulkRecategorize,
  formatBRL, normalizeText, limparDescricaoParcela,
}) {
  const [busca, setBusca] = useState("");
  const [fCategoria, setFCategoria] = useState("");
  const [fCartao, setFCartao] = useState("");
  const [fMes, setFMes] = useState("");
  const [ordCampo, setOrdCampo] = useState("data_lancamento");
  const [ordDir, setOrdDir] = useState("desc");
  const [sel, setSel] = useState(() => new Set());
  const [edit, setEdit] = useState(null); // { id, campo, valor }
  const [bulk, setBulk] = useState(null); // 'excluir' | 'recategorizar'
  const [recatCat, setRecatCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  const cartaoNome = (id) => cartoes.find((c) => String(c.id) === String(id))?.nome;
  const todasCategorias = useMemo(
    () => [...new Set([...(categories?.gasto || []), ...(categories?.receita || [])])].sort((a, b) => a.localeCompare(b)),
    [categories]
  );
  const meses = useMemo(() => {
    const s = new Set();
    lancamentos.forEach((l) => l.data_lancamento && s.add(l.data_lancamento.slice(0, 7)));
    return [...s].sort().reverse();
  }, [lancamentos]);

  const linhas = useMemo(() => {
    let arr = lancamentos.filter((l) => {
      if (fMes && !l.data_lancamento?.startsWith(fMes)) return false;
      if (fCategoria && l.categoria !== fCategoria) return false;
      if (fCartao && String(l.cartao_id) !== fCartao) return false;
      if (busca) {
        const q = busca.toLowerCase();
        const alvo = `${l.descricao || ""} ${l.categoria || ""}`.toLowerCase();
        if (!alvo.includes(q)) return false;
      }
      return true;
    });
    const dir = ordDir === "asc" ? 1 : -1;
    arr = [...arr].sort((a, b) => {
      let va = a[ordCampo], vb = b[ordCampo];
      if (ordCampo === "valor") { va = Number(va) || 0; vb = Number(vb) || 0; return (va - vb) * dir; }
      va = String(va || "").toLowerCase(); vb = String(vb || "").toLowerCase();
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
    return arr;
  }, [lancamentos, fMes, fCategoria, fCartao, busca, ordCampo, ordDir]);

  const ehAvulso = (l) => !l.parcela_grupo_id && !l.recorrente;
  const toggleSort = (campo) => {
    if (ordCampo === campo) setOrdDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setOrdCampo(campo); setOrdDir(campo === "data_lancamento" || campo === "valor" ? "desc" : "asc"); }
  };
  const toggleSel = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const todosVisiveisMarcados = linhas.length > 0 && linhas.every((l) => sel.has(l.id));
  const toggleTodos = () => setSel(() => (todosVisiveisMarcados ? new Set() : new Set(linhas.map((l) => l.id))));
  const rowsSelecionadas = linhas.filter((l) => sel.has(l.id));

  const salvarInline = async (l) => {
    if (!edit) return;
    const patch = {};
    let v = edit.valor;
    if (edit.campo === "valor") {
      const num = parseFloat(String(v).replace(",", "."));
      if (isNaN(num) || num <= 0) { setEdit(null); return; }
      patch.valor = Math.round(num * 100) / 100;
    } else if (edit.campo === "descricao") {
      if (!String(v).trim()) { setEdit(null); return; }
      patch.descricao = String(v).trim();
    } else if (edit.campo === "categoria") {
      patch.categoria = v;
    } else if (edit.campo === "data_lancamento") {
      if (!v) { setEdit(null); return; }
      patch.data_lancamento = v;
    }
    if (patch[edit.campo] === l[edit.campo]) { setEdit(null); return; }
    setBusy(true);
    const ok = await onInlineSave(l.id, patch);
    setBusy(false);
    setEdit(null);
    if (!ok) setErro("Não consegui salvar a edição. Tenta de novo.");
  };

  const confirmarBulk = async () => {
    setBusy(true); setErro("");
    const res = bulk === "excluir"
      ? await onBulkDelete(rowsSelecionadas)
      : await onBulkRecategorize(rowsSelecionadas, recatCat);
    setBusy(false);
    if (res?.ok) { setSel(new Set()); setBulk(null); setRecatCat(""); }
    else setErro(bulk === "excluir" ? "Erro ao excluir. Nada foi apagado do que falhou." : "Erro ao recategorizar.");
  };

  // Função (não componente) que retorna JSX: evita remontar o <input> a cada
  // tecla — se fosse <CelulaEditavel/>, a edição inline perderia o foco.
  const renderCelula = (l, campo, children) => {
    const editando = edit && edit.id === l.id && edit.campo === campo;
    if (editando) {
      if (campo === "categoria") {
        return (
          <select autoFocus className="pdx-inline" value={edit.valor}
            onChange={(e) => setEdit({ ...edit, valor: e.target.value })}
            onBlur={() => salvarInline(l)}
            onKeyDown={(e) => { if (e.key === "Enter") salvarInline(l); if (e.key === "Escape") setEdit(null); }}>
            {(l.tipo === "receita" ? categories.receita : categories.gasto).map((c) => <option key={c} value={c}>{normalizeText(c)}</option>)}
          </select>
        );
      }
      return (
        <input autoFocus className="pdx-inline"
          type={campo === "data_lancamento" ? "date" : campo === "valor" ? "text" : "text"}
          value={edit.valor}
          onChange={(e) => setEdit({ ...edit, valor: e.target.value })}
          onBlur={() => salvarInline(l)}
          onKeyDown={(e) => { if (e.key === "Enter") salvarInline(l); if (e.key === "Escape") setEdit(null); }} />
      );
    }
    const editavel = ehAvulso(l);
    return (
      <span
        className={editavel ? "pdx-cell-edit" : undefined}
        title={editavel ? "Clique para editar" : undefined}
        onClick={editavel ? () => setEdit({ id: l.id, campo, valor: campo === "valor" ? String(l.valor) : (l[campo] || "") }) : undefined}
      >
        {children}
      </span>
    );
  };

  return (
    <div>
      <style>{CSS}</style>
      <div className="pdx-tbl-wrap">
        <div className="pdx-tbl-tools">
          <div className="pdx-tbl-search">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={t.textSecondary} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            <input placeholder="Buscar descrição ou categoria…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <select className="pdx-tbl-select" value={fMes} onChange={(e) => setFMes(e.target.value)}>
            <option value="">Todos os meses</option>
            {meses.map((m) => { const [a, mm] = m.split("-"); return <option key={m} value={m}>{["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"][Number(mm) - 1]}/{a}</option>; })}
          </select>
          <select className="pdx-tbl-select" value={fCategoria} onChange={(e) => setFCategoria(e.target.value)}>
            <option value="">Todas as categorias</option>
            {todasCategorias.map((c) => <option key={c} value={c}>{normalizeText(c)}</option>)}
          </select>
          <select className="pdx-tbl-select" value={fCartao} onChange={(e) => setFCartao(e.target.value)}>
            <option value="">Todos os cartões</option>
            {cartoes.map((c) => <option key={c.id} value={String(c.id)}>{normalizeText(c.nome)}</option>)}
          </select>
        </div>

        {sel.size > 0 && (
          <div className="pdx-bulkbar">
            <b>{sel.size}</b> selecionado{sel.size > 1 ? "s" : ""}
            <button className="pdx-btn" onClick={() => { setRecatCat(todasCategorias[0] || ""); setBulk("recategorizar"); }}>Recategorizar</button>
            <button className="pdx-btn pdx-btn--danger" onClick={() => setBulk("excluir")}>Excluir</button>
            <button className="pdx-btn" onClick={() => setSel(new Set())} style={{ marginLeft: "auto" }}>Limpar seleção</button>
          </div>
        )}

        {erro && <div style={{ padding: "0.6rem 1rem", background: "#FEF2F2", color: t.gasto, fontSize: "0.83rem" }}>{erro}</div>}

        {linhas.length === 0 ? (
          <div className="pdx-tbl-empty">Nenhum lançamento com esses filtros.</div>
        ) : (
          <div style={{ maxHeight: "62vh", overflow: "auto" }}>
            <table className="pdx-tbl">
              <thead>
                <tr>
                  <th style={{ width: 36 }}><input type="checkbox" checked={todosVisiveisMarcados} onChange={toggleTodos} aria-label="Selecionar todos" /></th>
                  <th className="sortable" onClick={() => toggleSort("data_lancamento")}>Data{ordCampo === "data_lancamento" ? SETA(ordDir) : ""}</th>
                  <th className="sortable" onClick={() => toggleSort("descricao")}>Descrição{ordCampo === "descricao" ? SETA(ordDir) : ""}</th>
                  <th className="sortable" onClick={() => toggleSort("categoria")}>Categoria{ordCampo === "categoria" ? SETA(ordDir) : ""}</th>
                  <th>Cartão</th>
                  <th className="sortable" style={{ textAlign: "right" }} onClick={() => toggleSort("valor")}>Valor{ordCampo === "valor" ? SETA(ordDir) : ""}</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const parcela = l.parcela_grupo_id && l.total_parcelas;
                  const cor = l.tipo === "receita" ? t.receita : t.gasto;
                  const desc = limparDescricaoParcela(l.descricao || "");
                  return (
                    <tr key={l.id} className={sel.has(l.id) ? "is-selected" : undefined}>
                      <td><input type="checkbox" checked={sel.has(l.id)} onChange={() => toggleSel(l.id)} aria-label="Selecionar linha" /></td>
                      <td>{renderCelula(l, "data_lancamento", fmtData(l.data_lancamento))}</td>
                      <td style={{ maxWidth: 320 }}>{renderCelula(l, "descricao", <>{normalizeText(desc) || "—"}{l.recorrente && <small style={{ color: t.textSecondary }}> · recorrente</small>}</>)}</td>
                      <td>{renderCelula(l, "categoria", <span className="pdx-chip">{normalizeText(l.categoria) || "—"}</span>)}</td>
                      <td style={{ color: t.textSecondary }}>{cartaoNome(l.cartao_id) ? normalizeText(cartaoNome(l.cartao_id)) : (l.forma_pagamento || "—")}</td>
                      <td style={{ textAlign: "right" }}>
                        {renderCelula(l, "valor", (
                          <span className="pdx-val" style={{ color: cor }}>
                            {l.tipo === "receita" ? "+" : "-"}{formatBRL(l.valor).replace(new RegExp(String.fromCharCode(160), "g"), " ")}
                            {parcela ? <small> ({l.parcela_atual}/{l.total_parcelas})</small> : null}
                          </span>
                        ))}
                      </td>
                      <td>
                        <button className="pdx-iconbtn" title="Editar (modal)" onClick={() => onEdit(l)}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="pdx-tbl-foot">{linhas.length} lançamento{linhas.length !== 1 ? "s" : ""}{lancamentos.length !== linhas.length ? ` (de ${lancamentos.length})` : ""}</div>
      </div>

      {bulk && (
        <div className="pdx-modal-ov" onClick={() => !busy && setBulk(null)}>
          <div className="pdx-modal" onClick={(e) => e.stopPropagation()}>
            {bulk === "excluir" ? (
              <>
                <h3>Excluir {sel.size} lançamento{sel.size > 1 ? "s" : ""}?</h3>
                <p>Esta ação não pode ser desfeita. Parceladas selecionadas apagam a compra inteira (todas as parcelas do grupo).</p>
              </>
            ) : (
              <>
                <h3>Recategorizar {sel.size} lançamento{sel.size > 1 ? "s" : ""}</h3>
                <p>A nova categoria será aplicada a todos os selecionados (parceladas: todas as parcelas do grupo).</p>
                <select className="pdx-tbl-select" style={{ width: "100%" }} value={recatCat} onChange={(e) => setRecatCat(e.target.value)}>
                  {todasCategorias.map((c) => <option key={c} value={c}>{normalizeText(c)}</option>)}
                </select>
              </>
            )}
            <div className="pdx-modal-actions">
              <button className="pdx-btn" disabled={busy} onClick={() => setBulk(null)}>Cancelar</button>
              <button className={`pdx-btn ${bulk === "excluir" ? "pdx-btn--danger" : "pdx-btn--primary"}`} disabled={busy || (bulk === "recategorizar" && !recatCat)} onClick={confirmarBulk}>
                {busy ? "Processando…" : bulk === "excluir" ? "Excluir" : "Recategorizar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
