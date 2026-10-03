import { useRef, useState } from "react";
import { faturaPorDataDaCompra } from "../lib/faturas";
import { t } from "../lib/i18n";

// Topo da home (out/2026): Fatura do cartão, Débito do mês e Receitas do mês do mês
// selecionado, tudo por data_lancamento e com o valor cheio do mês. A conta mora em
// lib/fechamento.js (`cartaoPorCartao`, `debito`, `receitas`, `pagamentoFatura`) —
// aqui só se mostra. O mesmo componente serve o mobile (escuro) e o desktop (claro).
//
// A Fatura do cartão já nasce como carrossel de "faces". Hoje só existe a face
// "Por data da compra". A face "Pelo fechamento" (ciclo do cartão, lib/faturas.js →
// cicloQueContem) fica atrás de FATURA_PELO_FECHAMENTO e não é renderizada; quando
// ligar, o mobile ganha os pontos + scroll-snap e o desktop as abas.
export const FATURA_PELO_FECHAMENTO = false;

const TEMA = {
  mobile: {
    card: "#151821",
    borda: "#1E2330",
    texto: "#F1F2F4",
    medio: "#8B93A1",
    fraco: "#5C6570",
    fundo: "#0C0E14",
    receita: "#2FBF8A",
    gasto: "#E06C65",
    fatura: "#E8943A",
    acento: "#6366F1",
    raio: 16,
  },
  desktop: {
    card: "#FFFFFF",
    borda: "#E4E7F0",
    texto: "#111827",
    medio: "#6B7280",
    fraco: "#9AA1AE",
    fundo: "#F1F3F9",
    receita: "#059669",
    gasto: "#DC2626",
    fatura: "#B45309",
    acento: "#4F46E5",
    raio: 12,
  },
};

