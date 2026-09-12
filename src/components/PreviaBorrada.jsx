// Prévia borrada pras telas de gráfico (Planejamento Financeiro, Relatórios).
//
// Tela de gráfico não segura ninguém vazia: um CTA sozinho num fundo preto não dá
// vontade de nada. O gancho é a pessoa ver que existe uma forma — uma curva, uma
// dobra, um eixo — e não conseguir ler. Curiosidade vende melhor que bullet.
//
// ⚠️ REGRA DURA — o desenho abaixo é INVENTADO.
// Nunca renderizar o gráfico real e aplicar `filter: blur()` por cima: o blur é
// cosmético, os números continuam no DOM, e qualquer um lê no DevTools. São dados
// financeiros de outra pessoa. Aqui não existe nenhum dado do usuário — nem chega a
// ser buscado.
//
// Os pontos são fixos e não aleatórios: prévia que muda de forma a cada render parece
// bug, e re-render acontece a cada toque na tela.

import React from "react";
import { CHECKOUT } from "../lib/plano";

const COR = {
  bg: "#151821", borda: "#1E2330",
  texto: "#F1F2F4", medio: "#8B93A1", fraco: "#5C6570",
  acento: "#6366F1", linha: "#6366F1", area: "#6366F1",
};

// Curva inventada com cara de projeção de patrimônio: sobe, dobra e cai.
// A dobra existe de propósito — é o que a legenda descreve.
const PONTOS = [
  [0, 38], [1, 52], [2, 64], [3, 78], [4, 92], [5, 104], [6, 112],
  [7, 116], [8, 114], [9, 106], [10, 92], [11, 72], [12, 48], [13, 22],
];

const W = 320, H = 150, PAD = 8;
const maxY = 120;
const px = (i) => PAD + (i / (PONTOS.length - 1)) * (W - PAD * 2);
const py = (v) => H - PAD - (v / maxY) * (H - PAD * 2);
const linha = PONTOS.map(([i, v]) => `${px(i)},${py(v)}`).join(" ");
const area = `${PAD},${H - PAD} ${linha} ${W - PAD},${H - PAD}`;

const TEXTOS = {
  fp: {
    legenda: "Seu ano, se este mês se repetir. A dobra é o ponto em que o ritmo atual não segura a meta.",
    titulo: "O gráfico é o Assistente",
    corpo: "Você está vendo a curva. Número, cenário e ajuste saem no Assistente.",
    botao: "Ver no Assistente",
    plano: "assistente",
  },
  relatorios: {
    legenda: "O fechamento do mês, lado a lado com o anterior. A faixa é o que deu pra cortar sem doer.",
    titulo: "Relatórios é do Assistente",
    corpo: "O mês fecha sozinho todo dia 1º. Você só lê o que mudou.",
    botao: "Ver no Assistente",
    plano: "assistente",
  },
};

export default function PreviaBorrada({ recurso = "fp" }) {
  const t = TEXTOS[recurso] || TEXTOS.fp;
  const checkout = CHECKOUT[t.plano];

  return (
    <section
      aria-label={t.titulo}
      style={{ position: "relative", background: COR.bg, border: `1px solid ${COR.borda}`, borderRadius: "16px", overflow: "hidden", boxSizing: "border-box" }}
    >
      {/* Camada borrada. aria-hidden porque é decoração: o leitor de tela não deve
          anunciar um gráfico que não tem informação nenhuma. */}
      <div aria-hidden="true" style={{ filter: "blur(7px)", opacity: 0.55, padding: "1.1rem 1rem 0.6rem", pointerEvents: "none", userSelect: "none" }}>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.7rem" }}>
          {["R$ ———", "R$ ——", "R$ ———"].map((s, i) => (
            <div key={i} style={{ flex: 1, background: COR.borda, borderRadius: "8px", padding: "0.5rem" }}>
              <div style={{ height: "6px", width: "60%", background: COR.fraco, borderRadius: "3px", marginBottom: "6px" }} />
              <div style={{ height: "11px", width: "85%", background: COR.medio, borderRadius: "3px" }} />
            </div>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="150" role="presentation">
          <polygon points={area} fill={COR.area} opacity="0.18" />
          <polyline points={linha} fill="none" stroke={COR.linha} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} stroke={COR.borda} strokeWidth="1" />
          ))}
        </svg>
      </div>

      {/* Camada legível por cima */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", padding: "1.1rem", background: "linear-gradient(180deg, rgba(12,14,20,0.35) 0%, rgba(12,14,20,0.92) 62%)", boxSizing: "border-box" }}>
        <p style={{ margin: "0 0 0.9rem", fontSize: "0.72rem", color: COR.medio, lineHeight: 1.45 }}>{t.legenda}</p>
        <p style={{ margin: "0 0 0.35rem", fontSize: "1rem", fontWeight: 600, color: COR.texto, letterSpacing: "-0.01em" }}>{t.titulo}</p>
        <p style={{ margin: "0 0 1rem", fontSize: "0.82rem", color: COR.medio, lineHeight: 1.45 }}>{t.corpo}</p>
        <a
          href={checkout || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="pdx-tap"
          style={{ display: "block", textAlign: "center", padding: "0.8rem", borderRadius: "10px", background: COR.acento, color: "#fff", fontSize: "0.88rem", fontWeight: 700, textDecoration: "none" }}
        >
          {t.botao}
        </a>
      </div>
    </section>
  );
}
