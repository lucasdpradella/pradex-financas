import { useEffect, useState } from "react";

const SUPABASE_URL = "https://sjvuhqqsjboncwpboclv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE";

const sbApi = (token) => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${token || SUPABASE_KEY}`,
});

const CATEGORIAS = [
  "Imoveis",
  "Veiculos",
  "Viagem",
  "Educacao",
  "Saude",
  "Negocio proprio",
  "Reserva de emergencia",
  "Outros",
];

const FREQUENCIAS = ["Unica", "Parcelada", "Mensal", "Anual"];

const objetivoVazio = () => ({
  localId: crypto.randomUUID(),
  id: null,
  nome: "",
  categoria: "Imoveis",
  idade_atingimento: "",
  frequencia: "Unica",
  valor: "",
  ocorrencias: "",
});

function rowParaObjetivo(row) {
  return {
    localId: crypto.randomUUID(),
    id: row.id ?? null,
    nome: row.nome ?? "",
    categoria: row.categoria ?? "Imoveis",
    idade_atingimento: row.idade_atingimento ?? "",
    frequencia: row.frequencia ?? "Unica",
    valor: row.valor ?? "",
    ocorrencias: row.ocorrencias ?? "",
  };
}

export default function ObjetivosFP({ session }) {
  const userId = session?.user?.id ?? null;
  const token = session?.token ?? null;

  const [aposentadoriaId, setAposentadoriaId] = useState(null);
  const [salvandoAp, setSalvandoAp] = useState(false);
  const [salvandoOutros, setSalvandoOutros] = useState(false);
  const [sucesso, setSucesso] = useState(null);
  const [erro, setErro] = useState("");

  const [apIdade, setApIdade] = useState("");
  const [apFrequencia, setApFrequencia] = useState("Parcelada");
  const [apReceita, setApReceita] = useState("");
  const [apExpectativa, setApExpectativa] = useState("");

  const [outros, setOutros] = useState([objetivoVazio()]);

  useEffect(() => {
    const init = async () => {
      if (!token || !userId) return;
      try {
        const res = await fetch(
          `${SUPABASE_URL}/rest/v1/fp_objetivos?user_id=eq.${userId}&select=*&order=id.asc`,
          { headers: sbApi(token) }
        );
        const rows = await res.json();
        if (!Array.isArray(rows)) return;

        const aposentadoria = rows.find((r) => r.nome === "Aposentadoria");
        const secundarios = rows.filter((r) => r.nome !== "Aposentadoria");

        if (aposentadoria) {
          setAposentadoriaId(aposentadoria.id ?? null);
          setApIdade(aposentadoria.idade_atingimento ?? "");
          setApFrequencia(aposentadoria.aposentadoria_frequencia || aposentadoria.frequencia || "Parcelada");
          setApReceita(aposentadoria.valor ?? "");
          setApExpectativa(aposentadoria.aposentadoria_expectativa_vida ?? aposentadoria.expectativa_vida ?? "");
        }

        setOutros(secundarios.length > 0 ? secundarios.map(rowParaObjetivo) : [objetivoVazio()]);
      } catch (error) {
        console.error("[fp_objetivos] Erro ao carregar:", error);
      }
    };
    init();
  }, [token, userId]);

  const ok = (secao) => {
    setSucesso(secao);
    setTimeout(() => setSucesso(null), 2500);
  };

  async function upsertObjetivo({ id, payload }) {
    const url = id
      ? `${SUPABASE_URL}/rest/v1/fp_objetivos?id=eq.${id}`
      : `${SUPABASE_URL}/rest/v1/fp_objetivos`;
    const res = await fetch(url, {
      method: id ? "PATCH" : "POST",
      headers: { ...sbApi(token), Prefer: "return=representation" },
      body: JSON.stringify({ user_id: userId, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Erro ao salvar objetivo.");
    return Array.isArray(data) ? data[0] : null;
  }

  async function deletarObjetivo(id) {
    if (!id) return;
    await fetch(`${SUPABASE_URL}/rest/v1/fp_objetivos?id=eq.${id}`, {
      method: "DELETE",
      headers: sbApi(token),
    });
  }

  const salvarAposentadoria = async () => {
    if (!userId || !token) return;
    setErro("");
    setSalvandoAp(true);
    try {
      const saved = await upsertObjetivo({
        id: aposentadoriaId,
        payload: {
          nome: "Aposentadoria",
          categoria: "Aposentadoria",
          idade_atingimento: apIdade || null,
          frequencia: apFrequencia,
          aposentadoria_frequencia: apFrequencia,
          valor: apReceita || null,
          expectativa_vida: apExpectativa || null,
          aposentadoria_expectativa_vida: apExpectativa || null,
        },
      });
      if (saved?.id) setAposentadoriaId(saved.id);
      ok("aposentadoria");
    } catch (error) {
      setErro(error.message);
      console.error("[fp_objetivos] Erro ao salvar aposentadoria:", error);
    }
    setSalvandoAp(false);
  };

  const salvarOutros = async () => {
    if (!userId || !token) return;
    setErro("");
    setSalvandoOutros(true);
    try {
      const preenchidos = outros.filter((o) => o.nome.trim() !== "");
      const salvos = [];
      for (const objetivo of preenchidos) {
        const saved = await upsertObjetivo({
          id: objetivo.id,
          payload: {
            nome: objetivo.nome.trim(),
            categoria: objetivo.categoria,
            idade_atingimento: objetivo.idade_atingimento || null,
            frequencia: objetivo.frequencia,
            valor: objetivo.valor || null,
            ocorrencias: objetivo.frequencia !== "Unica" ? (objetivo.ocorrencias || null) : null,
          },
        });
        salvos.push({ ...objetivo, id: saved?.id ?? objetivo.id });
      }
      setOutros(salvos.length > 0 ? salvos : [objetivoVazio()]);
      ok("outros");
    } catch (error) {
      setErro(error.message);
      console.error("[fp_objetivos] Erro ao salvar outros objetivos:", error);
    }
    setSalvandoOutros(false);
  };

  const addObjetivo = () => setOutros((prev) => [...prev, objetivoVazio()]);

  const removeObjetivo = async (localId) => {
    const objetivo = outros.find((o) => o.localId === localId);
    if (objetivo?.id) await deletarObjetivo(objetivo.id);
    setOutros((prev) => {
      const next = prev.filter((o) => o.localId !== localId);
      return next.length > 0 ? next : [objetivoVazio()];
    });
  };

  const updateObjetivo = (localId, campo, valor) =>
    setOutros((prev) => prev.map((o) => (o.localId === localId ? { ...o, [campo]: valor } : o)));

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>
      <div style={card}>
        <div style={cardHeader}>
          <span style={badge}>Obrigatorio</span>
          <h2 style={titulo}>Aposentadoria</h2>
          <p style={subtitulo}>O primeiro objetivo do planejamento e garantir a estabilidade financeira apos o encerramento da vida profissional.</p>
        </div>

        <div style={grid}>
          <div style={campo}>
            <label style={lbl}>Nome do objetivo</label>
            <input value="Aposentadoria" disabled style={{ ...input, opacity: 0.5, cursor: "not-allowed" }} />
          </div>
          <div style={campo}>
            <label style={lbl}>Categoria</label>
            <input value="Aposentadoria" disabled style={{ ...input, opacity: 0.5, cursor: "not-allowed" }} />
          </div>
        </div>

        <div style={grid}>
          <div style={campo}>
            <label style={lbl}>Idade que deseja atingir o objetivo</label>
            <input type="number" placeholder="65" value={apIdade} onChange={(e) => setApIdade(e.target.value)} style={input} />
          </div>
          <div style={campo}>
            <label style={lbl}>Frequencia do resgate</label>
            <select value={apFrequencia} onChange={(e) => setApFrequencia(e.target.value)} style={input}>
              {FREQUENCIAS.map((frequencia) => <option key={frequencia}>{frequencia}</option>)}
            </select>
          </div>
        </div>

        <div style={grid}>
          <div style={campo}>
            <label style={lbl}>Receita mensal desejada (R$)</label>
            <input type="number" placeholder="20000" value={apReceita} onChange={(e) => setApReceita(e.target.value)} style={input} />
          </div>
          <div style={campo}>
            <label style={lbl}>Expectativa de vida</label>
            <input type="number" placeholder="90" value={apExpectativa} onChange={(e) => setApExpectativa(e.target.value)} style={input} />
          </div>
        </div>

        <div style={rodape}>
          {sucesso === "aposentadoria" && <span style={okStyle}>Salvo!</span>}
          <button onClick={salvarAposentadoria} disabled={salvandoAp} style={btnPrimario}>
            {salvandoAp ? "Salvando..." : "Salvar aposentadoria"}
          </button>
        </div>
      </div>

      <div style={{ ...card, marginTop: 24 }}>
        <div style={cardHeader}>
          <h2 style={titulo}>Outros Objetivos</h2>
          <p style={subtitulo}>Conheca as metas que o cliente deseja realizar ao longo de sua vida.</p>
          <div style={aviso}>
            <span>i</span>
            <span>Nao recadastre os objetivos secundarios nas despesas, pois eles ja serao considerados no calculo.</span>
          </div>
        </div>

        {outros.map((objetivo, index) => (
          <div key={objetivo.localId} style={linhaObjetivo}>
            <div style={linhaHeader}>
              <span style={numeroBadge}>{index + 1}</span>
              <button onClick={() => removeObjetivo(objetivo.localId)} style={btnRemover}>Remover</button>
            </div>

            <div style={grid}>
              <div style={campo}>
                <label style={lbl}>Nome do objetivo *</label>
                <input type="text" placeholder="Ex: Casa de campo" value={objetivo.nome} onChange={(e) => updateObjetivo(objetivo.localId, "nome", e.target.value)} style={input} />
              </div>
              <div style={campo}>
                <label style={lbl}>Categoria *</label>
                <select value={objetivo.categoria} onChange={(e) => updateObjetivo(objetivo.localId, "categoria", e.target.value)} style={input}>
                  {CATEGORIAS.map((categoria) => <option key={categoria}>{categoria}</option>)}
                </select>
              </div>
            </div>

            <div style={grid}>
              <div style={campo}>
                <label style={lbl}>Idade que deseja atingir o objetivo *</label>
                <input type="number" placeholder="35" value={objetivo.idade_atingimento} onChange={(e) => updateObjetivo(objetivo.localId, "idade_atingimento", e.target.value)} style={input} />
              </div>
              <div style={campo}>
                <label style={lbl}>Frequencia do resgate *</label>
                <select value={objetivo.frequencia} onChange={(e) => updateObjetivo(objetivo.localId, "frequencia", e.target.value)} style={input}>
                  {FREQUENCIAS.map((frequencia) => <option key={frequencia}>{frequencia}</option>)}
                </select>
              </div>
            </div>

            <div style={grid}>
              <div style={campo}>
                <label style={lbl}>{objetivo.frequencia === "Unica" ? "Valor do objetivo (R$) *" : "Valor do resgate (R$) *"}</label>
                <input type="number" placeholder={objetivo.frequencia === "Unica" ? "2000000" : "5000"} value={objetivo.valor} onChange={(e) => updateObjetivo(objetivo.localId, "valor", e.target.value)} style={input} />
              </div>
              {objetivo.frequencia !== "Unica" && (
                <div style={campo}>
                  <label style={lbl}>Quantidade de ocorrencias *</label>
                  <input type="number" placeholder="12" value={objetivo.ocorrencias} onChange={(e) => updateObjetivo(objetivo.localId, "ocorrencias", e.target.value)} style={input} />
                </div>
              )}
            </div>
          </div>
        ))}

        <button onClick={addObjetivo} style={btnSecundario}>+ Adicionar objetivo</button>

        <div style={rodape}>
          {sucesso === "outros" && <span style={okStyle}>Salvo!</span>}
          <button onClick={salvarOutros} disabled={salvandoOutros} style={btnPrimario}>
            {salvandoOutros ? "Salvando..." : "Salvar objetivos"}
          </button>
        </div>
      </div>

      {erro && (
        <div style={{ ...aviso, marginTop: 16, background: "rgba(244,67,54,0.08)", border: "1px solid rgba(244,67,54,0.3)", color: "#ef9a9a" }}>
          <span>!</span>
          <span>{erro}</span>
        </div>
      )}
    </div>
  );
}

const card = {
  background: "var(--card-bg, #1a1a2e)",
  border: "1px solid var(--border, #2a2a4a)",
  borderRadius: 12,
  padding: "24px 20px",
};
const cardHeader = { marginBottom: 20 };
const badge = {
  display: "inline-block",
  background: "rgba(124,106,247,0.15)",
  color: "var(--accent, #7c6af7)",
  fontSize: 11,
  fontWeight: 700,
  padding: "3px 10px",
  borderRadius: 20,
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};
const titulo = { margin: "0 0 6px", fontSize: 18, fontWeight: 700, color: "var(--text-primary, #e8e8f0)" };
const subtitulo = { margin: "0 0 12px", fontSize: 13, color: "var(--text-muted, #888)" };
const aviso = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  background: "rgba(33,150,243,0.08)",
  border: "1px solid rgba(33,150,243,0.2)",
  borderRadius: 8,
  padding: "10px 14px",
  fontSize: 13,
  color: "#90caf9",
};
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 };
const campo = { display: "flex", flexDirection: "column", gap: 6 };
const lbl = { fontSize: 12, fontWeight: 600, color: "var(--text-secondary, #aaa)", textTransform: "uppercase", letterSpacing: "0.05em" };
const input = {
  background: "var(--input-bg, #0f0f1e)",
  border: "1px solid var(--border, #2a2a4a)",
  borderRadius: 8,
  padding: "10px 12px",
  color: "var(--text-primary, #e8e8f0)",
  fontSize: 14,
  outline: "none",
};
const linhaObjetivo = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid var(--border, #2a2a4a)",
  borderRadius: 10,
  padding: "16px",
  marginBottom: 16,
};
const linhaHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 };
const numeroBadge = {
  width: 26,
  height: 26,
  background: "var(--accent, #7c6af7)",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 700,
  color: "#fff",
};
const rodape = { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16, marginTop: 20 };
const okStyle = { fontSize: 13, color: "#4caf50", fontWeight: 600 };
const btnPrimario = {
  background: "var(--accent, #7c6af7)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 20px",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
};
const btnSecundario = {
  background: "transparent",
  color: "var(--accent, #7c6af7)",
  border: "1px solid var(--accent, #7c6af7)",
  borderRadius: 8,
  padding: "8px 16px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  marginTop: 4,
};
const btnRemover = {
  background: "transparent",
  color: "#e57373",
  border: "1px solid rgba(229,115,115,0.3)",
  borderRadius: 6,
  padding: "4px 10px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};
