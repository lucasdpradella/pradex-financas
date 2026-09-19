// METAS — caixinhas de guardar dinheiro.
//
// Brief: Chave Mestre, Projetos/PRADEX/briefs/2026-09-16_metas-caixinhas.md
//
// PADRÃO DE PAYWALL (o mesmo do teto, decidido em 12/09): sem cadeado. A tela SEMPRE
// renderiza e o Free cria a primeira caixinha à vontade. O paywall só aparece quando
// ele tenta salvar a SEGUNDA — aí a intenção já está formada. Cadeado faz desistir
// antes de tocar; isto faz desistir depois de querer, que é muito mais caro pra quem
// está do outro lado.
//
// ⚠️ COR AQUI SO POR TOKEN. Esta tela nasce nos DOIS canvas (claro no desktop, escuro
// no celular) e o App injeta as variáveis no wrapper. Nada de hex de canvas aqui —
// foi o que deixou o Orçamento preto no desktop até 16/09 (PR #71).

import React, { useMemo, useState } from "react";
import {
  comProgresso, metasAtivas, limiteDeMetas, LIMITE_FREE, FORMAS_APORTE,
  DIFICULDADES, DIFICULDADE_PADRAO, dificuldadeDe, mensagemDoMarco, pontosDoMarco,
} from "../lib/metas";
import { CHECKOUT, PRECO, checkoutComEmail } from "../lib/plano";
import { parseValor } from "./OrcamentoCategoria";

const formatBRL = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

const hoje = () => new Date().toISOString().split("T")[0];

// `abateSaldo: true` é o padrão e continua sendo o caso normal — quem guarda, guarda
// hoje, e o dinheiro sai da conta hoje. O `false` é a exceção de estreia (ver abaixo).
const aporteVazio = () => ({ valor: "", data: hoje(), forma: "", resgate: false, abateSaldo: true });

const inputBase = {
  background: COR.campo,
  border: `1px solid ${COR.borda}`,
  borderRadius: "8px",
  padding: "0.55rem 0.6rem",
  color: COR.texto,
  fontSize: "0.85rem",
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
  width: "100%",
  minWidth: 0,
};

