import { conteudoUpgrade } from "../lib/plano";

// CTA de upgrade. Ocupa o lugar do recurso bloqueado em vez de deixar buraco: `card`
// entra no slot do card do WhatsApp no dashboard, `tela` ocupa a tela cheia (FP, Relatórios).
//
// O destino do checkout sai de `recurso`, não é fixo: falta Zap manda pro Essencial,
// falta FP/Relatórios manda pro Assistente.
//
// Não é página de vendas — só contexto + link do checkout (brief, Fase 2).

const Cadeado = ({ size = 20 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const BOTAO = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#C6A46B",
  border: "none",
  borderRadius: "10px",
  color: "#0C0E14",
  fontSize: "0.82rem",
  fontWeight: 700,
  fontFamily: "inherit",
  textDecoration: "none",
  cursor: "pointer",
  padding: "0.6rem 1.1rem",
};

export default function UpgradePlano({ plano, recurso, variant = "card", trial = null, onIniciarTrial, carregando = false }) {
  const { titulo, descricao, nota, cta, href, modo } = conteudoUpgrade(plano, recurso, { trial });
  const tela = variant === "tela";
  // Modo "trial" é ação no próprio app (RPC), não link externo de checkout — por isso
  // vira <button>. Se o pai não passou o handler, cai no link pra não virar botão morto.
  const acaoTrial = modo === "trial" && typeof onIniciarTrial === "function";

  return (
    <div
      style={{
        background: "#C6A46B12",
        border: "1px solid #C6A46B40",
        borderRadius: "16px",
        padding: tela ? "2rem 1.5rem" : "1rem 1.25rem",
        marginBottom: "1.25rem",
        textAlign: tela ? "center" : "left",
      }}
    >
      <div style={{ display: "flex", alignItems: tela ? "center" : "flex-start", gap: "0.85rem", flexDirection: tela ? "column" : "row" }}>
        <div
          style={{
            width: tela ? "48px" : "40px",
            height: tela ? "48px" : "40px",
            borderRadius: "12px",
            flexShrink: 0,
            background: "#C6A46B",
            color: "#0C0E14",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Cadeado size={tela ? 24 : 20} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 0.15rem", fontSize: tela ? "1.05rem" : "0.92rem", fontWeight: 700, color: "#F1F2F4" }}>{titulo}</p>
          <p style={{ margin: "0 0 0.35rem", fontSize: "0.76rem", color: "#8B93A1", lineHeight: 1.4 }}>{descricao}</p>
          <p style={{ margin: 0, fontSize: "0.72rem", color: "#C6A46B", fontWeight: 600 }}>{nota}</p>

          {acaoTrial ? (
            <button
              onClick={onIniciarTrial}
              disabled={carregando}
              style={{ ...BOTAO, marginTop: "0.9rem", border: "none", opacity: carregando ? 0.7 : 1, cursor: carregando ? "not-allowed" : "pointer" }}
            >
              {carregando ? "Liberando..." : cta}
            </button>
          ) : (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...BOTAO, marginTop: "0.9rem" }}
            >
              {cta}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
