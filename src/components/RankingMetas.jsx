// RANKING de metas.
//
// Brief: Chave Mestre, Projetos/PRADEX/briefs/2026-09-19_ranking-e-pontuacao-de-metas.md
//
// ⚠️ ESTA TELA EXISTE CONTRA UM VETO, E PRECISA CONTINUAR MERECENDO A EXCEÇÃO.
// briefs/2026-09-12_modo-caos-copy.md, na lista do que nunca fazer: "90% do pessoal
// segura. Você não." — comparação social em dinheiro é o jeito mais rápido de o
// cliente odiar o produto. O Pradex é o Lucas na orelha, não um feed.
//
// O ranking só sobrevive a isso porque é o contrário em três eixos:
//   1. de CONQUISTA, não de estrago — nunca aparece gasto aqui;
//   2. OPT-IN — sem apelido, a pessoa não está no placar e ninguém a vê;
//   3. em PONTOS, não em reais — nenhum valor em R$ entra nesta tela. Nenhum.
//
// Se um dia alguém for tentado a mostrar "R$ 43.000 guardados" ao lado do apelido,
// é a hora de reler o veto: vira placar de quem ganha mais, e é o fim.
//
// ⚠️ COR SÓ POR TOKEN — a tela nasce nos dois canvas (claro no desktop, escuro no
// celular), como as outras de Metas.

import React, { useState } from "react";

const COR = {
  bg: "var(--surface, #151821)",
  borda: "var(--border, #1E2330)",
  campo: "var(--surface2, #0C0E14)",
  texto: "var(--text-primary, #F1F2F4)",
  medio: "var(--text-secondary, #8B93A1)",
  fraco: "var(--text-muted, #5C6570)",
  acento: "var(--accent, #6366F1)",
  ok: "#2FBF8A",
};