export default function HomeResumo({
  variant = "mobile",
  fluxo,
  cartoes = [],
  formatBRL,
  idioma = "pt-BR",
  normalizar = (x) => x,
  pelaDataDoFechamento = FATURA_PELO_FECHAMENTO,
}) {
  const s = (key) => t(idioma, key);
  const c = TEMA[variant] || TEMA.mobile;
  const desktop = variant === "desktop";
  const dinheiro = (v) => formatBRL(Number(v || 0));
  const trilho = useRef(null);
  const [face, setFace] = useState(0);

  const linhas = faturaPorDataDaCompra(fluxo?.cartaoPorCartao, cartoes, { normalizar });
  const totalFatura = Number(fluxo?.cartao || 0);
  const pagamentoFatura = Number(fluxo?.pagamentoFatura || 0);

  const card = {
    background: c.card,
    border: `1px solid ${c.borda}`,
    borderRadius: c.raio,
    padding: desktop ? "1.1rem 1.25rem" : "1rem 1.05rem",
    minWidth: 0,
    boxSizing: "border-box",
  };
  const rotulo = { margin: "0 0 0.3rem", fontSize: desktop ? "0.72rem" : "0.75rem", fontWeight: 600, color: c.medio, textTransform: "uppercase", letterSpacing: desktop ? "0.07em" : "0.1em" };
  const valor = (cor, tam) => ({ margin: 0, fontSize: tam, fontWeight: 700, color: cor, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" });
  const apoio = { margin: "0.2rem 0 0", fontSize: "0.74rem", color: desktop ? c.medio : c.fraco };

  const faceCompra = (
    <div key="compra" data-face="compra" style={{ flex: "0 0 100%", scrollSnapAlign: "start", minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
        <div style={{ minWidth: 0 }}>
          <p style={rotulo}>{s("fatura_cartao")}</p>
          <p style={{ ...apoio, margin: 0 }}>{s("fatura_sub_compra")}</p>
        </div>
        <p style={valor(c.fatura, desktop ? "1.35rem" : "1.35rem")}>{dinheiro(totalFatura)}</p>
      </div>
      {linhas.length === 0 ? (
        <p style={{ margin: "0.7rem 0 0", fontSize: "0.82rem", color: c.medio }}>{s("fatura_vazia")}</p>
      ) : (
        <div style={{ marginTop: "0.35rem" }}>
          {linhas.map((l, i) => (
            <div key={l.cartaoId ?? "sem-cartao"} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0", borderBottom: i === linhas.length - 1 ? "none" : `1px solid ${c.borda}` }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 500, color: c.texto, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.nome || s("sem_cartao")}</p>
                {(l.diaFechamento || l.diaVencimento) && (
                  <p style={{ margin: "0.12rem 0 0", fontSize: "0.7rem", color: desktop ? c.medio : c.fraco }}>
                    {s("fecha_dia")} {l.diaFechamento || "-"} · {s("vence_dia")} {l.diaVencimento || "-"}
                  </p>
                )}
              </div>
              <p style={{ margin: 0, fontWeight: 700, color: desktop ? c.texto : c.fatura, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{dinheiro(l.total)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Placeholder da segunda face: estrutura apenas, desligada por flag.
  const faces = [{ id: "compra", label: s("face_compra"), node: faceCompra }];
  if (pelaDataDoFechamento) {
    faces.push({
      id: "fechamento",
      label: s("face_fechamento"),
      node: (
        <div key="fechamento" data-face="fechamento" style={{ flex: "0 0 100%", scrollSnapAlign: "start", minWidth: 0 }}>
          <p style={rotulo}>{s("fatura_cartao")} · {s("face_fechamento")}</p>
        </div>
      ),
    });
  }
  const variasFaces = faces.length > 1;

  const irPara = (i) => {
    setFace(i);
    const el = trilho.current;
    if (el && !desktop) el.scrollTo({ left: el.clientWidth * i, behavior: "smooth" });
  };

  const cardFatura = (
    <section style={card} aria-label={s("fatura_cartao")}>
      {variasFaces && desktop && (
        <div role="tablist" style={{ display: "flex", gap: "0.35rem", marginBottom: "0.7rem" }}>
          {faces.map((f, i) => (
            <button key={f.id} role="tab" aria-selected={face === i} type="button" onClick={() => irPara(i)} style={{ border: "none", borderRadius: 999, padding: "0.2rem 0.65rem", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", background: face === i ? "#EEF2FF" : "transparent", color: face === i ? "#4338CA" : c.medio }}>{f.label}</button>
          ))}
        </div>
      )}
      <div
        ref={trilho}
        onScroll={variasFaces && !desktop ? (e) => {
          const el = e.currentTarget;
          if (el.clientWidth) setFace(Math.round(el.scrollLeft / el.clientWidth));
        } : undefined}
        style={{ display: "flex", overflowX: variasFaces && !desktop ? "auto" : "hidden", scrollSnapType: variasFaces && !desktop ? "x mandatory" : undefined, scrollbarWidth: "none" }}
      >
        {desktop ? faces[face]?.node : faces.map((f) => f.node)}
      </div>
      {variasFaces && !desktop && (
        <div style={{ display: "flex", justifyContent: "center", gap: "0.35rem", marginTop: "0.6rem" }}>
          {faces.map((f, i) => (
            <button key={f.id} type="button" aria-label={f.label} onClick={() => irPara(i)} style={{ width: 7, height: 7, padding: 0, borderRadius: 999, border: "none", cursor: "pointer", background: face === i ? c.acento : c.borda }} />
          ))}
        </div>
      )}
    </section>
  );

  const notaPagamento = (
    <p style={{ margin: desktop ? "0.85rem 0 0" : "0", fontSize: "0.72rem", color: c.medio, background: c.fundo, borderRadius: desktop ? 8 : 10, padding: "0.45rem 0.65rem" }}>
      {s("pagamento_fatura_label")}{pagamentoFatura > 0 ? ` (${dinheiro(pagamentoFatura)})` : ""} {s("debito_nota_resto")}
    </p>
  );

  const cardDebito = (
    <section style={card} aria-label={s("debito_mes")}>
      <p style={rotulo}>{s("debito_mes")}</p>
      <p style={valor(c.gasto, desktop ? "1.6rem" : "1.15rem")}>{dinheiro(fluxo?.debito)}</p>
      <p style={apoio}>{s("debito_sub")}</p>
      {desktop && notaPagamento}
    </section>
  );

  const cardReceitas = (
    <section style={card} aria-label={s("receitas_mes")}>
      <p style={rotulo}>{s("receitas_mes")}</p>
      <p style={valor(c.receita, desktop ? "1.6rem" : "1.15rem")}>{dinheiro(fluxo?.receitas)}</p>
      <p style={apoio}>{s("receitas_sub")}</p>
    </section>
  );

  if (desktop) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)", gap: "1rem", alignItems: "stretch" }}>
        {cardFatura}
        {cardDebito}
        {cardReceitas}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "0.85rem" }}>
      <div style={{ marginBottom: "0.75rem" }}>{cardFatura}</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "0.75rem", marginBottom: "0.75rem" }}>
        {cardDebito}
        {cardReceitas}
      </div>
      {notaPagamento}
    </div>
  );
}
