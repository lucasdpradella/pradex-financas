import { useState, useEffect } from "react";

const SUPABASE_URL = "https://sjvuhqqsjboncwpboclv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE";

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
};

const categories = {
  receita: ["Salário", "Freelance", "Investimentos", "Aluguel recebido", "Outros"],
  gasto: ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Assinaturas", "Outros"],
};

const formatBRL = (value) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const monthNames = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export default function PradexFinancas() {
  const [tipo, setTipo] = useState("gasto");
  const [form, setForm] = useState({ descricao: "", valor: "", categoria: "", date: new Date().toISOString().split("T")[0] });
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => { fetchLancamentos(); }, []);

  const fetchLancamentos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/lancamentos?order=id.desc`, { headers });
      const data = await res.json();
      setLancamentos(Array.isArray(data) ? data : []);
    } catch (e) {
      setErro("Erro ao carregar lançamentos.");
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.descricao || !form.valor || !form.categoria) {
      setErro("Preencha todos os campos.");
      return;
    }
    const valor = parseFloat(form.valor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) {
      setErro("Valor inválido.");
      return;
    }
    setSaving(true);
    setErro("");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/lancamentos`, {
        method: "POST",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify({ descricao: form.descricao, valor, tipo, categoria: form.categoria, date: form.date }),
      });
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        setLancamentos(prev => [data[0], ...prev]);
        setForm({ descricao: "", valor: "", categoria: "", date: new Date().toISOString().split("T")[0] });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        setErro("Erro ao salvar. Tente novamente.");
      }
    } catch (e) {
      setErro("Erro de conexão.");
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/lancamentos?id=eq.${id}`, { method: "DELETE", headers });
      setLancamentos(prev => prev.filter(l => l.id !== id));
    } catch (e) {}
  };

  const totalReceitas = lancamentos.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
  const totalGastos = lancamentos.filter(l => l.tipo === "gasto").reduce((s, l) => s + Number(l.valor), 0);
  const saldo = totalReceitas - totalGastos;

  const formatData = (d) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day} ${monthNames[parseInt(m)-1]}`;
  };

  const inputStyle = {
    width: "100%",
    background: "#0F1117",
    border: "1px solid #252832",
    borderRadius: "10px",
    padding: "0.75rem 1rem",
    color: "#E8E8E8",
    fontSize: "0.9rem",
    marginBottom: "0.75rem",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0F1117",
      color: "#E8E8E8",
      fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
      padding: "2rem 1.5rem",
      maxWidth: "480px",
      margin: "0 auto",
    }}>
      <div style={{ marginBottom: "2rem" }}>
        <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", color: "#555", textTransform: "uppercase", margin: "0 0 0.25rem" }}>
          Pradex Finanças
        </p>
        <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 600, color: "#F0F0F0", letterSpacing: "-0.03em" }}>
          {monthNames[new Date().getMonth()]} {new Date().getFullYear()}
        </h1>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "2rem" }}>
        {[
          { label: "Receitas", value: totalReceitas, color: "#22C55E" },
          { label: "Gastos", value: totalGastos, color: "#EF4444" },
          { label: "Saldo", value: saldo, color: saldo >= 0 ? "#22C55E" : "#EF4444" },
        ].map(card => (
          <div key={card.label} style={{ background: "#181B24", borderRadius: "12px", padding: "1rem 0.75rem", border: "1px solid #252832" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.65rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em" }}>{card.label}</p>
            <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: card.color }}>{formatBRL(card.value)}</p>
          </div>
        ))}
      </div>
      <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid #252832" }}>
        <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Novo lançamento</p>
        <div style={{ display: "flex", background: "#0F1117", borderRadius: "10px", padding: "4px", marginBottom: "1rem" }}>
          {["gasto", "receita"].map(t => (
            <button key={t} onClick={() => { setTipo(t); setForm(f => ({ ...f, categoria: "" })); }} style={{ flex: 1, padding: "0.5rem", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, background: tipo === t ? (t === "receita" ? "#22C55E" : "#EF4444") : "transparent", color: tipo === t ? "#fff" : "#555", transition: "all 0.2s" }}>
              {t === "receita" ? "↑ Receita" : "↓ Gasto"}
            </button>
          ))}
        </div>
        <input type="text" placeholder="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={inputStyle} />
        <input type="text" placeholder="Valor (R$)" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} style={inputStyle} />
        <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ ...inputStyle, color: form.categoria ? "#E8E8E8" : "#555", appearance: "none" }}>
          <option value="">Categoria</option>
          {categories[tipo].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inputStyle} />
        {erro && <p style={{ color: "#EF4444", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{erro}</p>}
        <button onClick={handleSubmit} disabled={saving} style={{ width: "100%", padding: "0.85rem", border: "none", borderRadius: "10px", background: success ? "#16A34A" : tipo === "receita" ? "#22C55E" : "#EF4444", color: "#fff", fontSize: "0.95rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, transition: "all 0.2s", fontFamily: "inherit" }}>
          {saving ? "Salvando..." : success ? "✓ Salvo!" : "Adicionar"}
        </button>
      </div>
      <div>
        <p style={{ margin: "0 0 1rem", fontSize: "0.7rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.15em" }}>Lançamentos {loading && "· carregando..."}</p>
        {!loading && lancamentos.length === 0 && <p style={{ color: "#444", fontSize: "0.9rem", textAlign: "center", padding: "2rem 0" }}>Nenhum lançamento ainda.</p>}
        {lancamentos.map(l => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", padding: "0.9rem 1rem", background: "#181B24", borderRadius: "12px", marginBottom: "0.5rem", border: "1px solid #252832", gap: "0.75rem" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0, background: l.tipo === "receita" ? "#22C55E18" : "#EF444418", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>
              {l.tipo === "receita" ? "↑" : "↓"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 500, color: "#E8E8E8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{l.descricao}</p>
              <p style={{ margin: 0, fontSize: "0.72rem", color: "#555" }}>{l.categoria} · {formatData(l.date)}</p>
            </div>
            <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: l.tipo === "receita" ? "#22C55E" : "#EF4444", flexShrink: 0 }}>
              {l.tipo === "receita" ? "+" : "-"}{formatBRL(l.valor)}
            </p>
            <button onClick={() => handleDelete(l.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem", flexShrink: 0 }}>×</button>
          </div>
        ))}
      </div>
    </div>
  );
}
