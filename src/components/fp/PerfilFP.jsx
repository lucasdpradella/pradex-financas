import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";

const estadosCivis = ["Solteiro(a)", "Casado(a)", "União Estável", "Divorciado(a)", "Viúvo(a)", "Separado(a)"];
const regimesUniao = ["Comunhão Parcial de Bens", "Comunhão Universal de Bens", "Separação Total de Bens", "Participação Final nos Aquestos"];
const parentescos = ["Titular", "Cônjuge", "Filho(a)", "Pai/Mãe", "Outro"];

export default function PerfilFP({ session }) {
  const inputStyle = { width: "100%", background: "#0F1117", border: "1px solid #252832", borderRadius: "10px", padding: "0.75rem 1rem", color: "#E8E8E8", fontSize: "0.9rem", marginBottom: "0.75rem", outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const labelStyle = { display: "block", fontSize: "0.68rem", color: "#666", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.35rem", fontWeight: 600 };

  // Perfil
  const [perfil, setPerfil] = useState({
    nome: "", data_nascimento: "", profissao: "", estado_civil: "",
    regime_uniao: "", dupla_cidadania: false, pais_cidadania: "",
    saida_fiscal: false, pais_saida_fiscal: "", expectativa_vida: "",
    esportes: "", hobbies: "", comentarios: ""
  });
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [successPerfil, setSuccessPerfil] = useState(false);
  const [loadingPerfil, setLoadingPerfil] = useState(true);

  // fp_membros
  const [membros, setMembros] = useState([]);
  const [showFormMembro, setShowFormMembro] = useState(false);
  const [novoMembro, setNovoMembro] = useState({ nome: "", parentesco: "Titular", data_nascimento: "" });
  const [savingMembro, setSavingMembro] = useState(false);
  const [editandoMembro, setEditandoMembro] = useState(null);
  const [formEdicao, setFormEdicao] = useState({ nome: "", parentesco: "Titular", data_nascimento: "" });

  useEffect(() => { carregarPerfil(); carregarMembros(); }, []);

  // ── Perfil ──────────────────────────────────────────────────────────────────

  const carregarPerfil = async () => {
    setLoadingPerfil(true);
    const res = await supabase
      .from("fp_perfil")
      .select("*")
      .eq("user_id", session.user.id)
      .limit(1)
      .single();
    console.log("[fp_perfil] carregar:", { data: res.data, error: res.error, status: res.status });
    const { data, error } = res;
    if (error && error.code !== "PGRST116") {
      console.error("[fp_perfil] Erro ao carregar:", error);
    }
    if (data) {
      setPerfil({
        nome: data.nome || "",
        data_nascimento: data.data_nascimento || "",
        profissao: data.profissao || "",
        estado_civil: data.estado_civil || "",
        regime_uniao: data.regime_uniao || "",
        dupla_cidadania: data.dupla_cidadania || false,
        pais_cidadania: data.pais_cidadania || "",
        saida_fiscal: data.saida_fiscal || false,
        pais_saida_fiscal: data.pais_saida_fiscal || "",
        expectativa_vida: data.expectativa_vida ? String(data.expectativa_vida) : "",
        esportes: data.esportes || "",
        hobbies: data.hobbies || "",
        comentarios: data.comentarios || "",
      });
    }
    setLoadingPerfil(false);
  };

  const salvarPerfil = async () => {
    setSavingPerfil(true);
    const res = await supabase.from("fp_perfil").upsert({
      user_id: session.user.id,
      nome: perfil.nome,
      data_nascimento: perfil.data_nascimento || null,
      profissao: perfil.profissao,
      estado_civil: perfil.estado_civil,
      regime_uniao: perfil.regime_uniao,
      dupla_cidadania: perfil.dupla_cidadania,
      pais_cidadania: perfil.pais_cidadania || null,
      saida_fiscal: perfil.saida_fiscal,
      pais_saida_fiscal: perfil.pais_saida_fiscal || null,
      expectativa_vida: perfil.expectativa_vida ? parseInt(perfil.expectativa_vida) : null,
      esportes: perfil.esportes || null,
      hobbies: perfil.hobbies || null,
      comentarios: perfil.comentarios || null,
    }, { onConflict: "user_id" });
    console.log("[fp_perfil] upsert:", { data: res.data, error: res.error, status: res.status });
    if (res.error) console.error("[fp_perfil] Erro ao salvar:", res.error);
    else { setSuccessPerfil(true); setTimeout(() => setSuccessPerfil(false), 2500); }
    setSavingPerfil(false);
  };

  // ── Membros (fp_membros) ────────────────────────────────────────────────────

  const carregarMembros = async () => {
    const res = await supabase
      .from("fp_membros")
      .select("*")
      .eq("user_id", session.user.id)
      .order("id", { ascending: true });
    console.log("[fp_membros] carregar:", { data: res.data, error: res.error, status: res.status });
    if (res.error) console.error("[fp_membros] Erro ao carregar:", res.error);
    else setMembros(res.data || []);
  };

  const adicionarMembroFP = async () => {
    if (!novoMembro.nome.trim()) return;
    const uid = session?.user?.id;
    console.log("[fp_membros] user_id antes do insert:", uid);
    if (!uid) { console.error("[fp_membros] user_id indefinido — abortando insert"); return; }
    setSavingMembro(true);
    const res = await supabase.from("fp_membros").insert({
      user_id: uid,
      nome: novoMembro.nome.trim(),
      parentesco: novoMembro.parentesco,
      data_nascimento: novoMembro.data_nascimento || null,
    }).select();
    console.log("[fp_membros] insert:", { data: res.data, error: res.error, status: res.status });
    if (res.error) console.error("[fp_membros] Erro ao inserir:", res.error);
    else {
      setNovoMembro({ nome: "", parentesco: "Titular", data_nascimento: "" });
      setShowFormMembro(false);
      await carregarMembros();
    }
    setSavingMembro(false);
  };



  const iniciarEdicao = (m) => {
    setEditandoMembro(m.id);
    setFormEdicao({ nome: m.nome, parentesco: m.parentesco, data_nascimento: m.data_nascimento || "" });
  };

  const salvarEdicaoMembro = async (id) => {
    setSavingMembro(true);
    const res = await supabase.from("fp_membros").update({
      nome: formEdicao.nome.trim(),
      parentesco: formEdicao.parentesco,
      data_nascimento: formEdicao.data_nascimento || null,
    }).eq("id", id);
    console.log("[fp_membros] update:", { data: res.data, error: res.error, status: res.status });
    if (res.error) console.error("[fp_membros] Erro ao editar:", res.error);
    else { setEditandoMembro(null); await carregarMembros(); }
    setSavingMembro(false);
  };

  const removerMembroFP = async (id) => {
    const res = await supabase.from("fp_membros").delete().eq("id", id);
    console.log("[fp_membros] delete:", { data: res.data, error: res.error, status: res.status });
    if (res.error) console.error("[fp_membros] Erro ao remover:", res.error);
    else setMembros(prev => prev.filter(m => m.id !== id));
  };

  const mostrarRegime = ["Casado(a)", "União Estável"].includes(perfil.estado_civil);

  if (loadingPerfil) return (
    <div style={{ textAlign: "center", padding: "3rem 0" }}>
      <p style={{ color: "#555", fontSize: "0.85rem" }}>Carregando perfil...</p>
    </div>
  );

  return (
    <div>
      {/* SEÇÃO 1: DADOS PESSOAIS */}
      <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832" }}>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Dados Pessoais
        </p>

        <label style={labelStyle}>Nome completo</label>
        <input
          type="text"
          placeholder="Nome completo do cliente"
          value={perfil.nome_completo}
          onChange={e => setPerfil(p => ({ ...p, nome_completo: e.target.value }))}
          style={inputStyle}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div>
            <label style={labelStyle}>Data de nascimento</label>
            <input
              type="date"
              value={perfil.data_nascimento}
              onChange={e => setPerfil(p => ({ ...p, data_nascimento: e.target.value }))}
              style={{ ...inputStyle, marginBottom: 0 }}
            />
          </div>
          <div>
            <label style={labelStyle}>Expectativa de vida</label>
            <input
              type="number"
              placeholder="Ex: 85"
              min="50"
              max="120"
              value={perfil.expectativa_vida}
              onChange={e => setPerfil(p => ({ ...p, expectativa_vida: e.target.value }))}
              style={{ ...inputStyle, marginBottom: 0 }}
            />
          </div>
        </div>

        <label style={labelStyle}>Profissão</label>
        <input
          type="text"
          placeholder="Ex: Médico, Empresário, Engenheiro..."
          value={perfil.profissao}
          onChange={e => setPerfil(p => ({ ...p, profissao: e.target.value }))}
          style={inputStyle}
        />

        <div style={{ display: "grid", gridTemplateColumns: mostrarRegime ? "1fr 1fr" : "1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div>
            <label style={labelStyle}>Estado civil</label>
            <select
              value={perfil.estado_civil}
              onChange={e => setPerfil(p => ({ ...p, estado_civil: e.target.value, regime_uniao: "" }))}
              style={{ ...inputStyle, marginBottom: 0, color: perfil.estado_civil ? "#E8E8E8" : "#555", appearance: "none" }}
            >
              <option value="">Selecione...</option>
              {estadosCivis.map(ec => <option key={ec} value={ec}>{ec}</option>)}
            </select>
          </div>
          {mostrarRegime && (
            <div>
              <label style={labelStyle}>Regime de união</label>
              <select
                value={perfil.regime_uniao}
                onChange={e => setPerfil(p => ({ ...p, regime_uniao: e.target.value }))}
                style={{ ...inputStyle, marginBottom: 0, color: perfil.regime_uniao ? "#E8E8E8" : "#555", appearance: "none" }}
              >
                <option value="">Selecione...</option>
                {regimesUniao.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
        </div>

        <label style={labelStyle}>Esportes praticados</label>
        <input
          type="text"
          placeholder="Ex: Tênis, Natação, Ciclismo..."
          value={perfil.esportes}
          onChange={e => setPerfil(p => ({ ...p, esportes: e.target.value }))}
          style={inputStyle}
        />

        <label style={labelStyle}>Hobbies e interesses</label>
        <input
          type="text"
          placeholder="Ex: Vinhos, Viagens, Fotografia..."
          value={perfil.hobbies}
          onChange={e => setPerfil(p => ({ ...p, hobbies: e.target.value }))}
          style={{ ...inputStyle, marginBottom: "1.25rem" }}
        />

        <button
          onClick={salvarPerfil}
          disabled={savingPerfil}
          style={{
            width: "100%", padding: "0.85rem", border: "none", borderRadius: "10px",
            background: successPerfil ? "#16A34A" : "#6366F1",
            color: "#fff", fontSize: "0.95rem", fontWeight: 700,
            cursor: savingPerfil ? "not-allowed" : "pointer",
            opacity: savingPerfil ? 0.7 : 1, transition: "all 0.2s", fontFamily: "inherit"
          }}
        >
          {savingPerfil ? "Salvando..." : successPerfil ? "✓ Dados pessoais salvos!" : "Salvar dados pessoais"}
        </button>
      </div>

      {/* SEÇÃO 2: MEMBROS DA FAMÍLIA (fp_membros) */}
      <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Membros da Família
          </p>
          <button
            onClick={() => { setShowFormMembro(v => !v); setEditandoMembro(null); }}
            style={{
              background: "#6366F118", border: "1px solid #6366F140", borderRadius: "8px",
              color: "#6366F1", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer",
              padding: "0.35rem 0.75rem", fontFamily: "inherit"
            }}
          >
            {showFormMembro ? "Cancelar" : "+ Adicionar membro"}
          </button>
        </div>

        {/* Formulário de adição inline */}
        {showFormMembro && (
          <div style={{ background: "#0F1117", borderRadius: "12px", padding: "1rem", marginBottom: "1rem", border: "1px solid #252832" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <div>
                <label style={labelStyle}>Nome *</label>
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={novoMembro.nome}
                  onChange={e => setNovoMembro(p => ({ ...p, nome: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: 0, fontSize: "0.84rem", padding: "0.65rem 0.85rem" }}
                />
              </div>
              <div>
                <label style={labelStyle}>Parentesco *</label>
                <select
                  value={novoMembro.parentesco}
                  onChange={e => setNovoMembro(p => ({ ...p, parentesco: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: 0, fontSize: "0.84rem", padding: "0.65rem 0.85rem", appearance: "none" }}
                >
                  {parentescos.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={labelStyle}>Data de nascimento</label>
              <input
                type="date"
                value={novoMembro.data_nascimento}
                onChange={e => setNovoMembro(p => ({ ...p, data_nascimento: e.target.value }))}
                style={{ ...inputStyle, marginBottom: 0, fontSize: "0.84rem", padding: "0.65rem 0.85rem" }}
              />
            </div>
            <button
              onClick={adicionarMembroFP}
              disabled={savingMembro}
              style={{
                width: "100%", padding: "0.7rem", border: "none", borderRadius: "10px",
                background: "#6366F1", color: "#fff", fontSize: "0.9rem", fontWeight: 700,
                cursor: savingMembro ? "not-allowed" : "pointer",
                opacity: savingMembro ? 0.7 : 1, fontFamily: "inherit"
              }}
            >
              {savingMembro ? "Salvando..." : "Confirmar"}
            </button>
          </div>
        )}

        {/* Lista de membros */}
        {membros.length === 0 && !showFormMembro && (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>Nenhum membro cadastrado ainda.</p>
          </div>
        )}

        {membros.map(m => (
          <div key={m.id} style={{
            background: "#0F1117", borderRadius: "10px", padding: "0.75rem 1rem",
            marginBottom: "0.5rem", border: "1px solid #252832"
          }}>
            {editandoMembro === m.id ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <div>
                    <label style={labelStyle}>Nome *</label>
                    <input
                      type="text"
                      value={formEdicao.nome}
                      onChange={e => setFormEdicao(p => ({ ...p, nome: e.target.value }))}
                      style={{ ...inputStyle, marginBottom: 0, fontSize: "0.84rem", padding: "0.65rem 0.85rem" }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Parentesco *</label>
                    <select
                      value={formEdicao.parentesco}
                      onChange={e => setFormEdicao(p => ({ ...p, parentesco: e.target.value }))}
                      style={{ ...inputStyle, marginBottom: 0, fontSize: "0.84rem", padding: "0.65rem 0.85rem", appearance: "none" }}
                    >
                      {parentescos.map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={labelStyle}>Data de nascimento</label>
                  <input
                    type="date"
                    value={formEdicao.data_nascimento}
                    onChange={e => setFormEdicao(p => ({ ...p, data_nascimento: e.target.value }))}
                    style={{ ...inputStyle, marginBottom: 0, fontSize: "0.84rem", padding: "0.65rem 0.85rem" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => salvarEdicaoMembro(m.id)}
                    disabled={savingMembro}
                    style={{ flex: 1, padding: "0.6rem", border: "none", borderRadius: "8px", background: "#6366F1", color: "#fff", fontWeight: 700, fontSize: "0.84rem", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    {savingMembro ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    onClick={() => setEditandoMembro(null)}
                    style={{ padding: "0.6rem 1rem", border: "1px solid #252832", borderRadius: "8px", background: "none", color: "#888", fontSize: "0.84rem", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#E8E8E8", fontSize: "0.9rem", fontWeight: 600 }}>{m.nome}</div>
                  <div style={{ color: "#666", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                    {m.parentesco}{m.data_nascimento ? ` · ${m.data_nascimento}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <button
                    onClick={() => iniciarEdicao(m)}
                    style={{ background: "none", border: "1px solid #252832", borderRadius: "6px", color: "#6366F1", cursor: "pointer", fontSize: "0.75rem", padding: "0.25rem 0.6rem", fontFamily: "inherit" }}
                  >Editar</button>
                  <button
                    onClick={() => removerMembroFP(m.id)}
                    style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: "0 0.25rem" }}
                  >×</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
