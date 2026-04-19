import { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";

// ── Categorias disponíveis para objetivos secundários
const CATEGORIAS = [
  "Imóveis",
  "Veículos",
  "Viagem",
  "Educação",
  "Saúde",
  "Negócio próprio",
  "Reserva de emergência",
  "Outros",
];

const FREQUENCIAS = ["Única", "Parcelada", "Mensal", "Anual"];

const objetivoVazio = () => ({
  id: crypto.randomUUID(),
  nome: "",
  categoria: "Imóveis",
  idade_atingimento: "",
  frequencia: "Única",
  valor: "",
  ocorrencias: "",
});

const moeda = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export default function ObjetivosFP() {
  const [userId, setUserId] = useState(null);
  const [salvandoAp, setSalvandoAp] = useState(false);
  const [salvandoOutros, setSalvandoOutros] = useState(false);
  const [sucesso, setSucesso] = useState(null);

  // Aposentadoria
  const [apIdade, setApIdade] = useState("");
  const [apFrequencia, setApFrequencia] = useState("Parcelada");
  const [apReceita, setApReceita] = useState("");
  const [apExpectativa, setApExpectativa] = useState("");

  // Outros objetivos
  const [outros, setOutros] = useState([objetivoVazio()]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data } = await supabase
        .from("fp_objetivos")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setApIdade(data.aposentadoria_idade_alvo ?? "");
        setApFrequencia(data.aposentadoria_frequencia ?? "Parcelada");
        setApReceita(data.aposentadoria_renda_mensal ?? "");
        setApExpectativa(data.aposentadoria_expectativa_vida ?? "");
        setOutros(data.outros_objetivos?.length > 0 ? data.outros_objetivos : [objetivoVazio()]);
      }
    };
    init();
  }, []);

  const ok = (secao) => {
    setSucesso(secao);
    setTimeout(() => setSucesso(null), 2500);
  };

  const salvarAposentadoria = async () => {
    if (!userId) return;
    setSalvandoAp(true);
    await supabase.from("fp_objetivos").upsert(
      {
        user_id: userId,
        aposentadoria_idade_alvo: apIdade || null,
        aposentadoria_frequencia: apFrequencia,
        aposentadoria_renda_mensal: apReceita || null,
        aposentadoria_expectativa_vida: apExpectativa || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    setSalvandoAp(false);
    ok("aposentadoria");
  };

  const salvarOutros = async () => {
    if (!userId) return;
    setSalvandoOutros(true);
    const limpos = outros.filter((o) => o.nome.trim() !== "");
    await supabase.from("fp_objetivos").upsert(
      {
        user_id: userId,
        outros_objetivos: limpos,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );
    setSalvandoOutros(false);
    ok("outros");
  };

  const addObjetivo = () => setOutros((p) => [...p, objetivoVazio()]);
  const removeObjetivo = (id) => setOutros((p) => p.filter((o) => o.id !== id));
  const updateObjetivo = (id, campo, valor) =>
    setOutros((p) => p.map((o) => (o.id === id ? { ...o, [campo]: valor } : o)));

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "24px 16px" }}>

      {/* ── APOSENTADORIA ── */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={badge}>Obrigatório</span>
          <h2 style={titulo}>🏖️ Aposentadoria</h2>
          <p style={subtitulo}>
            O primeiro objetivo do planejamento é garantir a estabilidade financeira após o encerramento da vida profissional.
          </p>
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
            <input
              type="number" placeholder="65"
              value={apIdade} onChange={(e) => setApIdade(e.target.value)}
              style={input}
            />
          </div>
          <div style={campo}>
            <label style={lbl}>Frequência do resgate</label>
            <select value={apFrequencia} onChange={(e) => setApFrequencia(e.target.value)} style={input}>
              {FREQUENCIAS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <div style={grid}>
          <div style={campo}>
            <label style={lbl}>Receita mensal desejada (R$)</label>
            <input
              type="number" placeholder="20.000"
              value={apReceita} onChange={(e) => setApReceita(e.target.value)}
              style={input}
            />
          </div>
          <div style={campo}>
            <label style={lbl}>Expectativa de vida</label>
            <input
              type="number" placeholder="90"
              value={apExpectativa} onChange={(e) => setApExpectativa(e.target.value)}
              style={input}
            />
          </div>
        </div>

        {apReceita && apIdade && apExpectativa && (
          <p style={dica}>
            💡 Referência (regra dos 4%): patrimônio necessário ≈ <strong>{moeda(apReceita * 12 * 25)}</strong>
          </p>
        )}

        <div style={rodape}>
          {sucesso === "aposentadoria" && <span style={okStyle}>✓ Salvo!</span>}
          <button onClick={salvarAposentadoria} disabled={salvandoAp} style={btnPrimario}>
            {salvandoAp ? "Salvando..." : "Salvar aposentadoria"}
          </button>
        </div>
      </div>

      {/* ── OUTROS OBJETIVOS ── */}
      <div style={{ ...card, marginTop: 24 }}>
        <div style={cardHeader}>
          <h2 style={titulo}>🎯 Outros Objetivos</h2>
          <p style={subtitulo}>
            Conheça as metas que o cliente deseja realizar ao longo de sua vida.
          </p>
          <div style={aviso}>
            <span>ℹ️</span>
            <span>Não recadastre os objetivos secundários nas despesas, pois eles já serão considerados no cálculo.</span>
          </div>
        </div>

        {outros.map((obj, idx) => (
          <div key={obj.id} style={linhaObjetivo}>
            <div style={linhaHeader}>
              <span style={numeroBadge}>{idx + 1}</span>
              <button onClick={() => removeObjetivo(obj.id)} style={btnRemover}>× Remover</button>
            </div>

            <div style={grid}>
              <div style={campo}>
                <label style={lbl}>Nome do objetivo *</label>
                <input
                  type="text" placeholder="Ex: Casa de campo"
                  value={obj.nome}
                  onChange={(e) => updateObjetivo(obj.id, "nome", e.target.value)}
                  style={input}
                />
              </div>
              <div style={campo}>
                <label style={lbl}>Categoria *</label>
                <select
                  value={obj.categoria}
                  onChange={(e) => updateObjetivo(obj.id, "categoria", e.target.value)}
                  style={input}
                >
                  {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={grid}>
              <div style={campo}>
                <label style={lbl}>Idade que deseja atingir o objetivo *</label>
                <input
                  type="number" placeholder="35"
                  value={obj.idade_atingimento}
                  onChange={(e) => updateObjetivo(obj.id, "idade_atingimento", e.target.value)}
                  style={input}
                />
              </div>
              <div style={campo}>
                <label style={lbl}>Frequência do resgate *</label>
                <select
                  value={obj.frequencia}
                  onChange={(e) => updateObjetivo(obj.id, "frequencia", e.target.value)}
                  style={input}
                >
                  {FREQUENCIAS.map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>

            <div style={grid}>
              <div style={campo}>
                <label style={lbl}>
                  {obj.frequencia === "Única" ? "Valor do objetivo (R$) *" : "Valor do resgate (R$) *"}
                </label>
                <input
                  type="number"
                  placeholder={obj.frequencia === "Única" ? "2.000.000" : "5.000"}
                  value={obj.valor}
                  onChange={(e) => updateObjetivo(obj.id, "valor", e.target.value)}
                  style={input}
                />
              </div>
              {obj.frequencia !== "Única" && (
                <div style={campo}>
                  <label style={lbl}>Quantidade de ocorrências *</label>
                  <input
                    type="number" placeholder="12"
                    value={obj.ocorrencias}
                    onChange={(e) => updateObjetivo(obj.id, "ocorrencias", e.target.value)}
                    style={input}
                  />
                </div>
              )}
            </div>
          </div>
        ))}

        <button onClick={addObjetivo} style={btnSecundario}>+ Adicionar objetivo</button>

        <div style={rodape}>
          {sucesso === "outros" && <span style={okStyle}>✓ Salvo!</span>}
          <button onClick={salvarOutros} disabled={salvandoOutros} style={btnPrimario}>
            {salvandoOutros ? "Salvando..." : "Salvar objetivos"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Estilos
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
  display: "flex", gap: 10, alignItems: "flex-start",
  background: "rgba(33,150,243,0.08)", border: "1px solid rgba(33,150,243,0.2)",
  borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#90caf9",
};
const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 16 };
const campo = { display: "flex", flexDirection: "column", gap: 6 };
const lbl = { fontSize: 12, fontWeight: 600, color: "var(--text-secondary, #aaa)", textTransform: "uppercase", letterSpacing: "0.05em" };
const input = {
  background: "var(--input-bg, #0f0f1e)", border: "1px solid var(--border, #2a2a4a)",
  borderRadius: 8, padding: "10px 12px", color: "var(--text-primary, #e8e8f0)", fontSize: 14, outline: "none",
};
const dica = {
  marginTop: 4, marginBottom: 16, fontSize: 13, color: "var(--accent, #7c6af7)",
  background: "rgba(124,106,247,0.08)", borderRadius: 8, padding: "8px 12px",
};
const linhaObjetivo = {
  background: "rgba(255,255,255,0.03)", border: "1px solid var(--border, #2a2a4a)",
  borderRadius: 10, padding: "16px", marginBottom: 16,
};
const linhaHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 };
const numeroBadge = {
  width: 26, height: 26, background: "var(--accent, #7c6af7)", borderRadius: "50%",
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 12, fontWeight: 700, color: "#fff",
};
const rodape = { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 16, marginTop: 20 };
const okStyle = { fontSize: 13, color: "#4caf50", fontWeight: 600 };
const btnPrimario = {
  background: "var(--accent, #7c6af7)", color: "#fff", border: "none",
  borderRadius: 8, padding: "10px 20px", fontWeight: 600, fontSize: 14, cursor: "pointer",
};
const btnSecundario = {
  background: "transparent", color: "var(--accent, #7c6af7)", border: "1px solid var(--accent, #7c6af7)",
  borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", marginTop: 4,
};
const btnRemover = {
  background: "transparent", color: "#e57373", border: "1px solid rgba(229,115,115,0.3)",
  borderRadius: 6, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
};
