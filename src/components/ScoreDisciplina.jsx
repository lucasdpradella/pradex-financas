// Score de disciplina no topo do app — visível pra TODOS os planos, inclusive Free.
//
// Decisão do PRADELLA em 2026-09-12 (spec: Chave Mestre,
// Projetos/PRADEX/orcamento-e-disciplina.md): a nota é grátis, o orçamento é pago.
//
// O componente é o próprio vendedor. Quem não tem o Essencial vê que "Dentro do teto"
// — o item de MAIOR peso da nota — está inativo, e a linha que explica isso é o
// caminho pro upgrade. Não é paywall escondendo: é placar mostrando o que falta.
//
// A matemática não muda entre planos: `calcularDisciplina` já tira o componente
// inaplicável do numerador E do denominador, então a nota do Free é sobre 100 (três
// componentes) e a de quem tem teto é sobre 145. Ninguém é punido por não ter a
// feature — só deixa de ganhar por ela.
//
// ── Duas correções de 2026-09-13, ambas pedidas pelo PRADELLA ──
//
// 1. FECHADO POR PADRÃO. A primeira versão despejava os 4 critérios, os badges e a
//    chamada do teto de uma vez, e comia meia tela antes do dashboard começar. Agora
//    mostra só a nota; o resto abre no clique. Quem quer o número vê o número; quem
//    quer o porquê pede o porquê.
//
// 2. TEMA POR CONTEXTO. O desktop do Pradex é CLARO (components/desktop/theme.js) e
//    o mobile é escuro. A primeira versão usava a paleta escura nos dois, então no
//    notebook aparecia um retângulo preto no meio de uma tela clara. É a mesma
//    armadilha das "ilhas claras" do Planejamento, ao contrário — cor não é absoluta,
//    depende do fundo em que ela cai.

import React, { useMemo, useState } from "react";
import { calcularFechamento } from "../lib/fechamento";
import { calcularDisciplina, PONTOS } from "../lib/disciplina";
import { podeUsarRecurso } from "../lib/plano";
import { avaliarPremio, oQueFalta } from "../lib/premio";
import { desktopTheme } from "./desktop/theme";

// Semânticas valem nos dois temas: verde é verde. O que muda é superfície e texto.
const SEMANTICA = { acento: "#6366F1", bom: "#2FBF8A", alerta: "#E8943A", ruim: "#E06C65" };

const TEMA_ESCURO = { bg: "#151821", borda: "#1E2330", texto: "#F1F2F4", medio: "#8B93A1", fraco: "#5C6570", ...SEMANTICA };
const TEMA_CLARO = {
  bg: desktopTheme.surface,
  borda: desktopTheme.surfaceBorder,
  texto: desktopTheme.textPrimary,
  medio: desktopTheme.textSecondary,
  // O "fraco" do tema claro não pode ser o mesmo do escuro: #5C6570 sobre branco
  // ainda lê, mas sobre #FFF fica pesado demais pra texto terciário.
  fraco: "#9AA1AE",
  ...SEMANTICA,
  acento: desktopTheme.accent,
};

// A cor é da FAIXA, nunca do valor em reais — a regra do disciplina.js vale aqui
// também: isto pontua comportamento, não dinheiro.
const corDaFaixa = (c, score) => (score >= 85 ? c.bom : score >= 60 ? c.acento : score >= 30 ? c.alerta : c.ruim);

