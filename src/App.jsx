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
const formasPagamento = ["Débito", "Crédito", "Dinheiro", "PIX", "Outros"];

// Gera um UUID simples para grupo de parcelas
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export default function PradexFinancas() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [authErro, setAuthErro] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tela, setTela] = useState("dashboard");
  const [tipo, setTipo] = useState("gasto");
  const [form, setForm] = useState({ descricao: "", valor: "", categoria: "", data_lancamento: today, forma_pagamento: "", cartao_id: "", parcelado: false, total_parcelas: "", recorrente: false });
  const [lancamentos, setLancamentos] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [success, setSuccess] = useState(false);
  const [textoIA, setTextoIA] = useState("");
  const [processando, setProcessando] = useState(false);
  const [preview, setPreview] = useState([]);
  const [erroIA, setErroIA] = useState("");
  const [importado, setImportado] = useState(false);
  const [formCartao, setFormCartao] = useState({ nome: "", bandeira: "", dia_fechamento: "", dia_vencimento: "" });
  const [savingCartao, setSavingCartao] = useState(false);
  const [erroCartao, setErroCartao] = useState("");
  const [successCartao, setSuccessCartao] = useState(false);
  const [editando, setEditando] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: api(localStorage.getItem("sb_token")) });
      const data = await res.json();
      if (data.id) {
        const token = localStorage.getItem("sb_token");
        setSession({ user: data, token });
        fetchUserRole(data.id, token);
      }
    } catch (e) {}
    setLoadingAuth(false);
  };

  const fetchUserRole = async (userId, token) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}&select=role`, { headers: api(token) });
      const data = await res.json();
      if (Array.isArray(data) && data[0]) setUserRole(data[0].role);
    } catch (e) {}
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
        fetchUserRole(data.user.id, data.access_token);
      } else {
        setAuthErro(authMode === "login" ? "Email ou senha incorretos." : "Erro ao criar conta.");
      }
    } catch (e) { setAuthErro("Erro de conexão."); }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem("sb_token");
    setSession(null);
    setUserRole(null);
    setLancamentos([]);
    setCartoes([]);
  };

  useEffect(() => { if (session) { fetchLancamentos(); fetchCartoes(); } }, [session]);

  const fetchLancamentos = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?order=id.desc`, { headers: api(session?.token) });
      const data = await res.json();
      setLancamentos(Array.isArray(data) ? data : []);
    } catch (e) {}
    setLoading(false);
  };

  const fetchCartoes = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cartoes?order=id.asc`, { headers: api(session?.token) });
      const data = await res.json();
      setCartoes(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const handleSubmit = async () => {
    if (!form.descricao || !form.valor || !form.categoria) { setErro("Preencha todos os campos."); return; }
    const valor = parseFloat(form.valor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) { setErro("Valor inválido."); return; }

    // Validação de parcelas
    if (form.parcelado && form.forma_pagamento === "Crédito") {
      const nParcelas = parseInt(form.total_parcelas);
      if (!nParcelas || nParcelas < 2) { setErro("Informe o número de parcelas (mínimo 2)."); return; }
    }

    setSaving(true); setErro("");
    try {
      // Se parcelado no crédito, cria múltiplos lançamentos
      if (form.parcelado && form.forma_pagamento === "Crédito" && parseInt(form.total_parcelas) >= 2) {
        const nParcelas = parseInt(form.total_parcelas);
        const valorParcela = valor / nParcelas;
        const grupoId = generateUUID();
        const dataBase = new Date(form.data_lancamento + "T12:00:00");

        for (let i = 0; i < nParcelas; i++) {
          const dataParcela = new Date(dataBase);
          dataParcela.setMonth(dataParcela.getMonth() + i);
          const dataStr = dataParcela.toISOString().split("T")[0];

          const body = {
            descricao: `${form.descricao} (${i + 1}/${nParcelas})`,
            valor: Math.round(valorParcela * 100) / 100,
            tipo,
            categoria: form.categoria,
            data_lancamento: dataStr,
            user_id: session.user.id,
            forma_pagamento: "Crédito",
            cartao_id: form.cartao_id ? parseInt(form.cartao_id) : null,
            parcela_atual: i + 1,
            total_parcelas: nParcelas,
            parcela_grupo_id: grupoId,
            poderia_ter_evitado: false,
          };
          await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos`, {
            method: "POST",
            headers: { ...api(session?.token), "Prefer": "return=representation" },
            body: JSON.stringify(body),
          });
        }
        await fetchLancamentos();
        setForm({ descricao: "", valor: "", categoria: "", data_lancamento: today, forma_pagamento: "", cartao_id: "", parcelado: false, total_parcelas: "" });
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2000);
      } else {
        // Lançamento normal
        const body = {
          descricao: form.descricao, valor, tipo, categoria: form.categoria,
          data_lancamento: form.data_lancamento, user_id: session.user.id,
          forma_pagamento: form.forma_pagamento || null,
          cartao_id: form.forma_pagamento === "Crédito" && form.cartao_id ? parseInt(form.cartao_id) : null,
          poderia_ter_evitado: false,
          recorrente: form.recorrente || false,
        };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos`, {
          method: "POST",
          headers: { ...api(session?.token), "Prefer": "return=representation" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (Array.isArray(data) && data[0]) {
          setLancamentos(prev => [data[0], ...prev]);
          setForm({ descricao: "", valor: "", categoria: "", data_lancamento: today, forma_pagamento: "", cartao_id: "", parcelado: false, total_parcelas: "", recorrente: false });
          setSuccess(true);
          setTimeout(() => setSuccess(false), 2000);
        } else { setErro("Erro ao salvar."); }
      }
    } catch (e) { setErro("Erro de conexão."); }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?id=eq.${id}`, { method: "DELETE", headers: api(session?.token) });
      setLancamentos(prev => prev.filter(l => l.id !== id));
    } catch (e) {}
  };

  const handleEdit = (l) => {
    setEditando({
      id: l.id,
      descricao: l.descricao || "",
      valor: String(l.valor),
      tipo: l.tipo || "gasto",
      categoria: l.categoria || "",
      data_lancamento: l.data_lancamento || today,
      forma_pagamento: l.forma_pagamento || "",
      cartao_id: l.cartao_id ? String(l.cartao_id) : "",
      poderia_ter_evitado: l.poderia_ter_evitado || false,
      recorrente: l.recorrente || false,
    });
  };

  const handleSaveEdit = async () => {
    if (!editando.descricao || !editando.valor || !editando.categoria) return;
    const valor = parseFloat(String(editando.valor).replace(",", "."));
    if (isNaN(valor) || valor <= 0) return;
    setSavingEdit(true);
    try {
      const body = {
        descricao: editando.descricao, valor, tipo: editando.tipo,
        categoria: editando.categoria, data_lancamento: editando.data_lancamento,
        forma_pagamento: editando.forma_pagamento || null,
        cartao_id: editando.forma_pagamento === "Crédito" && editando.cartao_id ? parseInt(editando.cartao_id) : null,
        poderia_ter_evitado: editando.poderia_ter_evitado,
        recorrente: editando.recorrente || false,
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?id=eq.${editando.id}`, {
        method: "PATCH",
        headers: { ...api(session?.token), "Prefer": "return=representation" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        setLancamentos(prev => prev.map(l => l.id === editando.id ? data[0] : l));
        setEditando(null);
      }
    } catch (e) {}
    setSavingEdit(false);
  };

  // Toggle botão do arrependimento direto na lista
  const handleToggleArrependimento = async (e, lancamento) => {
    e.stopPropagation();
    const novoValor = !lancamento.poderia_ter_evitado;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?id=eq.${lancamento.id}`, {
        method: "PATCH",
        headers: { ...api(session?.token), "Prefer": "return=representation" },
        body: JSON.stringify({ poderia_ter_evitado: novoValor }),
      });
      setLancamentos(prev => prev.map(l => l.id === lancamento.id ? { ...l, poderia_ter_evitado: novoValor } : l));
    } catch (e) {}
  };

  const handleSaveCartao = async () => {
    if (!formCartao.nome) { setErroCartao("Nome é obrigatório."); return; }
    setSavingCartao(true); setErroCartao("");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cartoes`, {
        method: "POST",
        headers: { ...api(session?.token), "Prefer": "return=representation" },
        body: JSON.stringify({
          ...formCartao, user_id: session.user.id,
          dia_fechamento: formCartao.dia_fechamento ? parseInt(formCartao.dia_fechamento) : null,
          dia_vencimento: formCartao.dia_vencimento ? parseInt(formCartao.dia_vencimento) : null,
        }),
      });
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        setCartoes(prev => [...prev, data[0]]);
        setFormCartao({ nome: "", bandeira: "", dia_fechamento: "", dia_vencimento: "" });
        setSuccessCartao(true);
        setTimeout(() => setSuccessCartao(false), 2000);
      } else { setErroCartao("Erro ao salvar."); }
    } catch (e) { setErroCartao("Erro de conexão."); }
    setSavingCartao(false);
  };

  const handleDeleteCartao = async (id) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/cartoes?id=eq.${id}`, { method: "DELETE", headers: api(session?.token) });
      setCartoes(prev => prev.filter(c => c.id !== id));
    } catch (e) {}
  };

  const processarComIA = async () => {
    if (!textoIA.trim()) { setErroIA("Cole algum texto primeiro."); return; }
    setProcessando(true); setErroIA(""); setPreview([]);
    try {
      const cartoesInfo = cartoes.length > 0
        ? "\n\nCartões cadastrados:\n" + cartoes.map(c => "- ID " + c.id + ": " + c.nome + (c.bandeira ? " (" + c.bandeira + ")" : "")).join("\n")
        : "";
      const prompt = "Você é um assistente financeiro brasileiro. Analise o texto abaixo e extraia TODOS os lançamentos financeiros mencionados.\n\nREGRAS:\n- Ignore palavras soltas como Cartão ou Dinheiro sem valor\n- Para contas a vencer, use a data de vencimento\n- Cash back é receita\n- Sem duplicatas óbvias\n- Use ano 2026 se não especificado\n- Identifique a forma de pagamento: Débito, Crédito, Dinheiro, PIX ou Outros\n- Se for Crédito e mencionar um cartão, vincule ao cartão cadastrado usando o ID correto\n- Se não conseguir identificar o cartão, deixe cartao_id como null\n\nRetorne APENAS um array JSON válido:\n[{\"descricao\":\"...\",\"valor\":0.00,\"tipo\":\"gasto\",\"categoria\":\"...\",\"data_lancamento\":\"YYYY-MM-DD\",\"forma_pagamento\":\"...\",\"cartao_id\":null,\"poderia_ter_evitado\":false}]\n\nCategorias gastos: Moradia, Alimentação, Transporte, Saúde, Lazer, Educação, Assinaturas, Outros\nCategorias receitas: Salário, Freelance, Investimentos, Aluguel recebido, Outros" + cartoesInfo + "\n\nHoje: " + today + "\n\nTexto:\n" + textoIA;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/claude-proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_KEY },
        body: JSON.stringify({ prompt }),
      });
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
          body: JSON.stringify({ ...l, user_id: session.user.id, poderia_ter_evitado: false }),
        });
      }
      await fetchLancamentos();
      setTextoIA(""); setPreview([]);
      setImportado(true);
      setTimeout(() => { setImportado(false); setTela("dashboard"); }, 2000);
    } catch (e) { setErroIA("Erro ao salvar."); }
    setSaving(false);
  };

  const gastos = lancamentos.filter(l => l.tipo === "gasto");
  const receitas = lancamentos.filter(l => l.tipo === "receita");
  const totalReceitas = receitas.reduce((s, l) => s + Number(l.valor), 0);
  const totalGastos = gastos.reduce((s, l) => s + Number(l.valor), 0);
  const saldo = totalReceitas - totalGastos;

  // Cálculo do botão do arrependimento
  const taxaMensal = 0.009; // 0.9% ao mês
  const gastosEvitaveis = lancamentos.filter(l => l.poderia_ter_evitado && l.tipo === "gasto");
  const totalEvitavel = gastosEvitaveis.reduce((s, l) => s + Number(l.valor), 0);

  const calcularImpacto12m = (l) => {
    const valor = Number(l.valor);
    if (l.total_parcelas) {
      // Parcelado: soma parcelas restantes + rendimento
      const parcelasRestantes = l.total_parcelas - (l.parcela_atual || 1) + 1;
      const totalRestante = valor * parcelasRestantes;
      return totalRestante * Math.pow(1 + taxaMensal, 12);
    } else if (l.recorrente) {
      // Recorrente: 12 meses de aportes + rendimento composto
      let acumulado = 0;
      for (let i = 1; i <= 12; i++) {
        acumulado += valor * Math.pow(1 + taxaMensal, i);
      }
      return acumulado;
    } else {
      // Único: valor investido por 12 meses
      return valor * Math.pow(1 + taxaMensal, 12);
    }
  };

  const totalImpacto12m = gastosEvitaveis.reduce((s, l) => s + calcularImpacto12m(l), 0);

  const gastosPorCategoria = categories.gasto.map(cat => ({
    cat, total: gastos.filter(l => l.categoria === cat).reduce((s, l) => s + Number(l.valor), 0)
  })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
  const maxGasto = Math.max(...gastosPorCategoria.map(x => x.total), 1);

  const gastosPorCartao = cartoes.map(c => ({
    cartao: c,
    total: lancamentos.filter(l => l.cartao_id === c.id).reduce((s, l) => s + Number(l.valor), 0)
  })).filter(x => x.total > 0);

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

      {/* MODAL DE EDIÇÃO */}
      {editando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#181B24", borderRadius: "16px 16px 0 0", padding: "1.5rem", width: "100%", maxWidth: "480px", border: "1px solid #252832", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Editar lançamento</p>
              <button onClick={() => setEditando(null)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
            </div>
            <div style={{ display: "flex", background: "#0F1117", borderRadius: "10px", padding: "4px", marginBottom: "1rem" }}>
              {["gasto", "receita"].map(t => (
                <button key={t} onClick={() => setEditando(e => ({ ...e, tipo: t, categoria: "" }))} style={{
                  flex: 1, padding: "0.5rem", border: "none", borderRadius: "8px", cursor: "pointer",
                  fontSize: "0.85rem", fontWeight: 600,
                  background: editando.tipo === t ? (t === "receita" ? "#22C55E" : "#EF4444") : "transparent",
                  color: editando.tipo === t ? "#fff" : "#555", transition: "all 0.2s", fontFamily: "inherit",
                }}>{t === "receita" ? "↑ Receita" : "↓ Gasto"}</button>
              ))}
            </div>
            <input type="text" placeholder="Descrição" value={editando.descricao} onChange={e => setEditando(ed => ({ ...ed, descricao: e.target.value }))} style={inputStyle} />
            <input type="text" placeholder="Valor (R$)" value={editando.valor} onChange={e => setEditando(ed => ({ ...ed, valor: e.target.value }))} style={inputStyle} />
            <select value={editando.categoria} onChange={e => setEditando(ed => ({ ...ed, categoria: e.target.value }))} style={{ ...inputStyle, color: editando.categoria ? "#E8E8E8" : "#555", appearance: "none" }}>
              <option value="">Categoria</option>
              {categories[editando.tipo].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={editando.forma_pagamento} onChange={e => setEditando(ed => ({ ...ed, forma_pagamento: e.target.value, cartao_id: "" }))} style={{ ...inputStyle, color: editando.forma_pagamento ? "#E8E8E8" : "#555", appearance: "none" }}>
              <option value="">Forma de pagamento</option>
              {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {editando.forma_pagamento === "Crédito" && cartoes.length > 0 && (
              <select value={editando.cartao_id} onChange={e => setEditando(ed => ({ ...ed, cartao_id: e.target.value }))} style={{ ...inputStyle, color: editando.cartao_id ? "#E8E8E8" : "#555", appearance: "none" }}>
                <option value="">Selecione o cartão</option>
                {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
            <input type="date" value={editando.data_lancamento} onChange={e => setEditando(ed => ({ ...ed, data_lancamento: e.target.value }))} style={inputStyle} />

            {/* Toggle recorrente no modal de edição */}
            {editando.tipo === "gasto" && (
              <button
                onClick={() => setEditando(ed => ({ ...ed, recorrente: !ed.recorrente }))}
                style={{
                  width: "100%", padding: "0.75rem", border: `1px solid ${editando.recorrente ? "#6366F1" : "#252832"}`,
                  borderRadius: "10px", background: editando.recorrente ? "#6366F118" : "transparent",
                  color: editando.recorrente ? "#6366F1" : "#555",
                  fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  marginBottom: "0.75rem", transition: "all 0.2s",
                }}
              >
                {editando.recorrente ? "🔁 Gasto recorrente (mensal)" : "🔁 Marcar como recorrente"}
              </button>
            )}

            {/* Botão do Arrependimento no modal de edição */}
            {editando.tipo === "gasto" && (
              <button
                onClick={() => setEditando(ed => ({ ...ed, poderia_ter_evitado: !ed.poderia_ter_evitado }))}
                style={{
                  width: "100%", padding: "0.75rem", border: `1px solid ${editando.poderia_ter_evitado ? "#F59E0B" : "#252832"}`,
                  borderRadius: "10px", background: editando.poderia_ter_evitado ? "#F59E0B18" : "transparent",
                  color: editando.poderia_ter_evitado ? "#F59E0B" : "#555",
                  fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                  marginBottom: "0.75rem", transition: "all 0.2s",
                }}
              >
                {editando.poderia_ter_evitado ? "😬 Marcado como evitável" : "😬 Poderia ter evitado?"}
              </button>
            )}

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={() => setEditando(null)} style={{ flex: 1, padding: "0.75rem", border: "1px solid #252832", borderRadius: "10px", background: "transparent", color: "#888", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} style={{ flex: 2, padding: "0.75rem", border: "none", borderRadius: "10px", background: "#6366F1", color: "#fff", fontSize: "0.9rem", fontWeight: 700, cursor: savingEdit ? "not-allowed" : "pointer", opacity: savingEdit ? 0.7 : 1, fontFamily: "inherit" }}>
                {savingEdit ? "Salvando..." : "Salvar alterações"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", color: "#555", textTransform: "uppercase", margin: "0 0 0.25rem" }}>
            Pradex Finanças {userRole === "super_admin" ? "· 👑 Admin" : userRole === "assessor" ? "· 👔 Assessor" : ""}
          </p>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 600, color: "#F0F0F0", letterSpacing: "-0.03em" }}>
            {monthNames[new Date().getMonth()]} {new Date().getFullYear()}
          </h1>
        </div>
        <button onClick={handleLogout} style={{ background: "none", border: "1px solid #252832", borderRadius: "8px", color: "#555", cursor: "pointer", padding: "0.4rem 0.75rem", fontSize: "0.75rem", fontFamily: "inherit" }}>Sair</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {[{ label: "Receitas", value: totalReceitas, color: "#22C55E" }, { label: "Gastos", value: totalGastos, color: "#EF4444" }, { label: "Saldo", value: saldo, color: saldo >= 0 ? "#22C55E" : "#EF4444" }].map(card => (
          <div key={card.label} style={{ background: "#181B24", borderRadius: "12px", padding: "1rem 0.75rem", border: "1px solid #252832" }}>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.65rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em" }}>{card.label}</p>
            <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: card.color }}>{formatBRL(card.value)}</p>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", background: "#0F1117", borderRadius: "10px", padding: "4px", marginBottom: "1.5rem", border: "1px solid #252832", gap: "2px" }}>
        {[{ key: "dashboard", label: "📊" }, { key: "lancamentos", label: "Lançar" }, { key: "cartoes", label: "💳" }, { key: "importar", label: "✨ IA" }].map(t => (
          <button key={t.key} onClick={() => { setTela(t.key); setErro(""); setErroIA(""); }} style={{
            flex: 1, padding: "0.5rem 0.25rem", border: "none", borderRadius: "8px", cursor: "pointer",
            fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap",
            background: tela === t.key ? "#252832" : "transparent",
            color: tela === t.key ? "#F0F0F0" : "#555", transition: "all 0.2s", fontFamily: "inherit",
          }}>{t.label}</button>
        ))}
      </div>

      {tela === "dashboard" && (
        <div>
          {lancamentos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 0", color: "#444" }}>
              <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📊</p>
              <p style={{ fontSize: "0.9rem" }}>Sem dados ainda.</p>
            </div>
          ) : (
            <>
              {/* CARD BOTÃO DO ARREPENDIMENTO */}
              {gastosEvitaveis.length > 0 && (
                <div style={{ background: "#F59E0B0F", borderRadius: "16px", padding: "1.25rem 1.5rem", marginBottom: "1rem", border: "1px solid #F59E0B30" }}>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.1em" }}>😬 Botão do Arrependimento</p>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "#E8E8E8" }}>
                    Você marcou <strong style={{ color: "#F59E0B" }}>{formatBRL(totalEvitavel)}</strong> em gastos evitáveis.
                  </p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#888" }}>
                    Investindo esse dinheiro, teria <strong style={{ color: "#22C55E" }}>{formatBRL(totalImpacto12m)}</strong> em 12 meses. 💡
                  </p>
                </div>
              )}

              <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832" }}>
                <p style={{ margin: "0 0 1.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Gastos por categoria</p>
                {gastosPorCategoria.map((item, i) => (
                  <div key={item.cat} style={{ marginBottom: "0.85rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                      <span style={{ fontSize: "0.82rem", color: "#CCC" }}>{item.cat}</span>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600, color: COLORS[i % COLORS.length] }}>{formatBRL(item.total)}</span>
                    </div>
                    <div style={{ background: "#0F1117", borderRadius: "4px", height: "6px", overflow: "hidden" }}>
                      <div style={{ background: COLORS[i % COLORS.length], height: "100%", width: `${(item.total / maxGasto) * 100}%`, borderRadius: "4px" }} />
                    </div>
                  </div>
                ))}
              </div>

              {gastosPorCartao.length > 0 && (
                <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832" }}>
                  <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Faturas do mês</p>
                  {gastosPorCartao.map((item) => (
                    <div key={item.cartao.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 0", borderBottom: "1px solid #252832" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: "0.9rem", color: "#E8E8E8", fontWeight: 500 }}>💳 {item.cartao.nome}</p>
                        <p style={{ margin: 0, fontSize: "0.7rem", color: "#555" }}>Fecha dia {item.cartao.dia_fechamento} · Vence dia {item.cartao.dia_vencimento}</p>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#EF4444" }}>{formatBRL(item.total)}</p>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", border: "1px solid #252832" }}>
                <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Últimos lançamentos</p>
                {lancamentos.slice(0, 5).map(l => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.6rem 0", borderBottom: "1px solid #252832", cursor: "pointer" }} onClick={() => handleEdit(l)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "0.85rem", color: "#E8E8E8" }}>
                        {l.poderia_ter_evitado && <span style={{ marginRight: "4px" }}>😬</span>}
                        {l.descricao}
                        {l.total_parcelas && <span style={{ marginLeft: "6px", fontSize: "0.7rem", color: "#555", background: "#252832", padding: "1px 6px", borderRadius: "4px" }}>{l.parcela_atual}/{l.total_parcelas}x</span>}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.7rem", color: "#555" }}>{l.categoria} · {l.forma_pagamento || "—"} · {formatData(l.data_lancamento)}</p>
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

      {tela === "lancamentos" && (
        <>
          <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid #252832" }}>
            <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Novo lançamento</p>
            <div style={{ display: "flex", background: "#0F1117", borderRadius: "10px", padding: "4px", marginBottom: "1rem" }}>
              {["gasto", "receita"].map(t => (
                <button key={t} onClick={() => { setTipo(t); setForm(f => ({ ...f, categoria: "", parcelado: false, total_parcelas: "" })); }} style={{
                  flex: 1, padding: "0.5rem", border: "none", borderRadius: "8px", cursor: "pointer",
                  fontSize: "0.85rem", fontWeight: 600,
                  background: tipo === t ? (t === "receita" ? "#22C55E" : "#EF4444") : "transparent",
                  color: tipo === t ? "#fff" : "#555", transition: "all 0.2s", fontFamily: "inherit",
                }}>{t === "receita" ? "↑ Receita" : "↓ Gasto"}</button>
              ))}
            </div>
            <input type="text" placeholder="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={inputStyle} />
            <input type="text" placeholder="Valor total (R$)" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} style={inputStyle} />
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ ...inputStyle, color: form.categoria ? "#E8E8E8" : "#555", appearance: "none" }}>
              <option value="">Categoria</option>
              {categories[tipo].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value, cartao_id: "", parcelado: false, total_parcelas: "" }))} style={{ ...inputStyle, color: form.forma_pagamento ? "#E8E8E8" : "#555", appearance: "none" }}>              <option value="">Forma de pagamento</option>
              {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {form.forma_pagamento === "Crédito" && cartoes.length > 0 && (
              <select value={form.cartao_id} onChange={e => setForm(f => ({ ...f, cartao_id: e.target.value }))} style={{ ...inputStyle, color: form.cartao_id ? "#E8E8E8" : "#555", appearance: "none" }}>
                <option value="">Selecione o cartão</option>
                {cartoes.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
            {form.forma_pagamento === "Crédito" && cartoes.length === 0 && (
              <p style={{ color: "#F59E0B", fontSize: "0.8rem", marginBottom: "0.75rem" }}>⚠️ Cadastre um cartão primeiro na aba 💳</p>
            )}

            {/* OPÇÃO DE PARCELAMENTO */}
            {form.forma_pagamento === "Crédito" && (
              <div style={{ marginBottom: "0.75rem" }}>
                <button
                  onClick={() => setForm(f => ({ ...f, parcelado: !f.parcelado, total_parcelas: "" }))}
                  style={{
                    width: "100%", padding: "0.65rem 1rem", border: `1px solid ${form.parcelado ? "#6366F1" : "#252832"}`,
                    borderRadius: "10px", background: form.parcelado ? "#6366F118" : "transparent",
                    color: form.parcelado ? "#6366F1" : "#555", fontSize: "0.85rem", fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s",
                  }}
                >
                  {form.parcelado ? "✓ Compra parcelada" : "+ Parcelar no crédito"}
                </button>
                {form.parcelado && (
                  <input
                    type="number" placeholder="Número de parcelas (ex: 10)" min="2" max="48"
                    value={form.total_parcelas}
                    onChange={e => setForm(f => ({ ...f, total_parcelas: e.target.value }))}
                    style={{ ...inputStyle, marginTop: "0.5rem", marginBottom: 0 }}
                  />
                )}
                {form.parcelado && form.total_parcelas >= 2 && form.valor && (
                  <p style={{ margin: "0.4rem 0 0", fontSize: "0.78rem", color: "#888" }}>
                    = {form.total_parcelas}x de {formatBRL(parseFloat(form.valor.replace(",", ".")) / parseInt(form.total_parcelas) || 0)} por mês
                  </p>
                )}
              </div>
            )}

            {/* TOGGLE RECORRENTE */}
            {tipo === "gasto" && !form.parcelado && (
              <button
                onClick={() => setForm(f => ({ ...f, recorrente: !f.recorrente }))}
                style={{
                  width: "100%", padding: "0.65rem 1rem", border: `1px solid ${form.recorrente ? "#6366F1" : "#252832"}`,
                  borderRadius: "10px", background: form.recorrente ? "#6366F118" : "transparent",
                  color: form.recorrente ? "#6366F1" : "#555", fontSize: "0.85rem", fontWeight: 600,
                  cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s",
                  marginBottom: "0.75rem",
                }}
              >
                {form.recorrente ? "🔁 Gasto recorrente (mensal)" : "🔁 Marcar como recorrente"}
              </button>
            )}

            <input type="date" value={form.data_lancamento} onChange={e => setForm(f => ({ ...f, data_lancamento: e.target.value }))} style={inputStyle} />
            {erro && <p style={{ color: "#EF4444", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{erro}</p>}
            <button onClick={handleSubmit} disabled={saving} style={{
              width: "100%", padding: "0.85rem", border: "none", borderRadius: "10px",
              background: success ? "#16A34A" : tipo === "receita" ? "#22C55E" : "#EF4444",
              color: "#fff", fontSize: "0.95rem", fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
              transition: "all 0.2s", fontFamily: "inherit",
            }}>{saving ? "Salvando..." : success ? "✓ Salvo!" : form.parcelado && form.total_parcelas >= 2 ? `Parcelar em ${form.total_parcelas}x` : "Adicionar"}</button>
          </div>

          <div>
            <p style={{ margin: "0 0 1rem", fontSize: "0.7rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.15em" }}>Lançamentos {loading && "· carregando..."}</p>
            {!loading && lancamentos.length === 0 && <p style={{ color: "#444", fontSize: "0.9rem", textAlign: "center", padding: "2rem 0" }}>Nenhum lançamento ainda.</p>}
            {lancamentos.map(l => (
              <div key={l.id} onClick={() => handleEdit(l)} style={{ display: "flex", alignItems: "center", padding: "0.9rem 1rem", background: l.poderia_ter_evitado ? "#F59E0B08" : "#181B24", borderRadius: "12px", marginBottom: "0.5rem", border: `1px solid ${l.poderia_ter_evitado ? "#F59E0B30" : "#252832"}`, gap: "0.75rem", cursor: "pointer" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0, background: l.tipo === "receita" ? "#22C55E18" : "#EF444418", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>
                  {l.tipo === "receita" ? "↑" : "↓"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 500, color: "#E8E8E8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {l.descricao}
                    {l.total_parcelas && <span style={{ marginLeft: "6px", fontSize: "0.68rem", color: "#6366F1", background: "#6366F115", padding: "1px 5px", borderRadius: "4px" }}>{l.parcela_atual}/{l.total_parcelas}x</span>}
                    {l.recorrente && <span style={{ marginLeft: "6px", fontSize: "0.68rem", color: "#22C55E", background: "#22C55E15", padding: "1px 5px", borderRadius: "4px" }}>🔁</span>}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "#555" }}>{l.categoria} · {l.forma_pagamento || "—"} · {formatData(l.data_lancamento)}</p>
                </div>
                <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: l.tipo === "receita" ? "#22C55E" : "#EF4444", flexShrink: 0 }}>
                  {l.tipo === "receita" ? "+" : "-"}{formatBRL(l.valor)}
                </p>
                {/* Botão do Arrependimento inline */}
                {l.tipo === "gasto" && (
                  <button
                    onClick={(e) => handleToggleArrependimento(e, l)}
                    title={l.poderia_ter_evitado ? "Remover marcação" : "Poderia ter evitado?"}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: "1rem", padding: "0 0.1rem", flexShrink: 0,
                      opacity: l.poderia_ter_evitado ? 1 : 0.25,
                      transition: "opacity 0.2s",
                    }}
                  >😬</button>
                )}
                <button onClick={(e) => { e.stopPropagation(); handleDelete(l.id); }} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem", flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tela === "cartoes" && (
        <>
          <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1.5rem", border: "1px solid #252832" }}>
            <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Novo cartão</p>
            <input type="text" placeholder="Nome do cartão (ex: Santander)" value={formCartao.nome} onChange={e => setFormCartao(f => ({ ...f, nome: e.target.value }))} style={inputStyle} />
            <input type="text" placeholder="Bandeira (ex: Visa, Master)" value={formCartao.bandeira} onChange={e => setFormCartao(f => ({ ...f, bandeira: e.target.value }))} style={inputStyle} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <input type="number" placeholder="Dia fechamento" min="1" max="31" value={formCartao.dia_fechamento} onChange={e => setFormCartao(f => ({ ...f, dia_fechamento: e.target.value }))} style={{ ...inputStyle, marginBottom: 0 }} />
              <input type="number" placeholder="Dia vencimento" min="1" max="31" value={formCartao.dia_vencimento} onChange={e => setFormCartao(f => ({ ...f, dia_vencimento: e.target.value }))} style={{ ...inputStyle, marginBottom: 0 }} />
            </div>
            {erroCartao && <p style={{ color: "#EF4444", fontSize: "0.8rem", marginBottom: "0.75rem", marginTop: "0.75rem" }}>{erroCartao}</p>}
            <button onClick={handleSaveCartao} disabled={savingCartao} style={{
              width: "100%", padding: "0.85rem", border: "none", borderRadius: "10px", marginTop: "0.75rem",
              background: successCartao ? "#16A34A" : "#6366F1", color: "#fff", fontSize: "0.95rem", fontWeight: 700,
              cursor: savingCartao ? "not-allowed" : "pointer", opacity: savingCartao ? 0.7 : 1,
              transition: "all 0.2s", fontFamily: "inherit",
            }}>{savingCartao ? "Salvando..." : successCartao ? "✓ Salvo!" : "Adicionar cartão"}</button>
          </div>
          <div>
            <p style={{ margin: "0 0 1rem", fontSize: "0.7rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.15em" }}>Meus cartões</p>
            {cartoes.length === 0 && <p style={{ color: "#444", fontSize: "0.9rem", textAlign: "center", padding: "2rem 0" }}>Nenhum cartão cadastrado.</p>}
            {cartoes.map(c => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", padding: "1rem", background: "#181B24", borderRadius: "12px", marginBottom: "0.5rem", border: "1px solid #252832", gap: "0.75rem" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#6366F118", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>💳</div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "#E8E8E8" }}>{c.nome}</p>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "#555" }}>
                    {c.bandeira && c.bandeira + " · "}Fecha dia {c.dia_fechamento || "—"} · Vence dia {c.dia_vencimento || "—"}
                  </p>
                </div>
                <button onClick={() => handleDeleteCartao(c.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem" }}>×</button>
              </div>
            ))}
          </div>
        </>
      )}

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
                    <p style={{ margin: 0, fontSize: "0.7rem", color: "#555" }}>
                      {l.categoria} · {l.forma_pagamento || "—"}
                      {l.cartao_id ? " · 💳 " + (cartoes.find(c => c.id === l.cartao_id)?.nome || "Cartão") : ""}
                      {" · " + formatData(l.data_lancamento)}
                    </p>
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
