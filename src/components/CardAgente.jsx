import { temAcesso, trialAtivo, diasRestantesTrial } from "../lib/plano";
import UpgradePlano from "./UpgradePlano";

// Card do agente WhatsApp no topo do dashboard.
//
// Extraído de App.jsx em 2026-09-16 por um motivo só: ele existia APENAS no mobile.
// O bloco morava dentro de `tela === "dashboard" && !isDesktop`, e o DashboardDesktop
// não tinha uma linha sobre plano, trial ou assinatura. Quem abria o link do Pradex no
// computador — que é como a maioria das indicações chega — não via preço, não via
// teste, não via botão nenhum. Não era decisão de produto: era o card ter nascido na
// tela do celular e nunca ter sido levado pra outra.
//
// TRÊS casos distintos, cuidado ao mexer:
//   - assina   -> NADA. Já achou o agente; o card viraria lembrete do óbvio ocupando o
//                 topo do dashboard. (Um "&&" simples aqui jogaria o assinante no else,
//                 que é o CTA de upgrade — pior ainda.)
//   - trial    -> o card verde com o link, porque pode não ter começado a conversa
//   - sem nada -> UpgradePlano, que é o convite
const WA_LINK = "https://wa.me/5511924568633?text=Oi%21%20Quero%20come%C3%A7ar%20a%20usar%20o%20Pradex%20pelo%20WhatsApp.";

export default function CardAgente({ plano, trial, podeZap, isDesktop = false, onIniciarTrial, carregando = false }) {
  if (temAcesso(plano, "whatsapp")) return null;

  if (!podeZap) {
    return (
      <UpgradePlano
        isDesktop={isDesktop}
        plano={plano}
        recurso="whatsapp"
        variant="card"
        trial={trial}
        onIniciarTrial={onIniciarTrial}
        carregando={carregando}
      />
    );
  }

  // ⚠️ Este card renderiza nos DOIS canvas. Os hex de texto eram fixos no escuro
  // (#F1F2F4 / #8B93A1) porque ele só existia no mobile — sobre o canvas claro do
  // desktop, isso é texto branco em fundo quase branco. Mesmo padrão do UpgradePlano.
  const cTitulo = isDesktop ? "#111827" : "#F1F2F4";
  const cCorpo = isDesktop ? "#4B5563" : "#8B93A1";
  const dias = diasRestantesTrial(trial);

  return (
    <a
      href={WA_LINK}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: "flex", alignItems: "center", gap: "0.85rem", background: "#25D36612", border: "1px solid #25D36635", borderRadius: "16px", padding: "1rem 1.25rem", marginBottom: "1.25rem", textDecoration: "none", cursor: "pointer" }}
    >
      <div style={{ width: "40px", height: "40px", borderRadius: "12px", flexShrink: 0, background: "#25D366", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg viewBox="0 0 24 24" fill="#fff" width="22" height="22" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 0.15rem", fontSize: "0.92rem", fontWeight: 700, color: cTitulo }}>Lance seus gastos pelo WhatsApp</p>
        <p style={{ margin: 0, fontSize: "0.76rem", color: cCorpo, lineHeight: 1.4 }}>Manda texto ou áudio — "gastei 50 no mercado" — e o Pradex registra sozinho.</p>
        {/* Quem está no teste precisa saber que ele acaba — descobrir pelo silêncio no
            dia 15 é a pior versão disso.
            Só pra quem ainda NÃO paga: quem assinou continua com trial_ate preenchido
            no banco (o plano não apaga o trial), e mostrar "teste grátis · N dias
            restantes" pra assinante sugere que o acesso dele vence — foi o que o
            PRADELLA viu depois de virar assistente. O `temAcesso` no topo do
            componente já garante isso, mas a condição fica explícita. */}
        {trialAtivo(trial) && (
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.72rem", color: "#6366F1", fontWeight: 600 }}>
            Teste grátis · {dias} {dias === 1 ? "dia restante" : "dias restantes"}
          </p>
        )}
      </div>
      <span style={{ fontSize: "1.1rem", color: "#25D366", flexShrink: 0 }}>›</span>
    </a>
  );
}
