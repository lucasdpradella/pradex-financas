// Painel do dono — cadastros, ativos, pagantes, receita estimada.
//
// Pedido do Lucas em 17/09, no dia seguinte à primeira venda do produto ter chegado
// em silêncio: "meu dash da empresa pra ver cadastros, usuários ativos, planos
// pagantes etc".
//
// ⚠️ TODO NÚMERO DAQUI VEM DE UMA RPC ÚNICA, `admin_metricas()`. A tela não faz
// select em tabela nenhuma, e não poderia: o app inteiro é fechado por RLS
// `user_id = auth.uid()`, então o front NÃO CONSEGUE contar usuários — e é bom que
// não consiga. A RPC é SECURITY DEFINER, checa `profiles.role = 'super_admin'` e
// devolve só agregado (ver a migration 2026-09-17_admin_metricas.sql).
//
// O que isto NUNCA deve virar: uma tela que lista gente. Se um dia precisar de
// "quem são os pagantes", isso é outra decisão, com outra conversa — dado financeiro
// de cliente não vira lista de navegação porque foi fácil.
//
// Só o desktop: é painel de trabalho, com tabela e grade. No celular ele não cabe e
// o item nem aparece na navegação.

import React, { useEffect, useState } from "react";
import { desktopTheme as t } from "./theme";

const fmtBRL = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtNum = (v) => Number(v || 0).toLocaleString("pt-BR");

const fmtData = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
};

const CSS = `
.pdx-met { display: grid; gap: 1.25rem; }
.pdx-met__grade { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1rem; }
.pdx-met__card { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1.1rem 1.2rem; }
.pdx-met__card--alerta { border-color: #DC262655; background: #FEF2F2; }
.pdx-met__rot { margin: 0 0 0.4rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.09em; color: ${t.textSecondary}; font-weight: 600; }
.pdx-met__val { margin: 0; font-size: 1.7rem; font-weight: 700; color: ${t.textPrimary}; letter-spacing: -0.02em; line-height: 1.1; }
.pdx-met__sub { margin: 0.35rem 0 0; font-size: 0.78rem; color: ${t.textSecondary}; line-height: 1.45; }
.pdx-met__secao { margin: 0 0 0.75rem; font-size: 0.8rem; font-weight: 700; color: ${t.textPrimary}; text-transform: uppercase; letter-spacing: 0.06em; }
.pdx-met__painel { background: ${t.surface}; border: 1px solid ${t.surfaceBorder}; border-radius: 12px; padding: 1.25rem 1.35rem; }
.pdx-met__tab { width: 100%; border-collapse: collapse; font-size: 0.86rem; }
.pdx-met__tab th { text-align: left; padding: 0.5rem 0.4rem; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em; color: ${t.textSecondary}; border-bottom: 1px solid ${t.surfaceBorder}; }
.pdx-met__tab td { padding: 0.6rem 0.4rem; border-bottom: 1px solid ${t.surfaceBorder}; color: ${t.textPrimary}; }
.pdx-met__tab tr:last-child td { border-bottom: none; }
.pdx-met__tag { display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; }
.pdx-met__tag--ok { background: #ECFDF5; color: #047857; }
.pdx-met__tag--erro { background: #FEF2F2; color: #B91C1C; }
.pdx-met__nota { margin: 0.5rem 0 0; font-size: 0.75rem; color: ${t.textSecondary}; line-height: 1.5; }
.pdx-met__erro { background: #FEF2F2; border: 1px solid #DC262655; border-radius: 12px; padding: 1.1rem 1.25rem; color: #B91C1C; font-size: 0.88rem; line-height: 1.5; }
`;

function Card({ rotulo, valor, sub, alerta }) {
  return (
    <div className={`pdx-met__card${alerta ? " pdx-met__card--alerta" : ""}`}>
      <p className="pdx-met__rot">{rotulo}</p>
      <p className="pdx-met__val" style={alerta ? { color: "#B91C1C" } : undefined}>{valor}</p>
      {sub && <p className="pdx-met__sub">{sub}</p>}
    </div>
  );
}

