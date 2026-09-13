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

import React, { useMemo } from "react";
import { calcularFechamento } from "../lib/fechamento";
import { calcularDisciplina, PONTOS } from "../lib/disciplina";
import { podeUsarRecurso } from "../lib/plano";
import { avaliarPremio, oQueFalta } from "../lib/premio";

const COR = {
  bg: "#151821",
  borda: "#1E2330",
  texto: "#F1F2F4",
  medio: "#8B93A1",
  fraco: "#5C6570",
  acento: "#6366F1",
  bom: "#2FBF8A",
  medio_: "#E8943A",
  ruim: "#E06C65",
};

// A cor é da FAIXA, nunca do valor em reais — a regra do disciplina.js vale aqui
// também: isto pontua comportamento, não dinheiro.
const corDaFaixa = (score) => (score >= 85 ? COR.bom : score >= 60 ? COR.acento : score >= 30 ? COR.medio_ : COR.ruim);

export default function ScoreDisciplina({ lancamentos, ano, mes, plano, trial = null, tetos = [], onQueroTeto, premioResgatadoEm = null, onResgatarPremio }) {
  // Quem está no trial já tem o teto: mostrar a chamada de upgrade seria vender o que
  // a pessoa acabou de ganhar.
  const temTeto = podeUsarRecurso(plano, "orcamento", trial);

  const { d, premio } = useMemo(() => {
    const f = calcularFechamento(lancamentos || [], ano, mes);
    const disc = calcularDisciplina(f, { tetos });
    return {
      d: disc,
      premio: avaliarPremio({
        score: disc.score,
        diasDistintos: f.diasComLancamento,
        resgatadoEm: premioResgatadoEm,
        plano,
      }),
    };
  }, [lancamentos, ano, mes, tetos, premioResgatadoEm, plano]);

  if (d.vazio) return null;

  const cor = corDaFaixa(d.score);
  const aplicaveis = d.componentes.filter((c) => c.aplicavel);

  return (
    <section
      aria-label="Score de disciplina"
      style={{ background: COR.bg, border: `1px solid ${COR.borda}`, borderRadius: "14px", padding: "1rem", marginBottom: "1rem", boxSizing: "border-box" }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.6rem" }}>
        <p style={{ margin: 0, fontSize: "0.64rem", color: COR.medio, textTransform: "uppercase", letterSpacing: "0.12em", flex: 1 }}>
          Disciplina
        </p>
        {/* O denominador muda com o plano, e mostrar isso é de propósito: é a dica
            mais barata de que existe mais nota pra ganhar. */}
        <span style={{ fontSize: "0.62rem", color: COR.fraco }}>
          {aplicaveis.length} de {d.componentes.length} critérios
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", margin: "0.35rem 0 0.6rem" }}>
        <span style={{ fontSize: "2rem", fontWeight: 600, letterSpacing: "-0.03em", color: cor, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
          {d.score}
        </span>
        <span style={{ fontSize: "0.85rem", fontWeight: 500, color: COR.fraco, lineHeight: 1.6 }}>/ 100</span>
      </div>

      <div style={{ height: "6px", background: COR.borda, borderRadius: "999px", overflow: "hidden", marginBottom: "0.7rem" }}>
        <div style={{ width: `${Math.max(2, d.score)}%`, height: "100%", background: cor, borderRadius: "999px", transition: "width .3s" }} />
      </div>

      <p style={{ margin: "0 0 0.7rem", fontSize: "0.78rem", color: COR.medio }}>{d.resumo}</p>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        {d.componentes.map((c) => (
          <li key={c.chave} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.72rem", opacity: c.aplicavel ? 1 : 0.55 }}>
            <span style={{ flex: 1, color: c.aplicavel ? COR.texto : COR.fraco }}>{c.label}</span>
            <span style={{ color: COR.fraco }}>{c.detalhe}</span>
            <span style={{ color: c.aplicavel ? COR.medio : COR.fraco, fontVariantNumeric: "tabular-nums", minWidth: "44px", textAlign: "right" }}>
              {c.aplicavel ? `${c.pontos}/${c.max}` : `— /${c.max}`}
            </span>
          </li>
        ))}
      </ul>

      {/* PRÊMIO. Só aparece pra quem pode ganhar. Quem já resgatou e quem já assina
          não veem nada — `avaliarPremio` devolve motivo e `oQueFalta` cala nesses
          dois casos, de propósito: lembrar alguém de um prêmio que ele nunca mais
          pode ter é cobrança, não incentivo. */}
      {premio.elegivel && (
        <div style={{ marginTop: "0.8rem", background: "#2FBF8A18", border: "1px solid #2FBF8A40", borderRadius: "10px", padding: "0.8rem" }}>
          <p style={{ margin: "0 0 0.3rem", fontSize: "0.82rem", fontWeight: 600, color: COR.bom }}>
            Você fechou o mês com {d.score}. Isso vale prêmio.
          </p>
          <p style={{ margin: "0 0 0.7rem", fontSize: "0.76rem", color: COR.medio, lineHeight: 1.45 }}>
            {premio.percentual}% no primeiro mês do Essencial e mais {premio.diasTrial} dias de teste antes de qualquer cobrança. Uma vez só.
          </p>
          <button
            type="button"
            onClick={onResgatarPremio}
            className="pdx-tap"
            style={{ width: "100%", padding: "0.7rem", border: "none", borderRadius: "8px", background: COR.bom, color: "#0C0E14", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            Resgatar
          </button>
        </div>
      )}

      {/* O que falta, pra quem ainda está no caminho. Nunca vira número em reais —
          é dia e ponto, que é o que a pessoa controla. */}
      {!premio.elegivel && oQueFalta(premio) && d.score > 0 && (
        <p style={{ margin: "0.8rem 0 0", fontSize: "0.72rem", color: COR.fraco }}>
          🎁 {oQueFalta(premio)} Fechando o mês em {80} você ganha {premio.percentual}% no primeiro mês + {premio.diasTrial} dias de teste.
        </p>
      )}

      {/* A chamada só existe pra quem não tem o teto. Quem já tem não precisa de
          anúncio — e anúncio pra quem já pagou é o jeito mais rápido de irritar. */}
      {!temTeto && (
        <button
          type="button"
          onClick={onQueroTeto}
          className="pdx-tap"
          style={{
            marginTop: "0.8rem", width: "100%", padding: "0.6rem", cursor: "pointer",
            background: "transparent", border: `1px dashed ${COR.acento}`, borderRadius: "10px",
            color: COR.acento, fontSize: "0.76rem", fontWeight: 600, fontFamily: "inherit",
          }}
        >
          Dentro do teto vale {PONTOS.teto} pontos — o maior de todos. Definir meus tetos
        </button>
      )}

      {d.badges.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.7rem" }}>
          {d.badges.map((b) => (
            <span key={b} style={{ fontSize: "0.64rem", color: COR.bom, background: "#2FBF8A18", padding: "2px 8px", borderRadius: "999px" }}>
              {b}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
