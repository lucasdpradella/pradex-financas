import { useState, useEffect, useRef } from "react";
import { supabase, syncSupabaseSession } from "./supabaseClient";
import PerfilFP from "./components/fp/PerfilFP";
import ObjetivosFP from "./components/fp/ObjetivosFP";
import RendasDespesasFP from "./components/fp/RendasDespesasFP";
import InvestimentosFP from "./components/fp/InvestimentosFP";

const SUPABASE_URL = "https://sjvuhqqsjboncwpboclv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE";

const api = (token) => ({
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${token || SUPABASE_KEY}`,
});

const defaultCategories = {
  receita: ["Salário", "Freelance", "Investimentos", "Aluguel recebido", "Outros"],
  gasto: ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Assinaturas", "Outros"],
};

const COLORS = ["#6366F1","#22C55E","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6","#F97316"];
const formatBRL = (value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthNames = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const today = new Date().toISOString().split("T")[0];
const formasPagamento = ["Débito", "Crédito", "Dinheiro", "PIX", "Outros"];
const badgeBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "4px",
  fontSize: "0.62rem",
  padding: "1px 6px",
  borderRadius: "999px",
  verticalAlign: "middle",
};
const sectionToggleStyle = {
  width: "100%",
  padding: "0.8rem 1rem",
  border: "1px solid #252832",
  borderRadius: "14px",
  background: "#141720",
  color: "#CFCFCF",
  fontSize: "0.84rem",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  textAlign: "left",
  transition: "all 0.2s",
};

const normalizeText = (value = "") => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!/[ÃÂ ]/.test(text)) return text;
  try {
    return decodeURIComponent(escape(text));
  } catch (e) {
    return text
      .replace(/Ã¡/g, "á").replace(/Ã¢/g, "â").replace(/Ã£/g, "ã").replace(/Ã /g, "à")
      .replace(/Ã©/g, "é").replace(/Ãª/g, "ê").replace(/Ã­/g, "í").replace(/Ã³/g, "ó")
      .replace(/Ã´/g, "ô").replace(/Ãµ/g, "õ").replace(/Ãº/g, "ú").replace(/Ã§/g, "ç")
      .replace(/Ã/g, "Á").replace(/Ã‰/g, "É").replace(/Ã/g, "Í").replace(/Ã"/g, "Ó")
      .replace(/Ãš/g, "Ú").replace(/Ã‡/g, "Ç").replace(/Â·/g, "·").replace(/Â/g, "");
  }
};

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const limparDescricaoParcela = (descricao = "") => descricao.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
const montarDescricaoParcela = (descricao, parcelaAtual, totalParcelas) => `${limparDescricaoParcela(descricao)} (${parcelaAtual}/${totalParcelas})`;
const getMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
const getMonthLabel = (key) => {
  const [ano, mes] = key.split("-");
  return `${monthNames[parseInt(mes, 10) - 1]} ${ano}`;
};
const getFormaPagamentoLabel = (value) => normalizeText(value) || "Não informado";
const isValidDateString = (value = "") => /^\d{4}-\d{2}-\d{2}$/.test(String(value));
const getPreviewScore = (item) => {
  let score = 0;
  if ((item.descricao || "").trim().length >= 3) score += 2;
  if (Number(item.valor) > 0) score += 2;
  if (["gasto", "receita"].includes(item.tipo)) score += 2;
  if ((item.categoria || "").trim()) score += 2;
  if (isValidDateString(item.data_lancamento)) score += 1;
  if (formasPagamento.includes(item.forma_pagamento)) score += 1;
  if (item.forma_pagamento === "Crédito" && item.cartao_id) score += 1;
  return score;
};
const getPreviewConfidence = (item) => {
  const score = getPreviewScore(item);
  if (score >= 8) return { label: "Alta confiança", color: "#22C55E", background: "#22C55E15", border: "#22C55E30" };
  if (score >= 6) return { label: "Média confiança", color: "#F59E0B", background: "#F59E0B15", border: "#F59E0B30" };
  return { label: "Baixa confiança", color: "#EF4444", background: "#EF444415", border: "#EF444430" };
};
const getPreviewGroupLabel = (item) => {
  if (item.tipo === "receita") return "Receitas identificadas";
  if (isValidDateString(item.data_lancamento) && item.data_lancamento > today) return "Contas e lançamentos futuros";
  if (item.forma_pagamento === "Crédito") return "Compras no crédito";
  if (["Débito", "PIX", "Dinheiro"].includes(item.forma_pagamento)) return "Saídas do dia a dia";
  return "Lançamentos para revisar";
};
const enrichPreviewItem = (item) => ({
  ...item,
  id_preview: generateUUID(),
  descricao: normalizeText(item.descricao || ""),
  categoria: normalizeText(item.categoria || ""),
  forma_pagamento: item.forma_pagamento || "",
  data_lancamento: item.data_lancamento || today,
  poderia_ter_evitado: Boolean(item.poderia_ter_evitado),
  cartao_id: item.cartao_id ?? "",
  _editando: false,
});

async function fetchTaxaFocus() {
  return 5.65 + 4.5;
}

async function criarRecorrentesAteDezembro(lancamento, dataInicio, token, grupoId) {
  const dataBase = new Date(dataInicio + "T12:00:00");
  const anoAtual = dataBase.getFullYear();
  const mesInicio = dataBase.getMonth();
  const criados = [];
  for (let m = mesInicio + 1; m <= 11; m++) {
    const dataLanc = new Date(anoAtual, m, dataBase.getDate());
    const dataStr = dataLanc.toISOString().split("T")[0];
    const body = { ...lancamento, data_lancamento: dataStr, recorrente: true, recorrente_grupo_id: grupoId };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${token}`, "Prefer": "return=representation" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (Array.isArray(data) && data[0]) criados.push(data[0]);
  }
  return criados;
}

function agruparLancamentos(lancamentos) {
  const grupos = {};
  const naoRecorrentes = lancamentos.filter(l => !l.recorrente);
  const recorrentes = lancamentos.filter(l => l.recorrente);
  for (const l of recorrentes) {
    const chave = l.recorrente_grupo_id || `${l.descricao}||${l.valor}||${l.categoria}`;
    if (!grupos[chave]) {
      grupos[chave] = { ...l, _totalMeses: 1, _idsGrupo: [l.id], _grupoId: l.recorrente_grupo_id || null };
    } else {
      grupos[chave]._totalMeses += 1;
      grupos[chave]._idsGrupo.push(l.id);
      if (l.data_lancamento < grupos[chave].data_lancamento) grupos[chave].data_lancamento = l.data_lancamento;
    }
  }
  const recorrentesAgrupados = Object.values(grupos);
  const todos = [...recorrentesAgrupados, ...naoRecorrentes];
  todos.sort((a, b) => b.id - a.id);
  return todos;
}

function GraficoSimulador({ labels, dadosComAporte, dadosSemAporte, meta }) {
  const canvasRef = useRef(null);
  const instanceRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    if (instanceRef.current) instanceRef.current.destroy();
    const datasets = [
      { label: "Com aportes", data: dadosComAporte, borderColor: "#6366F1", backgroundColor: "rgba(99,102,241,0.08)", fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 },
      { label: "Só rendimento", data: dadosSemAporte, borderColor: "#555", backgroundColor: "transparent", fill: false, tension: 0.4, pointRadius: 0, borderWidth: 1.5, borderDash: [4, 4] },
    ];
    if (meta > 0) datasets.push({ label: "Meta", data: Array(labels.length).fill(meta), borderColor: "#F59E0B", backgroundColor: "transparent", fill: false, pointRadius: 0, borderWidth: 1.5, borderDash: [6, 4] });
    instanceRef.current = new window.Chart(canvasRef.current, {
      type: "line", data: { labels, datasets },
      options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#555", font: { size: 10 } }, grid: { color: "#1a1d26" } }, y: { ticks: { color: "#555", font: { size: 10 }, callback: v => v >= 1000000 ? "R$" + (v/1000000).toFixed(1) + "M" : v >= 1000 ? "R$" + (v/1000).toFixed(0) + "k" : "R$" + v }, grid: { color: "#1a1d26" } } } },
    });
    return () => { if (instanceRef.current) instanceRef.current.destroy(); };
  }, [JSON.stringify(dadosComAporte), JSON.stringify(dadosSemAporte), meta]);
  return <canvas ref={canvasRef} style={{ width: "100%", maxHeight: "220px" }} />;
}

