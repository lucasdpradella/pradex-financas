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
// é lucro e fica fácil mostrar e explicar, já o contrário não".
//
// ===== REDESENHO DE 2026-09-16 =====
//
// Origem: auditoria da home pelo Codex Desktop + proposta visual aprovada pelo Lucas
// ("ficou incrivelmente linda, quero igual"). Brief e mockup no vault:
//   Projetos/PRADEX/briefs/home-visual-conversao.md
//   Projetos/PRADEX/marca/home-proposta-visual.png
//
// O que a auditoria achou e este arquivo corrige:
//   1. a página era escura e TEXTUAL — não mostrava o produto em lugar nenhum
//   2. não existia comparação de planos, e o Assistente não aparecia (só o Essencial,
//      escondido numa resposta do FAQ)
//   3. "Criar conta grátis" levava a `#entrar` e o formulário abria em ENTRAR. Quem
//      clicava em criar conta caía numa tela de login. Este era o pior deles: não
//      adianta consertar a oferta depois do cadastro (PR #72) se o botão de cadastrar
//      manda pro lugar errado.
//
// A cena do hero É a arte do Codex, recortada e otimizada (ver HeroMockup.jsx pra
// saber por que ela não é CSS). Já o polvo do cabeçalho e do card do Essencial sai do
// SVG oficial (MascotePradex.jsx), não do render 3D: o render é uma interpretação, o
// vetor é a identidade, e ele precisa ficar nítido a 30px.
//
// ⚠️ NÃO PROMETER O QUE NÃO EXISTE. Sem selo de "mais vendido", sem depoimento
// inventado, sem trial automático (o teste só começa por clique, ver lib/plano.js) e
// sem anunciar feature que ainda não está em produção.

import React from "react";
import MascotePradex from "./MascotePradex";
import HeroMockup from "./HeroMockup";
import { PRECO } from "../lib/plano";

