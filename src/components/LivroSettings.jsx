import { useEffect, useState } from "react";
import { MOEDAS } from "../lib/moeda";
import { t } from "../lib/i18n";

const MOEDA_LABEL = { BRL: "BRL · R$", USD: "USD · $", DKK: "DKK · kr" };

export default function LivroSettings({ livro, idioma, isDesktop, onSalvar, salvando, membros = [] }) {
  const s = (key) => t(idioma, key);
  const [moeda, setMoeda] = useState(livro?.moeda || "BRL");
  const [lingua, setLingua] = useState(livro?.idioma === "en" ? "en" : "pt-BR");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setMoeda(livro?.moeda || "BRL");
    setLingua(livro?.idioma === "en" ? "en" : "pt-BR");
  }, [livro?.id, livro?.moeda, livro?.idioma]);

  const c = isDesktop
    ? { card: "#FFFFFF", borda: "#E4E7F0", texto: "#111827", medio: "#6B7280", fundo: "#F1F3F9", acento: "#4F46E5" }
    : { card: "#151821", borda: "#1E2330", texto: "#F1F2F4", medio: "#8B93A1", fundo: "#0C0E14", acento: "#6366F1" };

  const salvar = async () => {
    setMsg("");
    const res = await onSalvar?.({ moeda, idioma: lingua });
    setMsg(res?.ok ? s("livro_salvo") : (res?.erro || s("livro_erro")));
  };

  if (!livro?.id) {
    return <p style={{ color: c.medio, fontSize: "0.9rem" }}>{s("livro_sem")}</p>;
  }

  return (
    <section style={{ background: c.card, border: `1px solid ${c.borda}`, borderRadius: 16, padding: "1.25rem", maxWidth: 520 }}>
      <p style={{ margin: "0 0 1rem", fontSize: "0.8rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: c.medio }}>{s("livro_titulo")}</p>

      <label style={{ display: "block", marginBottom: "0.9rem" }}>
        <span style={{ display: "block", marginBottom: "0.35rem", color: c.texto, fontWeight: 650 }}>{s("livro_moeda")}</span>
        <select value={moeda} onChange={(e) => setMoeda(e.target.value)} style={{ width: "100%", background: c.fundo, color: c.texto, border: `1px solid ${c.borda}`, borderRadius: 10, padding: "0.65rem 0.75rem", font: "inherit" }}>
          {MOEDAS.map((m) => <option key={m} value={m}>{MOEDA_LABEL[m]}</option>)}
        </select>
        <span style={{ display: "block", marginTop: "0.35rem", color: c.medio, fontSize: "0.78rem" }}>{s("livro_moeda_hint")}</span>
      </label>

      <label style={{ display: "block", marginBottom: "1rem" }}>
        <span style={{ display: "block", marginBottom: "0.35rem", color: c.texto, fontWeight: 650 }}>{s("livro_idioma")}</span>
        <select value={lingua} onChange={(e) => setLingua(e.target.value)} style={{ width: "100%", background: c.fundo, color: c.texto, border: `1px solid ${c.borda}`, borderRadius: 10, padding: "0.65rem 0.75rem", font: "inherit" }}>
          <option value="pt-BR">{s("pt")}</option>
          <option value="en">{s("en")}</option>
        </select>
        <span style={{ display: "block", marginTop: "0.35rem", color: c.medio, fontSize: "0.78rem" }}>{s("livro_idioma_hint")}</span>
      </label>

      <button type="button" disabled={salvando} onClick={salvar} style={{ border: "none", borderRadius: 10, background: c.acento, color: "#fff", fontWeight: 700, padding: "0.7rem 1rem", cursor: "pointer", fontFamily: "inherit" }}>
        {salvando ? s("salvando") : s("livro_salvar")}
      </button>
      {msg && <p style={{ margin: "0.75rem 0 0", color: c.medio, fontSize: "0.82rem" }}>{msg}</p>}

      <div style={{ marginTop: "1.25rem", paddingTop: "1rem", borderTop: `1px solid ${c.borda}` }}>
        <p style={{ margin: "0 0 0.5rem", color: c.texto, fontWeight: 650, fontSize: "0.88rem" }}>{s("livro_membros")}</p>
        {membros.length < 2 && <p style={{ margin: 0, color: c.medio, fontSize: "0.8rem" }}>{s("livro_sozinho")}</p>}
        {membros.map((m) => (
          <p key={m.user_id} style={{ margin: "0.25rem 0", color: c.texto, fontSize: "0.85rem" }}>
            {m.nome || "—"} <span style={{ color: c.medio }}>· {m.papel === "dono" ? s("livro_dono") : s("livro_membro")}</span>
          </p>
        ))}
      </div>
    </section>
  );
}