export default function MetasCaixinhas({
  metas = [],
  lancamentos = [],
  plano,
  temAcessoPago = false,
  salvando = false,
  erroExterno = "",
  onCriar,
  onAportar,
  onArquivar,
  email,
  celebracao = null,
  onFecharCelebracao,
}) {
  const [abrindoForm, setAbrindoForm] = useState(false);
  const [nova, setNova] = useState({ nome: "", valor_alvo: "", aplicado_em: "", prazo: "", dificuldade: DIFICULDADE_PADRAO });
  const [aporteDe, setAporteDe] = useState(null);   // meta.id
  const [aporte, setAporte] = useState(aporteVazio());
  const [erro, setErro] = useState("");
  const [paywall, setPaywall] = useState(false);

  const ativas = useMemo(() => metasAtivas(metas), [metas]);
  const comDados = useMemo(
    () => ativas.map((m) => comProgresso(m, lancamentos)),
    [ativas, lancamentos],
  );

  const totalGuardado = comDados.reduce((s, m) => s + m.acumulado, 0);

  function abrirForm() {
    // A checagem é no SAVE, mas abrir o form já sabendo que vai bater no limite seria
    // convidar pra digitar à toa. Aqui o paywall aparece ANTES do trabalho perdido —
    // é a única exceção, e ela protege o usuário, não o produto.
    const bloqueio = limiteDeMetas(plano, metas, { temAcessoPago });
    if (bloqueio) { setPaywall(true); return; }
    setErro("");
    setAbrindoForm(true);
  }

  function salvarNova() {
    const nome = nova.nome.trim();
    const alvo = parseValor(nova.valor_alvo);
    if (!nome) { setErro("Dê um nome pra caixinha."); return; }
    if (alvo === null || Number.isNaN(alvo) || alvo <= 0) { setErro("Informe quanto você quer juntar."); return; }
    if (ativas.some((m) => m.nome.trim().toLowerCase() === nome.toLowerCase())) {
      setErro(`Você já tem uma caixinha chamada "${nome}".`);
      return;
    }
    const bloqueio = limiteDeMetas(plano, metas, { temAcessoPago });
    if (bloqueio) { setPaywall(true); return; }

    setErro("");
    onCriar?.({
      nome,
      valor_alvo: alvo,
      aplicado_em: nova.aplicado_em.trim() || null,
      prazo: nova.prazo || null,
      dificuldade: nova.dificuldade || DIFICULDADE_PADRAO,
    });
    setNova({ nome: "", valor_alvo: "", aplicado_em: "", prazo: "", dificuldade: DIFICULDADE_PADRAO });
    setAbrindoForm(false);
  }

  function confirmarAporte(meta) {
    const v = parseValor(aporte.valor);
    if (v === null || Number.isNaN(v) || v <= 0) { setErro("Informe um valor maior que zero."); return; }
    setErro("");
    onAportar?.({
      meta,
      valor: v,
      data: aporte.data || hoje(),
      forma: aporte.forma || null,
      resgate: aporte.resgate,
      abateSaldo: aporte.abateSaldo,
    });
    setAporte(aporteVazio());
    setAporteDe(null);
  }

  return (
    <section aria-label="Metas">
      <p style={{ margin: "0 0 0.3rem", fontSize: "0.7rem", color: COR.fraco, textTransform: "uppercase", letterSpacing: "0.1em" }}>
        Caixinhas
      </p>
      <p style={{ margin: "0 0 0.9rem", fontSize: "0.78rem", color: COR.medio, lineHeight: 1.45 }}>
        Quanto você quer juntar, e pra quê. Toda vez que guardar, avisa aqui — por
        padrão o valor sai do seu saldo do mês, como saiu da sua conta de verdade. Se
        o dinheiro já estava guardado de antes, você diz, e o saldo não muda.
      </p>

      {comDados.length > 0 && (
        <p style={{ margin: "0 0 0.9rem", fontSize: "0.8rem", color: COR.medio }}>
          Guardado no total: <span style={{ color: COR.ok, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{formatBRL(totalGuardado)}</span>
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {comDados.map((m) => (
          <div key={m.id} style={{ background: COR.bg, border: `1px solid ${m.concluida ? COR.ok : COR.borda}`, borderRadius: "12px", padding: "0.85rem 0.95rem" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
              <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: COR.texto, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.icone ? `${m.icone} ` : ""}{m.nome}
              </p>
              <p style={{ margin: 0, fontSize: "0.78rem", color: m.concluida ? COR.ok : COR.medio, fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {formatBRL(m.acumulado)} <span style={{ color: COR.fraco }}>de {formatBRL(m.valor_alvo)}</span>
              </p>
            </div>

            {/* Barra. A largura vem de `progresso`, que já está limitado a 1 — quem
                guardou a mais vê 100% na barra e o valor cheio no texto acima. */}
            <div style={{ height: "8px", background: COR.campo, borderRadius: "999px", overflow: "hidden", margin: "0.55rem 0 0.4rem" }}>
              <div style={{ height: "100%", width: `${Math.round(m.progresso * 100)}%`, background: m.concluida ? COR.ok : COR.acento, borderRadius: "999px", transition: "width 0.3s" }} />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              <p style={{ margin: 0, fontSize: "0.72rem", color: m.concluida ? COR.ok : COR.fraco, flex: 1, minWidth: 0 }}>
                {m.concluida
                  ? "🎉 Meta batida. Essa é sua."
                  : `faltam ${formatBRL(m.falta)}${m.prazo ? ` · até ${String(m.prazo).split("-").reverse().join("/")}` : ""}`}
              </p>
              <button
                type="button"
                onClick={() => { setAporteDe(aporteDe === m.id ? null : m.id); setAporte(aporteVazio()); setErro(""); }}
                className="pdx-tap"
                style={{ background: "transparent", border: `1px solid ${COR.acento}`, borderRadius: "8px", color: COR.acento, fontSize: "0.75rem", fontWeight: 700, padding: "0.35rem 0.7rem", cursor: "pointer", fontFamily: "inherit" }}
              >
                {aporteDe === m.id ? "fechar" : "Guardei / tirei"}
              </button>
            </div>

            {/* A dificuldade fica visível no card porque ela é o que o dono
                prometeu a si mesmo — e é com base nela que o app fala com ele
                depois ("você marcou difícil e sentou"). Escondida, viraria um
                número secreto que só o ranking usa. */}
            <p style={{ margin: "0.45rem 0 0", fontSize: "0.7rem", color: COR.fraco }}>
              {dificuldadeDe(m).label.toLowerCase()}
              {m.aplicado_em ? ` · onde está: ${m.aplicado_em}` : ""}
            </p>

            {aporteDe === m.id && (
              <div style={{ marginTop: "0.7rem", paddingTop: "0.7rem", borderTop: `1px solid ${COR.borda}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <input
                    inputMode="decimal"
                    placeholder="Quanto? R$"
                    value={aporte.valor}
                    onChange={(e) => setAporte((a) => ({ ...a, valor: e.target.value }))}
                    aria-label="Valor guardado"
                    style={inputBase}
                  />
                  <input
                    type="date"
                    value={aporte.data}
                    onChange={(e) => setAporte((a) => ({ ...a, data: e.target.value }))}
                    aria-label="Data"
                    style={inputBase}
                  />
                </div>
                {/* DUAS OPÇÕES VISÍVEIS, E NÃO UM CHECKBOX (corrigido em 18/09).
                    Antes isto era uma caixinha "Na verdade eu tirei dinheiro daqui", e
                    o Lucas não entendeu no primeiro uso: "se clicar ele tira do saldo,
                    se não clicar não tira" — ambíguo em dois níveis. "Tirei daqui"
                    podia ser da conta OU da caixinha, e o efeito no saldo não estava
                    escrito em lugar nenhum; ficava na cabeça de quem escreveu o código.

                    Agora as duas ações aparecem lado a lado, sempre, com o efeito no
                    saldo dito em português embaixo. Ninguém precisa deduzir o que o
                    estado não-marcado de uma caixa significa. */}
                <Escolha
                  titulo="O que aconteceu"
                  valor={aporte.resgate}
                  // Trocar de guardar pra tirar reseta o efeito no saldo: "já estava
                  // guardado" e "não voltou pra conta" são perguntas diferentes, e
                  // herdar a resposta da outra seria responder por quem está usando.
                  onMudar={(v) => setAporte((a) => ({ ...a, resgate: v, abateSaldo: true }))}
                  opcoes={[{ chave: false, label: "Guardei" }, { chave: true, label: "Tirei da caixinha" }]}
                />

                {/* O DINHEIRO SE MOVEU AGORA? (18/09, pedido do Lucas: "deixa a opção
                    dele abater ou não do saldo".)

                    Existe pelo caso de estreia, que é o primeiro que todo mundo vive:
                    a pessoa cria "Viagem — R$ 5.000" e já tem R$ 2.000 juntados de
                    antes. Sem esta escolha, registrar esses R$ 2.000 faria o mês dela
                    nascer com R$ 2.000 negativos por um dinheiro que saiu da conta
                    meses atrás — ou ela mentiria o valor, e aí a barra nunca mais bate
                    com a vida.

                    "Saiu da conta agora" segue sendo o padrão porque segue sendo a
                    verdade quase sempre. */}
                <Escolha
                  titulo="Esse dinheiro se moveu agora?"
                  valor={aporte.abateSaldo}
                  onMudar={(v) => setAporte((a) => ({ ...a, abateSaldo: v, forma: v ? a.forma : "" }))}
                  opcoes={
                    aporte.resgate
                      ? [{ chave: true, label: "Voltou pra conta" }, { chave: false, label: "Não passou pela conta" }]
                      : [{ chave: true, label: "Saiu da conta agora" }, { chave: false, label: "Já estava guardado" }]
                  }
                />

                {/* BOTÕES, E NÃO UM SELECT (19/09). O select tinha
                    `<option value="">De onde saiu (opcional)</option>` como primeira
                    linha — então, sem escolher nada, o campo exibia a PERGUNTA no
                    lugar onde a pessoa lê a RESPOSTA. O Lucas: "ela não pode virar
                    resposta, só pergunta". É o mesmo defeito do checkbox de ontem:
                    informação morando num estado que ninguém lê como conteúdo.

                    Agora a pergunta é título e as respostas são as três opções, igual
                    às outras duas escolhas da tela. Nenhuma vem marcada — segue
                    opcional, e clicar na marcada desmarca.

                    Crédito não está na lista de propósito: guardar dinheiro no crédito
                    geraria fatura e dívida fingindo de poupança (ver lib/metas.js).

                    Só aparece quando o dinheiro se moveu agora — perguntar "de onde
                    saiu" sobre um dinheiro que já estava guardado não tem resposta. */}
                {aporte.abateSaldo && (
                  <Escolha
                    // O rótulo acompanha a ação: guardando, o dinheiro SAI de algum
                    // lugar; tirando, ele VOLTA pra algum lugar.
                    titulo={aporte.resgate ? "Pra onde voltou (opcional)" : "De onde saiu (opcional)"}
                    valor={aporte.forma}
                    onMudar={(v) => setAporte((a) => ({ ...a, forma: a.forma === v ? "" : v }))}
                    opcoes={FORMAS_APORTE.map((f) => ({ chave: f, label: f }))}
                  />
                )}

                {/* A frase é o ponto inteiro da mudança: diz o que vai acontecer com o
                    saldo ANTES de a pessoa confirmar. Os quatro casos estão escritos
                    por extenso porque montar a frase por pedaços produziria português
                    torto no cruzamento menos comum. */}
                <p style={{ margin: "0.6rem 0 0", fontSize: "0.72rem", color: COR.medio, lineHeight: 1.45 }}>
                  {aporte.resgate
                    ? aporte.abateSaldo
                      ? "O valor volta pro seu saldo do mês e sai da caixinha."
                      : "O valor sai da caixinha. Seu saldo do mês não muda."
                    : aporte.abateSaldo
                      ? "O valor sai do seu saldo do mês e entra na caixinha."
                      : "O valor entra na caixinha. Seu saldo do mês não muda."}
                </p>

                <button
                  type="button"
                  onClick={() => confirmarAporte(m)}
                  disabled={salvando}
                  className="pdx-tap"
                  style={{ marginTop: "0.6rem", width: "100%", padding: "0.65rem", border: "none", borderRadius: "9px", background: COR.acento, color: "#fff", fontSize: "0.82rem", fontWeight: 700, cursor: salvando ? "not-allowed" : "pointer", opacity: salvando ? 0.7 : 1, fontFamily: "inherit" }}
                >
                  {salvando ? "Salvando..." : aporte.resgate ? "Confirmar retirada" : "Confirmar que guardei"}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {comDados.length === 0 && !abrindoForm && (
        <div style={{ background: COR.bg, border: `1px dashed ${COR.borda}`, borderRadius: "12px", padding: "1.6rem 1rem", textAlign: "center" }}>
          <p style={{ margin: "0 0 0.3rem", fontSize: "0.88rem", color: COR.texto, fontWeight: 600 }}>Nenhuma caixinha ainda</p>
          <p style={{ margin: 0, fontSize: "0.78rem", color: COR.medio, lineHeight: 1.45 }}>
            Comece pela mais concreta: uma viagem, um curso, a reserva de emergência.
          </p>
        </div>
      )}

      {abrindoForm ? (
        <div style={{ marginTop: "0.9rem", background: COR.bg, border: `1px solid ${COR.borda}`, borderRadius: "12px", padding: "0.95rem" }}>
          <p style={{ margin: "0 0 0.7rem", fontSize: "0.8rem", fontWeight: 700, color: COR.texto }}>Nova caixinha</p>
          <input
            placeholder="Pra quê? (ex.: Viagem)"
            value={nova.nome}
            onChange={(e) => setNova((n) => ({ ...n, nome: e.target.value }))}
            aria-label="Nome da meta"
            style={inputBase}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginTop: "0.5rem" }}>
            <input
              inputMode="decimal"
              placeholder="Quanto juntar? R$"
              value={nova.valor_alvo}
              onChange={(e) => setNova((n) => ({ ...n, valor_alvo: e.target.value }))}
              aria-label="Valor alvo"
              style={inputBase}
            />
            <input
              type="date"
              value={nova.prazo}
              onChange={(e) => setNova((n) => ({ ...n, prazo: e.target.value }))}
              aria-label="Prazo (opcional)"
              style={inputBase}
            />
          </div>
          {/* Texto livre: o app não lê conta, não concilia e não valida isto. É
              anotação da pessoa pra ela mesma — decisão do Lucas (16/09). */}
          <input
            placeholder="Onde está guardado? (ex.: caixinha do Nubank)"
            value={nova.aplicado_em}
            onChange={(e) => setNova((n) => ({ ...n, aplicado_em: e.target.value }))}
            aria-label="Onde está guardado"
            style={{ ...inputBase, marginTop: "0.5rem" }}
          />

          {/* DIFICULDADE — declarada por quem cria, porque só ela sabe.
              O app não lê conta nem renda, e a mesma meta de R$ 5.000 é trivial pra
              um e brutal pra outro.

              Cada opção mostra a FRASE embaixo, e não só o rótulo. Isso não é
              enfeite: se fossem só "fácil/moderada/difícil", todo mundo marcaria
              difícil — não por má-fé, por otimismo sobre o próprio esforço — e o
              peso deixaria de diferenciar qualquer coisa. A frase descreve o mês da
              pessoa, então ela responde sobre a vida dela e a resposta sai honesta. */}
          <div style={{ marginTop: "0.8rem" }}>
            <p style={{ margin: "0 0 0.35rem", fontSize: "0.68rem", color: COR.fraco, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Quão difícil vai ser
            </p>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {DIFICULDADES.map((d) => {
                const ativo = nova.dificuldade === d.chave;
                return (
                  <button
                    key={d.chave}
                    type="button"
                    onClick={() => setNova((n) => ({ ...n, dificuldade: d.chave }))}
                    aria-pressed={ativo}
                    className="pdx-tap"
                    style={{
                      flex: 1, minWidth: 0, padding: "0.5rem 0.35rem", borderRadius: "8px", cursor: "pointer",
                      fontSize: "0.76rem", fontWeight: 700, fontFamily: "inherit",
                      border: `1px solid ${ativo ? COR.acento : COR.borda}`,
                      background: ativo ? COR.acento : "transparent",
                      color: ativo ? "#fff" : COR.medio,
                    }}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>
            <p style={{ margin: "0.4rem 0 0", fontSize: "0.72rem", color: COR.medio, lineHeight: 1.45 }}>
              “{dificuldadeDe({ dificuldade: nova.dificuldade }).frase}”
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem" }}>
            <button
              type="button"
              onClick={salvarNova}
              disabled={salvando}
              className="pdx-tap"
              style={{ flex: 1, padding: "0.7rem", border: "none", borderRadius: "9px", background: COR.acento, color: "#fff", fontSize: "0.85rem", fontWeight: 700, cursor: salvando ? "not-allowed" : "pointer", opacity: salvando ? 0.7 : 1, fontFamily: "inherit" }}
            >
              {salvando ? "Criando..." : "Criar caixinha"}
            </button>
            <button
              type="button"
              onClick={() => { setAbrindoForm(false); setErro(""); }}
              className="pdx-tap"
              style={{ padding: "0.7rem 1rem", border: `1px solid ${COR.borda}`, borderRadius: "9px", background: "transparent", color: COR.medio, fontSize: "0.85rem", cursor: "pointer", fontFamily: "inherit" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={abrirForm}
          className="pdx-tap"
          style={{ marginTop: "0.9rem", width: "100%", padding: "0.8rem", border: `1px dashed ${COR.acento}`, borderRadius: "10px", background: "transparent", color: COR.acento, fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          + Nova caixinha
        </button>
      )}

      {/* Erro do servidor tem prioridade: é o que explica "salvei e não ficou". */}
      {(erroExterno || erro) && (
        <p style={{ margin: "0.7rem 0 0", fontSize: "0.78rem", color: "var(--danger, #E06C65)", lineHeight: 1.4 }}>{erroExterno || erro}</p>
      )}

      {paywall && <PaywallMetas email={email} onFechar={() => setPaywall(false)} />}
      {celebracao && <Celebracao {...celebracao} onFechar={onFecharCelebracao} />}
    </section>
  );
}

/**
 * A comemoração de um marco.
 *
 * EXISTE POR CAUSA DE UMA PERGUNTA DO LUCAS (19/09): "coloquei uma meta de casamento,
 * 100 mil. Até juntar 100 mil o cara nunca será recompensado por ter chegado?" Até
 * aqui só a conclusão era celebrada — numa meta grande, isso é um silêncio de dois
 * anos enquanto a pessoa faz tudo certo.
 *
 * Aparece UMA vez, na hora do aporte que cravou o marco (quem compara o antes e o
 * depois é o App). Não reaparece ao abrir a tela: o `marco_max` já subiu, e
 * comemorar o mesmo 50% toda vez transformaria conquista em ruído.
 *
 * Sem confete e sem "parabéns!!!": quem guarda R$ 200 por mês há um ano não quer
 * animação, quer ser visto. O tom é o de alguém que estava acompanhando.
 */
function Celebracao({ meta, marco, onFechar }) {
  const { titulo, frase } = mensagemDoMarco(marco, meta);
  const pontos = pontosDoMarco(marco, meta?.dificuldade);
  const fechou = marco === 100;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={onFechar}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.2rem" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: "380px", background: COR.bg, border: `1px solid ${fechou ? COR.ok : COR.acento}`, borderRadius: "16px", padding: "1.5rem 1.3rem", boxSizing: "border-box", textAlign: "center" }}
      >
        <p style={{ margin: "0 0 0.15rem", fontSize: "0.7rem", color: COR.fraco, textTransform: "uppercase", letterSpacing: "0.1em" }}>
          {meta?.nome}
        </p>
        <p style={{ margin: "0 0 0.5rem", fontSize: "1.35rem", fontWeight: 700, color: fechou ? COR.ok : COR.texto, letterSpacing: "-0.02em" }}>
          {titulo}
        </p>
        <p style={{ margin: "0 0 1.1rem", fontSize: "0.85rem", color: COR.medio, lineHeight: 1.5 }}>
          {frase}
        </p>

        {/* A barra aparece cheia até o marco: é a imagem do que foi conquistado, não
            do que falta. O número de pontos vem junto porque é ele que vai pro
            ranking — e ficar sabendo só na hora do placar seria tarde. */}
        <div style={{ height: "8px", background: COR.campo, borderRadius: "999px", overflow: "hidden", marginBottom: "0.6rem" }}>
          <div style={{ height: "100%", width: `${marco}%`, background: fechou ? COR.ok : COR.acento, borderRadius: "999px" }} />
        </div>
        <p style={{ margin: "0 0 1.2rem", fontSize: "0.75rem", color: COR.fraco }}>
          +{pontos} pontos · meta {dificuldadeDe(meta).label.toLowerCase()}
        </p>

        <button
          type="button"
          onClick={onFechar}
          className="pdx-tap"
          style={{ width: "100%", padding: "0.8rem", border: "none", borderRadius: "10px", background: fechou ? COR.ok : COR.acento, color: "#fff", fontSize: "0.88rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
        >
          {fechou ? "Essa é minha" : "Seguir"}
        </button>
      </div>
    </div>
  );
}

/**
 * Opções lado a lado, sempre visíveis, com a pergunta como título em cima.
 *
 * É o padrão de escolha desta tela inteira, e existe como componente porque são três
 * perguntas seguidas ("o que aconteceu", "o dinheiro se moveu agora" e "de onde
 * saiu"): três cópias do mesmo bloco de estilo é como uma delas fica visualmente
 * diferente das outras sem ninguém perceber.
 *
 * A REGRA QUE ELE CARREGA: pergunta é título, opção é resposta, e nunca o contrário.
 * Já custou dois consertos em dois dias — o checkbox cujo estado não-marcado guardava
 * metade da informação (18/09) e o select que exibia o próprio enunciado no lugar da
 * resposta (19/09).
 *
 * `valor` fora de `opcoes` (inclusive "") é um estado legítimo: significa nenhuma
 * marcada, que é como uma pergunta opcional deve começar.
 */
function Escolha({ titulo, valor, onMudar, opcoes }) {
  return (
    <div style={{ marginTop: "0.7rem" }}>
      <p style={{ margin: "0 0 0.35rem", fontSize: "0.68rem", color: COR.fraco, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {titulo}
      </p>
      {/* `alignItems: stretch` (padrão do flex) mantém os botões da mesma altura
          quando um deles quebra em duas linhas no celular — "Saldo da conta" quebra
          em telas estreitas e sem isso ele ficaria mais alto que os vizinhos. */}
      <div style={{ display: "flex", gap: "0.4rem" }}>
        {opcoes.map((op) => {
          const ativo = valor === op.chave;
          return (
            <button
              key={op.label}
              type="button"
              onClick={() => onMudar(op.chave)}
              aria-pressed={ativo}
              className="pdx-tap"
              style={{
                flex: 1, minWidth: 0, padding: "0.5rem 0.35rem", borderRadius: "8px", cursor: "pointer",
                fontSize: "0.76rem", fontWeight: 700, fontFamily: "inherit", lineHeight: 1.2,
                border: `1px solid ${ativo ? COR.acento : COR.borda}`,
                background: ativo ? COR.acento : "transparent",
                color: ativo ? "#fff" : COR.medio,
              }}
            >
              {op.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Modal, não tela: a pessoa volta exatamente pro que estava fazendo ao clicar em
// "agora não". Mandar pra outra tela transformaria um convite em punição.
function PaywallMetas({ email, onFechar }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mais de uma caixinha é do plano Essencial"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 110, display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      onClick={onFechar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: "480px", background: COR.bg, borderTop: `1px solid ${COR.borda}`, borderRadius: "16px 16px 0 0", padding: "1.4rem 1.2rem calc(1.4rem + env(safe-area-inset-bottom, 0px))", boxSizing: "border-box" }}
      >
        <p style={{ margin: "0 0 0.5rem", fontSize: "1.05rem", fontWeight: 600, color: COR.texto, letterSpacing: "-0.01em" }}>
          Uma meta de cada vez é pouco
        </p>
        <p style={{ margin: "0 0 1.2rem", fontSize: "0.85rem", color: COR.medio, lineHeight: 1.5 }}>
          Você tem {LIMITE_FREE === 1 ? "uma caixinha" : `${LIMITE_FREE} caixinhas`} no plano grátis. A vida raramente cabe em uma só — viagem, reserva e o curso não esperam a vez.
        </p>
        <a
          href={checkoutComEmail(CHECKOUT.essencial, email)}
          target="_blank"
          rel="noopener noreferrer"
          className="pdx-tap"
          style={{ display: "block", textAlign: "center", padding: "0.85rem", borderRadius: "10px", background: COR.acento, color: "#fff", fontSize: "0.9rem", fontWeight: 700, textDecoration: "none" }}
        >
          Quero o Essencial, {PRECO.essencial}
        </a>
        {/* PIX: o 3DS do checkout não desliga e derruba a compra sem deixar registro
            (caso de 15/09). Ver comentário em ConvitePlano.jsx. */}
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.72rem", color: COR.fraco, textAlign: "center" }}>
          No PIX a liberação é na hora.
        </p>
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