const MEDALHA = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default function RankingMetas({ ranking, onEntrar, salvando = false }) {
  const [apelido, setApelido] = useState("");
  const [erro, setErro] = useState("");
  const [abrindo, setAbrindo] = useState(false);

  // Enquanto a RPC não voltou, não renderiza nada: um esqueleto piscando por meio
  // segundo chama mais atenção que a informação.
  if (!ranking) return null;

  const top = Array.isArray(ranking.top) ? ranking.top : [];
  const eu = ranking.eu || {};
  const dentro = Boolean(eu.apelido);

  async function entrar() {
    const r = await onEntrar?.(apelido);
    if (r?.erro) { setErro(r.erro); return; }
    setErro(""); setApelido(""); setAbrindo(false);
  }

  return (
    <section aria-label="Ranking de metas" style={{ marginTop: "1.6rem" }}>
      <p style={{ margin: "0 0 0.3rem", fontSize: "0.7rem", color: COR.fraco, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Ranking
      </p>
      <p style={{ margin: "0 0 0.9rem", fontSize: "0.78rem", color: COR.medio, lineHeight: 1.45 }}>
        Quem mais avança nas próprias metas. Conta o quanto você caminhou e o quão
        difícil você disse que ela seria — nunca quanto dinheiro você tem.
      </p>

      {/* Os próprios números vêm ANTES do placar, e aparecem mesmo pra quem está
          fora dele. Quem ainda não entrou precisa ver o que já tem, senão o convite
          pra entrar é um convite às cegas. */}
      <div style={{ background: COR.bg, border: `1px solid ${COR.borda}`, borderRadius: "12px", padding: "0.85rem 0.95rem", marginBottom: "0.7rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
          <p style={{ margin: 0, fontSize: "0.8rem", color: COR.medio, flex: 1 }}>
            {dentro ? `você, como ${eu.apelido}` : "seus pontos"}
          </p>
          <p style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: COR.texto, fontVariantNumeric: "tabular-nums" }}>
            {Number(eu.pontos || 0)}
          </p>
        </div>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.72rem", color: COR.fraco }}>
          {eu.posicao ? `${eu.posicao}º lugar` : "fora do ranking"}
          {Number(eu.concluidas || 0) > 0 ? ` · ${eu.concluidas} meta${eu.concluidas > 1 ? "s" : ""} batida${eu.concluidas > 1 ? "s" : ""}` : ""}
        </p>

        {!dentro && !abrindo && (
          <button
            type="button"
            onClick={() => setAbrindo(true)}
            className="pdx-tap"
            style={{ marginTop: "0.7rem", width: "100%", padding: "0.7rem", border: `1px dashed ${COR.acento}`, borderRadius: "9px", background: "transparent", color: COR.acento, fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
          >
            Entrar no ranking
          </button>
        )}

        {/* O apelido É o consentimento: enquanto não existe, ninguém vê esta pessoa.
            Por isso o campo diz o que vai acontecer, em vez de só pedir um texto. */}
        {!dentro && abrindo && (
          <div style={{ marginTop: "0.7rem" }}>
            <input
              value={apelido}
              onChange={(e) => setApelido(e.target.value)}
              placeholder="Como você quer aparecer"
              maxLength={24}
              aria-label="Apelido no ranking"
              style={{ background: COR.campo, border: `1px solid ${COR.borda}`, borderRadius: "8px", padding: "0.55rem 0.6rem", color: COR.texto, fontSize: "0.85rem", outline: "none", fontFamily: "inherit", boxSizing: "border-box", width: "100%" }}
            />
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.72rem", color: COR.fraco, lineHeight: 1.45 }}>
              Só o apelido e seus pontos ficam visíveis. Nunca seu nome, seu e-mail,
              o valor das suas metas ou quanto você guardou.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
              <button
                type="button"
                onClick={entrar}
                disabled={salvando}
                className="pdx-tap"
                style={{ flex: 1, padding: "0.65rem", border: "none", borderRadius: "9px", background: COR.acento, color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: salvando ? "not-allowed" : "pointer", opacity: salvando ? 0.7 : 1, fontFamily: "inherit" }}
              >
                {salvando ? "Entrando..." : "Entrar"}
              </button>
              <button
                type="button"
                onClick={() => { setAbrindo(false); setErro(""); }}
                className="pdx-tap"
                style={{ padding: "0.65rem 1rem", border: `1px solid ${COR.borda}`, borderRadius: "9px", background: "transparent", color: COR.medio, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                Agora não
              </button>
            </div>
            {erro && <p style={{ margin: "0.5rem 0 0", fontSize: "0.76rem", color: "var(--danger, #E06C65)" }}>{erro}</p>}
          </div>
        )}
      </div>

      {top.length === 0 ? (
        <div style={{ background: COR.bg, border: `1px dashed ${COR.borda}`, borderRadius: "12px", padding: "1.3rem 1rem", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "0.78rem", color: COR.medio, lineHeight: 1.45 }}>
            Ninguém no ranking ainda. Uma meta entra depois de dois depósitos em dias
            diferentes — é o que separa quem está juntando de quem está testando.
          </p>
        </div>
      ) : (
        <div style={{ background: COR.bg, border: `1px solid ${COR.borda}`, borderRadius: "12px", overflow: "hidden" }}>
          {top.map((p, i) => (
            <div
              key={`${p.apelido}-${p.posicao}`}
              style={{
                display: "flex", alignItems: "center", gap: "0.6rem",
                padding: "0.7rem 0.95rem",
                borderTop: i === 0 ? "none" : `1px solid ${COR.borda}`,
                // A própria linha destacada: num placar, achar a si mesmo é a
                // primeira coisa que qualquer pessoa faz.
                background: p.sou_eu ? "rgba(99,102,241,0.10)" : "transparent",
              }}
            >
              <span style={{ fontSize: "0.8rem", color: COR.fraco, minWidth: "1.8rem", fontVariantNumeric: "tabular-nums" }}>
                {MEDALHA[p.posicao] || `${p.posicao}º`}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: "0.85rem", fontWeight: p.sou_eu ? 700 : 500, color: COR.texto, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.apelido}
              </span>
              {Number(p.concluidas || 0) > 0 && (
                <span style={{ fontSize: "0.72rem", color: COR.ok }} title={`${p.concluidas} meta(s) batida(s)`}>
                  🎯 {p.concluidas}
                </span>
              )}
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: COR.texto, fontVariantNumeric: "tabular-nums" }}>
                {p.pontos}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
