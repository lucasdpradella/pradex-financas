import { CHECKOUT, PRECO, ROTULO, nivelPlano, checkoutComEmail } from "../lib/plano";

// Banner de convite — aparece quando a pessoa chegou por um link com `?plano=`.
//
// POR QUE ISTO EXISTE (2026-09-16): o Lucas mandou o link do Pradex pra um amigo que
// ele já tinha convencido pessoalmente, e descobriu que o app não tinha caminho
// nenhum pra essa pessoa pagar. O convite de teste é desenhado pra quem duvida; quem
// já decidiu só queria o botão.
//
// A saída NÃO foi pôr preço na cara de todo mundo que se cadastra. A maioria dos
// cadastros não foi pré-vendida por ninguém, e cobrar no primeiro segundo é o jeito
// mais barato de perder quem ainda ia experimentar. O convite fica no LINK: quem
// recebeu de quem já explicou vê o botão; o resto do mundo continua vendo o teste.
//
// Não bloqueia nada e fecha com o ×. Sem auto-redirect pro checkout de propósito:
// `window.open` fora de clique é bloqueado pelo navegador, e mandar pra fora do app
// alguém que só queria olhar é pior que não ter botão nenhum.
const DESCRICAO = {
  essencial: "Lançamentos pelo WhatsApp e teto por categoria, liberados na hora.",
  assistente: "Tudo do Essencial mais o Planejamento Financeiro completo.",
  casal: "Tudo do Assistente para os dois, no mesmo livro — um paga, os dois usam.",
};

export default function ConvitePlano({ planoConvite, plano, email, isDesktop = false, onFechar }) {
  if (!planoConvite) return null;
  // Já tem o que o convite oferece: o banner viraria cobrança de quem já pagou.
  // Compara nível com nível: quem está no Assistente e recebeu convite do Casal ainda
  // tem o que subir; quem está no Casal não recebe convite de nada abaixo.
  if (nivelPlano(plano) >= nivelPlano(planoConvite)) return null;
  // Plano sem checkout configurado (Casal antes da oferta existir): sem botão, sem banner.
  if (!CHECKOUT[planoConvite]) return null;

  const cTitulo = isDesktop ? "#111827" : "#F1F2F4";
  const cCorpo = isDesktop ? "#4B5563" : "#8B93A1";
  const rotulo = ROTULO[planoConvite];

  return (
    <div style={{ background: "#6366F112", border: "1px solid #6366F140", borderRadius: "16px", padding: "1rem 1.25rem", marginBottom: "1.25rem", display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 0.2rem", fontSize: "0.92rem", fontWeight: 700, color: cTitulo }}>
          Seu convite é pro plano {rotulo}
        </p>
        <p style={{ margin: "0 0 0.8rem", fontSize: "0.78rem", color: cCorpo, lineHeight: 1.45 }}>
          {DESCRICAO[planoConvite]} Sem esperar os 14 dias de teste.
        </p>
        <a
          href={checkoutComEmail(CHECKOUT[planoConvite], email)}
          target="_blank"
          rel="noopener noreferrer"
          className="pdx-tap"
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "#6366F1", border: "none", borderRadius: "10px", color: "#fff", fontSize: "0.82rem", fontWeight: 700, fontFamily: "inherit", textDecoration: "none", padding: "0.6rem 1.1rem" }}
        >
          Assinar o {rotulo} — {PRECO[planoConvite]}/mês
        </a>
        {/* PIX e não cartão: o 3DS do checkout não desliga (tentado 2x em 15/09, o
            toggle volta sozinho) e derruba a compra SEM deixar registro nenhum no
            painel — foi o que aconteceu com a Solange. No PIX não há 3DS, o webhook
            libera igual (status 'paid') e o líquido é maior. Quando o 3DS for
            resolvido com o suporte da Cakto, esta linha pode sair. */}
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.72rem", color: cCorpo }}>
          No PIX a liberação é na hora.
        </p>
      </div>
      <button
        onClick={onFechar}
        aria-label="Fechar"
        style={{ background: "none", border: "none", color: "#8B93A1", cursor: "pointer", fontSize: "1.1rem", lineHeight: 1, padding: "0 0.25rem" }}
      >
        ×
      </button>
    </div>
  );
}
