import { useEffect, useState } from "react";

const SUPABASE_URL = "https://sjvuhqqsjboncwpboclv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE";

const sbApi = (token) => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${token || SUPABASE_KEY}`,
});

const estadosCivis = ["Solteiro(a)", "Casado(a)", "Uniao Estavel", "Divorciado(a)", "Viuvo(a)", "Separado(a)"];
const regimesUniao = ["Comunhao Parcial de Bens", "Comunhao Universal de Bens", "Separacao Total de Bens", "Participacao Final nos Aquestos"];
const parentescos = ["Titular", "Conjuge", "Filho(a)", "Pai/Mae", "Outro"];

function ordenarMembros(lista = []) {
  return [...lista].sort((a, b) => {
    if (a.parentesco === "Titular") return -1;
    if (b.parentesco === "Titular") return 1;
    return (a.nome || "").localeCompare(b.nome || "");
  });
}

const perfilInicial = {
  nome: "",
  data_nascimento: "",
  profissao: "",
  estado_civil: "",
  regime_uniao: "",
  dupla_cidadania: false,
  pais_cidadania: "",
  saida_fiscal: false,
  pais_saida_fiscal: "",
  expectativa_vida: "",
  esportes: "",
  hobbies: "",
  comentarios: "",
};

export default function PerfilFP({ session }) {
  const token = session?.token;
  const userId = session?.user?.id;

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
  const labelStyle = {
    display: "block",
    fontSize: "0.68rem",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: "0.35rem",
    fontWeight: 600,
  };

  const [perfil, setPerfil] = useState(perfilInicial);
  const [perfilId, setPerfilId] = useState(null);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [successPerfil, setSuccessPerfil] = useState(false);
  const [loadingPerfil, setLoadingPerfil] = useState(true);
  const [erroPerfil, setErroPerfil] = useState("");

  const [membros, setMembros] = useState([]);
  const [showFormMembro, setShowFormMembro] = useState(false);
  const [novoMembro, setNovoMembro] = useState({ nome: "", parentesco: "Titular", data_nascimento: "" });
  const [savingMembro, setSavingMembro] = useState(false);
  const [editandoMembro, setEditandoMembro] = useState(null);
  const [formEdicao, setFormEdicao] = useState({ nome: "", parentesco: "Titular", data_nascimento: "" });

  useEffect(() => {
    const init = async () => {
      if (!token || !userId) return;
      await Promise.all([carregarPerfil(), carregarMembros()]);
    };
    init();
  }, [token, userId]);

  const carregarPerfil = async () => {
    if (!token || !userId) return;
    setLoadingPerfil(true);
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/fp_perfil?user_id=eq.${userId}&select=*&limit=1`,
        { headers: sbApi(token) }
      );
      const rows = await res.json();
      const data = Array.isArray(rows) ? rows[0] : null;
      console.log("[fp_perfil] carregar:", { data, status: res.status });
      if (data) {
        setPerfilId(data.id || null);
        setPerfil({
          nome: data.nome || "",
          data_nascimento: data.data_nascimento || "",
          profissao: data.profissao || "",
          estado_civil: data.estado_civil || "",
          regime_uniao: data.regime_uniao || "",
          dupla_cidadania: Boolean(data.dupla_cidadania),
          pais_cidadania: data.pais_cidadania || "",
          saida_fiscal: Boolean(data.saida_fiscal),
          pais_saida_fiscal: data.pais_saida_fiscal || "",
          expectativa_vida: data.expectativa_vida ? String(data.expectativa_vida) : "",
          esportes: data.esportes || "",
          hobbies: data.hobbies || "",
          comentarios: data.comentarios || "",
        });
      } else {
        setPerfilId(null);
        setPerfil(perfilInicial);
      }
    } catch (error) {
      console.error("[fp_perfil] Erro ao carregar:", error);
    }
    setLoadingPerfil(false);
  };

  const garantirTitular = async (nomeTitular) => {
    if (!token || !userId || !nomeTitular.trim()) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/fp_membros?user_id=eq.${userId}&parentesco=eq.Titular&select=id&limit=1`,
        { headers: sbApi(token) }
      );
      const rows = await res.json();
      const titular = Array.isArray(rows) ? rows[0] : null;
      if (!titular) {
        const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/fp_membros`, {
          method: "POST",
          headers: { ...sbApi(token), Prefer: "return=representation" },
          body: JSON.stringify({
            user_id: userId,
            nome: nomeTitular.trim(),
            parentesco: "Titular",
          }),
        });
        const inserted = await insertRes.json();
        console.log("[fp_membros] titular criado automaticamente:", { data: inserted, status: insertRes.status });
      }
    } catch (error) {
      console.error("[fp_membros] Erro ao garantir titular:", error);
    }
  };

  const salvarPerfil = async () => {
    if (!token || !userId) return;
    setSavingPerfil(true);
    setErroPerfil("");

    const payload = {
      user_id: userId,
      nome: perfil.nome.trim(),
      data_nascimento: perfil.data_nascimento || null,
      profissao: perfil.profissao || null,
      estado_civil: perfil.estado_civil || null,
      regime_uniao: perfil.regime_uniao || null,
      dupla_cidadania: perfil.dupla_cidadania,
      pais_cidadania: perfil.pais_cidadania || null,
      saida_fiscal: perfil.saida_fiscal,
      pais_saida_fiscal: perfil.pais_saida_fiscal || null,
      expectativa_vida: perfil.expectativa_vida ? parseInt(perfil.expectativa_vida, 10) : null,
      esportes: perfil.esportes || null,
      hobbies: perfil.hobbies || null,
      comentarios: perfil.comentarios || null,
    };

    try {
      const existingRes = await fetch(
        `${SUPABASE_URL}/rest/v1/fp_perfil?user_id=eq.${userId}&select=id&limit=1`,
        { headers: sbApi(token) }
      );
      const existingRows = await existingRes.json();
      const existing = Array.isArray(existingRows) ? existingRows[0] : null;

      const endpoint = existing?.id
        ? `${SUPABASE_URL}/rest/v1/fp_perfil?user_id=eq.${userId}`
        : `${SUPABASE_URL}/rest/v1/fp_perfil`;

      const res = await fetch(endpoint, {
        method: existing?.id ? "PATCH" : "POST",
        headers: {
          ...sbApi(token),
          Prefer: existing?.id ? "return=minimal" : "return=representation",
        },
        body: JSON.stringify(payload),
      });

      const rows = existing?.id ? null : await res.json();
      const saved = Array.isArray(rows) ? rows[0] : null;
      console.log("[fp_perfil] salvar:", {
        payload,
        existingId: existing?.id || null,
        data: saved || rows,
        status: res.status,
      });

      if (res.ok) {
        if (saved?.id) setPerfilId(saved.id);
        await garantirTitular(perfil.nome.trim());
        await Promise.all([carregarPerfil(), carregarMembros()]);
        setSuccessPerfil(true);
        setTimeout(() => setSuccessPerfil(false), 2500);
      } else {
        console.error("[fp_perfil] Erro ao salvar:", rows);
        setErroPerfil(
          rows?.message ||
          rows?.error_description ||
          "Nao foi possivel salvar os dados pessoais com o schema atual."
        );
      }
    } catch (error) {
      console.error("[fp_perfil] Erro ao salvar:", error);
      setErroPerfil("Erro ao salvar os dados pessoais.");
    }

    setSavingPerfil(false);
  };

  const carregarMembros = async () => {
    if (!token || !userId) return;
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/fp_membros?user_id=eq.${userId}&select=*&order=id.asc`,
        { headers: sbApi(token) }
      );
      const rows = await res.json();
      console.log("[fp_membros] carregar:", { data: rows, status: res.status });
      setMembros(ordenarMembros(Array.isArray(rows) ? rows : []));
    } catch (error) {
      console.error("[fp_membros] Erro ao carregar:", error);
    }
  };

  const adicionarMembroFP = async () => {
    if (!token || !userId || !novoMembro.nome.trim()) return;
    setSavingMembro(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/fp_membros`, {
        method: "POST",
        headers: { ...sbApi(token), Prefer: "return=representation" },
        body: JSON.stringify({
          user_id: userId,
          nome: novoMembro.nome.trim(),
          parentesco: novoMembro.parentesco,
          data_nascimento: novoMembro.data_nascimento || null,
        }),
      });
      const rows = await res.json();
      console.log("[fp_membros] insert:", { data: rows, status: res.status });
      if (res.ok) {
        setNovoMembro({ nome: "", parentesco: "Titular", data_nascimento: "" });
        setShowFormMembro(false);
        await carregarMembros();
      } else {
        console.error("[fp_membros] Erro ao inserir:", rows);
      }
    } catch (error) {
      console.error("[fp_membros] Erro ao inserir:", error);
    }
    setSavingMembro(false);
  };

  const iniciarEdicao = (membro) => {
    setEditandoMembro(membro.id);
    setFormEdicao({
      nome: membro.nome || "",
      parentesco: membro.parentesco || "Titular",
      data_nascimento: membro.data_nascimento || "",
    });
  };

  const salvarEdicaoMembro = async (id) => {
    if (!token || !id) return;
    setSavingMembro(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/fp_membros?id=eq.${id}`, {
        method: "PATCH",
        headers: { ...sbApi(token), Prefer: "return=representation" },
        body: JSON.stringify({
          nome: formEdicao.nome.trim(),
          parentesco: formEdicao.parentesco,
          data_nascimento: formEdicao.data_nascimento || null,
        }),
      });
      const rows = await res.json();
      console.log("[fp_membros] update:", { data: rows, status: res.status });
      if (res.ok) {
        setEditandoMembro(null);
        await carregarMembros();
      } else {
        console.error("[fp_membros] Erro ao editar:", rows);
      }
    } catch (error) {
      console.error("[fp_membros] Erro ao editar:", error);
    }
    setSavingMembro(false);
  };

  const removerMembroFP = async (id) => {
    if (!token || !id) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/fp_membros?id=eq.${id}`, {
        method: "DELETE",
        headers: sbApi(token),
      });
      console.log("[fp_membros] delete:", { status: res.status });
      if (res.ok) {
        setMembros((prev) => prev.filter((membro) => membro.id !== id));
      }
    } catch (error) {
      console.error("[fp_membros] Erro ao remover:", error);
    }
  };

  const mostrarRegime = ["Casado(a)", "Uniao Estavel"].includes(perfil.estado_civil);

  if (loadingPerfil) {
    return (
      <div style={{ textAlign: "center", padding: "3rem 0" }}>
        <p style={{ color: "#555", fontSize: "0.85rem" }}>Carregando perfil...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832" }}>
        <p style={{ margin: "0 0 1.25rem", fontSize: "0.75rem", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Dados Pessoais
        </p>

        <label style={labelStyle}>Nome completo</label>
        <input
          type="text"
          placeholder="Nome completo do cliente"
          value={perfil.nome}
          onChange={(e) => setPerfil((prev) => ({ ...prev, nome: e.target.value }))}
          style={inputStyle}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div>
            <label style={labelStyle}>Data de nascimento</label>
            <input
              type="date"
              value={perfil.data_nascimento}
              onChange={(e) => setPerfil((prev) => ({ ...prev, data_nascimento: e.target.value }))}
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
              onChange={(e) => setPerfil((prev) => ({ ...prev, expectativa_vida: e.target.value }))}
              style={{ ...inputStyle, marginBottom: 0 }}
            />
          </div>
        </div>

        <label style={labelStyle}>Profissao</label>
        <input
          type="text"
          placeholder="Ex: Medico, Empresario, Engenheiro..."
          value={perfil.profissao}
          onChange={(e) => setPerfil((prev) => ({ ...prev, profissao: e.target.value }))}
          style={inputStyle}
        />

        <div style={{ display: "grid", gridTemplateColumns: mostrarRegime ? "1fr 1fr" : "1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
          <div>
            <label style={labelStyle}>Estado civil</label>
            <select
              value={perfil.estado_civil}
              onChange={(e) => setPerfil((prev) => ({ ...prev, estado_civil: e.target.value, regime_uniao: "" }))}
              style={{ ...inputStyle, marginBottom: 0, color: perfil.estado_civil ? "#E8E8E8" : "#555", appearance: "none" }}
            >
              <option value="">Selecione...</option>
              {estadosCivis.map((estadoCivil) => (
                <option key={estadoCivil} value={estadoCivil}>
                  {estadoCivil}
                </option>
              ))}
            </select>
          </div>
          {mostrarRegime && (
            <div>
              <label style={labelStyle}>Regime de uniao</label>
              <select
                value={perfil.regime_uniao}
                onChange={(e) => setPerfil((prev) => ({ ...prev, regime_uniao: e.target.value }))}
                style={{ ...inputStyle, marginBottom: 0, color: perfil.regime_uniao ? "#E8E8E8" : "#555", appearance: "none" }}
              >
                <option value="">Selecione...</option>
                {regimesUniao.map((regime) => (
                  <option key={regime} value={regime}>
                    {regime}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <label style={labelStyle}>Esportes praticados</label>
        <input
          type="text"
          placeholder="Ex: Tenis, Natacao, Ciclismo..."
          value={perfil.esportes}
          onChange={(e) => setPerfil((prev) => ({ ...prev, esportes: e.target.value }))}
          style={inputStyle}
        />

        <label style={labelStyle}>Hobbies e interesses</label>
        <input
          type="text"
          placeholder="Ex: Vinhos, Viagens, Fotografia..."
          value={perfil.hobbies}
          onChange={(e) => setPerfil((prev) => ({ ...prev, hobbies: e.target.value }))}
          style={{ ...inputStyle, marginBottom: "1.25rem" }}
        />

        <button
          onClick={salvarPerfil}
          disabled={savingPerfil}
          style={{
            width: "100%",
            padding: "0.85rem",
            border: "none",
            borderRadius: "10px",
            background: successPerfil ? "#16A34A" : "#6366F1",
            color: "#fff",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor: savingPerfil ? "not-allowed" : "pointer",
            opacity: savingPerfil ? 0.7 : 1,
            transition: "all 0.2s",
            fontFamily: "inherit",
          }}
        >
          {savingPerfil ? "Salvando..." : successPerfil ? "Dados pessoais salvos!" : "Salvar dados pessoais"}
        </button>
        {erroPerfil && (
          <p style={{ margin: "0.75rem 0 0", fontSize: "0.82rem", color: "#EF4444" }}>
            {erroPerfil}
          </p>
        )}
      </div>

      <div style={{ background: "#181B24", borderRadius: "16px", padding: "1.5rem", marginBottom: "1rem", border: "1px solid #252832" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
          <p style={{ margin: 0, fontSize: "0.75rem", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Membros da Familia
          </p>
          <button
            onClick={() => {
              setShowFormMembro((value) => !value);
              setEditandoMembro(null);
            }}
            style={{
              background: "#6366F118",
              border: "1px solid #6366F140",
              borderRadius: "8px",
              color: "#6366F1",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
              padding: "0.35rem 0.75rem",
              fontFamily: "inherit",
            }}
          >
            {showFormMembro ? "Cancelar" : "+ Adicionar membro"}
          </button>
        </div>

        {showFormMembro && (
          <div style={{ background: "#0F1117", borderRadius: "12px", padding: "1rem", marginBottom: "1rem", border: "1px solid #252832" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <div>
                <label style={labelStyle}>Nome *</label>
                <input
                  type="text"
                  placeholder="Nome completo"
                  value={novoMembro.nome}
                  onChange={(e) => setNovoMembro((prev) => ({ ...prev, nome: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: 0, fontSize: "0.84rem", padding: "0.65rem 0.85rem" }}
                />
              </div>
              <div>
                <label style={labelStyle}>Parentesco *</label>
                <select
                  value={novoMembro.parentesco}
                  onChange={(e) => setNovoMembro((prev) => ({ ...prev, parentesco: e.target.value }))}
                  style={{ ...inputStyle, marginBottom: 0, fontSize: "0.84rem", padding: "0.65rem 0.85rem", appearance: "none" }}
                >
                  {parentescos.map((parentesco) => (
                    <option key={parentesco}>{parentesco}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: "0.75rem" }}>
              <label style={labelStyle}>Data de nascimento</label>
              <input
                type="date"
                value={novoMembro.data_nascimento}
                onChange={(e) => setNovoMembro((prev) => ({ ...prev, data_nascimento: e.target.value }))}
                style={{ ...inputStyle, marginBottom: 0, fontSize: "0.84rem", padding: "0.65rem 0.85rem" }}
              />
            </div>
            <button
              onClick={adicionarMembroFP}
              disabled={savingMembro}
              style={{
                width: "100%",
                padding: "0.7rem",
                border: "none",
                borderRadius: "10px",
                background: "#6366F1",
                color: "#fff",
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: savingMembro ? "not-allowed" : "pointer",
                opacity: savingMembro ? 0.7 : 1,
                fontFamily: "inherit",
              }}
            >
              {savingMembro ? "Salvando..." : "Confirmar"}
            </button>
          </div>
        )}

        {membros.length === 0 && !showFormMembro && (
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#555" }}>Nenhum membro cadastrado ainda.</p>
          </div>
        )}

        {membros.map((membro) => (
          <div
            key={membro.id}
            style={{
              background: "#0F1117",
              borderRadius: "10px",
              padding: "0.75rem 1rem",
              marginBottom: "0.5rem",
              border: "1px solid #252832",
            }}
          >
            {editandoMembro === membro.id ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <div>
                    <label style={labelStyle}>Nome *</label>
                    <input
                      type="text"
                      value={formEdicao.nome}
                      onChange={(e) => setFormEdicao((prev) => ({ ...prev, nome: e.target.value }))}
                      style={{ ...inputStyle, marginBottom: 0, fontSize: "0.84rem", padding: "0.65rem 0.85rem" }}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Parentesco *</label>
                    <select
                      value={formEdicao.parentesco}
                      onChange={(e) => setFormEdicao((prev) => ({ ...prev, parentesco: e.target.value }))}
                      style={{ ...inputStyle, marginBottom: 0, fontSize: "0.84rem", padding: "0.65rem 0.85rem", appearance: "none" }}
                    >
                      {parentescos.map((parentesco) => (
                        <option key={parentesco}>{parentesco}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: "0.75rem" }}>
                  <label style={labelStyle}>Data de nascimento</label>
                  <input
                    type="date"
                    value={formEdicao.data_nascimento}
                    onChange={(e) => setFormEdicao((prev) => ({ ...prev, data_nascimento: e.target.value }))}
                    style={{ ...inputStyle, marginBottom: 0, fontSize: "0.84rem", padding: "0.65rem 0.85rem" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    onClick={() => salvarEdicaoMembro(membro.id)}
                    disabled={savingMembro}
                    style={{
                      flex: 1,
                      padding: "0.6rem",
                      border: "none",
                      borderRadius: "8px",
                      background: "#6366F1",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.84rem",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {savingMembro ? "Salvando..." : "Salvar"}
                  </button>
                  <button
                    onClick={() => setEditandoMembro(null)}
                    style={{
                      padding: "0.6rem 1rem",
                      border: "1px solid #252832",
                      borderRadius: "8px",
                      background: "none",
                      color: "#888",
                      fontSize: "0.84rem",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#E8E8E8", fontSize: "0.9rem", fontWeight: 600 }}>{membro.nome}</div>
                  <div style={{ color: "#666", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                    {membro.parentesco}
                    {membro.data_nascimento ? ` - ${membro.data_nascimento}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <button
                    onClick={() => iniciarEdicao(membro)}
                    style={{
                      background: "none",
                      border: "1px solid #252832",
                      borderRadius: "6px",
                      color: "#6366F1",
                      cursor: "pointer",
                      fontSize: "0.75rem",
                      padding: "0.25rem 0.6rem",
                      fontFamily: "inherit",
                    }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => removerMembroFP(membro.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#444",
                      cursor: "pointer",
                      fontSize: "1.1rem",
                      lineHeight: 1,
                      padding: "0 0.25rem",
                    }}
                  >
                    x
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
