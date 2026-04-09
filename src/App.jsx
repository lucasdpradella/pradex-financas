import { useState, useEffect } from "react";

const SUPABASE_URL = "https://sjvuhqqsjboncwpboclv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE";

const api = (token) => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${token || SUPABASE_KEY}`,
});

const categories = {
  receita: ["Salário", "Freelance", "Investimentos", "Aluguel recebido", "Outros"],
  gasto: ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Assinaturas", "Outros"],
};

const COLORS = ["#6366F1","#22C55E","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];

const formatBRL = (value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthNames = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const today = new Date().toISOString().split("T")[0];

export default function PradexFinancas() {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [authErro, setAuthErro] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [tela, setTela] = useState("dashboard");
  const [tipo, setTipo] = useState("gasto");
  const [form, setForm] = useState({ descricao: "", valor: "", categoria: "", data_lancamento: today });
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [success, setSuccess] = useState(false);
  const [textoIA, setTextoIA] = useState("");
  const [processando, setProcessando] = useState(false);
  const [preview, setPreview] = useState([]);
  const [erroIA, setErroIA] = useState("");
  const [importado, setImportado] = useState(false);

  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: api(localStorage.getItem("sb_token")) });
      const data = await res.json();
      if (data.id) setSession({ user: data, token: localStorage.getItem("sb_token") });
    } catch (e) {}
    setLoadingAuth(false);
  };

  const handleAuth = async () => {
    setAuthLoading(true); setAuthErro("");
    const endpoint = authMode === "login" ? "token?grant_type=password" : "signup";
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
        body: JSON.stringify({ email, password: senha }),
      });
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem("sb_token", data.access_token);
        setSession({ user: data.user, token: data.access_token });
      } else {
        setAuthErro(authMode === "login" ? "Email ou senha incorretos." : "Erro ao criar conta.");
      }
    } catch (e) { setAuthErro("Erro de conexão."); }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("sb_token");
    setSession(null);
    setLancamentos([]);
  };

  useEffect(() => { if (session) fetchLancamentos(); }, [session]);

  const fetchLancamentos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?order=id.desc`, { headers: api(session?.token) });
      const data = await res.json();
      setLancamentos(Array.isArray(data) ? data : []);
    } catch (e) {}
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!form.descricao || !form.valor || !form.categoria) { setErro("Preencha todos os campos."); return; }
    const valor = parseFloat(form.valor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) { setErro("Valor inválido."); return; }
    setSaving(true); setErro("");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos`, {
        method: "POST",
        headers: { ...api(session?.token), "Prefer": "return=representation" },
        body: JSON.stringify({ descricao: form.descricao, valor, tipo, categoria: form.categoria, data_lancamento: form.data_lancamento, user_id: session.user.id }),
      });
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        setLancamentos(prev => [data[0], ...prev]);
        setForm({ descricao: "", valor: "", categoria: "", data_lancamento: today });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else { setErro("Erro ao salvar."); }
    } catch (e) { setErro("Erro de conexão."); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?id=eq.${id}`, { method: "DELETE", headers: api(session?.token) });
      setLancamentos(prev => prev.filter(l => l.id !== id));
    } catch (e) {}
  };

  const processarComIA = async () => {
    if (!textoIA.trim()) { setErroIA("Cole algum texto primeiro."); return; }
    setProcessando(true); setErroIA(""); setPreview([]);
    try {
      const prompt = "Você é um assistente financeiro brasileiro. Analise o texto abaixo e extraia TODOS os lançamentos financeiros mencionados.\n\nREGRAS:\n- Ignore palavras soltas como 'Cartão' ou 'Dinheiro' sem valor\n- Para contas a vencer, use a data de vencimento\n- Cash back é receita\n- Sem duplicatas óbvias\n- Use ano 2026 se não especificado\n\nRetorne APENAS um array JSON válido:\n[{\"descricao\":\"...\",\"valor\":0.00,\"tipo\":\"gasto\",\"categoria\":\"...\",\"data_lancamento\":\"YYYY-MM-DD\"}]\n\nCategorias gastos: Moradia, Alimentação, Transporte, Saúde, Lazer, Educação, Assinaturas, Outros\nCategorias receitas: Salário, Freelance, Investimentos, Aluguel recebido, Outros\n\nHoje: " + today + "\n\nTexto:\n" + textoIA;
      const res = await fetch("https://sjvuhqqsjboncwpboclv.supabase.co/functions/v1/claude-proxy", {
        method: "POST",
        headers: {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${session?.token}`,
},
        body: JSON.stringify({ prompt }),
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed) && parsed.length > 0) setPreview(parsed);
      else setErroIA("Não consegui identificar lançamentos.");
    } catch (e) { setErroIA("Erro ao processar."); }
    setProcessando(false);
  };

  const confirmarImportacao = async () => {
    setSaving(true);
    try {
      for (const l of preview) {
        await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos`, {
          method: "POST",
          headers: { ...api(session?.token), "Prefer": "return=representation" },
          body: JSON.stringify({ ...l, user_id: session.user.id }),
        });
      }
      await fetchLancamentos();
      setTextoIA(""); setPreview([]);
      setImportado(true);
      setTimeout(() => { setImportado(false); setTela("lancamentos"); }, 2000);
    } catch (e) { setErroIA("Erro ao salvar."); }
    setSaving(false);
  };

  // Dashboard calculations
  const gastos = lancamentos.filter(l => l.tipo === "gasto");
  const receitas = lancamentos.filter(l => l.tipo === "receita");
  const totalReceitas = receitas.reduce((s, l) => s + Number(l.valor), 0);
  const totalGastos = gastos.reduce((s, l) => s + Number(l.valor), 0);
  const saldo = totalReceitas - totalGastos;

  const gastosPorCategoria = categories.gasto.map(cat => ({
    cat,
    total: gastos.filter(l => l.categoria === cat).reduce((s, l) => s + Number(l.valor), 0)
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);

  const maxGasto = Math.max(...gastosPorCategoria.map(x => x.total), 1);

  const formatData = (d) => {
    if (!d) return "";
    const [y, m, day] = d.split("-");
    return `${day} ${monthNames[parseInt(m)-1]}`;
  };

  const inputStyle = {
    width: "100%", background: "#0F1117", border: "1px solid #252832",
    borderRadius: "10px", padding: "0.75rem 1rem", color: "#E8E8E8",
    fontSize: "0.9rem", marginBottom: "0.75rem", outline: "none",
    boxSizing: "border-box", fontFamily: "inherit",
  };

  if (loadingAuth) return (
    <div style={{ minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#555", fontFamily: "'DM Sans', sans-serif" }}>Carregando...</p>
    </div>
  );

  if (!session) return (
    <div style={{ minHeight: "100vh", background: "#0F1117", color: "#E8E8E8", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div style={{ width: "100%", maxWidth: "380px" }}>
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", color: "#555", textTransform: "uppercase", margin: "0 0 0.5rem" }}>Pradex</p>
          <h1 style={{ margin: 0, fontSize: "2rem", fontWeight: 600, color: "#F0F0F0", letterSpacing: "-0.03em" }}>Finanças</h1>
        </div>
        <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", border: "1px solid #252832" }}>
          <div style={{ display: "flex", background: "#0F1117", borderRadius: "10px", padding: "4px", marginBottom: "1.5rem" }}>
            {["login", "cadastro"].map(m => (
              <button key={m} onClick={() => { setAuthMode(m); setAuthErro(""); }} style={{
                flex: 1, padding: "0.5rem", border: "none", borderRadius: "8px", cursor: "pointer",
                fontSize: "0.85rem", fontWeight: 600,
                background: authMode === m ? "#252832" : "transparent",
                color: authMode === m ? "#F0F0F0" : "#555", transition: "all 0.2s", fontFamily: "inherit",
              }}>{m === "login" ? "Entrar" : "Criar conta"}</button>
            ))}
          </div>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} style={inputStyle} />
          {authErro && <p style={{ color: "#EF4444", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{authErro}</p>}
          <button onClick={handleAuth} disabled={authLoading} style={{
            width: "100%", padding: "0.85rem", border: "none", borderRadius: "10px",
            background: "#6366F1", color: "#fff", fontSize: "0.95rem", fontWeight: 700,
            cursor: authLoading ? "not-allowed" : "pointer", opacity: authLoading ? 0.7 : 1, fontFamily: "inherit",
          }}>{authLoading ? "Aguarde..." : authMode === "login" ? "Entrar" : "Criar conta"}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0F1117", color: "#E8E8E8", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", padding: "2rem 1.5rem", maxWidth: "480px", margin: "0 auto" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", color: "#555", textTransform: "uppercase", margin: "0 0 0.25rem" }}>Pradex Finanças</p>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 600, color: "#F0F0F0", letterSpacing: "-0.03em" }}>
            {monthNames[new Date().getMonth()]} {new Date().getFullYear()}
          </h1>
        </div>
        <button onClick={handleLogout} style={{ background: "none", border: "1px solid #252832", borderRadius: "8px", color: "#555", cursor: "pointer", padding: "0.4rem 0.75rem", fontSize: "0.75rem", fontFamily: "inherit" }}>Sair</button>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {[{ label: "Receitas", value: totalReceitas, color: "#22C55E" }, { label: "Gastos", value: totalGastos, color: "#EF4444" }, { label: "Saldo", value: saldo, color: saldo >= 0 ? "#22C55E" : "#EF4444" }].map(card => (
          <div key={card.label} style={{ background: "#181B24", borderRadius: "12px", padding: "1rem 0.75rem", border: "1px solid #252832" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.65rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em" }}>{card.label}</p>
            <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: card.color }}>{formatBRL(card.value)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: "#0F1117", borderRadius: "10px", padding: "4px", marginBottom: "1.5rem", border: "1px solid #252832", overflowX: "auto" }}>
        {[{ key: "dashboard", label: "📊 Dashboard" }, { key: "lancamentos", label: "Lançamentos" }, { key: "importar", label: "✨ IA" }].map(t => (
          <button key={t.key} onClick={() => { setTela(t.key); setErro(""); setErroIA(""); }} style={{
            flex: 1, padding: "0.5rem", border: "none", borderRadius: "8px", cursor: "pointer",
            fontSize: "0.78rem", fontWeight: 600, whiteSpace: "nowrap",
            background: tela === t.key ? "#252832" : "transparent",
            color: tela === t.key ? "#F0F0F0" : "#555", transition: "all 0.2s", fontFamily: "inherit",
          }}>{t.label}</button>
        ))}
      </div>

      {/* DASHBOARD */}
      {tela === "dashboard" && (
        <div>
          {lancamentos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 0", color: "#444" }}>
              <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📊</p>
              <p style={{ fontSize: "0.9rem" }}>Sem dados ainda. Adicione lançamentos para ver o dashboard.</p>
            </div>
          ) : (
            <>
              {/* Gastos por categoria */}
              <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832" }}>
                <p style={{ margin: "0 0 1.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Gastos por categoria</p>
                {gastosPorCategoria.length === 0 ? (
                  <p style={{ color: "#444", fontSize: "0.85rem" }}>Nenhum gasto registrado.</p>
                ) : gastosPorCategoria.map((item, i) => (
                  <div key={item.cat} style={{ marginBottom: "0.85rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                      <span style={{ fontSize: "0.82rem", color: "#CCC" }}>{item.cat}</span>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: COLORS[i % COLORS.length] }}>{formatBRL(item.total)}</span>
                    </div>
                    <div style={{ background: "#0F1117", borderRadius: "4px", height: "6px", overflow: "hidden" }}>
                      <div style={{ background: COLORS[i % COLORS.length], height: "100%", width: `${(item.total / maxGasto) * 100}%`, borderRadius: "4px", transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Últimos lançamentos */}
              <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", border: "1px solid #252832" }}>
                <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Últimos lançamentos</p>
                {lancamentos.slice(0, 5).map(l => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderBottom: "1px solid #252832" }}>
                    <div>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "#E8E8E8" }}>{l.descricao}</p>
                      <p style={{ margin: 0, fontSize: "0.7rem", color: "#555" }}>{l.categoria} · {formatData(l.data_lancamento)}</p>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: l.tipo === "receita" ? "#22C55E" : "#EF4444" }}>
                      {l.tipo === "receita" ? "+" : "-"}{formatBRL(l.valor)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* LANÇAMENTOS */}
      {tela === "lancamentos" && (
        <>
          <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid #252832" }}>
            <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Novo lançamento</p>
            <div style={{ display: "flex", background: "#0F1117", borderRadius: "10px", padding: "4px", marginBottom: "1rem" }}>
              {["gasto", "receita"].map(t => (
                <button key={t} onClick={() => { setTipo(t); setForm(f => ({ ...f, categoria: "" })); }} style={{
                  flex: 1, padding: "0.5rem", border: "none", borderRadius: "8px", cursor: "pointer",
                  fontSize: "0.85rem", fontWeight: 600,
                  background: tipo === t ? (t === "receita" ? "#22C55E" : "#EF4444") : "transparent",
                  color: tipo === t ? "#fff" : "#555", transition: "all 0.2s", fontFamily: "inherit",
                }}>{t === "receita" ? "↑ Receita" : "↓ Gasto"}</button>
              ))}
            </div>
            <input type="text" placeholder="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={inputStyle} />
            <input type="text" placeholder="Valor (R$)" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} style={inputStyle} />
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ ...inputStyle, color: form.categoria ? "#E8E8E8" : "#555", appearance: "none" }}>
              <option value="">Categoria</option>
              {categories[tipo].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={form.data_lancamento} onChange={e => setForm(f => ({ ...f, data_lancamento: e.target.value }))} style={inputStyle} />
            {erro && <p style={{ color: "#EF4444", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{erro}</p>}
            <button onClick={handleSubmit} disabled={saving} style={{
              width: "100%", padding: "0.85rem", border: "none", borderRadius: "10px",
              background: success ? "#16A34A" : tipo === "receita" ? "#22C55E" : "#EF4444",
              color: "#fff", fontSize: "0.95rem", fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              transition: "all 0.2s", fontFamily: "inherit",
            }}>{saving ? "Salvando..." : success ? "✓ Salvo!" : "Adicionar"}</button>
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
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "#555" }}>{l.categoria} · {formatData(l.data_lancamento)}</p>
                </div>
                <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: l.tipo === "receita" ? "#22C55E" : "#EF4444", flexShrink: 0 }}>
                  {l.tipo === "receita" ? "+" : "-"}{formatBRL(l.valor)}
                </p>
                <button onClick={() => handleDelete(l.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem", flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* IMPORTAR IA */}
      {tela === "importar" && (
        <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", border: "1px solid #252832" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Importar com IA</p>
          <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "#666", lineHeight: 1.5 }}>Cole seus gastos em texto livre — extrato, WhatsApp, bloco de notas.</p>
          <textarea placeholder="Cole aqui o texto com seus gastos..." value={textoIA} onChange={e => setTextoIA(e.target.value)} rows={6} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
          {erroIA && <p style={{ color: "#EF4444", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{erroIA}</p>}
          {preview.length === 0 && (
            <button onClick={processarComIA} disabled={processando} style={{ width: "100%", padding: "0.85rem", border: "none", borderRadius: "10px", background: "#6366F1", color: "#fff", fontSize: "0.95rem", fontWeight: 700, cursor: processando ? "not-allowed" : "pointer", opacity: processando ? 0.7 : 1, transition: "all 0.2s", fontFamily: "inherit" }}>
              {processando ? "✨ Processando..." : "✨ Processar com IA"}
            </button>
          )}
          {preview.length > 0 && (
            <>
              <p style={{ margin: "1rem 0 0.75rem", fontSize: "0.75rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                {preview.length} lançamento{preview.length > 1 ? "s" : ""} identificado{preview.length > 1 ? "s" : ""}
              </p>
              {preview.map((l, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", padding: "0.75rem 1rem", background: "#0F1117", borderRadius: "10px", marginBottom: "0.5rem", border: "1px solid #252832", gap: "0.75rem" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0, background: l.tipo === "receita" ? "#22C55E18" : "#EF444418", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>
                    {l.tipo === "receita" ? "↑" : "↓"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 500, color: "#E8E8E8" }}>{l.descricao}</p>
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "#555" }}>{l.categoria} · {formatData(l.data_lancamento)}</p>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: l.tipo === "receita" ? "#22C55E" : "#EF4444", flexShrink: 0 }}>
                    {l.tipo === "receita" ? "+" : "-"}{formatBRL(l.valor)}
                  </p>
                </div>
              ))}
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                <button onClick={() => { setPreview([]); setTextoIA(""); }} style={{ flex: 1, padding: "0.75rem", border: "1px solid #252832", borderRadius: "10px", background: "transparent", color: "#888", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                <button onClick={confirmarImportacao} disabled={saving} style={{ flex: 2, padding: "0.75rem", border: "none", borderRadius: "10px", background: importado ? "#16A34A" : "#22C55E", color: "#fff", fontSize: "0.9rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, fontFamily: "inherit" }}>
                  {saving ? "Salvando..." : importado ? "✓ Importado!" : `Confirmar ${preview.length} lançamento${preview.length > 1 ? "s" : ""}`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
