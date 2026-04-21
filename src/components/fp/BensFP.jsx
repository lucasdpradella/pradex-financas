import { useEffect, useState } from "react";
import { syncSupabaseSession } from "../../supabaseClient";

const SUPABASE_URL = "https://sjvuhqqsjboncwpboclv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE";

const sbApi = (token) => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${token || SUPABASE_KEY}`,
});

const TIPOS_IMOVEL = ["Residencial", "Comercial", "Rural", "Terreno", "Outros"];
const TIPOS_VEICULO = ["Carro", "Moto", "Caminhão", "Barco", "Avião", "Outros"];
const ESTADOS_BR = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

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

// ─── Modal Imóvel ─────────────────────────────────────────────────────────────
function ModalImovel({ item, onClose, onSaved, userId, token }) {
  const [form, setForm] = useState({
    descricao: item?.descricao || "",
    tipo: item?.tipo || "Residencial",
    estado: item?.estado || "",
    cidade: item?.cidade || "",
    valor_atual: item?.valor_atual ? formatBRL(item.valor_atual) : "",
    participacao_pct: item?.participacao_pct ?? 100,
    financiado: item?.financiado ?? false,
    seguro_prestamista: item?.seguro_prestamista ?? false,
    data_quitacao: item?.data_quitacao || "",
    adquirido_apos_uniao: item?.adquirido_apos_uniao ?? false,
    participacao_conjuge: item?.participacao_conjuge ?? false,
    comentarios: item?.comentarios || "",
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  async function handleSalvar() {
    setErro("");
    if (!form.descricao.trim()) return setErro("Informe a descrição.");
    if (!form.valor_atual) return setErro("Informe o valor.");
    setSaving(true);
    const payload = {
      user_id: userId,
      descricao: form.descricao.trim(),
      tipo: form.tipo,
      estado: form.estado || null,
      cidade: form.cidade.trim() || null,
      valor_atual: parseBRL(form.valor_atual),
      participacao_pct: Number(form.participacao_pct) || 100,
      financiado: form.financiado,
      seguro_prestamista: form.seguro_prestamista,
      data_quitacao: form.financiado && form.data_quitacao ? form.data_quitacao : null,
      adquirido_apos_uniao: form.adquirido_apos_uniao,
      participacao_conjuge: form.participacao_conjuge,
      comentarios: form.comentarios.trim() || null,
    };
    try {
      const url = item ? `${SUPABASE_URL}/rest/v1/fp_imoveis?id=eq.${item.id}` : `${SUPABASE_URL}/rest/v1/fp_imoveis`;
      const res = await fetch(url, { method: item ? "PATCH" : "POST", headers: { ...sbApi(token), Prefer: "return=representation" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setErro(data?.message || "Erro ao salvar."); setSaving(false); return; }
      onSaved();
    } catch (e) { setErro("Erro ao salvar."); }
    setSaving(false);
  }

  return (
    <div style={st.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={st.modal}>
        <div style={st.modalHeader}>
          <span style={st.modalTitulo}>{item ? "Editar imóvel" : "Novo imóvel"}</span>
          <button style={st.btnFechar} onClick={onClose}>×</button>
        </div>
        <div style={st.modalBody}>
          <div style={st.grid2}>
            <div style={st.campo}>
              <label style={st.label}>Descrição *</label>
              <input style={st.input} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Ex: Apartamento Moema" />
            </div>
            <div style={st.campo}>
              <label style={st.label}>Tipo *</label>
              <select style={st.input} value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                {TIPOS_IMOVEL.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={st.campo}>
              <label style={st.label}>Estado</label>
              <select style={st.input} value={form.estado} onChange={(e) => set("estado", e.target.value)}>
                <option value="">Selecione...</option>
                {ESTADOS_BR.map((e) => <option key={e}>{e}</option>)}
              </select>
            </div>
            <div style={st.campo}>
              <label style={st.label}>Cidade</label>
              <input style={st.input} value={form.cidade} onChange={(e) => set("cidade", e.target.value)} placeholder="Ex: São Paulo" />
            </div>
            <div style={st.campo}>
              <label style={st.label}>Valor atual (R$) *</label>
              <input style={st.input} value={form.valor_atual} onChange={(e) => set("valor_atual", e.target.value)} onBlur={() => { const n = parseBRL(form.valor_atual); if (n > 0) set("valor_atual", formatBRL(n)); }} placeholder="R$ 0,00" />
            </div>
            <div style={st.campo}>
              <label style={st.label}>Participação (%)</label>
              <input style={st.input} type="number" min="0" max="100" value={form.participacao_pct} onChange={(e) => set("participacao_pct", e.target.value)} />
            </div>
          </div>

          <div style={st.checkRow}>
            <label style={st.checkLabel}><input type="checkbox" checked={form.financiado} onChange={(e) => set("financiado", e.target.checked)} /> Financiado</label>
            <label style={st.checkLabel}><input type="checkbox" checked={form.seguro_prestamista} onChange={(e) => set("seguro_prestamista", e.target.checked)} /> Seguro prestamista</label>
            <label style={st.checkLabel}><input type="checkbox" checked={form.adquirido_apos_uniao} onChange={(e) => set("adquirido_apos_uniao", e.target.checked)} /> Adquirido após união</label>
            <label style={st.checkLabel}><input type="checkbox" checked={form.participacao_conjuge} onChange={(e) => set("participacao_conjuge", e.target.checked)} /> Participação cônjuge</label>
          </div>

          {form.financiado && (
            <div style={st.campo}>
              <label style={st.label}>Previsão de quitação</label>
              <input style={st.input} type="date" value={form.data_quitacao} onChange={(e) => set("data_quitacao", e.target.value)} />
            </div>
          )}

          <div style={st.campo}>
            <label style={st.label}>Observações</label>
            <textarea style={{ ...st.input, minHeight: 64, resize: "vertical" }} value={form.comentarios} onChange={(e) => set("comentarios", e.target.value)} />
          </div>
          {erro && <div style={st.erro}>{erro}</div>}
        </div>
        <div style={st.modalFooter}>
          <button style={st.btnCancelar} onClick={onClose}>Cancelar</button>
          <button style={{ ...st.btnPrimario, opacity: saving ? 0.7 : 1 }} onClick={handleSalvar} disabled={saving}>{saving ? "Salvando..." : item ? "Salvar" : "Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Veículo ────────────────────────────────────────────────────────────
function ModalVeiculo({ item, onClose, onSaved, userId, token }) {
  const [form, setForm] = useState({
    descricao: item?.descricao || "",
    tipo: item?.tipo || "Carro",
    valor_atual: item?.valor_atual ? formatBRL(item.valor_atual) : "",
    financiado: item?.financiado ?? false,
    adquirido_apos_uniao: item?.adquirido_apos_uniao ?? false,
    comentarios: item?.comentarios || "",
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  async function handleSalvar() {
    setErro("");
    if (!form.descricao.trim()) return setErro("Informe a descrição.");
    if (!form.valor_atual) return setErro("Informe o valor.");
    setSaving(true);
    const payload = {
      user_id: userId,
      descricao: form.descricao.trim(),
      tipo: form.tipo,
      valor_atual: parseBRL(form.valor_atual),
      financiado: form.financiado,
      adquirido_apos_uniao: form.adquirido_apos_uniao,
      comentarios: form.comentarios.trim() || null,
    };
    try {
      const url = item ? `${SUPABASE_URL}/rest/v1/fp_veiculos?id=eq.${item.id}` : `${SUPABASE_URL}/rest/v1/fp_veiculos`;
      const res = await fetch(url, { method: item ? "PATCH" : "POST", headers: { ...sbApi(token), Prefer: "return=representation" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setErro(data?.message || "Erro ao salvar."); setSaving(false); return; }
      onSaved();
    } catch (e) { setErro("Erro ao salvar."); }
    setSaving(false);
  }

  return (
    <div style={st.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={st.modal}>
        <div style={st.modalHeader}>
          <span style={st.modalTitulo}>{item ? "Editar veículo" : "Novo veículo"}</span>
          <button style={st.btnFechar} onClick={onClose}>×</button>
        </div>
        <div style={st.modalBody}>
          <div style={st.grid2}>
            <div style={st.campo}>
              <label style={st.label}>Descrição *</label>
              <input style={st.input} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Ex: Honda Civic 2022" />
            </div>
            <div style={st.campo}>
              <label style={st.label}>Tipo *</label>
              <select style={st.input} value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                {TIPOS_VEICULO.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={st.campo}>
              <label style={st.label}>Valor atual (R$) *</label>
              <input style={st.input} value={form.valor_atual} onChange={(e) => set("valor_atual", e.target.value)} onBlur={() => { const n = parseBRL(form.valor_atual); if (n > 0) set("valor_atual", formatBRL(n)); }} placeholder="R$ 0,00" />
            </div>
          </div>
          <div style={st.checkRow}>
            <label style={st.checkLabel}><input type="checkbox" checked={form.financiado} onChange={(e) => set("financiado", e.target.checked)} /> Financiado</label>
            <label style={st.checkLabel}><input type="checkbox" checked={form.adquirido_apos_uniao} onChange={(e) => set("adquirido_apos_uniao", e.target.checked)} /> Adquirido após união</label>
          </div>
          <div style={st.campo}>
            <label style={st.label}>Observações</label>
            <textarea style={{ ...st.input, minHeight: 64, resize: "vertical" }} value={form.comentarios} onChange={(e) => set("comentarios", e.target.value)} />
          </div>
          {erro && <div style={st.erro}>{erro}</div>}
        </div>
        <div style={st.modalFooter}>
          <button style={st.btnCancelar} onClick={onClose}>Cancelar</button>
          <button style={{ ...st.btnPrimario, opacity: saving ? 0.7 : 1 }} onClick={handleSalvar} disabled={saving}>{saving ? "Salvando..." : item ? "Salvar" : "Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Participação ───────────────────────────────────────────────────────
function ModalParticipacao({ item, onClose, onSaved, userId, token }) {
  const [form, setForm] = useState({
    nome_empresa: item?.nome_empresa || "",
    cnpj: item?.cnpj || "",
    valor_empresa: item?.valor_empresa ? formatBRL(item.valor_empresa) : "",
    participacao_pct: item?.participacao_pct ?? "",
    adquirido_apos_uniao: item?.adquirido_apos_uniao ?? false,
    comentarios: item?.comentarios || "",
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  async function handleSalvar() {
    setErro("");
    if (!form.nome_empresa.trim()) return setErro("Informe o nome da empresa.");
    setSaving(true);
    const payload = {
      user_id: userId,
      nome_empresa: form.nome_empresa.trim(),
      cnpj: form.cnpj.trim() || null,
      valor_empresa: parseBRL(form.valor_empresa) || null,
      participacao_pct: Number(form.participacao_pct) || null,
      adquirido_apos_uniao: form.adquirido_apos_uniao,
      comentarios: form.comentarios.trim() || null,
    };
    try {
      const url = item ? `${SUPABASE_URL}/rest/v1/fp_participacoes?id=eq.${item.id}` : `${SUPABASE_URL}/rest/v1/fp_participacoes`;
      const res = await fetch(url, { method: item ? "PATCH" : "POST", headers: { ...sbApi(token), Prefer: "return=representation" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setErro(data?.message || "Erro ao salvar."); setSaving(false); return; }
      onSaved();
    } catch (e) { setErro("Erro ao salvar."); }
    setSaving(false);
  }

  return (
    <div style={st.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={st.modal}>
        <div style={st.modalHeader}>
          <span style={st.modalTitulo}>{item ? "Editar participação" : "Nova participação societária"}</span>
          <button style={st.btnFechar} onClick={onClose}>×</button>
        </div>
        <div style={st.modalBody}>
          <div style={st.grid2}>
            <div style={st.campo}>
              <label style={st.label}>Nome da empresa *</label>
              <input style={st.input} value={form.nome_empresa} onChange={(e) => set("nome_empresa", e.target.value)} placeholder="Razão social" />
            </div>
            <div style={st.campo}>
              <label style={st.label}>CNPJ</label>
              <input style={st.input} value={form.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
            </div>
            <div style={st.campo}>
              <label style={st.label}>Valor da empresa (R$)</label>
              <input style={st.input} value={form.valor_empresa} onChange={(e) => set("valor_empresa", e.target.value)} onBlur={() => { const n = parseBRL(form.valor_empresa); if (n > 0) set("valor_empresa", formatBRL(n)); }} placeholder="R$ 0,00" />
            </div>
            <div style={st.campo}>
              <label style={st.label}>Participação (%)</label>
              <input style={st.input} type="number" min="0" max="100" value={form.participacao_pct} onChange={(e) => set("participacao_pct", e.target.value)} placeholder="Ex: 50" />
            </div>
          </div>
          <div style={st.checkRow}>
            <label style={st.checkLabel}><input type="checkbox" checked={form.adquirido_apos_uniao} onChange={(e) => set("adquirido_apos_uniao", e.target.checked)} /> Adquirido após união</label>
          </div>
          <div style={st.campo}>
            <label style={st.label}>Observações</label>
            <textarea style={{ ...st.input, minHeight: 64, resize: "vertical" }} value={form.comentarios} onChange={(e) => set("comentarios", e.target.value)} />
          </div>
          {erro && <div style={st.erro}>{erro}</div>}
        </div>
        <div style={st.modalFooter}>
          <button style={st.btnCancelar} onClick={onClose}>Cancelar</button>
          <button style={{ ...st.btnPrimario, opacity: saving ? 0.7 : 1 }} onClick={handleSalvar} disabled={saving}>{saving ? "Salvando..." : item ? "Salvar" : "Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Outros Bens ────────────────────────────────────────────────────────
function ModalOutro({ item, onClose, onSaved, userId, token }) {
  const [form, setForm] = useState({
    descricao: item?.descricao || "",
    valor_atual: item?.valor_atual ? formatBRL(item.valor_atual) : "",
    comentarios: item?.comentarios || "",
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  async function handleSalvar() {
    setErro("");
    if (!form.descricao.trim()) return setErro("Informe a descrição.");
    setSaving(true);
    const payload = {
      user_id: userId,
      descricao: form.descricao.trim(),
      valor_atual: parseBRL(form.valor_atual) || null,
      comentarios: form.comentarios.trim() || null,
    };
    try {
      const url = item ? `${SUPABASE_URL}/rest/v1/fp_outros_bens?id=eq.${item.id}` : `${SUPABASE_URL}/rest/v1/fp_outros_bens`;
      const res = await fetch(url, { method: item ? "PATCH" : "POST", headers: { ...sbApi(token), Prefer: "return=representation" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) { setErro(data?.message || "Erro ao salvar."); setSaving(false); return; }
      onSaved();
    } catch (e) { setErro("Erro ao salvar."); }
    setSaving(false);
  }

  return (
    <div style={st.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={st.modal}>
        <div style={st.modalHeader}>
          <span style={st.modalTitulo}>{item ? "Editar bem" : "Novo bem"}</span>
          <button style={st.btnFechar} onClick={onClose}>×</button>
        </div>
        <div style={st.modalBody}>
          <div style={st.campo}>
            <label style={st.label}>Descrição *</label>
            <input style={st.input} value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Ex: Obra de arte, joias..." />
          </div>
          <div style={st.campo}>
            <label style={st.label}>Valor atual (R$)</label>
            <input style={st.input} value={form.valor_atual} onChange={(e) => set("valor_atual", e.target.value)} onBlur={() => { const n = parseBRL(form.valor_atual); if (n > 0) set("valor_atual", formatBRL(n)); }} placeholder="R$ 0,00" />
          </div>
          <div style={st.campo}>
            <label style={st.label}>Observações</label>
            <textarea style={{ ...st.input, minHeight: 64, resize: "vertical" }} value={form.comentarios} onChange={(e) => set("comentarios", e.target.value)} />
          </div>
          {erro && <div style={st.erro}>{erro}</div>}
        </div>
        <div style={st.modalFooter}>
          <button style={st.btnCancelar} onClick={onClose}>Cancelar</button>
          <button style={{ ...st.btnPrimario, opacity: saving ? 0.7 : 1 }} onClick={handleSalvar} disabled={saving}>{saving ? "Salvando..." : item ? "Salvar" : "Adicionar"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
const ABAS = ["Imóveis", "Veículos", "Participações", "Outros"];

export default function BensFP({ session }) {
  const userId = session?.user?.id;
  const token = session?.token;

  const [aba, setAba] = useState("Imóveis");
  const [imoveis, setImoveis] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [participacoes, setParticipacoes] = useState([]);
  const [outros, setOutros] = useState([]);
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
      const [rI, rV, rP, rO] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/fp_imoveis?user_id=eq.${userId}&order=created_at.asc`, { headers: sbApi(token) }),
        fetch(`${SUPABASE_URL}/rest/v1/fp_veiculos?user_id=eq.${userId}&order=created_at.asc`, { headers: sbApi(token) }),
        fetch(`${SUPABASE_URL}/rest/v1/fp_participacoes?user_id=eq.${userId}&order=created_at.asc`, { headers: sbApi(token) }),
        fetch(`${SUPABASE_URL}/rest/v1/fp_outros_bens?user_id=eq.${userId}&order=created_at.asc`, { headers: sbApi(token) }),
      ]);
      const [i, v, p, o] = await Promise.all([rI.json(), rV.json(), rP.json(), rO.json()]);
      setImoveis(Array.isArray(i) ? i : []);
      setVeiculos(Array.isArray(v) ? v : []);
      setParticipacoes(Array.isArray(p) ? p : []);
      setOutros(Array.isArray(o) ? o : []);
    } catch (e) {}
    setLoading(false);
  }

  async function handleDelete(tabela, id) {
    if (!window.confirm("Remover este item?")) return;
    await fetch(`${SUPABASE_URL}/rest/v1/${tabela}?id=eq.${id}`, { method: "DELETE", headers: sbApi(token) });
    carregar();
  }

  const totalImoveis = imoveis.reduce((s, i) => s + Number(i.valor_atual || 0), 0);
  const totalVeiculos = veiculos.reduce((s, v) => s + Number(v.valor_atual || 0), 0);
  const totalParticipacoes = participacoes.reduce((s, p) => s + ((Number(p.valor_empresa || 0) * Number(p.participacao_pct || 100)) / 100), 0);
  const totalOutros = outros.reduce((s, o) => s + Number(o.valor_atual || 0), 0);
  const totalGeral = totalImoveis + totalVeiculos + totalParticipacoes + totalOutros;

  const onSaved = () => { setModal(null); carregar(); };

  if (loading) return <div style={st.loading}>Carregando...</div>;

  return (
    <div style={st.container}>
      {/* Resumo */}
      <div style={st.resumoRow}>
        <div style={st.resumoCard}>
          <div style={st.resumoLabel}>Total de bens</div>
          <div style={{ ...st.resumoValor, color: "#6366f1" }}>{formatBRL(totalGeral)}</div>
        </div>
        {[
          { label: "Imóveis", total: totalImoveis },
          { label: "Veículos", total: totalVeiculos },
          { label: "Participações", total: totalParticipacoes },
          { label: "Outros", total: totalOutros },
        ].filter((g) => g.total > 0).map((g) => (
          <div key={g.label} style={st.resumoCard}>
            <div style={st.resumoLabel}>{g.label}</div>
            <div style={st.resumoValor}>{formatBRL(g.total)}</div>
          </div>
        ))}
      </div>

      {/* Abas */}
      <div style={st.tabsRow}>
        {ABAS.map((a) => (
          <button key={a} style={{ ...st.tab, ...(aba === a ? st.tabActive : {}) }} onClick={() => setAba(a)}>{a}</button>
        ))}
      </div>

      {/* Imóveis */}
      {aba === "Imóveis" && (
        <>
          <div style={st.sectionHeader}>
            <div />
            <button style={st.btnPrimario} onClick={() => setModal({ tipo: "imovel", item: null })}>+ Novo imóvel</button>
          </div>
          {imoveis.length === 0 ? <div style={st.vazio}>Nenhum imóvel cadastrado.</div> : imoveis.map((item) => (
            <div key={item.id} style={st.card}>
              <div style={st.cardLeft}>
                <div style={st.cardTitulo}>{item.descricao}</div>
                <div style={st.cardSub}>
                  {item.tipo}{item.cidade ? ` · ${item.cidade}` : ""}{item.estado ? `/${item.estado}` : ""}
                  {item.financiado ? " · Financiado" : " · Quitado"}
                  {item.adquirido_apos_uniao ? " · Após união" : ""}
                </div>
              </div>
              <div style={st.cardRight}>
                <div style={st.cardValor}>{formatBRL(item.valor_atual)}</div>
                {item.participacao_pct < 100 && <div style={st.cardSub}>{item.participacao_pct}% de participação</div>}
                <div style={st.cardAcoes}>
                  <button style={st.btnAcao} onClick={() => setModal({ tipo: "imovel", item })}>✏️</button>
                  <button style={st.btnAcao} onClick={() => handleDelete("fp_imoveis", item.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Veículos */}
      {aba === "Veículos" && (
        <>
          <div style={st.sectionHeader}>
            <div />
            <button style={st.btnPrimario} onClick={() => setModal({ tipo: "veiculo", item: null })}>+ Novo veículo</button>
          </div>
          {veiculos.length === 0 ? <div style={st.vazio}>Nenhum veículo cadastrado.</div> : veiculos.map((item) => (
            <div key={item.id} style={st.card}>
              <div style={st.cardLeft}>
                <div style={st.cardTitulo}>{item.descricao}</div>
                <div style={st.cardSub}>{item.tipo}{item.financiado ? " · Financiado" : " · Quitado"}{item.adquirido_apos_uniao ? " · Após união" : ""}</div>
              </div>
              <div style={st.cardRight}>
                <div style={st.cardValor}>{formatBRL(item.valor_atual)}</div>
                <div style={st.cardAcoes}>
                  <button style={st.btnAcao} onClick={() => setModal({ tipo: "veiculo", item })}>✏️</button>
                  <button style={st.btnAcao} onClick={() => handleDelete("fp_veiculos", item.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Participações */}
      {aba === "Participações" && (
        <>
          <div style={st.sectionHeader}>
            <div />
            <button style={st.btnPrimario} onClick={() => setModal({ tipo: "participacao", item: null })}>+ Nova participação</button>
          </div>
          {participacoes.length === 0 ? <div style={st.vazio}>Nenhuma participação cadastrada.</div> : participacoes.map((item) => (
            <div key={item.id} style={st.card}>
              <div style={st.cardLeft}>
                <div style={st.cardTitulo}>{item.nome_empresa}</div>
                <div style={st.cardSub}>{item.cnpj || "Sem CNPJ"}{item.participacao_pct ? ` · ${item.participacao_pct}%` : ""}{item.adquirido_apos_uniao ? " · Após união" : ""}</div>
              </div>
              <div style={st.cardRight}>
                <div style={st.cardValor}>{item.valor_empresa ? formatBRL((item.valor_empresa * (item.participacao_pct || 100)) / 100) : "—"}</div>
                {item.valor_empresa && <div style={st.cardSub}>empresa: {formatBRL(item.valor_empresa)}</div>}
                <div style={st.cardAcoes}>
                  <button style={st.btnAcao} onClick={() => setModal({ tipo: "participacao", item })}>✏️</button>
                  <button style={st.btnAcao} onClick={() => handleDelete("fp_participacoes", item.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Outros */}
      {aba === "Outros" && (
        <>
          <div style={st.sectionHeader}>
            <div />
            <button style={st.btnPrimario} onClick={() => setModal({ tipo: "outro", item: null })}>+ Novo bem</button>
          </div>
          {outros.length === 0 ? <div style={st.vazio}>Nenhum outro bem cadastrado.</div> : outros.map((item) => (
            <div key={item.id} style={st.card}>
              <div style={st.cardLeft}>
                <div style={st.cardTitulo}>{item.descricao}</div>
                {item.comentarios && <div style={st.cardSub}>{item.comentarios}</div>}
              </div>
              <div style={st.cardRight}>
                <div style={st.cardValor}>{formatBRL(item.valor_atual)}</div>
                <div style={st.cardAcoes}>
                  <button style={st.btnAcao} onClick={() => setModal({ tipo: "outro", item })}>✏️</button>
                  <button style={st.btnAcao} onClick={() => handleDelete("fp_outros_bens", item.id)}>🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Modais */}
      {modal?.tipo === "imovel" && <ModalImovel item={modal.item} onClose={() => setModal(null)} onSaved={onSaved} userId={userId} token={token} />}
      {modal?.tipo === "veiculo" && <ModalVeiculo item={modal.item} onClose={() => setModal(null)} onSaved={onSaved} userId={userId} token={token} />}
      {modal?.tipo === "participacao" && <ModalParticipacao item={modal.item} onClose={() => setModal(null)} onSaved={onSaved} userId={userId} token={token} />}
      {modal?.tipo === "outro" && <ModalOutro item={modal.item} onClose={() => setModal(null)} onSaved={onSaved} userId={userId} token={token} />}
    </div>
  );
}

const st = {
  container: { padding: "24px", maxWidth: 820, margin: "0 auto" },
  loading: { padding: 40, textAlign: "center", color: "#888" },
  vazio: { textAlign: "center", padding: "40px 0", color: "#555", fontSize: 14, background: "var(--surface, #1a1d27)", borderRadius: 10, border: "1px dashed var(--border, #2e3248)" },
  resumoRow: { display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" },
  resumoCard: { flex: 1, minWidth: 150, background: "var(--surface, #1a1d27)", border: "1px solid var(--border, #2e3248)", borderRadius: 10, padding: "16px 20px" },
  resumoLabel: { fontSize: 11, color: "#666", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 },
  resumoValor: { fontSize: 20, fontWeight: 700, color: "#e8e8f0" },
  tabsRow: { display: "flex", gap: 4, marginBottom: 20, background: "var(--surface, #1a1d27)", padding: 4, borderRadius: 10, width: "fit-content" },
  tab: { padding: "7px 16px", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#666", border: "none", background: "transparent", fontFamily: "inherit" },
  tabActive: { background: "var(--surface2, #252836)", color: "#e8e8f0" },
  sectionHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  card: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface, #1a1d27)", border: "1px solid var(--border, #2e3248)", borderRadius: 10, padding: "14px 18px", marginBottom: 8 },
  cardLeft: { flex: 1 },
  cardTitulo: { fontWeight: 600, fontSize: 14, color: "#e8e8f0", marginBottom: 3 },
  cardSub: { fontSize: 12, color: "#666" },
  cardRight: { textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 },
  cardValor: { fontWeight: 700, fontSize: 16, color: "#6366f1" },
  cardAcoes: { display: "flex", gap: 6 },
  btnAcao: { background: "none", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 4px" },
  grid2: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 14 },
  campo: { marginBottom: 14 },
  label: { display: "block", fontSize: 11, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 },
  input: { width: "100%", background: "#0f1117", border: "1px solid var(--border, #2e3248)", borderRadius: 8, padding: "9px 12px", color: "#e8e8f0", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  checkRow: { display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 14 },
  checkLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#aaa", cursor: "pointer" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  modal: { background: "var(--surface, #1a1d27)", border: "1px solid var(--border, #2e3248)", borderRadius: 14, width: "100%", maxWidth: 520, maxHeight: "90vh", display: "flex", flexDirection: "column" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "20px 24px 16px", borderBottom: "1px solid var(--border, #2e3248)" },
  modalTitulo: { fontSize: 16, fontWeight: 700, color: "#e8e8f0" },
  btnFechar: { background: "none", border: "none", color: "#666", fontSize: 22, cursor: "pointer", lineHeight: 1, padding: 0 },
  modalBody: { padding: "20px 24px", overflowY: "auto", flex: 1 },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--border, #2e3248)" },
  erro: { background: "rgba(239,68,68,.1)", color: "#ef4444", borderRadius: 6, padding: "8px 12px", fontSize: 13 },
  btnPrimario: { background: "#6366f1", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" },
  btnCancelar: { background: "none", border: "none", color: "#666", fontSize: 13, cursor: "pointer", padding: "9px 16px", fontFamily: "inherit" },
};
