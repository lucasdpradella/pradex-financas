import { useRef, useState } from "react";
import { parseValorConta } from "../lib/formaPagamento";

// As três camadas da home: Fluxo do mês, Nas contas agora, Faturas.
// O mesmo componente serve o mobile (escuro) e o desktop (claro). A conta é do
// fechamento e de listarFaturas — aqui só se mostra e se edita o saldo.

const TEMA = {
  mobile: {
    card: "#151821",
    borda: "#1E2330",
    texto: "#F1F2F4",
    medio: "#8B93A1",
    fraco: "#5C6570",
    fundo: "#0C0E14",
    entrou: "#2FBF8A",
    saiu: "#E06C65",
    acento: "#6366F1",
    chip: "#0C0E14",
  },
  desktop: {
    card: "#FFFFFF",
    borda: "#E4E7F0",
    texto: "#111827",
    medio: "#6B7280",
    fraco: "#9AA1AE",
    fundo: "#F1F3F9",
    entrou: "#059669",
    saiu: "#DC2626",
    acento: "#4F46E5",
    chip: "#F1F3F9",
  },
};

function Icone({ tipo, cor }) {
  const comum = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: cor, strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
  if (tipo === "entrou") return <svg {...comum}><path d="M12 19V5" /><path d="M6 11l6-6 6 6" /></svg>;
  if (tipo === "saiu") return <svg {...comum}><path d="M12 5v14" /><path d="M6 13l6 6 6-6" /></svg>;
  return <svg {...comum}><path d="M5 12h14" /></svg>;
}

