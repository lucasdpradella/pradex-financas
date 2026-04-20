import { useEffect, useState } from "react";
import { syncSupabaseSession } from "../../supabaseClient";

const SUPABASE_URL = "https://sjvuhqqsjboncwpboclv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE";

const sbApi = (token) => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${token || SUPABASE_KEY}`,
});

const TIPOS = ["Investimentos", "Previdência", "Outros"];

const CATEGORIAS = {
  "Investimentos": ["Renda Fixa", "Ações", "FIIs", "Internacional", "Cripto", "Multimercado", "Outros"],
  "Previdência": ["PGBL", "VGBL", "Outros"],
  "Outros": ["Outros"],
};

function formatBRL(v) {
  if (v === null || v === undefined || v === "") return "";
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseBRL(v) {
  if (!v) return 0;
  const n = String(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const p = parseFloat(n);
  return isNaN(p) ? 0 : p;
}

function Modal({ item, onClose, onSaved, userId, token }) {
  const [form, setForm] = useState({
    tipo: item?.tipo || "Investimentos",
    origem: item?.origem || "",
    instituicao: item?.instituicao || "",
    valor: item?.valor ? formatBRL(item.valor) : "",
    comentarios: item?.comentarios || "",
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  function set(field, value) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  async function handleSalvar() {
    setErro("");
    if (!form.instituicao.trim()) return setErro("Informe a instituição.");
    if (!form.valor) return setErro("Informe o valor.");

    setSaving(true);
    const hoje = new Date();
    const mesAno = `${String(hoje.getMonth() + 1).padStart(2, "0")}/${hoje.getFullYear()}`;

    const payload = {
      user_id: userId,
      mes_ano_referencia: item?.mes_ano_referencia || mesAno,
      tipo: form.tipo,
      origem: form.origem || null,
      instituicao: form.instituicao.trim(),
      valor: parseBRL(form.valor),
      comentarios: form.comentarios.trim() || null,
    };

    try {
      const url = item
        ? `${SUPABASE_URL}/rest/v1/fp_investimentos?id=eq.${item.id}`
        : `${SUPABASE_URL}/rest/v1/fp_investimentos`;
      const res = await fetch(url, {
        method: item ? "PATCH" : "POST",
        headers: { ...sbApi(token), Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data?.message || "Erro ao salvar."); setSaving(false); return; }
      onSaved();
    } catch (e) {
      setErro("Erro ao salvar. Tente novamente.");
    }
    setSaving(false);
  }

  const categoriasDisponiveis = CATEGORIAS[form.tipo] || CATEGORIAS["Outros"];

  return (
    <div style={st.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={st.modal}>
        <div style={st.modalHeader}>
          <span style={st.modalTitulo}>{item ? "Editar investimento" : "Novo investimento"}</span>
          <button style={st.btnFechar} onClick={onClose}>×</button>
        </div>

        <div style={st.modalBody}>
          <div style={st.campo}>
            <label style={st.label}>Tipo *</label>
            <select style={st.select} value={form.tipo} onChange={(e) => { set("tipo", e.target.value); set("origem", ""); }}>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div style={st.campo}>
            <label style={st.label}>Categoria</label>
            <select style={st.select} value={form.origem} onChange={(e) => set("origem", e.target.value)}>
              <option value="">Selecione...</option>
              {categoriasDisponiveis.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div style={st.campo}>
            <label style={st.label}>Instituição *</label>
            <input
              style={st.input}
              value={form.instituicao}
              onChange={(e) => set("instituicao", e.target.value)}
              placeholder="Ex: XP, Nubank, Itaú..."
            />
          </div>

          <div style={st.campo}>
            <label style={st.label}>Valor total investido (R$) *</label>
            <input
              style={st.input}
              value={form.valor}
              onChange={(e) => set("valor", e.target.value)}
              onBlur={() => { const n = parseBRL(form.valor); if (n > 0) set("valor", formatBRL(n)); }}
              placeholder="R$ 0,00"
            />
          </div>

          <div style={st.campo}>
            <label style={st.label}>Observações</label>
            <textarea
              style={{ ...st.input, minHeight: 72, resize: "vertical" }}
              value={form.comentarios}
              onChange={(e) => set("comentarios", e.target.value)}
              placeholder="Anotações opcionais"
            />
          </div>

          {erro && <div style={st.erro}>{erro}</div>}
        </div>

        <div style={st.modalFooter}>
          <button style={st.btnCancelar} onClick={onClose}>Cancelar</button>
          <button
            style={{ ...st.btnPrimario, opacity: saving ? 0.7 : 1, cursor: saving ? "not-allowed" : "pointer" }}
            onClick={handleSalvar}
            disabled={saving}
          >
            {saving ? "Salvando..." : item ? "Salvar" : "Adicionar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InvestimentosFP({ session }) {
  const userId = session?.user?.id;
  const token = session?.token;

  const [investimentos, setInvestimentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  useEffect(() => {
    const init = async () => {
      if (!session?.token) return;
      await syncSupabaseSession(session.token);
      await carregar();
    };
    init();
  }, [session?.token]);

  async function carregar() {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/fp_investimentos?user_id=eq.${userId}&order=tipo.asc,instituicao.asc`,
        { headers: sbApi(token) }
      );
      const data = await res.json();
      setInvestimentos(Array.isArray(data) ? data : []);
    } catch (e) {}
    setLoading(false);
  }

  async function handleDelete(id) {
    if (!window.confirm("Remover este investimento?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/fp_investimentos?id=eq.${id}`, {
      method: "DELETE",
      headers: sbApi(token),
    });
    carregar();
  }

  const totalGeral = investimentos.reduce((s, i) => s + Number(i.valor || 0), 0);

  const porTipo = TIPOS.map((tipo) => {
    const itens = investimentos.filter((i) => i.tipo === tipo);
    const total = itens.reduce((s, i) => s + Number(i.valor || 0), 0);
    return { tipo, itens, total };
  }).filter((g) => g.itens.length > 0);

  if (loading) return <div style={st.loading}>Carregando...</div>;

  return (
    <div style={st.container}>
      {/* Resumo */}
      <div style={st.resumoRow}>
        <div style={st.resumoCard}>
          <div style={st.resumoLabel}>Total investido</div>
          <div style={{ ...st.resumoValor, color: "#6366f1" }}>{formatBRL(totalGeral)}</div>
        </div>
        {TIPOS.map((tipo) => {
          const total = investimentos.filter((i) => i.tipo === tipo).reduce((s, i) => s + Number(i.valor || 0), 0);
          const pct = totalGeral > 0 ? ((total / totalGeral) * 100).toFixed(1) : "0.0";
          if (total === 0) return null;
          return (
            <div key={tipo} style={st.resumoCard}>
              <div style={st.resumoLabel}>{tipo}</div>
              <div style={{ ...st.resumoValor, color: "#e8e8f0" }}>{formatBRL(total)}</div>
              <div style={st.resumoPct}>{pct}% do total</div>
            </div>
          );
        })}
      </div>

      <div style={st.sectionHeader}>
        <div />
        <button style={st.btnPrimario} onClick={() => setModal({ item: null })}>
          + Novo investimento
        </button>
      </div>

      {investimentos.length === 0 ? (
        <div style={st.vazio}>Nenhum investimento cadastrado ainda.</div>
      ) : (
        porTipo.map(({ tipo, itens, total }) => (
          <div key={tipo} style={st.grupo}>
            <div style={st.grupoHeader}>
              <span style={st.grupoTitulo}>{tipo}</span>
              <span style={st.grupoTotal}>{formatBRL(total)}</span>
            </div>
            {itens.map((inv) => (
              <div key={inv.id} style={st.card}>
                <div style={st.cardLeft}>
                  <div style={st.cardTitulo}>{inv.instituicao}</div>
                  <div style={st.cardSub}>
                    {inv.origem || tipo}
                    {inv.comentarios ? ` · ${inv.comentarios}` : ""}
                  </div>
                </div>
                <div style={st.cardRight}>
                  <div style={st.cardValor}>{formatBRL(inv.valor)}</div>
                  <div style={st.cardAcoes}>
                    <button style={st.btnAcao} onClick={() => setModal({ item: inv })}>✏️</button>
                    <button style={st.btnAcao} onClick={() => handleDelete(inv.id)}>🗑️</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {modal && (
        <Modal
          item={modal.item}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); carregar(); }}
          userId={userId}
          token={token}
        />
      )}
    </div>
  );
}

const st = {
  container: { padding: "24px", maxWidth: 820, margin: "0 auto" },
  loading: { padding: 40, textAlign: "center", color: "#888" },
  vazio: { textAlign: "center", padding: "40px 0", color: "#555", fontSize: 14, background: "var(--surface, #1a1d27)", borderRadius: 10, border: "1px dashed var(--border, #2e3248)" },
  resumoRow: { display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" },
  resumoCard: { flex: 1, minWidth: 160, background: "var(--surface, #1a1d27)", border: "1px solid var(--border, #2e3248)", borderRadius: 10, padding: "16px 20px" },
  resumoLabel: { fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 },
  resumoValor: { fontSize: 22, fontWeight: 700 },
  resumoPct: { fontSize: 11, color: "#555", marginTop: 4 },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  grupo: { marginBottom: 24 },
  grupoHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, padding: "0 4px" },
  grupoTitulo: { fontSize: 13, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: ".06em" },
  grupoTotal: { fontSize: 14, fontWeight: 700, color: "#e8e8f0" },
  card: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface, #1a1d27)", border: "1px solid var(--border, #2e3248)", borderRadius: 10, padding: "14px 18px", marginBottom: 8 },
  cardLeft: { flex: 1 },
  cardTitulo: { fontWeight: 600, fontSize: 14, color: "#e8e8f0", marginBottom: 3 },
  cardSub: { fontSize: 12, color: "#666" },
  cardRight: { textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 },
  cardValor: { fontWeight: 700, fontSize: 16, color: "#6366f1" },
  cardAcoes: { display: "flex", gap: 6 },
  btnAcao: { background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 4px", borderRadius: 4 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "var(--surface, #1a1d27)", border: "1px solid var(--border, #2e3248)", borderRadius: 14, width: "100%", maxWidth: 480, maxHeight: "90vh", display: "flex", flexDirection: "column" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: "1px solid var(--border, #2e3248)" },
  modalTitulo: { fontSize: 16, fontWeight: 700, color: "#e8e8f0" },
  btnFechar: { background: "none", border: "none", color: "#666", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 },
  modalBody: { padding: "20px 24px", overflowY: "auto", flex: 1 },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--border, #2e3248)" },
  campo: { marginBottom: 16 },
  label: { display: "block", fontSize: 11, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 },
  input: { width: "100%", background: "#0f1117", border: "1px solid var(--border, #2e3248)", borderRadius: 8, padding: "9px 12px", color: "#e8e8f0", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  select: { width: "100%", background: "#0f1117", border: "1px solid var(--border, #2e3248)", borderRadius: 8, padding: "9px 12px", color: "#e8e8f0", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  erro: { background: "rgba(239,68,68,.1)", color: "#ef4444", borderRadius: 6, padding: "8px 12px", fontSize: 13, marginTop: 8 },
  btnPrimario: { background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
  btnCancelar: { background: "none", border: "none", color: "#666", fontSize: 13, cursor: "pointer", padding: "9px 16px", fontFamily: "inherit" },
};