const C = {
  bg: "#0C0E14", surface: "#151821", surface2: "#1E2330", borda: "#2C3344",
  texto: "#F1F2F4", medio: "#8B93A1", fraco: "#5C6570",
  acento: "#6366F1", acentoClaro: "#8189F7", ciano: "#22D3EE", bom: "#2FBF8A",
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

// Os três planos. O conteúdo veio do brief do Codex, e os PREÇOS saem de lib/plano.js
// — a mesma constante que o app usa nos CTAs de dentro. Preço em dois lugares diverge
// no dia em que um deles muda, e aí a home promete um valor que o checkout não cobra.
const PLANOS = [
  {
    chave: "free",
    nome: "Free",
    preco: "R$ 0",
    sufixo: "",
    linha: "Comece a se organizar",
    itens: ["Registro de gastos", "Cartões e parcelas", "Histórico e dashboard"],
    cta: "Começar grátis",
    icone: "raio",
  },
  {
    chave: "essencial",
    nome: "Essencial",
    preco: PRECO.essencial,
    sufixo: "/mês",
    linha: "Facilite sua rotina",
    itens: ["Tudo do Free", "Lançamentos pelo WhatsApp", "Teto por categoria"],
    cta: "Quero o Essencial",
    icone: "polvo",
    destaque: true,
    selo: "Para o dia a dia",
  },
  {
    chave: "assistente",
    nome: "Assistente",
    preco: PRECO.assistente,
    sufixo: "/mês",
    linha: "Planeje seus próximos passos",
    itens: ["Tudo do Essencial", "Planejamento financeiro", "Relatórios"],
    cta: "Quero o Assistente",
    icone: "grafico",
  },
];

const Check = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={C.bom} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Ícones dos planos definidos pelo Lucas: raio no Free, polvo no Essencial, gráfico
// ciano no Assistente.
function IconePlano({ tipo }) {
  const caixa = {
    width: "42px", height: "42px", borderRadius: "11px", display: "flex",
    alignItems: "center", justifyContent: "center", marginBottom: "1rem",
  };
  if (tipo === "polvo") {
    return <div style={{ ...caixa, background: "#6366F11F" }}><MascotePradex size={30} /></div>;
  }
  if (tipo === "grafico") {
    return (
      <div style={{ ...caixa, background: "#22D3EE1F" }}>
        <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke={C.ciano} strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <line x1="6" y1="20" x2="6" y2="13" /><line x1="12" y1="20" x2="12" y2="7" /><line x1="18" y1="20" x2="18" y2="10" />
        </svg>
      </div>
    );
  }
  return (
    <div style={{ ...caixa, background: "#6366F11F" }}>
      <svg viewBox="0 0 24 24" width="21" height="21" fill={C.acentoClaro} aria-hidden="true">
        <path d="M13 2L4.5 13.5H11l-1 8.5 8.5-11.5H12l1-8.5z" />
      </svg>
    </div>
  );
}

const BOTAO_BASE = {
  display: "block", width: "100%", textAlign: "center", boxSizing: "border-box",
  padding: "0.8rem 1rem", borderRadius: "10px", fontSize: "0.88rem", fontWeight: 700,
  fontFamily: "inherit", cursor: "pointer", textDecoration: "none",
};

/**
 * `onComecar` e `onEscolherPlano` vêm do App porque o estado de auth mora lá.
 *
 * Sem eles a página continua funcionando (os botões viram âncora pra #entrar) — é o
 * que acontece nas telas de recuperar senha, que também usam a Landing como moldura e
 * não têm nada disso pra oferecer.
 */
export default function Landing({ children, onComecar, onEscolherPlano }) {
  const irPara = (destino) => (e) => {
    if (typeof destino !== "function") return;     // deixa a âncora agir
    e.preventDefault();
    destino();
    // O scroll depois do setState: o formulário precisa já estar no modo certo quando
    // a pessoa chega nele, senão ela vê "Entrar" selecionado e pensa que errou.
    requestAnimationFrame(() => {
      document.getElementById("entrar")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.texto, fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      <style>{`
        .pdx-lp { max-width: 1140px; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; box-sizing: border-box; }
        .pdx-lp__hero { display: grid; grid-template-columns: 1fr; gap: 2.5rem; align-items: center; margin-bottom: 4rem; }
        .pdx-lp__h1 { margin: 0 0 1rem; font-size: clamp(2rem, 3.75vw, 3rem); line-height: 1.06; font-weight: 700; letter-spacing: -0.042em; }
        .pdx-lp__planos { display: grid; grid-template-columns: 1fr; gap: 1rem; align-items: stretch; }
        .pdx-lp__nav { display: none; }
        /* Só a partir de 900px o hero vira duas colunas: abaixo disso o mockup
           espremido ao lado do título fica ilegível, que é pior que empilhado. */
        @media (min-width: 900px) {
          .pdx-lp { padding: 2rem 2rem 4rem; }
          .pdx-lp__hero { grid-template-columns: 1.05fr 1.15fr; gap: 2rem; }
          .pdx-lp__planos { grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
          .pdx-lp__nav { display: flex; gap: 1.75rem; }
        }
        .pdx-lp a, .pdx-lp button { transition: opacity 0.15s, background 0.15s, border-color 0.15s; }
        .pdx-lp a:hover, .pdx-lp button:hover { opacity: 0.88; }
      `}</style>

      <div className="pdx-lp">
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "3rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
            <MascotePradex size={34} />
            <span style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "0.04em" }}>PRADEX</span>
          </div>

          <nav className="pdx-lp__nav" aria-label="Seções">
            <a href="#como-funciona" style={{ fontSize: "0.88rem", color: C.medio, textDecoration: "none" }}>Como funciona</a>
            <a href="#planos" style={{ fontSize: "0.88rem", color: C.medio, textDecoration: "none" }}>Planos</a>
          </nav>

          {/* "Entrar" abre o modo LOGIN — e "Começar grátis", lá embaixo, abre o modo
              CADASTRO. Antes os dois caíam no mesmo lugar, com login selecionado. */}
          <a
            href="#entrar"
            onClick={irPara(onComecar ? () => onComecar("login") : null)}
            style={{ fontSize: "0.85rem", color: C.texto, textDecoration: "none", border: `1px solid ${C.borda}`, borderRadius: "9px", padding: "0.5rem 1.1rem", whiteSpace: "nowrap" }}
          >
            Entrar
          </a>
        </header>

        <section className="pdx-lp__hero">
          <div>
            {/* Quebras explícitas: a arte tem TRÊS linhas — "Seu dinheiro" /
                "organizado." / a frase colorida. Deixar o navegador quebrar sozinho
                dava duas linhas e mudava o ritmo do título. */}
            <h1 className="pdx-lp__h1">
              Seu dinheiro<br />organizado.<br />
              <span style={{ color: C.acentoClaro }}>Sua cabeça mais leve.</span>
            </h1>
            <p style={{ margin: "0 0 1.9rem", fontSize: "1.02rem", lineHeight: 1.6, color: C.medio, maxWidth: "26em" }}>
              Acompanhe seus gastos e escolha quanto quer automatizar sua rotina.
            </p>

            <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap" }}>
              <a
                href="#entrar"
                onClick={irPara(onComecar ? () => onComecar("cadastro") : null)}
                style={{ ...BOTAO_BASE, width: "auto", background: C.acento, color: "#fff", padding: "0.85rem 1.7rem" }}
              >
                Começar grátis →
              </a>
              <a
                href="#planos"
                style={{ ...BOTAO_BASE, width: "auto", background: "transparent", color: C.texto, border: `1px solid ${C.borda}`, padding: "0.85rem 1.6rem" }}
              >
                Conhecer os planos
              </a>
            </div>
            <p style={{ margin: "0.85rem 0 0", fontSize: "0.78rem", color: C.fraco }}>
              Sem cartão para começar.
            </p>
          </div>

          <HeroMockup />
        </section>

        <section id="como-funciona" style={{ scrollMarginTop: "1.5rem", marginBottom: "4rem" }}>
          <h2 style={{ margin: "0 0 1.4rem", fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-0.02em" }}>Como funciona</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "0.9rem" }}>
            {RECURSOS.map((r) => (
              <div key={r.titulo} style={{ background: C.surface, border: `1px solid ${C.surface2}`, borderRadius: "12px", padding: "1.1rem", boxSizing: "border-box" }}>
                <p style={{ margin: "0 0 0.35rem", fontSize: "0.92rem", fontWeight: 600 }}>{r.titulo}</p>
                <p style={{ margin: 0, fontSize: "0.82rem", lineHeight: 1.5, color: C.medio }}>{r.texto}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PLANOS — a seção que simplesmente não existia. O Assistente só aparecia
            numa linha do FAQ, e o visitante não tinha como comparar nada. */}
        <section id="planos" style={{ scrollMarginTop: "1.5rem", marginBottom: "3.5rem" }}>
          <h2 style={{ margin: "0 0 0.4rem", fontSize: "clamp(1.5rem, 4vw, 2.1rem)", fontWeight: 700, textAlign: "center", letterSpacing: "-0.03em" }}>
            Um plano para cada momento.
          </h2>
          <p style={{ margin: "0 0 2rem", fontSize: "0.95rem", color: C.medio, textAlign: "center" }}>
            Mais controle hoje. Mais conquistas amanhã.
          </p>

          <div className="pdx-lp__planos">
            {PLANOS.map((p) => (
              <div
                key={p.chave}
                style={{
                  position: "relative", display: "flex", flexDirection: "column",
                  background: p.destaque ? "#12142099" : C.surface,
                  border: `1px solid ${p.destaque ? C.acento : C.surface2}`,
                  borderRadius: "16px", padding: "1.5rem 1.35rem", boxSizing: "border-box",
                  boxShadow: p.destaque ? "0 0 0 1px rgba(99,102,241,0.35), 0 18px 50px rgba(79,70,229,0.18)" : "none",
                }}
              >
                {p.selo && (
                  <span style={{
                    position: "absolute", top: "-11px", left: "50%", transform: "translateX(-50%)",
                    background: C.acento, color: "#fff", fontSize: "0.68rem", fontWeight: 700,
                    padding: "0.22rem 0.75rem", borderRadius: "999px", whiteSpace: "nowrap",
                  }}>
                    {p.selo}
                  </span>
                )}

                <IconePlano tipo={p.icone} />

                <p style={{ margin: "0 0 0.35rem", fontSize: "1.15rem", fontWeight: 700 }}>{p.nome}</p>
                <p style={{ margin: "0 0 0.3rem", fontSize: "1.9rem", fontWeight: 700, letterSpacing: "-0.03em" }}>
                  {p.preco}
                  <span style={{ fontSize: "0.9rem", fontWeight: 600, color: C.medio }}>{p.sufixo}</span>
                </p>
                <p style={{ margin: "0 0 1.2rem", fontSize: "0.85rem", color: C.medio }}>{p.linha}</p>

                <ul style={{ listStyle: "none", margin: "0 0 1.5rem", padding: 0, display: "grid", gap: "0.6rem", flex: 1 }}>
                  {p.itens.map((item) => (
                    <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: "0.55rem", fontSize: "0.85rem", color: C.texto, lineHeight: 1.4 }}>
                      <Check />{item}
                    </li>
                  ))}
                </ul>

                {/* Todos os CTAs levam ao CADASTRO, nunca direto ao checkout: sem
                    conta não há o que assinar. A escolha do plano é guardada e volta
                    como convite depois que a pessoa entra (ver ConvitePlano.jsx). */}
                <a
                  href="#entrar"
                  onClick={irPara(
                    p.chave === "free"
                      ? (onComecar ? () => onComecar("cadastro") : null)
                      : (onEscolherPlano ? () => onEscolherPlano(p.chave) : null),
                  )}
                  style={{
                    ...BOTAO_BASE,
                    background: p.destaque ? C.acento : "transparent",
                    color: p.destaque ? "#fff" : C.texto,
                    border: p.destaque ? "1px solid transparent" : `1px solid ${C.borda}`,
                  }}
                >
                  {p.cta}
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* As três dúvidas que travam o cadastro, respondidas antes de serem feitas.
            "Onde ficam meus dados" está aqui e não no rodapé de propósito: é a
            objeção número um de app de finanças feito por gente que não é banco. */}
        <h2 style={{ fontSize: "1.1rem", fontWeight: 600, margin: "0 0 1rem" }}>Antes de você perguntar</h2>
        <dl style={{ margin: "0 0 3rem", display: "grid", gap: "1.1rem", maxWidth: "760px" }}>
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
              O agente do WhatsApp e o teto por categoria fazem parte do Essencial, {PRECO.essencial} por mês, cancela quando quiser.
              O Planejamento Financeiro e os Relatórios são do Assistente, {PRECO.assistente} por mês.
            </dd>
          </div>
        </dl>

        {/* O formulário de login/cadastro que já existia, recebido como children.
            Não foi reescrito: a lógica de auth continua no App.jsx, intocada. */}
        <div id="entrar" style={{ scrollMarginTop: "1rem", maxWidth: "460px" }}>
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
