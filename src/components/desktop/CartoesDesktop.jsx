import { useMemo, useState } from "react";
import { desktopTheme as t } from "./theme";

// Tela "Cartões" do desktop (Fase A). Mesma tabela `cartoes` que o mobile já usa —
// nenhum schema novo. O gasto do mês vem dos lançamentos que o App.jsx já carregou.
// Toda escrita passa pelos handlers do App, que checam res.ok antes de refletir na UI.

const VAZIO = { nome: "", bandeira: "", dia_fechamento: "", dia_vencimento: "" };

const CSS = `
.pdx-crt { font-family: 'DM Sans', 'Helvetica Neue', sans-serif; display: flex; flex-direction: column; gap: 1rem; }
.pdx-crt__head { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.pdx-crt__sub { margin: 0; font-size: 0.85rem; color: ${t.textSecondary}; }
.pdx-crt__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; align-items: start; }
.pdx-crt__card { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1.15rem 1.25rem; min-width: 0; }
.pdx-crt__nome { margin: 0 0 0.2rem; font-size: 1rem; font-weight: 700; color: ${t.textPrimary}; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pdx-crt__meta { margin: 0; font-size: 0.78rem; color: ${t.textSecondary}; }
.pdx-crt__valor { margin: 0.9rem 0 0; font-size: 1.2rem; font-weight: 700; color: ${t.textPrimary}; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
.pdx-crt__valorlbl { margin: 0.15rem 0 0; font-size: 0.72rem; color: ${t.textSecondary}; text-transform: uppercase; letter-spacing: 0.07em; }
.pdx-crt__acoes { display: flex; gap: 0.5rem; margin-top: 1rem; padding-top: 0.9rem; border-top: 1px solid ${t.surfaceBorder}; }
.pdx-crt__empty { background: ${t.surface}; border: 1px dashed ${t.surfaceBorder}; border-radius: 12px; padding: 2.5rem 1.5rem; text-align: center; color: ${t.textSecondary}; font-size: 0.9rem; }
.pdx-crt__form { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1.25rem 1.35rem; }
.pdx-crt__formtitle { margin: 0 0 1rem; font-size: 0.75rem; font-weight: 600; color: ${t.textSecondary}; text-transform: uppercase; letter-spacing: 0.07em; }
.pdx-crt__campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.85rem; }
.pdx-crt__campo { display: flex; flex-direction: column; gap: 0.3rem; min-width: 0; }
.pdx-crt__campo label { font-size: 0.75rem; font-weight: 600; color: ${t.textSecondary}; }
.pdx-crt__campo input { width: 100%; box-sizing: border-box; padding: 0.6rem 0.75rem; border: 1px solid ${t.surfaceBorder}; border-radius: 8px; background: ${t.surface}; color: ${t.textPrimary}; font-family: inherit; font-size: 0.9rem; }
.pdx-crt__campo input:focus { outline: none; border-color: ${t.accent}; box-shadow: 0 0 0 3px ${t.chipBg}; }
.pdx-crt__erro { margin: 0.9rem 0 0; font-size: 0.82rem; color: ${t.gasto}; }
.pdx-crt__formacoes { display: flex; gap: 0.6rem; margin-top: 1.1rem; }
.pdx-btn { padding: 0.55rem 1.1rem; border-radius: 8px; font-family: inherit; font-size: 0.85rem; font-weight: 600; cursor: pointer; border: 1px solid ${t.surfaceBorder}; background: ${t.surface}; color: ${t.textSecondary}; white-space: nowrap; }
.pdx-btn:hover:not(:disabled) { background: ${t.mainBg}; color: ${t.textPrimary}; }
.pdx-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.pdx-btn--primary { background: ${t.accent}; border-color: ${t.accent}; color: #fff; }
.pdx-btn--primary:hover:not(:disabled) { background: ${t.accentHover}; color: #fff; }
.pdx-btn--danger { color: ${t.gasto}; }
.pdx-btn--danger:hover:not(:disabled) { background: #FEF2F2; color: ${t.gasto}; }
`;

const mesCorrente = () => {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
};

