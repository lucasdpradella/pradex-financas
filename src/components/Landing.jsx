// Página de vendas — o que quem NÃO tem conta vê em pradex.com.br.
//
// POR QUE ELA EXISTE. Até 14/09/2026 a raiz do site era um formulário de login. Pra
// quem já tem conta, ótimo. Pra quem ouviu falar do app e foi ver o que é, é a pior
// primeira tela possível: pede senha de um serviço que a pessoa ainda não sabe o que
// faz. Era também parte do motivo de a IA de busca do Google não achar nada pra
// dizer sobre o Pradex — a raiz do site não falava do produto.
//
// ARRANJO (decisão do PRADELLA, "vamos de B"): a MESMA URL decide por quem está
// olhando. Sem sessão, esta página. Com sessão, o app. Uma URL só, então o
// `start_url: "/"` do PWA continua valendo e nenhuma instalação existente quebra —
// que era o preço de mover o app pra /app.
//
// PÚBLICO: todo mundo, sem focar em cliente Nobel. Palavras do PRADELLA: "se vierem
// é lucro e fica fácil mostrar e explicar, já o contrário não". Por isso o pedido é
// CADASTRO GRÁTIS, não assinatura — vender R$ 29,90 pra quem nunca usou é caro.

import React from "react";

const C = {
  bg: "#0C0E14", surface: "#151821", surface2: "#1E2330", borda: "#2C3344",
  texto: "#F1F2F4", medio: "#8B93A1", fraco: "#5C6570",
  acento: "#6366F1", bom: "#2FBF8A",
};

const RECURSOS = [
  {
    titulo: "Lance pelo WhatsApp",
    texto: '"gastei 50 no mercado" — por texto ou áudio. Cai categorizado, sem abrir o app.',
  },
  {
    titulo: "Teto por categoria",
    texto: "Você diz quanto quer gastar no máximo em cada uma. O app avisa quando está perto.",
  },
  {
    titulo: "Cartões e parcelas",
    texto: "As parcelas dos próximos meses já aparecem, junto do que é recorrente.",
  },
  {
    titulo: "Score de disciplina",
    texto: "Pontua o hábito de registrar e de cumprir o que você prometeu. Nunca o tamanho da sua conta.",
  },
];

export default function Landing({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.texto, fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <div style={{ maxWidth: "760px", margin: "0 auto", padding: "2rem 1.25rem 3rem", boxSizing: "border-box" }}>

        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "3rem" }}>
          <span style={{ fontSize: "0.72rem", letterSpacing: "0.18em", textTransform: "uppercase", color: C.medio }}>Pradex Finanças</span>
          <a href="#entrar" style={{ fontSize: "0.82rem", color: C.medio, textDecoration: "none" }}>Já tenho conta</a>
        </header>

        <h1 style={{ margin: "0 0 1rem", fontSize: "2.1rem", lineHeight: 1.15, fontWeight: 600, letterSpacing: "-0.03em" }}>
          Saber pra onde vai o seu dinheiro não deveria dar trabalho.
        </h1>
        <p style={{ margin: "0 0 2rem", fontSize: "1.05rem", lineHeight: 1.6, color: C.medio }}>
          Você manda <em style={{ color: C.texto, fontStyle: "normal" }}>"gastei 50 no mercado"</em> no WhatsApp e acabou.
          O Pradex registra, organiza por categoria e te mostra onde você está estourando — antes do fim do mês.
        </p>

        <a
          href="#entrar"
          style={{ display: "inline-block", background: C.acento, color: "#fff", textDecoration: "none", fontWeight: 700, fontSize: "0.95rem", padding: "0.9rem 1.8rem", borderRadius: "10px" }}
        >
          Criar conta grátis
        </a>
        <p style={{ margin: "0.7rem 0 3rem", fontSize: "0.78rem", color: C.fraco }}>
          Grátis pra registrar e acompanhar, sem prazo. Sem cartão pra começar.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "0.9rem", marginBottom: "3rem" }}>
          {RECURSOS.map((r) => (
            <div key={r.titulo} style={{ background: C.surface, border: `1px solid ${C.surface2}`, borderRadius: "12px", padding: "1.1rem", boxSizing: "border-box" }}>
              <p style={{ margin: "0 0 0.35rem", fontSize: "0.92rem", fontWeight: 600 }}>{r.titulo}</p>
              <p style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.5, color: C.medio }}>{r.texto}</p>
            </div>
          ))}
        </div>

        {/* As três dúvidas que travam o cadastro, respondidas antes de serem feitas.
            "Onde ficam meus dados" está aqui e não no rodapé de propósito: é a
            objeção número um de app de finanças feito por gente que não é banco. */}
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 1rem" }}>Antes de você perguntar</h2>
        <dl style={{ margin: "0 0 3rem", display: "grid", gap: "1.1rem" }}>
          <div>
            <dt style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.25rem" }}>Preciso conectar meu banco?</dt>
            <dd style={{ margin: 0, fontSize: "0.86rem", lineHeight: 1.55, color: C.medio }}>
              Não. O Pradex não pede senha de banco, não acessa conta e não lê cartão. Você registra o que quiser, do jeito que quiser.
            </dd>
          </div>
          <div>
            <dt style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.25rem" }}>Onde ficam os meus dados?</dt>
            <dd style={{ margin: 0, fontSize: "0.86rem", lineHeight: 1.55, color: C.medio }}>
              Na sua conta, em servidor, com acesso isolado por usuário. Não é no navegador: trocar de celular ou limpar o histórico não apaga nada.
              Você pode excluir tudo quando quiser, sem falar com ninguém. <a href="/sobre" style={{ color: C.acento }}>Mais detalhes</a>.
            </dd>
          </div>
          <div>
            <dt style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: "0.25rem" }}>Quanto custa?</dt>
            <dd style={{ margin: 0, fontSize: "0.86rem", lineHeight: 1.55, color: C.medio }}>
              Registrar, organizar e acompanhar é grátis, sem limite de lançamento e sem prazo.
              O agente do WhatsApp e o teto por categoria fazem parte do Essencial, R$ 29,90 por mês, cancela quando quiser.
            </dd>
          </div>
        </dl>

        {/* O formulário de login/cadastro que já existia, recebido como children.
            Não foi reescrito: a lógica de auth continua no App.jsx, intocada. */}
        <div id="entrar" style={{ scrollMarginTop: "1rem" }}>
          {children}
        </div>

        <footer style={{ marginTop: "2.5rem", paddingTop: "1.25rem", borderTop: `1px solid ${C.surface2}`, fontSize: "0.78rem", color: C.fraco, lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 0.5rem" }}>
            Feito por Lucas D'Angelo Pradella, assessor de investimentos na Nobel Capital.
            O Pradex é um app de organização financeira: não faz recomendação de investimento nem promete rentabilidade.
          </p>
          <a href="/sobre" style={{ color: C.medio, marginRight: "1rem" }}>Sobre</a>
          <a href="/privacidade" style={{ color: C.medio, marginRight: "1rem" }}>Privacidade</a>
          <a href="/excluir-conta" style={{ color: C.medio }}>Excluir conta</a>
        </footer>
      </div>
    </div>
  );
}