// ⚠️ `apiKey` e `token` são COISAS DIFERENTES, e trocá-las foi o bug que derrubou
// este painel no primeiro uso em produção ("Invalid API key", 17/09):
//   apikey        -> a chave PUBLICÁVEL do projeto, igual pra todo mundo. É o que
//                    identifica o projeto no PostgREST.
//   Authorization -> o access_token da SESSÃO, que é quem diz qual usuário é.
// Mandar o token nos dois lugares faz o PostgREST rejeitar antes de chegar na RPC —
// nem dá tempo de a checagem de super_admin rodar.
//
// O resto do app nunca errou isso porque passa pelo helper `api()` do App.jsx. Este
// componente montava o header na mão, e foi só aqui que a diferença apareceu.
export default function PainelMetricas({ supabaseUrl, apiKey, token }) {
  const [m, setM] = useState(null);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      setErro("");
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/admin_metricas`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey, Authorization: `Bearer ${token}` },
          body: "{}",
        });
        const corpo = await res.json().catch(() => null);
        if (!vivo) return;
        if (!res.ok) {
          // 42501 é o `raise exception ... using errcode` da RPC pra quem não é
          // super_admin. Mensagem separada porque "sem permissão" e "função não
          // existe" pedem ações opostas: uma é conta errada, a outra é migration.
          const msg = String(corpo?.message || "");
          if (res.status === 404 || msg.includes("admin_metricas")) {
            setErro("A função `admin_metricas` ainda não existe no banco. Rode a migration 2026-09-17_admin_metricas.sql no SQL Editor.");
          } else if (msg.includes("acesso restrito") || res.status === 403) {
            setErro("Esta conta não é super_admin.");
          } else {
            setErro(msg || `Não consegui carregar (HTTP ${res.status}).`);
          }
          return;
        }
        setM(corpo);
      } catch (e) {
        if (vivo) setErro("Falha de rede ao carregar as métricas.");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [supabaseUrl, apiKey, token]);

  if (carregando) {
    return <p style={{ color: t.textSecondary, fontSize: "0.9rem" }}>Carregando…</p>;
  }
  if (erro) {
    return <><style>{CSS}</style><div className="pdx-met__erro">{erro}</div></>;
  }
  if (!m) return null;

  const cad = m.cadastros || {};
  const ativos = m.ativos || {};
  const planos = m.planos || {};
  const trial = m.trial || {};
  const zap = m.whatsapp || {};
  const lanc = m.lancamentos || {};
  const vendas = Array.isArray(m.ultimas_vendas) ? m.ultimas_vendas : [];

  // Conversão sobre CADASTROS, não sobre visitantes: o app não tem analytics de
  // visita, e inventar denominador é a forma mais fácil de um painel mentir.
  const conversao = cad.total > 0 ? (planos.pagantes / cad.total) * 100 : 0;

  return (
    <>
      <style>{CSS}</style>
      <div className="pdx-met">

        <div className="pdx-met__grade">
          <Card rotulo="Receita estimada" valor={fmtBRL(planos.mrr_estimado)} sub={`${fmtNum(planos.pagantes)} ${planos.pagantes === 1 ? "assinante" : "assinantes"} · por mês`} />
          <Card rotulo="Cadastros" valor={fmtNum(cad.total)} sub={`+${fmtNum(cad.sete_dias)} em 7 dias · +${fmtNum(cad.hoje)} hoje`} />
          <Card rotulo="Ativos (30 dias)" valor={fmtNum(ativos.trinta_dias)} sub={`${fmtNum(ativos.sete_dias)} nos últimos 7 dias`} />
          <Card rotulo="Conversão" valor={`${conversao.toFixed(1)}%`} sub="assinantes sobre cadastros" />
        </div>

        {/* O que exige ação vem ANTES do resto: painel que enterra problema no rodapé
            não serve pra nada. Some quando está tudo zerado. */}
        {(m.pendencias > 0 || zap.pagantes_sem_telefone > 0) && (
          <div className="pdx-met__grade">
            {m.pendencias > 0 && (
              <Card
                alerta
                rotulo="Pagou e não liberou"
                valor={fmtNum(m.pendencias)}
                sub="Em `pendencias_assinatura`. Precisa amarrar na mão."
              />
            )}
            {zap.pagantes_sem_telefone > 0 && (
              <Card
                alerta
                rotulo="Pagante sem WhatsApp"
                valor={fmtNum(zap.pagantes_sem_telefone)}
                sub="Paga o Essencial e o agente não reconhece o número. Some se não avisar."
              />
            )}
          </div>
        )}

        <div className="pdx-met__painel">
          <p className="pdx-met__secao">Planos</p>
          <div className="pdx-met__grade">
            <Card rotulo="Free" valor={fmtNum(planos.free)} />
            <Card rotulo="Essencial" valor={fmtNum(planos.essencial)} sub="R$ 29,90/mês" />
            <Card rotulo="Assistente" valor={fmtNum(planos.assistente)} sub="R$ 79,90/mês" />
            <Card rotulo="Casal" valor={fmtNum(planos.casal ?? 0)} sub="R$ 249,00/mês" />
          </div>
          <p className="pdx-met__nota">
            A receita é <strong>estimada</strong>: contagem × preço de tabela. Não desconta taxa da
            Cakto, não conhece cupom e não sabe de assinatura em atraso — serve pra tendência, não
            pra fechar caixa.
          </p>
        </div>

        <div className="pdx-met__painel">
          <p className="pdx-met__secao">Teste do WhatsApp</p>
          <div className="pdx-met__grade">
            <Card rotulo="Em teste agora" valor={fmtNum(trial.ativos)} />
            <Card rotulo="Converteram" valor={fmtNum(trial.converteram)} sub="testaram e assinaram" />
            <Card rotulo="Terminou sem assinar" valor={fmtNum(trial.expirados_sem_converter)} />
            <Card rotulo="Com WhatsApp no perfil" valor={fmtNum(zap.com_telefone)} sub={`de ${fmtNum(cad.total)} cadastros`} />
          </div>
        </div>

        <div className="pdx-met__painel">
          <p className="pdx-met__secao">Uso</p>
          <div className="pdx-met__grade">
            <Card rotulo="Lançamentos" valor={fmtNum(lanc.total)} sub={`${fmtNum(lanc.trinta_dias)} nos últimos 30 dias`} />
          </div>
          <p className="pdx-met__nota">
            "Ativo" é quem tem lançamento na janela — abrir o app não deixa rastro, e é de
            propósito: nunca houve telemetria de navegação aqui. A janela usa a data do gasto,
            então quem lança hoje uma despesa do mês passado conta no mês passado.
          </p>
        </div>

        <div className="pdx-met__painel">
          <p className="pdx-met__secao">Últimos eventos de cobrança</p>
          {vendas.length === 0 ? (
            <p style={{ margin: 0, fontSize: "0.88rem", color: t.textSecondary }}>Nenhum evento registrado ainda.</p>
          ) : (
            <table className="pdx-met__tab">
              <thead>
                <tr><th>Quando</th><th>E-mail</th><th>Plano</th><th>Resultado</th></tr>
              </thead>
              <tbody>
                {vendas.map((v, i) => (
                  <tr key={`${v.email}-${v.quando}-${i}`}>
                    <td>{fmtData(v.quando)}</td>
                    <td>{v.email || "—"}</td>
                    <td>{v.plano || "—"}</td>
                    <td>
                      <span className={`pdx-met__tag ${v.resultado === "aplicado" ? "pdx-met__tag--ok" : "pdx-met__tag--erro"}`}>
                        {v.resultado === "aplicado" ? "liberado" : "sem conta"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p className="pdx-met__nota">Números de {fmtData(m.gerado_em)}. Recarregue a página pra atualizar.</p>
      </div>
    </>
  );
}