export default function CartoesDesktop({
  cartoes, lancamentos, formatBRL, normalizeText,
  onCriar, onAtualizar, onExcluir,
}) {
  const [form, setForm] = useState(VAZIO);
  const [editandoId, setEditandoId] = useState(null); // null = criando
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [confirmarId, setConfirmarId] = useState(null); // exclusão em 2 passos, sem window.confirm

  // Gasto do mês corrente por cartão — agregação client-side, nenhuma query nova.
  const gastoPorCartao = useMemo(() => {
    const mes = mesCorrente();
    const mapa = {};
    for (const l of lancamentos) {
      if (l.tipo !== "gasto" || !l.cartao_id) continue;
      if (!l.data_lancamento?.startsWith(mes)) continue;
      mapa[l.cartao_id] = (mapa[l.cartao_id] || 0) + Number(l.valor || 0);
    }
    return mapa;
  }, [lancamentos]);

  const abrirNovo = () => {
    setForm(VAZIO); setEditandoId(null); setErro(""); setAberto(true);
  };

  const abrirEdicao = (c) => {
    setForm({
      nome: c.nome || "",
      bandeira: c.bandeira || "",
      dia_fechamento: c.dia_fechamento != null ? String(c.dia_fechamento) : "",
      dia_vencimento: c.dia_vencimento != null ? String(c.dia_vencimento) : "",
    });
    setEditandoId(c.id); setErro(""); setAberto(true); setConfirmarId(null);
  };

  const fechar = () => { setAberto(false); setErro(""); setEditandoId(null); setForm(VAZIO); };

  const salvar = async () => {
    if (!form.nome.trim()) { setErro("Nome é obrigatório."); return; }
    setSalvando(true); setErro("");
    const res = editandoId ? await onAtualizar(editandoId, form) : await onCriar(form);
    setSalvando(false);
    if (!res?.ok) { setErro(res?.erro || "Não foi possível salvar."); return; }
    fechar();
  };

  const excluir = async (id) => {
    setErro("");
    const res = await onExcluir(id);
    setConfirmarId(null);
    if (!res?.ok) setErro(res?.erro || "Não foi possível excluir.");
    else if (editandoId === id) fechar();
  };

  return (
    <div className="pdx-crt">
      <style>{CSS}</style>

      <div className="pdx-crt__head">
        <p className="pdx-crt__sub">
          {cartoes.length === 0
            ? "Nenhum cartão cadastrado."
            : `${cartoes.length} ${cartoes.length === 1 ? "cartão cadastrado" : "cartões cadastrados"} · gasto do mês corrente`}
        </p>
        {!aberto && <button className="pdx-btn pdx-btn--primary" onClick={abrirNovo}>Novo cartão</button>}
      </div>

      {aberto && (
        <div className="pdx-crt__form">
          <p className="pdx-crt__formtitle">{editandoId ? "Editar cartão" : "Novo cartão"}</p>
          <div className="pdx-crt__campos">
            <div className="pdx-crt__campo">
              <label htmlFor="crt-nome">Nome</label>
              <input id="crt-nome" type="text" placeholder="Ex.: Nubank" value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
            </div>
            <div className="pdx-crt__campo">
              <label htmlFor="crt-bandeira">Bandeira</label>
              <input id="crt-bandeira" type="text" placeholder="Ex.: Visa" value={form.bandeira}
                onChange={(e) => setForm((f) => ({ ...f, bandeira: e.target.value }))} />
            </div>
            <div className="pdx-crt__campo">
              <label htmlFor="crt-fech">Dia do fechamento</label>
              <input id="crt-fech" type="number" min="1" max="31" placeholder="1 a 31" value={form.dia_fechamento}
                onChange={(e) => setForm((f) => ({ ...f, dia_fechamento: e.target.value }))} />
            </div>
            <div className="pdx-crt__campo">
              <label htmlFor="crt-venc">Dia do vencimento</label>
              <input id="crt-venc" type="number" min="1" max="31" placeholder="1 a 31" value={form.dia_vencimento}
                onChange={(e) => setForm((f) => ({ ...f, dia_vencimento: e.target.value }))} />
            </div>
          </div>
          {erro && <p className="pdx-crt__erro">{erro}</p>}
          <div className="pdx-crt__formacoes">
            <button className="pdx-btn pdx-btn--primary" onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : editandoId ? "Salvar alterações" : "Adicionar cartão"}
            </button>
            <button className="pdx-btn" onClick={fechar} disabled={salvando}>Cancelar</button>
          </div>
        </div>
      )}

      {!aberto && erro && <p className="pdx-crt__erro">{erro}</p>}

      {cartoes.length === 0 ? (
        !aberto && <div className="pdx-crt__empty">Cadastre um cartão para acompanhar compras e faturas por cartão.</div>
      ) : (
        <div className="pdx-crt__grid">
          {cartoes.map((c) => {
            const meta = [
              normalizeText(c.bandeira) || null,
              c.dia_fechamento ? `Fecha dia ${c.dia_fechamento}` : null,
              c.dia_vencimento ? `Vence dia ${c.dia_vencimento}` : null,
            ].filter(Boolean).join(" · ");
            return (
              <div className="pdx-crt__card" key={c.id}>
                <p className="pdx-crt__nome">{normalizeText(c.nome)}</p>
                <p className="pdx-crt__meta">{meta || "Sem bandeira ou datas informadas"}</p>
                <p className="pdx-crt__valor">{formatBRL(gastoPorCartao[c.id] || 0)}</p>
                <p className="pdx-crt__valorlbl">Gasto no mês</p>
                <div className="pdx-crt__acoes">
                  {confirmarId === c.id ? (
                    <>
                      <button className="pdx-btn pdx-btn--danger" onClick={() => excluir(c.id)}>Confirmar exclusão</button>
                      <button className="pdx-btn" onClick={() => setConfirmarId(null)}>Cancelar</button>
                    </>
                  ) : (
                    <>
                      <button className="pdx-btn" onClick={() => abrirEdicao(c)}>Editar</button>
                      <button className="pdx-btn pdx-btn--danger" onClick={() => { setErro(""); setConfirmarId(c.id); }}>Excluir</button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