export default function ScoreDisciplina({
  lancamentos, ano, mes, plano, trial = null, tetos = [],
  onQueroTeto, premioResgatadoEm = null, onResgatarPremio, isDesktop = false,
}) {
  const c = isDesktop ? TEMA_CLARO : TEMA_ESCURO;
  const [aberto, setAberto] = useState(false);

  // Quem está no trial já tem o teto: mostrar a chamada de upgrade seria vender o que
  // a pessoa acabou de ganhar.
  const temTeto = podeUsarRecurso(plano, "orcamento", trial);

  const { d, premio } = useMemo(() => {
    const f = calcularFechamento(lancamentos || [], ano, mes);
    const disc = calcularDisciplina(f, { tetos });
    return {
      d: disc,
      premio: avaliarPremio({ score: disc.score, diasDistintos: f.diasComLancamento, resgatadoEm: premioResgatadoEm, plano }),
    };
  }, [lancamentos, ano, mes, tetos, premioResgatadoEm, plano]);

  if (d.vazio) return null;

  const cor = corDaFaixa(c, d.score);
  const aplicaveis = d.componentes.filter((x) => x.aplicavel);
  // O prêmio nunca fica escondido atrás do clique: é a única coisa aqui com prazo.
  const destaque = premio.elegivel;

  return (
    <section
      aria-label="Score de disciplina"
      style={{ background: c.bg, border: `1px solid ${c.borda}`, borderRadius: "14px", marginBottom: "1rem", boxSizing: "border-box", overflow: "hidden" }}
    >
      {/* Linha fechada: rótulo, nota, barra e a seta. Uma linha só. */}
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="pdx-tap"
        style={{
          display: "flex", alignItems: "center", gap: "0.75rem", width: "100%",
          padding: "0.8rem 1rem", background: "transparent", border: "none",
          cursor: "pointer", fontFamily: "inherit", textAlign: "left", boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.3rem", flexShrink: 0 }}>
          <span style={{ fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.03em", color: cor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
            {d.score}
          </span>
          <span style={{ fontSize: "0.72rem", fontWeight: 500, color: c.fraco }}>/100</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: "0 0 0.3rem", fontSize: "0.6rem", color: c.medio, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Disciplina
          </p>
          <div style={{ height: "5px", background: c.borda, borderRadius: "999px", overflow: "hidden" }}>
            <div style={{ width: `${Math.max(2, d.score)}%`, height: "100%", background: cor, borderRadius: "999px", transition: "width .3s" }} />
          </div>
        </div>

        <span aria-hidden="true" style={{ color: c.fraco, fontSize: "0.8rem", flexShrink: 0, transition: "transform .2s", transform: aberto ? "rotate(180deg)" : "none" }}>▾</span>
      </button>

      {/* Prêmio fica FORA do colapso: tem prazo e é a única coisa aqui que a pessoa
          perde se não vir. */}
      {destaque && (
        <div style={{ margin: "0 1rem 0.9rem", background: "#2FBF8A18", border: "1px solid #2FBF8A40", borderRadius: "10px", padding: "0.8rem" }}>
          <p style={{ margin: "0 0 0.3rem", fontSize: "0.82rem", fontWeight: 600, color: c.bom }}>
            Você fechou o mês com {d.score}. Isso vale prêmio.
          </p>
          <p style={{ margin: "0 0 0.7rem", fontSize: "0.76rem", color: c.medio, lineHeight: 1.45 }}>
            {premio.percentual}% no primeiro mês do Essencial e mais {premio.diasTrial} dias de teste antes de qualquer cobrança. Uma vez só.
          </p>
          <button type="button" onClick={onResgatarPremio} className="pdx-tap"
            style={{ width: "100%", padding: "0.7rem", border: "none", borderRadius: "8px", background: c.bom, color: "#0C0E14", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Resgatar
          </button>
        </div>
      )}

      {aberto && (
        <div style={{ padding: "0 1rem 1rem" }}>
          <p style={{ margin: "0 0 0.7rem", fontSize: "0.78rem", color: c.medio }}>
            {d.resumo} <span style={{ color: c.fraco }}>· {aplicaveis.length} de {d.componentes.length} critérios</span>
          </p>

          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
            {d.componentes.map((comp) => (
              <li key={comp.chave} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.72rem", opacity: comp.aplicavel ? 1 : 0.55 }}>
                <span style={{ flex: 1, color: comp.aplicavel ? c.texto : c.fraco }}>{comp.label}</span>
                <span style={{ color: c.fraco }}>{comp.detalhe}</span>
                <span style={{ color: comp.aplicavel ? c.medio : c.fraco, fontVariantNumeric: "tabular-nums", minWidth: "44px", textAlign: "right" }}>
                  {comp.aplicavel ? `${comp.pontos}/${comp.max}` : `— /${comp.max}`}
                </span>
              </li>
            ))}
          </ul>

          {/* Chamada do teto: só pra quem não tem. Anúncio pra quem já pagou é o jeito
              mais rápido de irritar. */}
          {!temTeto && (
            <button type="button" onClick={onQueroTeto} className="pdx-tap"
              style={{ marginTop: "0.8rem", width: "100%", padding: "0.6rem", cursor: "pointer", background: "transparent", border: `1px dashed ${c.acento}`, borderRadius: "10px", color: c.acento, fontSize: "0.76rem", fontWeight: 600, fontFamily: "inherit" }}>
              Dentro do teto vale {PONTOS.teto} pontos — o maior de todos. Definir meus tetos
            </button>
          )}

          {!premio.elegivel && oQueFalta(premio) && d.score > 0 && (
            <p style={{ margin: "0.8rem 0 0", fontSize: "0.72rem", color: c.fraco }}>
              🎁 {oQueFalta(premio)} Fechando o mês em 80 você ganha {premio.percentual}% no primeiro mês + {premio.diasTrial} dias de teste.
            </p>
          )}

          {d.badges.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.7rem" }}>
              {d.badges.map((b) => (
                <span key={b} style={{ fontSize: "0.64rem", color: c.bom, background: "#2FBF8A18", padding: "2px 8px", borderRadius: "999px" }}>{b}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