export default function PradexFinancas() {
  const [session, setSession] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [authErro, setAuthErro] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [tela, setTela] = useState("ia");
  const [tipo, setTipo] = useState("gasto");
  const [form, setForm] = useState({ descricao: "", valor: "", categoria: "", data_lancamento: today, forma_pagamento: "", cartao_id: "", parcelado: false, parcela_atual: "1", total_parcelas: "", recorrente: false });
  const [lancamentos, setLancamentos] = useState([]);
  const [cartoes, setCartoes] = useState([]);
  const [categories, setCategories] = useState(defaultCategories);
  const [novaCategoria, setNovaCategoria] = useState({ nome: "", tipo: "gasto" });
  const [mostrarCategorias, setMostrarCategorias] = useState(false);
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
  const [mostrarFormCartao, setMostrarFormCartao] = useState(false);
  const [editando, setEditando] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [mesHistorico, setMesHistorico] = useState({ ano: new Date().getFullYear(), mes: new Date().getMonth() });
  const [simulador, setSimulador] = useState({ meta: "", patrimonioAtual: "", aporteMensal: "" });
  const [taxaFocus, setTaxaFocus] = useState(10.15);
  const [rascunhos, setRascunhos] = useState([]);
  const [filtroLancamentos, setFiltroLancamentos] = useState("todos");
  const [fpAba, setFpAba] = useState("perfil");

  const inputStyle = { width: "100%", background: "#0F1117", border: "1px solid #252832", borderRadius: "10px", padding: "0.75rem 1rem", color: "#E8E8E8", fontSize: "0.9rem", marginBottom: "0.75rem", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };

  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: api(localStorage.getItem("sb_token")) });
      const data = await res.json();
      if (data.id) {
        const token = localStorage.getItem("sb_token");
        setSession({ user: data, token });
        await syncSupabaseSession(token);
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
        method: "POST", headers: { "Content-Type": "application/json", "apikey": SUPABASE_KEY },
        body: JSON.stringify({ email, password: senha }),
      });
      const data = await res.json();
      if (data.access_token) {
        localStorage.setItem("sb_token", data.access_token);
        setSession({ user: data.user, token: data.access_token });
        await syncSupabaseSession(data.access_token);
        fetchUserRole(data.user.id, data.access_token);
      } else { setAuthErro(authMode === "login" ? "Email ou senha incorretos." : "Erro ao criar conta."); }
    } catch (e) { setAuthErro("Erro de conexão."); }
    setAuthLoading(false);
  };

  const handleLogout = () => {
    supabase.auth.signOut().catch(() => {});
    localStorage.removeItem("sb_token");
    setSession(null); setUserRole(null);
    setLancamentos([]); setCartoes([]);
  };

  useEffect(() => {
    if (session) {
      fetchLancamentos(); fetchCartoes(); fetchRascunhos(); fetchCategorias();
      fetchTaxaFocus().then(t => setTaxaFocus(t));
    }
  }, [session]);

  const fetchCategorias = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/categorias?order=nome.asc`, { headers: api(session?.token) });
      const data = await res.json();
      if (Array.isArray(data)) {
        const removidas = data.filter(c => c.removida).map(c => c.nome + c.tipo);
        const gastoCustom = data.filter(c => c.tipo === "gasto" && !c.removida).map(c => c.nome);
        const receitaCustom = data.filter(c => c.tipo === "receita" && !c.removida).map(c => c.nome);
        setCategories({
          gasto: [...new Set([...defaultCategories.gasto.filter(n => !removidas.includes(n + "gasto")), ...gastoCustom])],
          receita: [...new Set([...defaultCategories.receita.filter(n => !removidas.includes(n + "receita")), ...receitaCustom])],
        });
      }
    } catch (e) {}
  };

  const handleAddCategoria = async () => {
    if (!novaCategoria.nome.trim()) return;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/categorias`, {
        method: "POST",
        headers: { ...api(session?.token), "Prefer": "return=representation" },
        body: JSON.stringify({ nome: novaCategoria.nome.trim(), tipo: novaCategoria.tipo, user_id: session.user.id, removida: false }),
      });
      setCategories(prev => ({ ...prev, [novaCategoria.tipo]: [...new Set([...prev[novaCategoria.tipo], novaCategoria.nome.trim()])] }));
      setNovaCategoria(prev => ({ ...prev, nome: "" }));
    } catch (e) {}
  };

  const handleRemoveCategoria = async (nome, tipo) => {
    try {
      if (defaultCategories[tipo].includes(nome)) {
        await fetch(`${SUPABASE_URL}/rest/v1/categorias`, {
          method: "POST",
          headers: { ...api(session?.token), "Prefer": "return=representation" },
          body: JSON.stringify({ nome, tipo, user_id: session.user.id, removida: true }),
        });
      } else {
        await fetch(`${SUPABASE_URL}/rest/v1/categorias?nome=eq.${encodeURIComponent(nome)}&tipo=eq.${tipo}&user_id=eq.${session.user.id}`, { method: "DELETE", headers: api(session?.token) });
      }
      setCategories(prev => ({ ...prev, [tipo]: prev[tipo].filter(c => c !== nome) }));
    } catch (e) {}
  };

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

  const fetchRascunhos = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/lancamentos_rascunho?status=eq.pendente&order=id.desc`, { headers: api(session?.token) });
      const data = await res.json();
      setRascunhos(Array.isArray(data) ? data : []);
    } catch (e) {}
  };

  const confirmarRascunho = async (r) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos`, {
        method: "POST",
        headers: { ...api(session?.token), "Prefer": "return=representation" },
        body: JSON.stringify({ descricao: r.descricao, valor: r.valor, tipo: r.tipo, categoria: r.categoria, forma_pagamento: r.forma_pagamento, data_lancamento: r.data_lancamento || today, user_id: session.user.id, poderia_ter_evitado: false, recorrente: false }),
      });
      await fetch(`${SUPABASE_URL}/rest/v1/lancamentos_rascunho?id=eq.${r.id}`, { method: "PATCH", headers: api(session?.token), body: JSON.stringify({ status: "confirmado" }) });
      setRascunhos(prev => prev.filter(x => x.id !== r.id));
      await fetchLancamentos();
    } catch (e) {}
  };

  const rejeitarRascunho = async (id) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/lancamentos_rascunho?id=eq.${id}`, { method: "PATCH", headers: api(session?.token), body: JSON.stringify({ status: "rejeitado" }) });
      setRascunhos(prev => prev.filter(x => x.id !== id));
    } catch (e) {}
  };

  const handleSubmit = async () => {
    if (!form.descricao || !form.valor || !form.categoria) { setErro("Preencha todos os campos."); return; }
    const valor = parseFloat(form.valor.replace(",", "."));
    if (isNaN(valor) || valor <= 0) { setErro("Valor inválido."); return; }
    setSaving(true); setErro("");
    try {
      if (form.parcelado && form.forma_pagamento === "Crédito" && parseInt(form.total_parcelas) >= 2) {
        const nParcelas = parseInt(form.total_parcelas);
        const parcelaAtual = parseInt(form.parcela_atual) || 1;
        const valorParcela = valor;
        const grupoId = generateUUID();
        const dataBase = new Date(form.data_lancamento + "T12:00:00");
        if (parcelaAtual < 1 || parcelaAtual > nParcelas) { setErro("A parcela atual precisa estar entre 1 e o total de parcelas."); setSaving(false); return; }
        for (let i = parcelaAtual; i <= nParcelas; i++) {
          const dataParcela = new Date(dataBase);
          dataParcela.setMonth(dataParcela.getMonth() + (i - parcelaAtual));
          await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos`, {
            method: "POST",
            headers: { ...api(session?.token), "Prefer": "return=representation" },
            body: JSON.stringify({ descricao: montarDescricaoParcela(form.descricao, i, nParcelas), valor: Math.round(valorParcela*100)/100, tipo, categoria: form.categoria, data_lancamento: dataParcela.toISOString().split("T")[0], user_id: session.user.id, forma_pagamento: "Crédito", cartao_id: form.cartao_id ? parseInt(form.cartao_id) : null, parcela_atual: i, total_parcelas: nParcelas, parcela_grupo_id: grupoId, poderia_ter_evitado: false }),
          });
        }
        await fetchLancamentos();
        setForm({ descricao: "", valor: "", categoria: "", data_lancamento: today, forma_pagamento: "", cartao_id: "", parcelado: false, parcela_atual: "1", total_parcelas: "", recorrente: false });
        setSuccess(true); setTimeout(() => setSuccess(false), 2000);
      } else {
        const grupoId = form.recorrente ? generateUUID() : null;
        const bodyBase = { descricao: form.descricao, valor, tipo, categoria: form.categoria, data_lancamento: form.data_lancamento, user_id: session.user.id, forma_pagamento: form.forma_pagamento || null, cartao_id: form.forma_pagamento === "Crédito" && form.cartao_id ? parseInt(form.cartao_id) : null, poderia_ter_evitado: false, recorrente: form.recorrente || false, recorrente_grupo_id: grupoId, parcela_atual: null, total_parcelas: null, parcela_grupo_id: null };
        const res = await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos`, {
          method: "POST", headers: { ...api(session?.token), "Prefer": "return=representation" },
          body: JSON.stringify(bodyBase),
        });
        const data = await res.json();
        if (Array.isArray(data) && data[0]) {
          if (form.recorrente) {
            await criarRecorrentesAteDezembro({ ...bodyBase }, form.data_lancamento, session.token, grupoId);
            await fetchLancamentos();
          } else {
            setLancamentos(prev => [data[0], ...prev]);
          }
          setForm({ descricao: "", valor: "", categoria: "", data_lancamento: today, forma_pagamento: "", cartao_id: "", parcelado: false, parcela_atual: "1", total_parcelas: "", recorrente: false });
          setSuccess(true); setTimeout(() => setSuccess(false), 2000);
        } else { setErro("Erro ao salvar."); }
      }
    } catch (e) { setErro("Erro de conexão."); }
    setSaving(false);
  };

  const handleDelete = async (l) => {
    try {
      if (l._grupoId) {
        await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?recorrente_grupo_id=eq.${l._grupoId}`, { method: "DELETE", headers: api(session?.token) });
        setLancamentos(prev => prev.filter(x => x.recorrente_grupo_id !== l._grupoId));
      } else {
        const ids = l._idsGrupo || [l.id];
        for (const id of ids) {
          await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?id=eq.${id}`, { method: "DELETE", headers: api(session?.token) });
        }
        setLancamentos(prev => prev.filter(x => !ids.includes(x.id)));
      }
    } catch (e) {}
  };

  const handleEdit = (l) => {
    const totalParcelas = l.total_parcelas ? String(l.total_parcelas) : "";
    const parcelaAtual = l.parcela_atual ? String(l.parcela_atual) : "1";
    setEditando({ id: l.id, descricao: limparDescricaoParcela(l.descricao || ""), valor: String(l.valor), tipo: l.tipo || "gasto", categoria: l.categoria || "", data_lancamento: l.data_lancamento || today, forma_pagamento: l.forma_pagamento || "", cartao_id: l.cartao_id ? String(l.cartao_id) : "", poderia_ter_evitado: l.poderia_ter_evitado || false, recorrente: l.recorrente || false, parcelado: Boolean(l.total_parcelas), parcela_atual: parcelaAtual, total_parcelas: totalParcelas, _recorrenteOriginal: l.recorrente || false, _grupoId: l.recorrente_grupo_id || null, _parcelaGrupoId: l.parcela_grupo_id || null, _parcelaAtualOriginal: l.parcela_atual || null });
  };

  const handleSaveEdit = async () => {
    if (!editando.descricao || !editando.valor || !editando.categoria) return;
    const valor = parseFloat(String(editando.valor).replace(",", "."));
    if (isNaN(valor) || valor <= 0) return;
    setSavingEdit(true);
    try {
      if (editando.parcelado && editando.forma_pagamento === "Crédito" && parseInt(editando.total_parcelas) >= 2) {
        const totalParcelas = parseInt(editando.total_parcelas);
        const parcelaAtual = parseInt(editando.parcela_atual) || 1;
        if (parcelaAtual < 1 || parcelaAtual > totalParcelas) { alert("A parcela atual precisa estar entre 1 e o total de parcelas."); setSavingEdit(false); return; }
        const grupoParcelaId = editando._parcelaGrupoId || generateUUID();
        const valorParcela = Math.round(valor * 100) / 100;
        const descricaoBase = limparDescricaoParcela(editando.descricao);
        if (editando._parcelaGrupoId) {
          await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?parcela_grupo_id=eq.${editando._parcelaGrupoId}&id=neq.${editando.id}`, { method: "DELETE", headers: api(session?.token) });
        }
        const resAtual = await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?id=eq.${editando.id}`, {
          method: "PATCH", headers: { ...api(session?.token), "Prefer": "return=representation" },
          body: JSON.stringify({ descricao: montarDescricaoParcela(descricaoBase, parcelaAtual, totalParcelas), valor: valorParcela, tipo: editando.tipo, categoria: editando.categoria, data_lancamento: editando.data_lancamento, forma_pagamento: "Crédito", cartao_id: editando.cartao_id ? parseInt(editando.cartao_id) : null, poderia_ter_evitado: editando.poderia_ter_evitado, recorrente: false, recorrente_grupo_id: null, parcela_atual: parcelaAtual, total_parcelas: totalParcelas, parcela_grupo_id: grupoParcelaId }),
        });
        const dataAtual = await resAtual.json();
        if (Array.isArray(dataAtual) && dataAtual[0]) {
          const dataBase = new Date(editando.data_lancamento + "T12:00:00");
          for (let i = parcelaAtual + 1; i <= totalParcelas; i++) {
            const dataParcela = new Date(dataBase);
            dataParcela.setMonth(dataParcela.getMonth() + (i - parcelaAtual));
            await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos`, {
              method: "POST", headers: { ...api(session?.token), "Prefer": "return=representation" },
              body: JSON.stringify({ descricao: montarDescricaoParcela(descricaoBase, i, totalParcelas), valor: valorParcela, tipo: editando.tipo, categoria: editando.categoria, data_lancamento: dataParcela.toISOString().split("T")[0], user_id: session.user.id, forma_pagamento: "Crédito", cartao_id: editando.cartao_id ? parseInt(editando.cartao_id) : null, poderia_ter_evitado: editando.poderia_ter_evitado, recorrente: false, recorrente_grupo_id: null, parcela_atual: i, total_parcelas: totalParcelas, parcela_grupo_id: grupoParcelaId }),
            });
          }
          await fetchLancamentos();
          setEditando(null);
        }
        setSavingEdit(false);
        return;
      }
      if (editando._parcelaGrupoId) {
        await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?parcela_grupo_id=eq.${editando._parcelaGrupoId}&id=neq.${editando.id}`, { method: "DELETE", headers: api(session?.token) });
      }
      const grupoId = (!editando._recorrenteOriginal && editando.recorrente) ? generateUUID() : editando._grupoId;
      const body = { descricao: limparDescricaoParcela(editando.descricao), valor, tipo: editando.tipo, categoria: editando.categoria, data_lancamento: editando.data_lancamento, forma_pagamento: editando.forma_pagamento || null, cartao_id: editando.forma_pagamento === "Crédito" && editando.cartao_id ? parseInt(editando.cartao_id) : null, poderia_ter_evitado: editando.poderia_ter_evitado, recorrente: editando.recorrente || false, recorrente_grupo_id: grupoId, parcela_atual: null, total_parcelas: null, parcela_grupo_id: null };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?id=eq.${editando.id}`, {
        method: "PATCH", headers: { ...api(session?.token), "Prefer": "return=representation" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        setLancamentos(prev => prev.map(l => l.id === editando.id ? data[0] : l));
        if (editando.recorrente && !editando._recorrenteOriginal) {
          const baseBody = { ...body, user_id: session.user.id };
          await criarRecorrentesAteDezembro(baseBody, editando.data_lancamento, session.token, grupoId);
          await fetchLancamentos();
        }
        setEditando(null);
      }
    } catch (e) {}
    setSavingEdit(false);
  };

  const handleToggleArrependimento = async (e, lancamento) => {
    e.stopPropagation();
    const novoValor = !lancamento.poderia_ter_evitado;
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos?id=eq.${lancamento.id}`, { method: "PATCH", headers: { ...api(session?.token), "Prefer": "return=representation" }, body: JSON.stringify({ poderia_ter_evitado: novoValor }) });
      setLancamentos(prev => prev.map(l => l.id === lancamento.id ? { ...l, poderia_ter_evitado: novoValor } : l));
    } catch (e) {}
  };

  const handleSaveCartao = async () => {
    if (!formCartao.nome) { setErroCartao("Nome é obrigatório."); return; }
    setSavingCartao(true); setErroCartao("");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/cartoes`, {
        method: "POST", headers: { ...api(session?.token), "Prefer": "return=representation" },
        body: JSON.stringify({ ...formCartao, user_id: session.user.id, dia_fechamento: formCartao.dia_fechamento ? parseInt(formCartao.dia_fechamento) : null, dia_vencimento: formCartao.dia_vencimento ? parseInt(formCartao.dia_vencimento) : null }),
      });
      const data = await res.json();
      if (Array.isArray(data) && data[0]) {
        setCartoes(prev => [...prev, data[0]]);
        setFormCartao({ nome: "", bandeira: "", dia_fechamento: "", dia_vencimento: "" });
        setSuccessCartao(true); setMostrarFormCartao(false);
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
      const cartoesInfo = cartoes.length > 0 ? "\n\nCartões cadastrados:\n" + cartoes.map(c => "- ID " + c.id + ": " + c.nome + (c.bandeira ? " (" + c.bandeira + ")" : "")).join("\n") : "";
      const todasCatsGasto = categories.gasto.join(", ");
      const todasCatsReceita = categories.receita.join(", ");
      const prompt = `Você é um assistente financeiro brasileiro. Analise o texto abaixo e extraia TODOS os lançamentos financeiros mencionados.\n\nREGRAS:\n- Ignore palavras soltas como Cartão ou Dinheiro sem valor\n- Para contas a vencer, use a data de vencimento\n- Cash back é receita\n- Sem duplicatas óbvias\n- Use ano 2026 se não especificado\n- Identifique a forma de pagamento: Débito, Crédito, Dinheiro, PIX ou Outros\n- Se for Crédito e mencionar um cartão, vincule ao cartão cadastrado usando o ID correto\n- Se não conseguir identificar o cartão, deixe cartao_id como null\n\nRetorne APENAS um array JSON válido:\n[{"descricao":"...","valor":0.00,"tipo":"gasto","categoria":"...","data_lancamento":"YYYY-MM-DD","forma_pagamento":"...","cartao_id":null,"poderia_ter_evitado":false}]\n\nCategorias gastos: ${todasCatsGasto}\nCategorias receitas: ${todasCatsReceita}${cartoesInfo}\n\nHoje: ${today}\n\nTexto:\n${textoIA}`;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/claude-proxy`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + SUPABASE_KEY }, body: JSON.stringify({ prompt }) });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      if (Array.isArray(parsed) && parsed.length > 0) setPreview(parsed.map(enrichPreviewItem));
      else setErroIA("Não consegui identificar lançamentos.");
    } catch (e) { setErroIA("Erro ao processar."); }
    setProcessando(false);
  };

  const atualizarPreviewItem = (id, updates) => {
    setPreview(prev => prev.map(item => item.id_preview === id ? { ...item, ...updates } : item));
  };

  const togglePreviewEdit = (id) => {
    setPreview(prev => prev.map(item => item.id_preview === id ? { ...item, _editando: !item._editando } : item));
  };

  const removerPreviewItem = (id) => {
    setPreview(prev => prev.filter(item => item.id_preview !== id));
  };

  const confirmarImportacao = async () => {
    setSaving(true);
    try {
      for (const l of preview) {
        const { id_preview, _editando, ...payload } = l;
        await fetch(`${SUPABASE_URL}/rest/v1/Lancamentos`, { method: "POST", headers: { ...api(session?.token), "Prefer": "return=representation" }, body: JSON.stringify({ ...payload, user_id: session.user.id, poderia_ter_evitado: false, cartao_id: payload.cartao_id ? Number(payload.cartao_id) : null }) });
      }
      await fetchLancamentos();
      setTextoIA(""); setPreview([]);
      setImportado(true);
      setTimeout(() => { setImportado(false); setTela("dashboard"); }, 2000);
    } catch (e) { setErroIA("Erro ao salvar."); }
    setSaving(false);
  };

  const mesAtual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const gastos = lancamentos.filter(l => l.tipo === "gasto" && l.data_lancamento?.startsWith(mesAtual));
  const receitas = lancamentos.filter(l => l.tipo === "receita" && l.data_lancamento?.startsWith(mesAtual));
  const totalReceitas = receitas.reduce((s, l) => s + Number(l.valor), 0);
  const totalGastos = gastos.reduce((s, l) => s + Number(l.valor), 0);
  const taxaMensal = 0.009;
  const gastosEvitaveis = lancamentos.filter(l => l.poderia_ter_evitado && l.tipo === "gasto" && l.data_lancamento?.startsWith(mesAtual));
  const totalEvitavel = gastosEvitaveis.reduce((s, l) => s + Number(l.valor), 0);
  const calcularImpacto12m = (l) => {
    const valor = Number(l.valor);
    if (l.total_parcelas) return valor * (l.total_parcelas - (l.parcela_atual || 1) + 1) * Math.pow(1 + taxaMensal, 12);
    if (l.recorrente) { let a = 0; for (let i = 1; i <= 12; i++) a += valor * Math.pow(1 + taxaMensal, i); return a; }
    return valor * Math.pow(1 + taxaMensal, 12);
  };
  const totalImpacto12m = gastosEvitaveis.reduce((s, l) => s + calcularImpacto12m(l), 0);
  const gastosPorCategoria = categories.gasto.map(cat => ({ cat, total: gastos.filter(l => l.categoria === cat).reduce((s, l) => s + Number(l.valor), 0) })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
  const maxGasto = Math.max(...gastosPorCategoria.map(x => x.total), 1);
  const gastosPorCartao = cartoes.map(c => ({ cartao: c, total: lancamentos.filter(l => l.cartao_id === c.id && l.data_lancamento?.startsWith(mesAtual)).reduce((s, l) => s + Number(l.valor), 0) })).filter(x => x.total > 0);
  const gastosDebito = gastos.filter(l => l.forma_pagamento !== "Crédito").reduce((s, l) => s + Number(l.valor), 0);
  const gastosCredito = gastos.filter(l => l.forma_pagamento === "Crédito").reduce((s, l) => s + Number(l.valor), 0);
  const percentualDebito = totalGastos > 0 ? (gastosDebito / totalGastos) * 100 : 0;
  const percentualCredito = totalGastos > 0 ? (gastosCredito / totalGastos) * 100 : 0;
  const projecaoParcelas = Array.from({ length: 3 }, (_, offset) => {
    const dataBase = new Date();
    dataBase.setDate(1);
    dataBase.setMonth(dataBase.getMonth() + offset + 1);
    const monthKey = getMonthKey(dataBase);
    const parcelasMes = lancamentos
      .filter(l => l.tipo === "gasto" && l.forma_pagamento === "Crédito" && l.total_parcelas && l.data_lancamento?.startsWith(monthKey))
      .sort((a, b) => Number(b.valor) - Number(a.valor));
    const total = parcelasMes.reduce((s, l) => s + Number(l.valor), 0);
    const comprasAtivas = new Set(parcelasMes.map(l => l.parcela_grupo_id || `${limparDescricaoParcela(l.descricao)}-${l.cartao_id || "sem-cartao"}`)).size;
    return { key: monthKey, label: getMonthLabel(monthKey), total, comprasAtivas, parcelas: parcelasMes.slice(0, 3) };
  });
  const formatData = (d) => { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day} ${monthNames[parseInt(m)-1]}`; };

  const lancamentosAgrupados = agruparLancamentos(lancamentos);
  const opcoesFiltroLancamentos = [
    { value: "todos", label: "Todos" },
    { value: "debito", label: "Débito" },
    { value: "credito", label: "Crédito total" },
    { value: "parceladas", label: "Parceladas" },
    ...cartoes.map(cartao => ({ value: `cartao-${cartao.id}`, label: `Crédito · ${normalizeText(cartao.nome)}` })),
  ];
  const lancamentosFiltrados = lancamentosAgrupados.filter((lancamento) => {
    if (filtroLancamentos === "todos") return true;
    if (filtroLancamentos === "debito") return lancamento.tipo === "gasto" && lancamento.forma_pagamento !== "Crédito";
    if (filtroLancamentos === "credito") return lancamento.tipo === "gasto" && lancamento.forma_pagamento === "Crédito";
    if (filtroLancamentos === "parceladas") return lancamento.tipo === "gasto" && lancamento.forma_pagamento === "Crédito" && Number(lancamento.total_parcelas) >= 2;
    if (filtroLancamentos.startsWith("cartao-")) {
      const cartaoId = parseInt(filtroLancamentos.replace("cartao-", ""), 10);
      return lancamento.tipo === "gasto" && lancamento.forma_pagamento === "Crédito" && Number(lancamento.cartao_id) === cartaoId;
    }
    return true;
  });
  const cartaoSelecionado = filtroLancamentos.startsWith("cartao-") ? cartoes.find(cartao => `cartao-${cartao.id}` === filtroLancamentos) || null : null;
  const totalFiltradoLancamentos = lancamentosFiltrados.reduce((s, lancamento) => s + Number(lancamento.valor || 0), 0);
  const quantidadeFiltradaLancamentos = lancamentosFiltrados.length;
  const totalCartaoSelecionado = cartaoSelecionado
    ? lancamentosAgrupados.filter(lancamento => lancamento.tipo === "gasto" && lancamento.forma_pagamento === "Crédito" && Number(lancamento.cartao_id) === Number(cartaoSelecionado.id)).reduce((s, lancamento) => s + Number(lancamento.valor || 0), 0)
    : 0;
  const previewAgrupado = preview.reduce((acc, item) => {
    const grupo = getPreviewGroupLabel(item);
    if (!acc[grupo]) acc[grupo] = [];
    acc[grupo].push(item);
    return acc;
  }, {});

  const menuItems = [{ key: "ia", label: "IA" }, { key: "dashboard", label: "Dashboard" }, { key: "lancamentos", label: "Lançar" }, { key: "historico", label: "Histórico" }, { key: "metas", label: "Metas" }, { key: "fp", label: "FP" }];

  if (loadingAuth) return <div style={{ minHeight: "100vh", background: "#0F1117", display: "flex", alignItems: "center", justifyContent: "center" }}><p style={{ color: "#555", fontFamily: "'DM Sans', sans-serif" }}>Carregando...</p></div>;

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
              <button key={m} onClick={() => { setAuthMode(m); setAuthErro(""); }} style={{ flex: 1, padding: "0.5rem", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, background: authMode === m ? "#252832" : "transparent", color: authMode === m ? "#F0F0F0" : "#555", transition: "all 0.2s", fontFamily: "inherit" }}>{m === "login" ? "Entrar" : "Criar conta"}</button>
            ))}
          </div>
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} />
          <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAuth()} style={inputStyle} />
          {authErro && <p style={{ color: "#EF4444", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{authErro}</p>}
          <button onClick={handleAuth} disabled={authLoading} style={{ width: "100%", padding: "0.85rem", border: "none", borderRadius: "10px", background: "#6366F1", color: "#fff", fontSize: "0.95rem", fontWeight: 700, cursor: authLoading ? "not-allowed" : "pointer", opacity: authLoading ? 0.7 : 1, fontFamily: "inherit" }}>{authLoading ? "Aguarde..." : authMode === "login" ? "Entrar" : "Criar conta"}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0F1117", color: "#E8E8E8", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif", padding: "2rem 1.5rem", maxWidth: "480px", margin: "0 auto" }}>

      {editando && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div style={{ background: "#181B24", borderRadius: "16px 16px 0 0", padding: "1.5rem", width: "100%", maxWidth: "480px", border: "1px solid #252832", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Editar lançamento</p>
              <button onClick={() => setEditando(null)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "1.2rem" }}>×</button>
            </div>
            <div style={{ display: "flex", background: "#0F1117", borderRadius: "10px", padding: "4px", marginBottom: "1rem" }}>
              {["gasto", "receita"].map(t => (
                <button key={t} onClick={() => setEditando(e => ({ ...e, tipo: t, categoria: "", parcelado: t === "gasto" ? e.parcelado : false, parcela_atual: t === "gasto" ? e.parcela_atual : "1", total_parcelas: t === "gasto" ? e.total_parcelas : "", recorrente: t === "gasto" ? e.recorrente : false }))} style={{ flex: 1, padding: "0.5rem", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, background: editando.tipo === t ? (t === "receita" ? "#22C55E" : "#EF4444") : "transparent", color: editando.tipo === t ? "#fff" : "#555", transition: "all 0.2s", fontFamily: "inherit" }}>{t === "receita" ? "Receita" : "Gasto"}</button>
              ))}
            </div>
            <input type="text" placeholder="Descrição" value={editando.descricao} onChange={e => setEditando(ed => ({ ...ed, descricao: e.target.value }))} style={inputStyle} />
            <input type="text" placeholder={editando.parcelado ? "Valor da parcela (R$)" : "Valor (R$)"} value={editando.valor} onChange={e => setEditando(ed => ({ ...ed, valor: e.target.value }))} style={inputStyle} />
            <select value={editando.categoria} onChange={e => setEditando(ed => ({ ...ed, categoria: e.target.value }))} style={{ ...inputStyle, color: editando.categoria ? "#E8E8E8" : "#555", appearance: "none" }}>
              <option value="">Categoria</option>
              {categories[editando.tipo].map(c => <option key={c} value={c}>{normalizeText(c)}</option>)}
            </select>
            <select value={editando.forma_pagamento} onChange={e => setEditando(ed => ({ ...ed, forma_pagamento: e.target.value, cartao_id: "", parcelado: e.target.value === "Crédito" ? ed.parcelado : false, parcela_atual: e.target.value === "Crédito" ? ed.parcela_atual : "1", total_parcelas: e.target.value === "Crédito" ? ed.total_parcelas : "", recorrente: e.target.value === "Crédito" ? ed.recorrente : false }))} style={{ ...inputStyle, color: editando.forma_pagamento ? "#E8E8E8" : "#555", appearance: "none" }}>
              <option value="">Forma de pagamento</option>
              {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {editando.forma_pagamento === "Crédito" && cartoes.length > 0 && (
              <select value={editando.cartao_id} onChange={e => setEditando(ed => ({ ...ed, cartao_id: e.target.value }))} style={{ ...inputStyle, color: editando.cartao_id ? "#E8E8E8" : "#555", appearance: "none" }}>
                <option value="">Selecione o cartão</option>
                {cartoes.map(c => <option key={c.id} value={c.id}>{normalizeText(c.nome)}</option>)}
              </select>
            )}
            {editando.tipo === "gasto" && editando.forma_pagamento === "Crédito" && (
              <div style={{ marginBottom: "0.75rem" }}>
                <button onClick={() => setEditando(ed => ({ ...ed, parcelado: !ed.parcelado, parcela_atual: ed.parcelado ? "1" : (ed.parcela_atual || "1"), total_parcelas: ed.parcelado ? "" : ed.total_parcelas, recorrente: false }))} style={{ width: "100%", padding: "0.75rem", border: `1px solid ${editando.parcelado ? "#6366F1" : "#252832"}`, borderRadius: "10px", background: editando.parcelado ? "#6366F118" : "transparent", color: editando.parcelado ? "#6366F1" : "#555", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s" }}>
                  {editando.parcelado ? "Compra parcelada" : "+ Marcar como compra parcelada"}
                </button>
                {editando.parcelado && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <input type="number" placeholder="Parcela atual" min="1" max="48" value={editando.parcela_atual || "1"} onChange={e => setEditando(ed => ({ ...ed, parcela_atual: e.target.value }))} style={{ ...inputStyle, marginBottom: 0 }} />
                    <input type="number" placeholder="Total de parcelas" min="2" max="48" value={editando.total_parcelas || ""} onChange={e => setEditando(ed => ({ ...ed, total_parcelas: e.target.value }))} style={{ ...inputStyle, marginBottom: 0 }} />
                  </div>
                )}
                {editando.parcelado && editando.total_parcelas >= 2 && editando.valor && <p style={{ margin: "0.4rem 0 0", fontSize: "0.78rem", color: "#888" }}>Atualiza da parcela {editando.parcela_atual || 1} até {editando.total_parcelas}, repetindo {formatBRL(parseFloat(String(editando.valor).replace(",", ".")) || 0)} por mês.</p>}
              </div>
            )}
            <input type="date" value={editando.data_lancamento} onChange={e => setEditando(ed => ({ ...ed, data_lancamento: e.target.value }))} style={inputStyle} />
            {editando.tipo === "gasto" && !editando.parcelado && (
              <button onClick={() => setEditando(ed => ({ ...ed, recorrente: !ed.recorrente }))} style={{ width: "100%", padding: "0.75rem", border: `1px solid ${editando.recorrente ? "#6366F1" : "#252832"}`, borderRadius: "10px", background: editando.recorrente ? "#6366F118" : "transparent", color: editando.recorrente ? "#6366F1" : "#555", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: "0.75rem", transition: "all 0.2s" }}>
                {editando.recorrente ? "Recorrente ativa até Dez/" + new Date().getFullYear() : "Marcar como recorrente"}
              </button>
            )}
            {editando.tipo === "gasto" && (
              <button onClick={() => setEditando(ed => ({ ...ed, poderia_ter_evitado: !ed.poderia_ter_evitado }))} style={{ width: "100%", padding: "0.75rem", border: `1px solid ${editando.poderia_ter_evitado ? "#F59E0B" : "#252832"}`, borderRadius: "10px", background: editando.poderia_ter_evitado ? "#F59E0B18" : "transparent", color: editando.poderia_ter_evitado ? "#F59E0B" : "#555", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: "0.75rem", transition: "all 0.2s" }}>
                {editando.poderia_ter_evitado ? "Marcado como gasto evitável" : "Marcar como gasto evitável"}
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

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.5rem" }}>
        <div>
          <p style={{ fontSize: "0.7rem", letterSpacing: "0.2em", color: "#555", textTransform: "uppercase", margin: "0 0 0.25rem" }}>
            Pradex Finanças {userRole === "super_admin" ? "· Admin" : userRole === "assessor" ? "· Assessor" : ""}
          </p>
          <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 600, color: "#F0F0F0", letterSpacing: "-0.03em" }}>
            {monthNames[new Date().getMonth()]} {new Date().getFullYear()}
          </h1>
        </div>
        <button onClick={handleLogout} style={{ background: "none", border: "1px solid #252832", borderRadius: "8px", color: "#555", cursor: "pointer", padding: "0.4rem 0.75rem", fontSize: "0.75rem", fontFamily: "inherit" }}>Sair</button>
      </div>

      {/* CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1.5rem" }}>
        <div style={{ background: "linear-gradient(180deg, #191D27 0%, #181B24 100%)", borderRadius: "14px", padding: "1rem 0.85rem", border: "1px solid #252832" }}>
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.64rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.12em" }}>Ganhos</p>
          <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#22C55E" }}>{formatBRL(totalReceitas)}</p>
        </div>
        <div style={{ background: "linear-gradient(180deg, #191D27 0%, #181B24 100%)", borderRadius: "14px", padding: "1rem 0.85rem", border: "1px solid #252832" }}>
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.64rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.12em" }}>Débito</p>
          <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#EF4444" }}>{formatBRL(gastosDebito)}</p>
        </div>
        <div style={{ background: "linear-gradient(180deg, #191D27 0%, #181B24 100%)", borderRadius: "14px", padding: "1rem 0.85rem", border: "1px solid #252832" }}>
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.64rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.12em" }}>Cartões</p>
          {gastosPorCartao.length > 0 ? gastosPorCartao.map((item, i) => (
            <div key={item.cartao.id} style={{ marginBottom: i < gastosPorCartao.length - 1 ? "0.35rem" : 0 }}>
              <p style={{ margin: 0, fontSize: "0.64rem", color: "#777" }}>{normalizeText(item.cartao.nome)}</p>
              <p style={{ margin: 0, fontSize: "0.84rem", fontWeight: 700, color: "#EF4444" }}>{formatBRL(item.total)}</p>
            </div>
          )) : <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "#333" }}>—</p>}
        </div>
      </div>

      {/* MENU */}
      <div style={{ display: "flex", background: "#0F1117", borderRadius: "10px", padding: "4px", marginBottom: "1.5rem", border: "1px solid #252832", gap: "2px" }}>
        {menuItems.map(t => (
          <button key={t.key} onClick={() => { setTela(t.key); setErro(""); setErroIA(""); }} style={{ flex: 1, padding: "0.5rem 0.25rem", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: t.key === "ia" ? "0.78rem" : "0.7rem", fontWeight: t.key === "ia" ? 700 : 600, whiteSpace: "nowrap", background: tela === t.key ? (t.key === "ia" ? "#6366F1" : "#252832") : "transparent", color: tela === t.key ? "#F0F0F0" : t.key === "ia" ? "#6366F1" : "#555", transition: "all 0.2s", fontFamily: "inherit" }}>{t.label}</button>
        ))}
      </div>

      {/* IA */}
      {tela === "ia" && (
        <div>
          <div style={{ background: "#6366F110", borderRadius: "20px", padding: "1.75rem 1.5rem", marginBottom: "1.25rem", border: "1px solid #6366F140", textAlign: "center" }}>
            <p style={{ margin: "0 0 0.5rem", fontSize: "2rem" }}>IA</p>
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.2rem", fontWeight: 700, color: "#F0F0F0" }}>Importar com Inteligência Artificial</h2>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#888", lineHeight: 1.6 }}>Cole seus gastos em texto livre, extrato, WhatsApp ou bloco de notas e a IA organiza tudo automaticamente.</p>
          </div>
          <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", border: "1px solid #252832", marginBottom: "1.25rem" }}>
            <textarea placeholder="Cole aqui o texto com seus gastos..." value={textoIA} onChange={e => setTextoIA(e.target.value)} rows={6} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
            {erroIA && <p style={{ color: "#EF4444", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{erroIA}</p>}
            {preview.length === 0 && (
              <button onClick={processarComIA} disabled={processando} style={{ width: "100%", padding: "0.95rem", border: "none", borderRadius: "12px", background: processando ? "#4a4c9a" : "#6366F1", color: "#fff", fontSize: "1rem", fontWeight: 700, cursor: processando ? "not-allowed" : "pointer", transition: "all 0.2s", fontFamily: "inherit" }}>
                {processando ? "Processando..." : "Processar com IA"}
              </button>
            )}
            {preview.length > 0 && (
              <>
                <div style={{ background: "#121521", borderRadius: "14px", border: "1px solid #252832", padding: "0.9rem 1rem", margin: "1rem 0 0.9rem" }}>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.76rem", color: "#A3A3A3", textTransform: "uppercase", letterSpacing: "0.1em" }}>{preview.length} lançamento{preview.length > 1 ? "s" : ""} identificado{preview.length > 1 ? "s" : ""}</p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#666", lineHeight: 1.5 }}>A prévia agora agrupa os itens por contexto, mostra o nível de confiança da IA e permite edição rápida antes de confirmar.</p>
                </div>
                {Object.entries(previewAgrupado).map(([grupo, itens]) => (
                  <div key={grupo} style={{ marginBottom: "0.9rem" }}>
                    <p style={{ margin: "0 0 0.55rem", fontSize: "0.72rem", color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>{grupo}</p>
                    {itens.map((l) => {
                      const confianca = getPreviewConfidence(l);
                      return (
                        <div key={l.id_preview} style={{ background: "#0F1117", borderRadius: "12px", marginBottom: "0.55rem", border: `1px solid ${confianca.border}`, padding: "0.9rem 1rem" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                            <div style={{ width: "34px", height: "34px", borderRadius: "10px", flexShrink: 0, background: l.tipo === "receita" ? "#22C55E18" : "#EF444418", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.95rem" }}>{l.tipo === "receita" ? "+" : "-"}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap", marginBottom: "0.2rem" }}>
                                <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 600, color: "#E8E8E8", lineHeight: 1.25 }}>{normalizeText(l.descricao)}</p>
                                <span style={{ ...badgeBaseStyle, color: confianca.color, background: confianca.background }}>{confianca.label}</span>
                              </div>
                              <p style={{ margin: 0, fontSize: "0.72rem", color: "#666", lineHeight: 1.3 }}>{normalizeText(l.categoria)} · {getFormaPagamentoLabel(l.forma_pagamento)} · {formatData(l.data_lancamento)}</p>
                            </div>
                            <p style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700, color: l.tipo === "receita" ? "#22C55E" : "#EF4444", flexShrink: 0 }}>{l.tipo === "receita" ? "+" : "-"}{formatBRL(l.valor)}</p>
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                            <button onClick={() => togglePreviewEdit(l.id_preview)} style={{ padding: "0.45rem 0.75rem", borderRadius: "8px", border: "1px solid #252832", background: l._editando ? "#6366F118" : "transparent", color: l._editando ? "#6366F1" : "#888", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{l._editando ? "Fechar edição" : "Editar"}</button>
                            <button onClick={() => removerPreviewItem(l.id_preview)} style={{ padding: "0.45rem 0.75rem", borderRadius: "8px", border: "1px solid #252832", background: "transparent", color: "#888", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Remover</button>
                          </div>
                          {l._editando && (
                            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #1B1F2A" }}>
                              <input type="text" value={l.descricao} onChange={e => atualizarPreviewItem(l.id_preview, { descricao: e.target.value })} placeholder="Descrição" style={{ ...inputStyle, marginBottom: "0.6rem", fontSize: "0.84rem", padding: "0.65rem 0.85rem" }} />
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem" }}>
                                <input type="text" value={String(l.valor ?? "")} onChange={e => atualizarPreviewItem(l.id_preview, { valor: e.target.value })} placeholder="Valor" style={{ ...inputStyle, marginBottom: "0.6rem", fontSize: "0.84rem", padding: "0.65rem 0.85rem" }} />
                                <input type="date" value={l.data_lancamento || today} onChange={e => atualizarPreviewItem(l.id_preview, { data_lancamento: e.target.value })} style={{ ...inputStyle, marginBottom: "0.6rem", fontSize: "0.84rem", padding: "0.65rem 0.85rem" }} />
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem" }}>
                                <select value={l.tipo || "gasto"} onChange={e => atualizarPreviewItem(l.id_preview, { tipo: e.target.value, categoria: "" })} style={{ ...inputStyle, marginBottom: "0.6rem", fontSize: "0.84rem", padding: "0.65rem 0.85rem", color: "#E8E8E8", appearance: "none" }}>
                                  <option value="gasto">Gasto</option>
                                  <option value="receita">Receita</option>
                                </select>
                                <select value={l.categoria || ""} onChange={e => atualizarPreviewItem(l.id_preview, { categoria: e.target.value })} style={{ ...inputStyle, marginBottom: "0.6rem", fontSize: "0.84rem", padding: "0.65rem 0.85rem", color: l.categoria ? "#E8E8E8" : "#555", appearance: "none" }}>
                                  <option value="">Categoria</option>
                                  {categories[l.tipo || "gasto"].map(c => <option key={`${l.id_preview}-${c}`} value={c}>{normalizeText(c)}</option>)}
                                </select>
                              </div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem" }}>
                                <select value={l.forma_pagamento || ""} onChange={e => atualizarPreviewItem(l.id_preview, { forma_pagamento: e.target.value, cartao_id: e.target.value === "Crédito" ? l.cartao_id : "" })} style={{ ...inputStyle, marginBottom: "0.6rem", fontSize: "0.84rem", padding: "0.65rem 0.85rem", color: l.forma_pagamento ? "#E8E8E8" : "#555", appearance: "none" }}>
                                  <option value="">Forma de pagamento</option>
                                  {formasPagamento.map(f => <option key={`${l.id_preview}-${f}`} value={f}>{f}</option>)}
                                </select>
                                {l.forma_pagamento === "Crédito" && cartoes.length > 0 ? (
                                  <select value={l.cartao_id || ""} onChange={e => atualizarPreviewItem(l.id_preview, { cartao_id: e.target.value })} style={{ ...inputStyle, marginBottom: "0.6rem", fontSize: "0.84rem", padding: "0.65rem 0.85rem", color: l.cartao_id ? "#E8E8E8" : "#555", appearance: "none" }}>
                                    <option value="">Selecione o cartão</option>
                                    {cartoes.map(c => <option key={`${l.id_preview}-cartao-${c.id}`} value={c.id}>{normalizeText(c.nome)}</option>)}
                                  </select>
                                ) : (
                                  <div style={{ ...inputStyle, marginBottom: "0.6rem", fontSize: "0.78rem", padding: "0.65rem 0.85rem", color: "#666", display: "flex", alignItems: "center" }}>Cartão não aplicável</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
                  <button onClick={() => { setPreview([]); setTextoIA(""); }} style={{ flex: 1, padding: "0.75rem", border: "1px solid #252832", borderRadius: "10px", background: "transparent", color: "#888", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
                  <button onClick={confirmarImportacao} disabled={saving} style={{ flex: 2, padding: "0.75rem", border: "none", borderRadius: "10px", background: importado ? "#16A34A" : "#22C55E", color: "#fff", fontSize: "0.9rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, fontFamily: "inherit" }}>
                    {saving ? "Salvando..." : importado ? "Importado!" : `Confirmar ${preview.length} lançamento${preview.length > 1 ? "s" : ""}`}
                  </button>
                </div>
              </>
            )}
          </div>
          {rascunhos.length > 0 && (
            <div>
              <p style={{ margin: "0 0 0.75rem", fontSize: "0.75rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Pendentes do WhatsApp ({rascunhos.length})</p>
              {rascunhos.map(r => (
                <div key={r.id} style={{ background: "#181B24", borderRadius: "16px", padding: "1.25rem", marginBottom: "0.75rem", border: "1px solid #252832" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", marginBottom: "0.75rem" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0, background: r.tipo === "receita" ? "#22C55E18" : "#EF444418", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>{r.tipo === "receita" ? "+" : "-"}</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: "0 0 0.16rem", fontSize: "0.9rem", fontWeight: 600, color: "#E8E8E8", lineHeight: 1.25 }}>{normalizeText(r.descricao)}</p>
                      <p style={{ margin: "0 0 0.2rem", fontSize: "0.85rem", fontWeight: 700, color: r.tipo === "receita" ? "#22C55E" : "#EF4444" }}>{formatBRL(r.valor)}</p>
                      <p style={{ margin: 0, fontSize: "0.7rem", color: "#555" }}>{normalizeText(r.categoria)} · {getFormaPagamentoLabel(r.forma_pagamento)}</p>
                    </div>
                  </div>
                  {r.texto_original && <div style={{ background: "#0F1117", borderRadius: "8px", padding: "0.5rem 0.75rem", marginBottom: "0.75rem" }}><p style={{ margin: 0, fontSize: "0.72rem", color: "#555" }}>Texto original: "{r.texto_original}"</p></div>}
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button onClick={() => rejeitarRascunho(r.id)} style={{ flex: 1, padding: "0.65rem", border: "1px solid #252832", borderRadius: "10px", background: "transparent", color: "#555", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Rejeitar</button>
                    <button onClick={() => confirmarRascunho(r)} style={{ flex: 2, padding: "0.65rem", border: "none", borderRadius: "10px", background: "#22C55E", color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Confirmar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DASHBOARD */}
      {tela === "dashboard" && (
        <div>
          {lancamentos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem 0", color: "#444" }}>
              <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>•</p>
              <p style={{ fontSize: "0.95rem", color: "#CFCFCF", margin: "0 0 0.4rem" }}>Seu painel ainda está vazio.</p>
              <p style={{ fontSize: "0.82rem", color: "#666", margin: 0 }}>Adicione os primeiros lançamentos para visualizar o resumo do mês.</p>
            </div>
          ) : (
            <>
              {gastosEvitaveis.length > 0 && (
                <div style={{ background: "#F59E0B0F", borderRadius: "16px", padding: "1.25rem 1.5rem", marginBottom: "1rem", border: "1px solid #F59E0B30" }}>
                  <p style={{ margin: "0 0 0.5rem", fontSize: "0.75rem", fontWeight: 600, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.1em" }}>Botão do Arrependimento</p>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "#E8E8E8" }}>Você marcou <strong style={{ color: "#F59E0B" }}>{formatBRL(totalEvitavel)}</strong> em gastos evitáveis.</p>
                  <p style={{ margin: 0, fontSize: "0.8rem", color: "#888" }}>Investindo esse dinheiro, teria <strong style={{ color: "#22C55E" }}>{formatBRL(totalImpacto12m)}</strong> em 12 meses.</p>
                </div>
              )}
              <div style={{ background: "linear-gradient(180deg, #1A1E29 0%, #181B24 100%)", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832", boxShadow: "0 10px 30px rgba(0,0,0,0.18)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", marginBottom: "1rem" }}>
                  <div>
                    <p style={{ margin: "0 0 0.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Resumo dos gastos</p>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "#666" }}>Separação entre débito e cartão no mês atual</p>
                  </div>
                  <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#E8E8E8" }}>{formatBRL(totalGastos)}</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div style={{ background: "#0F1117", borderRadius: "12px", padding: "1rem", border: "1px solid #252832" }}>
                    <p style={{ margin: "0 0 0.35rem", fontSize: "0.7rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>Débito</p>
                    <p style={{ margin: "0 0 0.35rem", fontSize: "0.95rem", fontWeight: 700, color: "#EF4444" }}>{formatBRL(gastosDebito)}</p>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#777" }}>{percentualDebito.toFixed(0)}% dos gastos</p>
                  </div>
                  <div style={{ background: "#0F1117", borderRadius: "12px", padding: "1rem", border: "1px solid #252832" }}>
                    <p style={{ margin: "0 0 0.35rem", fontSize: "0.7rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>Cartão</p>
                    <p style={{ margin: "0 0 0.35rem", fontSize: "0.95rem", fontWeight: 700, color: "#F59E0B" }}>{formatBRL(gastosCredito)}</p>
                    <p style={{ margin: 0, fontSize: "0.72rem", color: "#777" }}>{percentualCredito.toFixed(0)}% dos gastos</p>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem", marginBottom: "1rem" }}>
                <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", border: "1px solid #252832" }}>
                  <p style={{ margin: "0 0 1.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Gastos por categoria</p>
                  {gastosPorCategoria.length > 0 ? gastosPorCategoria.map((item, i) => (
                    <div key={item.cat} style={{ marginBottom: "0.85rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem", gap: "0.75rem" }}>
                        <span style={{ fontSize: "0.82rem", color: "#CCC" }}>{item.cat}</span>
                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: COLORS[i % COLORS.length], whiteSpace: "nowrap" }}>{formatBRL(item.total)}</span>
                      </div>
                      <div style={{ background: "#0F1117", borderRadius: "4px", height: "6px", overflow: "hidden" }}><div style={{ background: COLORS[i % COLORS.length], height: "100%", width: `${(item.total / maxGasto) * 100}%`, borderRadius: "4px" }} /></div>
                    </div>
                  )) : <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>Sem gastos neste mês.</p>}
                </div>
                <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", border: "1px solid #252832" }}>
                  <p style={{ margin: "0 0 1.25rem", fontSize: "0.75rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Próximas parcelas</p>
                  {projecaoParcelas.some(m => m.total > 0) ? projecaoParcelas.map((mes) => (
                    <div key={mes.key} style={{ padding: "0.85rem 0", borderBottom: "1px solid #252832" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem", marginBottom: mes.parcelas.length > 0 ? "0.45rem" : 0 }}>
                        <div>
                          <p style={{ margin: "0 0 0.15rem", fontSize: "0.82rem", color: "#E8E8E8", fontWeight: 600 }}>{mes.label}</p>
                          <p style={{ margin: 0, fontSize: "0.7rem", color: "#555" }}>{mes.comprasAtivas > 0 ? `${mes.comprasAtivas} compra${mes.comprasAtivas > 1 ? "s" : ""} parcelada${mes.comprasAtivas > 1 ? "s" : ""}` : "Sem parcelas"}</p>
                        </div>
                        <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: mes.total > 0 ? "#EF4444" : "#555", whiteSpace: "nowrap" }}>{formatBRL(mes.total)}</p>
                      </div>
                      {mes.parcelas.map((parcela) => (
                        <div key={parcela.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", marginTop: "0.3rem" }}>
                          <p style={{ margin: 0, fontSize: "0.72rem", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {limparDescricaoParcela(parcela.descricao)} <span style={{ color: "#6366F1" }}>{parcela.parcela_atual}/{parcela.total_parcelas}x</span>
                          </p>
                          <p style={{ margin: 0, fontSize: "0.72rem", color: "#CCC", whiteSpace: "nowrap" }}>{formatBRL(parcela.valor)}</p>
                        </div>
                      ))}
                    </div>
                  )) : <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>Nenhuma parcela futura prevista nos próximos 3 meses.</p>}
                </div>
              </div>
              {gastosPorCartao.length > 0 && (
                <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832" }}>
                  <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Faturas do mês</p>
                  {gastosPorCartao.map((item) => (
                    <div key={item.cartao.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 0", borderBottom: "1px solid #252832" }}>
                      <div>
                        <p style={{ margin: "0 0 0.12rem", fontSize: "0.9rem", color: "#E8E8E8", fontWeight: 500, lineHeight: 1.25 }}>{normalizeText(item.cartao.nome)}</p>
                        <p style={{ margin: 0, fontSize: "0.7rem", color: "#555", lineHeight: 1.25 }}>Fecha dia {item.cartao.dia_fechamento} · Vence dia {item.cartao.dia_vencimento}</p>
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
                      <p style={{ margin: "0 0 0.12rem", fontSize: "0.85rem", color: "#E8E8E8", lineHeight: 1.25 }}>
                        {l.poderia_ter_evitado && <span style={{ ...badgeBaseStyle, marginRight: "6px", color: "#F59E0B", background: "#F59E0B15" }}>Evitável</span>}
                        {l.recorrente && <span style={{ ...badgeBaseStyle, marginRight: "6px", color: "#22C55E", background: "#22C55E15" }}>Recorrente</span>}
                        {normalizeText(l.descricao)}
                        {l.total_parcelas && <span style={{ marginLeft: "6px", fontSize: "0.7rem", color: "#555", background: "#252832", padding: "1px 6px", borderRadius: "4px" }}>{l.parcela_atual}/{l.total_parcelas}x</span>}
                      </p>
                      <p style={{ margin: 0, fontSize: "0.7rem", color: "#555", lineHeight: 1.25 }}>{normalizeText(l.categoria)} · {getFormaPagamentoLabel(l.forma_pagamento)} · {formatData(l.data_lancamento)}</p>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: l.tipo === "receita" ? "#22C55E" : "#EF4444" }}>{l.tipo === "receita" ? "+" : "-"}{formatBRL(l.valor)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* LANÇAR */}
      {tela === "lancamentos" && (
        <>
          <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832" }}>
            <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Novo lançamento</p>
            <div style={{ display: "flex", background: "#0F1117", borderRadius: "10px", padding: "4px", marginBottom: "1rem" }}>
              {["gasto", "receita"].map(t => (
                <button key={t} onClick={() => { setTipo(t); setForm(f => ({ ...f, categoria: "", parcelado: false, parcela_atual: "1", total_parcelas: "" })); }} style={{ flex: 1, padding: "0.5rem", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600, background: tipo === t ? (t === "receita" ? "#22C55E" : "#EF4444") : "transparent", color: tipo === t ? "#fff" : "#555", transition: "all 0.2s", fontFamily: "inherit" }}>{t === "receita" ? "Receita" : "Gasto"}</button>
              ))}
            </div>
            <input type="text" placeholder="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={inputStyle} />
            <input type="text" placeholder={form.parcelado ? "Valor da parcela (R$)" : "Valor total (R$)"} value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} style={inputStyle} />
            <select value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} style={{ ...inputStyle, color: form.categoria ? "#E8E8E8" : "#555", appearance: "none" }}>
              <option value="">Categoria</option>
              {categories[tipo].map(c => <option key={c} value={c}>{normalizeText(c)}</option>)}
            </select>
            <select value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value, cartao_id: "", parcelado: false, parcela_atual: "1", total_parcelas: "" }))} style={{ ...inputStyle, color: form.forma_pagamento ? "#E8E8E8" : "#555", appearance: "none" }}>
              <option value="">Forma de pagamento</option>
              {formasPagamento.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            {form.forma_pagamento === "Crédito" && cartoes.length > 0 && (
              <select value={form.cartao_id} onChange={e => setForm(f => ({ ...f, cartao_id: e.target.value }))} style={{ ...inputStyle, color: form.cartao_id ? "#E8E8E8" : "#555", appearance: "none" }}>
                <option value="">Selecione o cartão</option>
                {cartoes.map(c => <option key={c.id} value={c.id}>{normalizeText(c.nome)}</option>)}
              </select>
            )}
            {form.forma_pagamento === "Crédito" && (
              <div style={{ marginBottom: "0.75rem" }}>
                <button onClick={() => setForm(f => ({ ...f, parcelado: !f.parcelado, parcela_atual: "1", total_parcelas: "", recorrente: false }))} style={{ width: "100%", padding: "0.65rem 1rem", border: `1px solid ${form.parcelado ? "#6366F1" : "#252832"}`, borderRadius: "10px", background: form.parcelado ? "#6366F118" : "transparent", color: form.parcelado ? "#6366F1" : "#555", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s" }}>
                  {form.parcelado ? "Compra parcelada" : "+ Parcelar no crédito"}
                </button>
                {form.parcelado && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
                    <input type="number" placeholder="Parcela atual" min="1" max="48" value={form.parcela_atual} onChange={e => setForm(f => ({ ...f, parcela_atual: e.target.value }))} style={{ ...inputStyle, marginBottom: 0 }} />
                    <input type="number" placeholder="Total de parcelas" min="2" max="48" value={form.total_parcelas} onChange={e => setForm(f => ({ ...f, total_parcelas: e.target.value }))} style={{ ...inputStyle, marginBottom: 0 }} />
                  </div>
                )}
                {form.parcelado && form.total_parcelas >= 2 && form.valor && <p style={{ margin: "0.4rem 0 0", fontSize: "0.78rem", color: "#888" }}>Lança da parcela {form.parcela_atual || 1} até {form.total_parcelas}, repetindo {formatBRL(parseFloat(form.valor.replace(",", ".")) || 0)} por mês.</p>}
              </div>
            )}
            {tipo === "gasto" && !form.parcelado && (
              <button onClick={() => setForm(f => ({ ...f, recorrente: !f.recorrente }))} style={{ width: "100%", padding: "0.65rem 1rem", border: `1px solid ${form.recorrente ? "#6366F1" : "#252832"}`, borderRadius: "10px", background: form.recorrente ? "#6366F118" : "transparent", color: form.recorrente ? "#6366F1" : "#555", fontSize: "0.85rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left", transition: "all 0.2s", marginBottom: "0.75rem" }}>
                {form.recorrente ? `Recorrente ativa até Dez/${new Date().getFullYear()}` : "Marcar como recorrente"}
              </button>
            )}
            <input type="date" value={form.data_lancamento} onChange={e => setForm(f => ({ ...f, data_lancamento: e.target.value }))} style={inputStyle} />
            {erro && <p style={{ color: "#EF4444", fontSize: "0.8rem", marginBottom: "0.75rem" }}>{erro}</p>}
            <button onClick={handleSubmit} disabled={saving} style={{ width: "100%", padding: "0.85rem", border: "none", borderRadius: "10px", background: success ? "#16A34A" : tipo === "receita" ? "#22C55E" : "#EF4444", color: "#fff", fontSize: "0.95rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1, transition: "all 0.2s", fontFamily: "inherit" }}>{saving ? "Salvando..." : success ? "Salvo!" : form.parcelado && form.total_parcelas >= 2 ? `Parcelar em ${form.total_parcelas}x` : form.recorrente ? "Adicionar + criar recorrências" : "Adicionar"}</button>
          </div>

          <button onClick={() => setMostrarCategorias(!mostrarCategorias)} style={{ ...sectionToggleStyle, marginBottom: "0.75rem" }}>
            <span style={{ display: "block", fontSize: "0.84rem", color: "#E8E8E8" }}>{mostrarCategorias ? "Fechar categorias" : "Gerenciar categorias"}</span>
            <span style={{ display: "block", fontSize: "0.72rem", color: "#666", fontWeight: 500, marginTop: "0.2rem" }}>Organize as categorias de receitas e gastos do app.</span>
          </button>
          {mostrarCategorias && (
            <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832" }}>
              <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Nova categoria</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                {["gasto", "receita"].map(t => (
                  <button key={t} onClick={() => setNovaCategoria(n => ({ ...n, tipo: t }))} style={{ padding: "0.5rem", border: `1px solid ${novaCategoria.tipo === t ? "#6366F1" : "#252832"}`, borderRadius: "8px", background: novaCategoria.tipo === t ? "#6366F118" : "transparent", color: novaCategoria.tipo === t ? "#6366F1" : "#555", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {t === "gasto" ? "Gasto" : "Receita"}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
                <input type="text" placeholder="Nome da categoria" value={novaCategoria.nome} onChange={e => setNovaCategoria(n => ({ ...n, nome: e.target.value }))} onKeyDown={e => e.key === "Enter" && handleAddCategoria()} style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                <button onClick={handleAddCategoria} style={{ padding: "0.75rem 1rem", border: "none", borderRadius: "10px", background: "#6366F1", color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>Adicionar</button>
              </div>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.7rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em" }}>Gastos</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1rem" }}>
                {categories.gasto.map(c => (
                  <div key={c} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "#0F1117", borderRadius: "8px", padding: "0.3rem 0.6rem", border: "1px solid #252832" }}>
                    <span style={{ fontSize: "0.78rem", color: "#CCC" }}>{c}</span>
                    <button onClick={() => handleRemoveCategoria(c, "gasto")} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
              <p style={{ margin: "0 0 0.5rem", fontSize: "0.7rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em" }}>Receitas</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {categories.receita.map(c => (
                  <div key={c} style={{ display: "flex", alignItems: "center", gap: "0.25rem", background: "#0F1117", borderRadius: "8px", padding: "0.3rem 0.6rem", border: "1px solid #252832" }}>
                    <span style={{ fontSize: "0.78rem", color: "#CCC" }}>{c}</span>
                    <button onClick={() => handleRemoveCategoria(c, "receita")} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => setMostrarFormCartao(!mostrarFormCartao)} style={{ ...sectionToggleStyle, marginBottom: "1rem" }}>
            <span style={{ display: "block", fontSize: "0.84rem", color: "#E8E8E8" }}>{mostrarFormCartao ? "Fechar cartões" : "Gerenciar cartões"}</span>
            <span style={{ display: "block", fontSize: "0.72rem", color: "#666", fontWeight: 500, marginTop: "0.2rem" }}>Cadastre os cartões para acompanhar compras e faturas.</span>
          </button>
          {mostrarFormCartao && (
            <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832" }}>
              <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Novo cartão</p>
              <input type="text" placeholder="Nome do cartão" value={formCartao.nome} onChange={e => setFormCartao(f => ({ ...f, nome: e.target.value }))} style={inputStyle} />
              <input type="text" placeholder="Bandeira (ex: Visa)" value={formCartao.bandeira} onChange={e => setFormCartao(f => ({ ...f, bandeira: e.target.value }))} style={inputStyle} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <input type="number" placeholder="Dia fechamento" min="1" max="31" value={formCartao.dia_fechamento} onChange={e => setFormCartao(f => ({ ...f, dia_fechamento: e.target.value }))} style={{ ...inputStyle, marginBottom: 0 }} />
                <input type="number" placeholder="Dia vencimento" min="1" max="31" value={formCartao.dia_vencimento} onChange={e => setFormCartao(f => ({ ...f, dia_vencimento: e.target.value }))} style={{ ...inputStyle, marginBottom: 0 }} />
              </div>
              {erroCartao && <p style={{ color: "#EF4444", fontSize: "0.8rem", marginBottom: "0.75rem", marginTop: "0.75rem" }}>{erroCartao}</p>}
              <button onClick={handleSaveCartao} disabled={savingCartao} style={{ width: "100%", padding: "0.85rem", border: "none", borderRadius: "10px", marginTop: "0.75rem", background: successCartao ? "#16A34A" : "#6366F1", color: "#fff", fontSize: "0.95rem", fontWeight: 700, cursor: savingCartao ? "not-allowed" : "pointer", opacity: savingCartao ? 0.7 : 1, transition: "all 0.2s", fontFamily: "inherit" }}>{savingCartao ? "Salvando..." : successCartao ? "Salvo!" : "Adicionar cartão"}</button>
              {cartoes.length > 0 && (
                <div style={{ marginTop: "1rem" }}>
                  {cartoes.map(c => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", padding: "0.75rem 0", borderBottom: "1px solid #252832", gap: "0.75rem" }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: "0 0 0.12rem", fontSize: "0.9rem", fontWeight: 600, color: "#E8E8E8", lineHeight: 1.25 }}>{normalizeText(c.nome)}</p>
                        <p style={{ margin: 0, fontSize: "0.72rem", color: "#555", lineHeight: 1.25 }}>{normalizeText(c.bandeira) && normalizeText(c.bandeira) + " · "}Fecha dia {c.dia_fechamento || "—"} · Vence dia {c.dia_vencimento || "—"}</p>
                      </div>
                      <button onClick={() => handleDeleteCartao(c.id)} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem" }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <p style={{ margin: "0 0 1rem", fontSize: "0.7rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.15em" }}>Lançamentos {loading && "· carregando..."}</p>
            <div style={{ marginBottom: "1rem" }}>
              <select value={filtroLancamentos} onChange={e => setFiltroLancamentos(e.target.value)} style={{ ...inputStyle, marginBottom: 0, color: "#E8E8E8", appearance: "none" }}>
                {opcoesFiltroLancamentos.map(opcao => <option key={opcao.value} value={opcao.value}>{opcao.label}</option>)}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.6rem", marginTop: "0.75rem" }}>
                <div style={{ background: "#181B24", borderRadius: "10px", border: "1px solid #252832", padding: "0.8rem 0.9rem" }}>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.66rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>Total filtrado</p>
                  <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#E8E8E8" }}>{formatBRL(totalFiltradoLancamentos)}</p>
                </div>
                <div style={{ background: "#181B24", borderRadius: "10px", border: "1px solid #252832", padding: "0.8rem 0.9rem" }}>
                  <p style={{ margin: "0 0 0.25rem", fontSize: "0.66rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>Lançamentos</p>
                  <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#E8E8E8" }}>{quantidadeFiltradaLancamentos}</p>
                </div>
                {cartaoSelecionado && (
                  <div style={{ background: "#181B24", borderRadius: "10px", border: "1px solid #252832", padding: "0.8rem 0.9rem" }}>
                    <p style={{ margin: "0 0 0.25rem", fontSize: "0.66rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>{normalizeText(cartaoSelecionado.nome)}</p>
                    <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "#F59E0B" }}>{formatBRL(totalCartaoSelecionado)}</p>
                  </div>
                )}
              </div>
              {cartaoSelecionado && (
                <p style={{ margin: "0.6rem 0 0", fontSize: "0.76rem", color: "#777" }}>
                  Mostrando apenas compras no cartão {normalizeText(cartaoSelecionado.nome)}.
                </p>
              )}
            </div>
            {!loading && lancamentosFiltrados.length === 0 && (
              <div style={{ textAlign: "center", padding: "2.2rem 1rem", color: "#444", background: "#141720", borderRadius: "14px", border: "1px solid #252832" }}>
                <p style={{ margin: "0 0 0.35rem", fontSize: "0.92rem", color: "#CFCFCF" }}>Nenhum lançamento encontrado nesse filtro.</p>
                <p style={{ margin: 0, fontSize: "0.78rem", color: "#666" }}>Tente trocar o filtro ou adicionar um novo lançamento.</p>
              </div>
            )}
            {lancamentosFiltrados.map(l => (
              <div key={l._idsGrupo ? `grupo-${l._idsGrupo[0]}` : l.id} onClick={() => handleEdit(l)} style={{ display: "flex", alignItems: "center", padding: "0.9rem 1rem", background: l.poderia_ter_evitado ? "#F59E0B08" : "#181B24", borderRadius: "12px", marginBottom: "0.5rem", border: `1px solid ${l.poderia_ter_evitado ? "#F59E0B30" : "#252832"}`, gap: "0.75rem", cursor: "pointer" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", flexShrink: 0, background: l.tipo === "receita" ? "#22C55E18" : "#EF444418", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>{l.tipo === "receita" ? "+" : "-"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: "0 0 0.12rem", fontSize: "0.9rem", fontWeight: 500, color: "#E8E8E8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.25 }}>
                    {normalizeText(l.descricao)}
                    {l.total_parcelas && <span style={{ marginLeft: "6px", fontSize: "0.68rem", color: "#6366F1", background: "#6366F115", padding: "1px 5px", borderRadius: "4px" }}>{l.parcela_atual}/{l.total_parcelas}x</span>}
                    {l._totalMeses && l._totalMeses > 1 && <span style={{ marginLeft: "6px", fontSize: "0.68rem", color: "#22C55E", background: "#22C55E15", padding: "1px 6px", borderRadius: "999px" }}>{l._totalMeses} meses</span>}
                  </p>
                  <p style={{ margin: 0, fontSize: "0.72rem", color: "#555", lineHeight: 1.25 }}>{normalizeText(l.categoria)} · {getFormaPagamentoLabel(l.forma_pagamento)} · {formatData(l.data_lancamento)}</p>
                </div>
                {l.tipo === "gasto" && !l._totalMeses && (
                  <div style={{ width: "76px", display: "flex", justifyContent: "center", alignItems: "center", flexShrink: 0 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleArrependimento(e, l); }}
                      style={{ background: l.poderia_ter_evitado ? "#F59E0B15" : "transparent", border: `1px solid ${l.poderia_ter_evitado ? "#F59E0B35" : "#252832"}`, cursor: "pointer", fontSize: "0.66rem", padding: "3px 8px", opacity: l.poderia_ter_evitado ? 1 : 0.5, transition: "opacity 0.2s, background 0.2s, border-color 0.2s", color: "#F59E0B", fontWeight: 700, borderRadius: "999px", whiteSpace: "nowrap", fontFamily: "inherit" }}
                    >
                      Evitável
                    </button>
                  </div>
                )}
                <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: l.tipo === "receita" ? "#22C55E" : "#EF4444", flexShrink: 0 }}>{l.tipo === "receita" ? "+" : "-"}{formatBRL(l.valor)}</p>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(l); }} style={{ background: "none", border: "none", color: "#333", cursor: "pointer", fontSize: "1rem", padding: "0 0.25rem", flexShrink: 0 }}>×</button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* HISTÓRICO */}
      {tela === "historico" && (() => {
        const { ano, mes } = mesHistorico;
        const prefixo = `${ano}-${String(mes + 1).padStart(2, "0")}`;
        const lancMes = lancamentos.filter(l => l.data_lancamento?.startsWith(prefixo));
        const receitasMes = lancMes.filter(l => l.tipo === "receita").reduce((s, l) => s + Number(l.valor), 0);
        const gastosMes = lancMes.filter(l => l.tipo === "gasto").reduce((s, l) => s + Number(l.valor), 0);
        const gastosDebitoMes = lancMes.filter(l => l.tipo === "gasto" && l.forma_pagamento !== "Crédito").reduce((s, l) => s + Number(l.valor), 0);
        const gastosCartaoMes = lancMes.filter(l => l.tipo === "gasto" && l.forma_pagamento === "Crédito").reduce((s, l) => s + Number(l.valor), 0);
        const saldoMes = receitasMes - gastosMes;
        const evitaveisMes = lancMes.filter(l => l.poderia_ter_evitado && l.tipo === "gasto").reduce((s, l) => s + Number(l.valor), 0);
        const navegarMes = (dir) => { setMesHistorico(prev => { let m = prev.mes + dir, a = prev.ano; if (m > 11) { m = 0; a++; } if (m < 0) { m = 11; a--; } return { mes: m, ano: a }; }); };
        const gastosCat = categories.gasto.map(cat => ({ cat, total: lancMes.filter(l => l.tipo === "gasto" && l.categoria === cat).reduce((s, l) => s + Number(l.valor), 0) })).filter(x => x.total > 0).sort((a, b) => b.total - a.total);
        const maxCat = Math.max(...gastosCat.map(x => x.total), 1);
        const ehMesAtual = mes === new Date().getMonth() && ano === new Date().getFullYear();
        return (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
              <button onClick={() => navegarMes(-1)} style={{ background: "#181B24", border: "1px solid #252832", borderRadius: "8px", color: "#888", cursor: "pointer", padding: "0.4rem 0.8rem", fontSize: "1rem", fontFamily: "inherit" }}>‹</button>
              <div style={{ textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "#F0F0F0" }}>{monthNames[mes]} {ano}</p>
                {ehMesAtual && <p style={{ margin: 0, fontSize: "0.7rem", color: "#6366F1" }}>mês atual</p>}
              </div>
              <button onClick={() => navegarMes(1)} style={{ background: "#181B24", border: "1px solid #252832", borderRadius: "8px", color: "#888", cursor: "pointer", padding: "0.4rem 0.8rem", fontSize: "1rem", fontFamily: "inherit" }}>›</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
              {[{ label: "Receitas", value: receitasMes, color: "#22C55E" }, { label: "Débito", value: gastosDebitoMes, color: "#EF4444" }, { label: "Cartão", value: gastosCartaoMes, color: "#F59E0B" }, { label: "Saldo", value: saldoMes, color: saldoMes >= 0 ? "#22C55E" : "#EF4444" }].map(card => (
                <div key={card.label} style={{ background: "#181B24", borderRadius: "12px", padding: "1rem 0.75rem", border: "1px solid #252832" }}>
                  <p style={{ margin: "0 0 0.4rem", fontSize: "0.65rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em" }}>{card.label}</p>
                  <p style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, color: card.color }}>{formatBRL(card.value)}</p>
                </div>
              ))}
            </div>
            <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", color: "#666" }}>Gasto total do mês: <span style={{ color: "#E8E8E8", fontWeight: 700 }}>{formatBRL(gastosMes)}</span></p>
            {lancMes.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 0", color: "#444" }}>
                <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>•</p>
                <p style={{ fontSize: "0.9rem" }}>Nenhum lançamento em {monthNames[mes]} {ano}.</p>
              </div>
            ) : (
              <>
                {evitaveisMes > 0 && <div style={{ background: "#F59E0B0F", borderRadius: "12px", padding: "1rem 1.25rem", marginBottom: "1rem", border: "1px solid #F59E0B30" }}><p style={{ margin: 0, fontSize: "0.8rem", color: "#F59E0B" }}><strong>{formatBRL(evitaveisMes)}</strong> em gastos evitáveis nesse mês</p></div>}
                {gastosCat.length > 0 && (
                  <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832" }}>
                    <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Gastos por categoria</p>
                    {gastosCat.map((item, i) => (
                      <div key={item.cat} style={{ marginBottom: "0.85rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.3rem" }}>
                          <span style={{ fontSize: "0.82rem", color: "#CCC" }}>{item.cat}</span>
                          <span style={{ fontSize: "0.82rem", fontWeight: 600, color: COLORS[i % COLORS.length] }}>{formatBRL(item.total)}</span>
                        </div>
                        <div style={{ background: "#0F1117", borderRadius: "4px", height: "6px", overflow: "hidden" }}><div style={{ background: COLORS[i % COLORS.length], height: "100%", width: `${(item.total / maxCat) * 100}%`, borderRadius: "4px" }} /></div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", border: "1px solid #252832" }}>
                  <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>{lancMes.length} lançamento{lancMes.length > 1 ? "s" : ""}</p>
                  {lancMes.map(l => (
                    <div key={l.id} onClick={() => handleEdit(l)} style={{ display: "flex", alignItems: "center", padding: "0.7rem 0", borderBottom: "1px solid #1a1d26", cursor: "pointer", gap: "0.75rem" }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "8px", flexShrink: 0, background: l.tipo === "receita" ? "#22C55E18" : "#EF444418", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem" }}>{l.tipo === "receita" ? "+" : "-"}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 0.12rem", fontSize: "0.85rem", color: "#E8E8E8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: 1.25 }}>
                          {l.poderia_ter_evitado && <span style={{ ...badgeBaseStyle, marginRight: "6px", color: "#F59E0B", background: "#F59E0B15" }}>Evitável</span>}
                          {l.recorrente && <span style={{ ...badgeBaseStyle, marginRight: "6px", color: "#22C55E", background: "#22C55E15" }}>Recorrente</span>}
                          {normalizeText(l.descricao)}
                          {l.total_parcelas && <span style={{ marginLeft: "5px", fontSize: "0.65rem", color: "#6366F1", background: "#6366F115", padding: "1px 4px", borderRadius: "3px" }}>{l.parcela_atual}/{l.total_parcelas}x</span>}
                        </p>
                        <p style={{ margin: 0, fontSize: "0.7rem", color: "#555", lineHeight: 1.25 }}>{normalizeText(l.categoria)} · {getFormaPagamentoLabel(l.forma_pagamento)} · {formatData(l.data_lancamento)}</p>
                      </div>
                      <p style={{ margin: 0, fontSize: "0.88rem", fontWeight: 700, color: l.tipo === "receita" ? "#22C55E" : "#EF4444", flexShrink: 0 }}>{l.tipo === "receita" ? "+" : "-"}{formatBRL(l.valor)}</p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* METAS */}
      {tela === "metas" && (() => {
        const meta = parseFloat((simulador.meta || "").replace(/\./g, "").replace(",", ".")) || 0;
        const patrimonioAtual = parseFloat((simulador.patrimonioAtual || "").replace(/\./g, "").replace(",", ".")) || 0;
        const aporteMensal = parseFloat((simulador.aporteMensal || "").replace(/\./g, "").replace(",", ".")) || 0;
        const taxaMensalFocus = taxaFocus / 100 / 12;
        const meses = 60;
        const dadosComAporte = [], dadosSemAporte = [];
        let saldoCom = patrimonioAtual, saldoSem = patrimonioAtual;
        for (let i = 0; i <= meses; i++) {
          dadosComAporte.push(Math.round(saldoCom));
          dadosSemAporte.push(Math.round(saldoSem));
          saldoCom = saldoCom * (1 + taxaMensalFocus) + aporteMensal;
          saldoSem = saldoSem * (1 + taxaMensalFocus);
        }
        const mesMeta = dadosComAporte.findIndex(v => v >= meta && meta > 0);
        const progresso12 = meta > 0 ? Math.min((dadosComAporte[12] / meta) * 100, 100) : 0;
        const progresso36 = meta > 0 ? Math.min((dadosComAporte[36] / meta) * 100, 100) : 0;
        const progresso60 = meta > 0 ? Math.min((dadosComAporte[60] / meta) * 100, 100) : 0;
        const labels = Array.from({ length: meses + 1 }, (_, i) => { if (i === 0) return "Hoje"; if (i % 12 === 0) return `${i / 12}a`; if (i === mesMeta) return "Meta"; return ""; });
        const temDados = patrimonioAtual > 0 || aporteMensal > 0;
        return (
          <div>
            <p style={{ margin: "0 0 1.25rem", fontSize: "0.8rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Simulador de Metas</p>
            <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                {[{ label: "Patrimônio atual (R$)", key: "patrimonioAtual", placeholder: "Ex: 50.000" }, { label: "Quanto guardar por mês (R$)", key: "aporteMensal", placeholder: "Ex: 1.000" }].map(({ label, key, placeholder }) => (
                  <div key={key}>
                    <p style={{ margin: "0 0 0.3rem", fontSize: "0.7rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</p>
                    <input type="text" placeholder={placeholder} value={simulador[key] || ""} onChange={e => setSimulador(s => ({ ...s, [key]: e.target.value }))} style={{ ...inputStyle, marginBottom: 0, fontSize: "0.85rem" }} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "0.75rem" }}>
                <p style={{ margin: "0 0 0.3rem", fontSize: "0.7rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>Meta (R$)</p>
                <input type="text" placeholder="Ex: 500.000" value={simulador.meta || ""} onChange={e => setSimulador(s => ({ ...s, meta: e.target.value }))} style={{ ...inputStyle, marginBottom: 0, fontSize: "0.85rem" }} />
              </div>
            </div>
            {temDados && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "1rem" }}>
                  {[{ label: "1 ano", valor: dadosComAporte[12], prog: progresso12 }, { label: "3 anos", valor: dadosComAporte[36], prog: progresso36 }, { label: "5 anos", valor: dadosComAporte[60], prog: progresso60 }].map(({ label, valor, prog }) => (
                    <div key={label} style={{ background: "#181B24", borderRadius: "12px", padding: "1rem 0.75rem", border: "1px solid #252832" }}>
                      <p style={{ margin: "0 0 0.3rem", fontSize: "0.65rem", color: "#555", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</p>
                      <p style={{ margin: "0 0 0.5rem", fontSize: "0.8rem", fontWeight: 700, color: "#6366F1" }}>{formatBRL(valor)}</p>
                      {meta > 0 && (<><div style={{ background: "#0F1117", borderRadius: "4px", height: "4px", overflow: "hidden" }}><div style={{ background: prog >= 100 ? "#22C55E" : "#6366F1", height: "100%", width: `${prog}%`, borderRadius: "4px", transition: "width 0.5s" }} /></div><p style={{ margin: "0.25rem 0 0", fontSize: "0.65rem", color: prog >= 100 ? "#22C55E" : "#555" }}>{Math.round(prog)}% da meta</p></>)}
                    </div>
                  ))}
                </div>
                {meta > 0 && mesMeta > 0 && <div style={{ background: "#22C55E0F", borderRadius: "12px", padding: "1rem 1.25rem", marginBottom: "1rem", border: "1px solid #22C55E30" }}><p style={{ margin: 0, fontSize: "0.85rem", color: "#22C55E" }}>Você atinge sua meta em <strong>{mesMeta < 12 ? `${mesMeta} meses` : `${Math.floor(mesMeta / 12)} ano${Math.floor(mesMeta / 12) > 1 ? "s" : ""}${mesMeta % 12 > 0 ? ` e ${mesMeta % 12} meses` : ""}`}</strong></p></div>}
                {meta > 0 && mesMeta === -1 && <div style={{ background: "#EF44440F", borderRadius: "12px", padding: "1rem 1.25rem", marginBottom: "1rem", border: "1px solid #EF444430" }}><p style={{ margin: 0, fontSize: "0.85rem", color: "#EF4444" }}>Com esse aporte, você não atinge a meta em 5 anos.</p></div>}
                <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", border: "1px solid #252832" }}>
                  <p style={{ margin: "0 0 1rem", fontSize: "0.75rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Projeção patrimonial</p>
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.7rem", color: "#6366F1" }}>Com aportes</span>
                    <span style={{ fontSize: "0.7rem", color: "#555" }}>Só rendimento</span>
                    {meta > 0 && <span style={{ fontSize: "0.7rem", color: "#F59E0B" }}>- - Meta</span>}
                  </div>
                  <GraficoSimulador labels={labels} dadosComAporte={dadosComAporte} dadosSemAporte={dadosSemAporte} meta={meta} />
                </div>
              </>
            )}
            {!temDados && <div style={{ textAlign: "center", padding: "3rem 0", color: "#444" }}><p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>•</p><p style={{ fontSize: "0.9rem" }}>Preencha os campos acima para ver a projeção.</p></div>}
          </div>
        );
      })()}

      {/* FP */}
      {tela === "fp" && (
        <div>
          <p style={{ margin: "0 0 1.25rem", fontSize: "0.8rem", fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>Planejamento Financeiro</p>

          {/* Subabas */}
          <div style={{ display: "flex", background: "#0F1117", borderRadius: "10px", padding: "4px", marginBottom: "1.5rem", gap: "2px", border: "1px solid #252832" }}>
            {[
              { key: "perfil", label: "Perfil" },
              { key: "objetivos", label: "Objetivos" },
              { key: "rendas", label: "Rendas" },
              { key: "investimentos", label: "Invest." },
              { key: "bens", label: "Bens" },
              { key: "diagnostico", label: "Diagnóstico" },
            ].map(aba => (
              <button
                key={aba.key}
                onClick={() => setFpAba(aba.key)}
                style={{
                  flex: 1, padding: "0.4rem 0.1rem", border: "none", borderRadius: "8px",
                  cursor: "pointer", fontSize: "0.6rem", fontWeight: 600, whiteSpace: "nowrap",
                  background: fpAba === aba.key ? "#252832" : "transparent",
                  color: fpAba === aba.key ? "#F0F0F0" : "#555",
                  transition: "all 0.2s", fontFamily: "inherit"
                }}
              >
                {aba.label}
              </button>
            ))}
          </div>

          {/* Aba Perfil */}
          {fpAba === "perfil" && <PerfilFP session={session} />}

          {/* Aba Objetivos */}
          {fpAba === "objetivos" && <ObjetivosFP session={session} />}

          {/* Aba Rendas e Despesas */}
          {fpAba === "rendas" && <RendasDespesasFP session={session} />}

          {/* Aba Investimentos */}
          {fpAba === "investimentos" && <InvestimentosFP session={session} />}

          {/* Outras abas — em breve */}
          {fpAba !== "perfil" && fpAba !== "objetivos" && fpAba !== "rendas" && fpAba !== "investimentos" && (
            <div style={{ background: "#181B24", borderRadius: "16px", padding: "2rem 1.5rem", border: "1px solid #252832", textAlign: "center" }}>
              <p style={{ margin: "0 0 0.4rem", fontSize: "1.5rem" }}>🚧</p>
              <p style={{ margin: "0 0 0.25rem", fontSize: "0.9rem", color: "#CFCFCF", fontWeight: 600 }}>Em construção</p>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#555" }}>
                A aba <strong style={{ color: "#888" }}>
                  {fpAba === "investimentos" ? "Investimentos" : fpAba === "bens" ? "Bens" : "Diagnóstico"}
                </strong> será implementada em breve.
              </p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