function LinhaFluxo({ tipo, label, valor, cor, texto, borda }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.72rem 0", borderBottom: `1px solid ${borda}` }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.55rem", color: cor, fontWeight: 650, fontSize: "0.92rem" }}>
        <span style={{ width: 28, height: 28, borderRadius: "999px", border: `1.5px solid ${cor}`, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icone tipo={tipo} cor={cor} />
        </span>
        {label}
      </span>
      <span style={{ color: cor, fontWeight: 750, fontSize: "1.05rem", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{valor}</span>
    </div>
  );
}

export default function HomeResumo({
  variant = "mobile",
  fluxo,
  faturas = [],
  bancos = [],
  formatBRL,
  onSalvarSaldo,
  onCriarConta,
}) {
  const c = TEMA[variant] || TEMA.mobile;
  const cancelarEdicao = useRef(false);
  const [editandoId, setEditandoId] = useState(null);
  const [rascunho, setRascunho] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [nova, setNova] = useState(false);
  const [nomeNova, setNomeNova] = useState("");
  const [saldoNova, setSaldoNova] = useState("");

  const dinheiro = (v) => formatBRL(Number(v || 0));
  const disponivel = bancos.reduce((s, b) => s + Number(b.saldo_atual || 0), 0);

  const abrir = (banco) => {
    setErro("");
    setEditandoId(banco.id);
    setRascunho(banco.saldo_atual == null ? "" : String(banco.saldo_atual).replace(".", ","));
  };

  const salvar = async (banco) => {
    const valor = parseValorConta(rascunho);
    if (valor == null) { setErro("Informe o saldo. Ex.: 2.180 ou 2180,50."); return; }
    setOcupado(true); setErro("");
    const res = await onSalvarSaldo?.(banco, valor);
    setOcupado(false);
    if (res && res.ok === false) { setErro(res.erro || "Não foi possível salvar o saldo."); return; }
    setEditandoId(null);
  };

  const criar = async () => {
    const nome = nomeNova.trim();
    if (!nome) { setErro("Informe o nome da conta."); return; }
    const saldo = saldoNova.trim() ? parseValorConta(saldoNova) : null;
    if (saldoNova.trim() && saldo == null) { setErro("Saldo inválido."); return; }
    setOcupado(true); setErro("");
    const res = await onCriarConta?.(nome);
    if (!res?.ok) { setOcupado(false); setErro(res?.erro || "Não foi possível criar a conta."); return; }
    if (saldo != null && res.banco) {
      const saldoRes = await onSalvarSaldo?.(res.banco, saldo);
      if (saldoRes && saldoRes.ok === false) { setOcupado(false); setErro(saldoRes.erro || "Conta criada, mas o saldo não entrou."); return; }
    }
    setOcupado(false);
    setNova(false); setNomeNova(""); setSaldoNova("");
  };

  const card = {
    background: c.card,
    border: `1px solid ${c.borda}`,
    borderRadius: 16,
    padding: variant === "desktop" ? "1.15rem 1.3rem" : "1rem 1.05rem",
    marginBottom: "0.85rem",
  };
  const titulo = {
    margin: "0 0 0.35rem",
    fontSize: "0.95rem",
    fontWeight: 750,
    color: c.texto,
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  };

  return (
    <div>
      <section style={card} aria-label="Fluxo do mês">
        <p style={titulo}>
          Fluxo do mês
          <span title="Caixa do mês pela data do lançamento. Competência fica no planejamento." style={{ width: 16, height: 16, borderRadius: "999px", border: `1.5px solid ${c.fraco}`, color: c.fraco, fontSize: "0.65rem", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>i</span>
        </p>
        <LinhaFluxo tipo="entrou" label="Entrou" valor={dinheiro(fluxo?.entrou)} cor={c.entrou} borda={c.borda} />
        <LinhaFluxo tipo="saiu" label="Saiu" valor={dinheiro(fluxo?.saiu)} cor={c.saiu} borda={c.borda} />
        <LinhaFluxo tipo="diferenca" label="Diferença" valor={dinheiro(fluxo?.diferenca)} cor={c.texto} borda="transparent" />
        {Number(fluxo?.guardado) > 0 && (
          <p style={{ margin: "0.15rem 0 0", fontSize: "0.78rem", color: c.acento, fontWeight: 650 }}>
            Guardou {dinheiro(fluxo.guardado)}
            <span style={{ color: c.medio, fontWeight: 500 }}> · não entra no Saiu</span>
          </p>
        )}
        <p style={{ margin: "0.45rem 0 0", fontSize: "0.72rem", color: c.fraco, display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span aria-hidden="true">↕</span> ganhos e gastos do mês
        </p>
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", margin: "-0.25rem 0 0.85rem" }}>
        <span style={{ background: c.chip, color: c.medio, border: `1px solid ${c.borda}`, borderRadius: 999, padding: "0.28rem 0.7rem", fontSize: "0.75rem", fontWeight: 650 }}>
          Débito {dinheiro(fluxo?.debito)}
        </span>
        <span style={{ background: c.chip, color: c.medio, border: `1px solid ${c.borda}`, borderRadius: 999, padding: "0.28rem 0.7rem", fontSize: "0.75rem", fontWeight: 650 }}>
          Cartão {dinheiro(fluxo?.cartao)}
        </span>
      </div>

      <section style={card} aria-label="Nas contas agora">
        <p style={titulo}>Nas contas agora</p>
        {bancos.length === 0 && !nova && (
          <p style={{ margin: "0.2rem 0 0.6rem", fontSize: "0.82rem", color: c.medio }}>Nenhuma conta cadastrada. O disponível é a soma do que você informar.</p>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))", gap: "0.65rem", alignItems: "start" }}>
          {bancos.map((banco) => (
            <div key={banco.id} style={{ minWidth: 0, paddingRight: "0.35rem" }}>
              <p style={{ margin: "0 0 0.2rem", fontSize: "0.78rem", color: c.medio, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{banco.nome}</p>
              {editandoId === banco.id ? (
                <input
                  aria-label={`Saldo de ${banco.nome}`}
                  inputMode="decimal"
                  value={rascunho}
                  autoFocus
                  disabled={ocupado}
                  onChange={(e) => setRascunho(e.target.value)}
                  onBlur={() => {
                    if (cancelarEdicao.current) { cancelarEdicao.current = false; return; }
                    salvar(banco);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
                    if (e.key === "Escape") { cancelarEdicao.current = true; setEditandoId(null); }
                  }}
                  style={{ width: "100%", boxSizing: "border-box", background: c.fundo, color: c.texto, border: `1px solid ${c.acento}`, borderRadius: 8, padding: "0.35rem 0.45rem", font: "inherit", fontWeight: 700 }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => abrir(banco)}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: c.texto, fontWeight: 750, fontSize: "0.95rem", fontVariantNumeric: "tabular-nums", fontFamily: "inherit" }}
                >
                  {banco.saldo_atual == null ? "informar" : dinheiro(banco.saldo_atual)}
                </button>
              )}
            </div>
          ))}
          <div style={{ minWidth: 0, borderLeft: bancos.length ? `1px solid ${c.borda}` : "none", paddingLeft: bancos.length ? "0.7rem" : 0 }}>
            <p style={{ margin: "0 0 0.2rem", fontSize: "0.78rem", color: c.medio }}>Disponível</p>
            <p style={{ margin: 0, color: c.texto, fontWeight: 800, fontSize: "0.95rem", fontVariantNumeric: "tabular-nums" }}>{dinheiro(disponivel)}</p>
          </div>
        </div>
        {nova ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginTop: "0.85rem" }}>
            <input aria-label="Nome da conta" placeholder="Ex.: XP Conta digital" value={nomeNova} onChange={(e) => setNomeNova(e.target.value)} style={{ flex: "1 1 140px", background: c.fundo, color: c.texto, border: `1px solid ${c.borda}`, borderRadius: 8, padding: "0.45rem 0.6rem", font: "inherit" }} />
            <input aria-label="Saldo inicial" placeholder="Saldo" inputMode="decimal" value={saldoNova} onChange={(e) => setSaldoNova(e.target.value)} style={{ width: 110, background: c.fundo, color: c.texto, border: `1px solid ${c.borda}`, borderRadius: 8, padding: "0.45rem 0.6rem", font: "inherit" }} />
            <button type="button" disabled={ocupado} onClick={criar} style={{ border: "none", borderRadius: 8, background: c.acento, color: "#fff", fontWeight: 700, padding: "0.45rem 0.75rem", cursor: "pointer", fontFamily: "inherit" }}>{ocupado ? "Salvando..." : "Salvar"}</button>
            <button type="button" onClick={() => { setNova(false); setErro(""); }} style={{ border: "none", background: "none", color: c.medio, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
          </div>
        ) : (
          <button type="button" onClick={() => { setNova(true); setErro(""); }} style={{ marginTop: "0.75rem", background: "none", border: "none", padding: 0, color: c.acento, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: "0.8rem" }}>
            Adicionar conta
          </button>
        )}
        {erro && <p style={{ margin: "0.55rem 0 0", fontSize: "0.78rem", color: c.saiu }}>{erro}</p>}
      </section>

      <section style={{ ...card, marginBottom: 0 }} aria-label="Faturas">
        <p style={titulo}>Faturas</p>
        {faturas.length === 0 ? (
          <p style={{ margin: "0.35rem 0 0.7rem", fontSize: "0.82rem", color: c.medio }}>Nenhuma fatura aberta neste ciclo.</p>
        ) : faturas.map((f) => (
          <div key={f.cartaoId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", padding: "0.72rem 0", borderBottom: `1px solid ${c.borda}` }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.9rem", color: c.texto, fontWeight: 600 }}>{f.label}</p>
              {f.vencimento && <p style={{ margin: "0.12rem 0 0", fontSize: "0.72rem", color: c.medio }}>{f.vencimento}</p>}
            </div>
            <p style={{ margin: 0, fontWeight: 750, color: c.texto, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{dinheiro(f.valor)}</p>
          </div>
        ))}
        <p style={{ margin: "0.7rem 0 0", fontSize: "0.75rem", color: c.medio, background: c.fundo, borderRadius: 10, padding: "0.55rem 0.7rem" }}>
          pagamento de fatura não conta de novo no Saiu
        </p>
      </section>
    </div>
  );
}
