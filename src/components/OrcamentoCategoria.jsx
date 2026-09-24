// Teto por categoria — a tela que destrava o resto.
//
// PADRÃO DE PAYWALL (decisão do PRADELLA, 2026-09-12): sem cadeado. A tela SEMPRE
// renderiza e o Free preenche à vontade. O paywall só aparece no clique de salvar,
// porque aí a intenção já está formada — a pessoa já decidiu quanto quer gastar em
// cada categoria e só quer que aquilo valha.
//
// Cadeado faz desistir antes de tocar. Isto faz desistir DEPOIS de querer, que é uma
// desistência muito mais cara pra quem está do outro lado.
//
// Copy: briefs/2026-09-12_copy-paywall.md (variação "caos leve").

import React, { useEffect, useMemo, useState } from "react";
import { paywallNoSave, checkoutComEmail } from "../lib/plano";
import { useFormatMoney, useSimboloMoeda } from "../lib/moeda";

// `toFixed(2).replace(".", ",")` nao poe separador de milhar: "R$ 2421,00" ao lado de
// "R$ 33.782,00" nos cards do topo, na mesma tela. Acima de mil, a vista tropeca.

// ⚠️ COR AQUI SO POR TOKEN — esta tela renderiza nos DOIS canvas do app.
//
// Ate 16/09 estes valores eram os hex do canvas ESCURO, escritos direto. No
// celular ficava certo; no desktop, que tem canvas claro desde 07/03, o Orcamento
// aparecia como um bloco PRETO no meio das telas brancas — o mesmo defeito que a
// aba Rendas teve (ver o historico no rodape de fp/RendasDespesasFP.jsx).
//
// Agora cada cor sai de var(--x), que App.jsx injeta no wrapper da tela conforme o
// canvas (CANVAS_CLARO / CANVAS_ESCURO). O FALLBACK de cada uma e o hex escuro de
// antes: e ele que segura o mobile, onde nada e injetado.
//
// Regra pra mexer aqui: superficie, borda e texto sempre em token. Cor semantica
// (o vermelho de estouro) tambem, porque o vermelho que serve sobre #151821 nao e
// o que serve sobre branco — por isso --danger, e nao um hex.
const COR = {
  bg: "var(--surface, #151821)",
  borda: "var(--border, #1E2330)",
  // --surface2, e nao --input-bg: no claro o --input-bg e #FFFFFF e o campo ficaria
  // branco dentro de um card branco. Mesma pegadinha que ja pegou a aba Rendas.
  fundo: "var(--surface2, #0C0E14)",
  texto: "var(--text-primary, #F1F2F4)",
  medio: "var(--text-secondary, #8B93A1)",
  fraco: "var(--text-muted, #5C6570)",
  acento: "var(--accent, #6366F1)",
  ruim: "var(--danger, #E06C65)",
};

// Aceita "1.200,50", "1200.50" e "1200". O usuário digita como quiser; o banco
// recebe número. Devolve null pra vazio e NaN pra lixo — os dois casos são tratados
// diferente na hora de salvar (vazio = apagar o teto; lixo = erro).
export function parseValor(bruto) {
  const s = String(bruto ?? "").trim();
  if (!s) return null;
  const limpo = s.replace(/[R$\s]/gi, "");
  // "R$" sozinho vira string vazia aqui. Sem esta guarda, Number("") devolve 0 — e um
  // teto de R$ 0 passaria pelo check de "> 0" como se fosse escolha do usuário.
  if (!limpo) return NaN;

  let normal;
  if (limpo.includes(",")) {
    // Tem vírgula: ela é o decimal e o ponto é milhar. Padrão brasileiro, sem dúvida.
    normal = limpo.replace(/\./g, "").replace(",", ".");
  } else {
    // Só ponto, e aí é ambíguo: "1.200" é mil e duzentos (BR) ou um vírgula dois (US)?
    // Num app de finanças brasileiro, três dígitos depois do último ponto é milhar.
    // "0.99" e "1.5" continuam decimais porque têm 2 e 1 dígito.
    const m = limpo.match(/^(\d{1,3}(?:\.\d{3})+)$/);
    normal = m ? limpo.replace(/\./g, "") : limpo;
  }

  const n = Number(normal);
  return Number.isFinite(n) ? n : NaN;
}

export default function OrcamentoCategoria({ categorias = [], tetos = [], plano, trial = null, gastosPorCategoria = {}, onSalvar, salvando = false, erroExterno = "", email }) {
  const formatBRL = useFormatMoney();
  const simbolo = useSimboloMoeda();
  const doGasto = useMemo(
    () => categorias.filter((c) => (c.tipo ?? "gasto") === "gasto").map((c) => c.nome).filter(Boolean),
    [categorias],
  );

  const inicial = useMemo(() => {
    const m = {};
    for (const t of tetos) if (t?.categoria) m[t.categoria] = String(t.limite ?? "");
    return m;
  }, [tetos]);

  const [valores, setValores] = useState(inicial);
  const [erro, setErro] = useState("");
  const [paywall, setPaywall] = useState(null);
  // Se a pessoa já digitou, um fetch que chega atrasado não pode apagar o que ela
  // escreveu. Antes disso, o que vier do banco manda.
  const [editado, setEditado] = useState(false);

  // ⚠️ SEM ISTO O SALVAR APAGA TETO. `useState(inicial)` só roda no primeiro mount,
  // então se a tela montar antes de `fetchOrcamentos` responder, `valores` congela
  // vazio. A pessoa digita UM teto, salva — e como `salvarOrcamentos` apaga o mês
  // inteiro antes de reinserir, todos os outros tetos daquele mês somem.
  //
  // Vale também pra troca de mês: `orcamentos` é recarregado e a tela precisa
  // acompanhar, senão mostra o teto do mês anterior.
  useEffect(() => {
    if (!editado) setValores(inicial);
  }, [inicial, editado]);

  const setValor = (cat, v) => { setValores((a) => ({ ...a, [cat]: v })); setEditado(true); setErro(""); };

  function handleSalvar() {
    const linhas = [];
    for (const cat of doGasto) {
      const n = parseValor(valores[cat]);
      if (n === null) continue;                       // vazio: sem teto pra essa categoria
      if (Number.isNaN(n) || n <= 0) { setErro(`Valor inválido em "${cat}".`); return; }
      linhas.push({ categoria: cat, limite: n });
    }
    if (linhas.length === 0) { setErro("Defina pelo menos um teto."); return; }

    // ⚠️ A checagem de plano acontece AQUI e só aqui. Nada acima desta linha pergunta
    // se a pessoa pode — ela pode olhar e preencher sempre.
    const bloqueio = paywallNoSave(plano, "orcamento", trial);
    if (bloqueio) { setPaywall(bloqueio); return; }

    onSalvar?.(linhas);
  }

  return (
    <section aria-label="Teto por categoria">
      <p style={{ margin: "0 0 0.3rem", fontSize: "0.7rem", color: COR.fraco, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Teto por categoria
      </p>
      <p style={{ margin: "0 0 0.9rem", fontSize: "0.78rem", color: COR.medio }}>
        Quanto você quer gastar no máximo em cada uma. O teto continua valendo nos meses seguintes até você mudar. Deixe em branco pra não ter teto.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {doGasto.map((cat) => {
          const gasto = Number(gastosPorCategoria[cat] || 0);
          const herdado = tetos.find((t) => String(t.categoria).toLowerCase() === cat.toLowerCase())?.herdado;
          const limite = parseValor(valores[cat]);
          const estourou = limite && !Number.isNaN(limite) && gasto > limite;
          return (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: "0.6rem", background: COR.bg, border: `1px solid ${COR.borda}`, borderRadius: "10px", padding: "0.6rem 0.75rem" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "0.82rem", color: COR.texto, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat}</p>
                {gasto > 0 && (
                  <p style={{ margin: "1px 0 0", fontSize: "0.66rem", color: estourou ? COR.ruim : COR.fraco, fontVariantNumeric: "tabular-nums" }}>
                    já gastou {formatBRL(gasto)}
                    {herdado && <span style={{ color: COR.fraco }}> · teto do mês anterior</span>}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ fontSize: "0.75rem", color: COR.fraco }}>{simbolo}</span>
                <input
                  inputMode="decimal"
                  placeholder="—"
                  value={valores[cat] ?? ""}
                  onChange={(e) => setValor(cat, e.target.value)}
                  aria-label={`Teto de ${cat}`}
                  style={{
                    width: "88px", background: COR.fundo, border: `1px solid ${estourou ? COR.ruim : COR.borda}`,
                    borderRadius: "8px", padding: "0.45rem 0.5rem", color: COR.texto, fontSize: "0.82rem",
                    outline: "none", fontFamily: "inherit", textAlign: "right", fontVariantNumeric: "tabular-nums",
                    boxSizing: "border-box", minWidth: 0,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Erro do servidor tem prioridade: e o que explica "salvei e nao ficou". */}
      {(erroExterno || erro) && <p style={{ margin: "0.7rem 0 0", fontSize: "0.78rem", color: COR.ruim, lineHeight: 1.4 }}>{erroExterno || erro}</p>}

      <button
        type="button"
        onClick={handleSalvar}
        disabled={salvando}
        className="pdx-tap"
        style={{
          marginTop: "0.9rem", width: "100%", padding: "0.8rem", border: "none", borderRadius: "10px",
          background: COR.acento, color: "#fff", fontSize: "0.9rem", fontWeight: 700,
          cursor: salvando ? "not-allowed" : "pointer", opacity: salvando ? 0.7 : 1, fontFamily: "inherit",
        }}
      >
        {salvando ? "Salvando..." : "Salvar tetos"}
      </button>

      {paywall && <PaywallOrcamento bloqueio={paywall} email={email} onFechar={() => setPaywall(null)} />}
    </section>
  );
}

// O paywall é modal e não tela: a pessoa volta exatamente pro que estava preenchendo
// quando clica em "agora não". Mandar ela pra outra tela apagaria o trabalho dela e
// transformaria um convite em punição.
function PaywallOrcamento({ bloqueio, email, onFechar }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Teto por categoria é do plano Essencial"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 110, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      onClick={onFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: "480px", background: COR.bg, borderTop: `1px solid ${COR.borda}`, borderRadius: "16px 16px 0 0", padding: "1.4rem 1.2rem calc(1.4rem + env(safe-area-inset-bottom, 0px))", boxSizing: "border-box" }}
      >
        <p style={{ margin: "0 0 0.5rem", fontSize: "1.05rem", fontWeight: 600, color: COR.texto, letterSpacing: "-0.01em" }}>
          Limite sem plano não segura
        </p>
        <p style={{ margin: "0 0 1.2rem", fontSize: "0.85rem", color: COR.medio, lineHeight: 1.5 }}>
          Anotar o teto e não acompanhar é lista na gaveta. O Essencial guarda os seus e te avisa quando passa.
        </p>

        <a
          href={checkoutComEmail(bloqueio.checkout, email) || "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="pdx-tap"
          style={{ display: "block", textAlign: "center", padding: "0.85rem", borderRadius: "10px", background: COR.acento, color: "#fff", fontSize: "0.9rem", fontWeight: 700, textDecoration: "none" }}
        >
          Quero o Essencial, R$ 29,90
        </a>

        <button
          type="button"
          onClick={onFechar}
          style={{ marginTop: "0.6rem", width: "100%", padding: "0.7rem", background: "transparent", border: "none", color: COR.fraco, fontSize: "0.82rem", cursor: "pointer", fontFamily: "inherit" }}
        >
          agora não
        </button>
      </div>
    </div>
  );
}
