import { useEffect, useState } from "react";

const SUPABASE_URL = "https://sjvuhqqsjboncwpboclv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE";

const IPCA_ANUAL = 0.045;
const SPREAD_ANUAL = 0.045;
const TAXA_NOMINAL_ANUAL = (1 + IPCA_ANUAL) * (1 + SPREAD_ANUAL) - 1;
const MODO_PROJECAO = 'nominal';
const TAXA_ANUAL = MODO_PROJECAO === 'nominal' ? TAXA_NOMINAL_ANUAL : SPREAD_ANUAL;
const INFLACAO_ANUAL = MODO_PROJECAO === 'nominal' ? IPCA_ANUAL : 0;

const taxaMensal = (taxaAnual) => Math.pow(1 + taxaAnual, 1 / 12) - 1;
const i_mes = taxaMensal(TAXA_ANUAL);
const g_mes = taxaMensal(INFLACAO_ANUAL);

const formatPct = (decimal) => `${(decimal * 100).toFixed(2).replace('.', ',')}%`;

const sbApi = (token) => ({
  "Content-Type": "application/json",
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${token || SUPABASE_KEY}`,
});

function idadeAtual(dataNascimento) {
  if (!dataNascimento) return null;
  const hoje = new Date();
  const nasc = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
  return idade;
}

// Convenção: ANUIDADE ANTECIPADA (annuity due) — aporte/saque no início do mês.
// Todos os fatores PMT levam (1+i) extra vs. anuidade ordinária.

// 1. VF de uma anuidade com aporte crescente geometricamente (acumulação)
function vfAcumulacaoComGradiente(VP, PMT_inicial, n_meses, i, g) {
  const vfPrincipal = VP * Math.pow(1 + i, n_meses);
  if (Math.abs(i - g) < 1e-10) {
    return vfPrincipal + PMT_inicial * n_meses * Math.pow(1 + i, n_meses);
  }
  const fatorPMT = ((Math.pow(1 + i, n_meses) - Math.pow(1 + g, n_meses)) / (i - g)) * (1 + i);
  return vfPrincipal + PMT_inicial * fatorPMT;
}

// 2. PV de anuidade decrescente com saques crescendo geometricamente (Consumo Total)
function pvAnuidadeCrescente(PMT_inicial, n_meses, i, g) {
  if (Math.abs(i - g) < 1e-10) {
    return PMT_inicial * n_meses * (1 + i);
  }
  const razao = (1 + g) / (1 + i);
  return PMT_inicial * ((1 - Math.pow(razao, n_meses)) / (i - g)) * (1 + i);
}

// 3. PV de perpetuidade crescente (Preservação - Gordon antecipado)
function pvPerpetuidadeCrescente(PMT_inicial, i, g) {
  if (i <= g) {
    throw new Error('Taxa precisa ser maior que inflação para perpetuidade crescente');
  }
  return (PMT_inicial / (i - g)) * (1 + i);
}

// 4. Inverso da acumulação com aporte FIXO (XP usa aporte mínimo constante para Consumo/Preservação)
function pmtParaAtingirVF(VF_alvo, VP, n_meses, i) {
  const vfPrincipal = VP * Math.pow(1 + i, n_meses);
  const fatorPMT_plano = ((Math.pow(1 + i, n_meses) - 1) / i) * (1 + i);
  return (VF_alvo - vfPrincipal) / fatorPMT_plano;
}

function calcularProjecoes({ patrimonioAtual, aportesMensais, idadeInicio, idadeAposentadoria, expectativaVida, rendaMensalDesejada }) {
  const VP = patrimonioAtual;
  const nAcum = Math.max(0, (idadeAposentadoria - idadeInicio) * 12);
  const nDist = Math.max(0, (expectativaVida - idadeAposentadoria) * 12);
  const anosAteAposentadoria = Math.max(0, idadeAposentadoria - idadeInicio);

  // Renda desejada inflacionada até a aposentadoria (em modo real, INFLACAO_ANUAL=0 → noop)
  const rendaInflacionadaInicio = rendaMensalDesejada * Math.pow(1 + INFLACAO_ANUAL, anosAteAposentadoria);

  // Patrimônio projetado na aposentadoria com aportes crescendo a IPCA
  const patrimonioAtualNaAposentadoria = vfAcumulacaoComGradiente(VP, aportesMensais, nAcum, i_mes, g_mes);

  // Necessidade de capital na aposentadoria
  const pvConsumo = nDist > 0 ? pvAnuidadeCrescente(rendaInflacionadaInicio, nDist, i_mes, g_mes) : 0;
  const pvPreservacao = i_mes > g_mes ? pvPerpetuidadeCrescente(rendaInflacionadaInicio, i_mes, g_mes) : 0;

  // Aporte mensal CONSTANTE (não cresce com IPCA) necessário para atingir cada alvo
  const aporteConsumo = nAcum > 0 ? pmtParaAtingirVF(pvConsumo, VP, nAcum, i_mes) : 0;
  const aportePreservacao = nAcum > 0 ? pmtParaAtingirVF(pvPreservacao, VP, nAcum, i_mes) : 0;

  const ages = [];
  for (let a = idadeInicio; a <= expectativaVida; a++) ages.push(a);

  // Simulação mês a mês. aporteCresceComIpca=true → projeção real do usuário; false → aporte mínimo XP (fixo).
  // Saque na fase de retirada SEMPRE cresce com IPCA.
  function simular(aporteInicial, aporteCresceComIpca) {
    const vals = [];
    let pat = VP;
    let aporteCorrente = aporteInicial;
    let saqueCorrente = rendaInflacionadaInicio;
    for (const age of ages) {
      vals.push(pat);
      const acumulando = age < idadeAposentadoria;
      for (let m = 0; m < 12; m++) {
        if (acumulando) {
          pat = (pat + aporteCorrente) * (1 + i_mes);
          if (aporteCresceComIpca) aporteCorrente *= (1 + g_mes);
        } else {
          pat = (pat - saqueCorrente) * (1 + i_mes);
          if (pat < 0) pat = 0;
          saqueCorrente *= (1 + g_mes);
        }
      }
    }
    return vals;
  }

  const projecaoAtual = simular(aportesMensais, true);
  const consumoVals = simular(Math.max(0, aporteConsumo), false);
  const preservacaoVals = simular(Math.max(0, aportePreservacao), false);

  return {
    ages,
    projecaoAtual,
    consumoVals,
    preservacaoVals,
    aporteConsumo: Math.max(0, aporteConsumo),
    aportePreservacao: Math.max(0, aportePreservacao),
    pvConsumo,
    pvPreservacao,
    rendaInflacionadaInicio,
    patrimonioAtualNaAposentadoria,
  };
}

const chart = { width: 760, height: 420, marginTop: 24, marginRight: 20, marginBottom: 52, marginLeft: 72 };
const innerWidth = chart.width - chart.marginLeft - chart.marginRight;
const innerHeight = chart.height - chart.marginTop - chart.marginBottom;

function buildLinePath(values, ages, yMax) {
  if (!values.length) return "";
  const getX = (i) => chart.marginLeft + (i / (ages.length - 1)) * innerWidth;
  const getY = (v) => chart.marginTop + innerHeight - (Math.max(0, v) / yMax) * innerHeight;
  return values.map((v, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(1)} ${getY(v).toFixed(1)}`).join(" ");
}

function formatBRL(v) {
  return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatYAxis(v) {
  if (v === 0) return "R$ 0";
  if (v < 1_000_000) return `R$ ${Math.round(v / 1000)}K`;
  const m = v / 1_000_000;
  return Number.isInteger(m) ? `R$ ${m}M` : `R$ ${m.toFixed(1)}M`;
}

function ScenarioCard({ color, title, aporte, patrimonio, subtitle, highlighted = false }) {
  return (
    <div style={{ ...styles.scenarioCard, background: highlighted ? "#EFEFEF" : "#FFFFFF", borderColor: highlighted ? "#E2E2E2" : "#E5E7EB" }}>
      <div style={styles.scenarioHeader}>
        <div style={styles.scenarioTitleWrap}>
          <span style={{ ...styles.scenarioDot, background: color }} />
          <span style={styles.scenarioTitle}>{title}</span>
        </div>
        <span style={styles.infoIcon}>i</span>
      </div>
      <div style={styles.metricRow}>
        <span style={styles.metricLabel}>Capacidade de aporte medio</span>
        <span style={styles.metricValue}>{aporte}</span>
      </div>
      <div style={{ ...styles.metricRow, marginBottom: 0 }}>
        <span style={styles.metricLabel}>{subtitle}</span>
        <span style={styles.metricValue}>{patrimonio}</span>
      </div>
    </div>
  );
}

export default function DiagnosticoFP({ session }) {
  const userId = session?.user?.id;
  const token = session?.token;

  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState(null);

  useEffect(() => {
    if (!userId || !token) return;
    carregar();
  }, [userId, token]);

  async function carregar() {
    setLoading(true);
    try {
      const headers = sbApi(token);

      const [rObjetivos, rInvest, rRendas, rDespesas, rPerfil] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/fp_objetivos?user_id=eq.${userId}&categoria=eq.Aposentadoria&select=idade_atingimento,valor,expectativa_vida&limit=1`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/fp_investimentos?user_id=eq.${userId}&select=valor`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/fp_rendas?user_id=eq.${userId}&select=valor_bruto`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/fp_despesas?user_id=eq.${userId}&select=valor_bruto`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/fp_perfil?user_id=eq.${userId}&select=data_nascimento,expectativa_vida&limit=1`, { headers }),
      ]);

      const [dObj, dInvest, dRendas, dDespesas, dPerfil] = await Promise.all([
        rObjetivos.json(), rInvest.json(), rRendas.json(), rDespesas.json(), rPerfil.json(),
      ]);


      const obj = Array.isArray(dObj) && dObj.length > 0 ? dObj[0] : null;
      const perfil = Array.isArray(dPerfil) ? dPerfil[0] : null;

      const patrimonioAtual = Array.isArray(dInvest)
        ? dInvest.reduce((s, r) => s + Number(r.valor || 0), 0)
        : 0;

      const somaRendas = Array.isArray(dRendas)
        ? dRendas.reduce((s, r) => s + Number(r.valor_bruto || 0), 0)
        : 0;
      const somaDespesas = Array.isArray(dDespesas)
        ? dDespesas.reduce((s, r) => s + Number(r.valor_bruto || 0), 0)
        : 0;
      const aportesMensais = Math.max(0, somaRendas - somaDespesas);

      const idadeAposentadoria = Number(obj?.idade_atingimento) || 65;
      const rendaMensalDesejada = Number(obj?.valor) || 10000;
      const expectativaVida = Number(obj?.expectativa_vida) || Number(perfil?.expectativa_vida) || 90;
      const dataNasc = perfil?.data_nascimento || null;
      const idadeInicio = idadeAtual(dataNasc) ?? 35;

      setDados({
        patrimonioAtual,
        aportesMensais,
        idadeInicio,
        idadeAposentadoria,
        expectativaVida,
        rendaMensalDesejada,
        somaRendas,
        somaDespesas,
      });
    } catch (e) {
      console.error("[diagnostico] erro ao carregar:", e);
    }
    setLoading(false);
  }

  if (loading || !dados) {
    return <div style={{ padding: 40, textAlign: "center", color: "#888" }}>{loading ? "Carregando..." : "Sem dados suficientes para diagnóstico."}</div>;
  }

  const { patrimonioAtual, aportesMensais, idadeInicio, idadeAposentadoria, expectativaVida, rendaMensalDesejada, somaRendas, somaDespesas } = dados;

  const projecoes = calcularProjecoes({ patrimonioAtual, aportesMensais, idadeInicio, idadeAposentadoria, expectativaVida, rendaMensalDesejada });
  const { ages, projecaoAtual, consumoVals, preservacaoVals, aporteConsumo, aportePreservacao, pvConsumo, pvPreservacao, patrimonioAtualNaAposentadoria } = projecoes;

  const yMax = Math.ceil(Math.max(...projecaoAtual, ...preservacaoVals, pvPreservacao) * 1.15 / 500_000) * 500_000 || 3_500_000;
  const yTicks = Array.from({ length: 8 }, (_, i) => Math.round((yMax / 7) * i));

  const getX = (i) => chart.marginLeft + (i / Math.max(ages.length - 1, 1)) * innerWidth;
  const getY = (v) => chart.marginTop + innerHeight - (Math.max(0, v) / yMax) * innerHeight;

  const aposentadoriaIdx = ages.findIndex((a) => a >= idadeAposentadoria);
  const destaqueIdx = aposentadoriaIdx >= 0 ? aposentadoriaIdx : ages.length - 1;
  const destaqueX = getX(destaqueIdx);
  const destaqueY = getY(projecaoAtual[destaqueIdx] ?? 0);

  return (
    <div style={styles.shell}>
      <div style={styles.topRow}>
        <p style={styles.topTitle}>Diagnostico do planejamento</p>
        <button style={styles.filterButton}>Visualizar por: Ano</button>
      </div>

      <div style={styles.board}>
        <div style={styles.leftPanel}>
          <div style={styles.statusRow}>
            <span style={styles.statusDot} />
            <h2 style={styles.statusTitle}>Planejamento Adequado Consumo</h2>
          </div>

          <div style={styles.separator} />

          <p style={styles.description}>
            O planejamento atual projeta a evolução do patrimônio com base nos aportes reais, rendimentos de {(TAXA_ANUAL * 100).toFixed(2)}% a.a. e renda mensal desejada na aposentadoria.
          </p>

          <div style={styles.assumptions}>
            <div style={styles.assumptionRow}>
              <span style={styles.assumptionLabel}>Valor mensal da aposentadoria</span>
              <span style={styles.assumptionValue}>{formatBRL(rendaMensalDesejada)}</span>
            </div>
            <div style={styles.assumptionRow}>
              <span style={styles.assumptionLabel}>Retorno esperado</span>
              <span style={styles.assumptionValue}>{MODO_PROJECAO === 'nominal' ? `IPCA + ${formatPct(SPREAD_ANUAL)}` : `${formatPct(SPREAD_ANUAL)} real`}</span>
            </div>
            <div style={styles.assumptionRow}>
              <span style={styles.assumptionLabel}>Rentabilidade total</span>
              <span style={styles.assumptionValue}>{formatPct(TAXA_ANUAL)} a.a.</span>
            </div>
            <div style={styles.assumptionRow}>
              <span style={styles.assumptionLabel}>Inflação considerada</span>
              <span style={styles.assumptionValue}>{MODO_PROJECAO === 'nominal' ? `${formatPct(IPCA_ANUAL)} a.a.` : '0% (valor presente)'}</span>
            </div>
            <div style={styles.assumptionRow}>
              <span style={styles.assumptionLabel}>Patrimônio atual</span>
              <span style={styles.assumptionValue}>{formatBRL(patrimonioAtual)}</span>
            </div>
            <div style={styles.assumptionRow}>
              <span style={styles.assumptionLabel}>Capacidade de aporte atual</span>
              <span style={styles.assumptionValue}>{formatBRL(aportesMensais)}/mês</span>
            </div>
          </div>

          <div style={styles.scenarioList}>
            <ScenarioCard
              color="#19B36B"
              title="Planejamento atual"
              aporte={`${formatBRL(aportesMensais)}/mês`}
              patrimonio={formatBRL(patrimonioAtualNaAposentadoria)}
              subtitle={`Patrimônio projetado aos ${idadeAposentadoria} anos`}
              highlighted
            />
            <ScenarioCard
              color="#767676"
              title="Consumo total do patrimônio"
              aporte={`${formatBRL(aporteConsumo)}/mês`}
              patrimonio={formatBRL(pvConsumo)}
              subtitle={`Patrimônio mínimo aos ${idadeAposentadoria} anos`}
            />
            <ScenarioCard
              color="#111111"
              title="Preservação do patrimônio"
              aporte={`${formatBRL(aportePreservacao)}/mês`}
              patrimonio={formatBRL(pvPreservacao)}
              subtitle={`Patrimônio necessário aos ${idadeAposentadoria} anos`}
            />
          </div>
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.chartActions}>
            <button style={styles.resetButton}>Reset zoom</button>
          </div>

          <div style={styles.chartWrapper}>
            <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={styles.svg}>
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line x1={chart.marginLeft} y1={getY(tick)} x2={chart.width - chart.marginRight} y2={getY(tick)} stroke="#D9DEE8" strokeWidth="1" />
                  <text x={chart.marginLeft - 12} y={getY(tick) + 4} textAnchor="end" style={styles.axisText}>{formatYAxis(tick)}</text>
                </g>
              ))}

              <line x1={destaqueX} y1={chart.marginTop} x2={destaqueX} y2={chart.height - chart.marginBottom} stroke="#D2D7E2" strokeDasharray="4 4" strokeWidth="1.5" />

              <path d={buildLinePath(projecaoAtual, ages, yMax)} fill="none" stroke="#19B36B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d={buildLinePath(consumoVals, ages, yMax)} fill="none" stroke="#7A7A7A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d={buildLinePath(preservacaoVals, ages, yMax)} fill="none" stroke="#111111" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

              {projecaoAtual.filter((_, i) => i % 5 === 0 || i === destaqueIdx).map((v, _, arr) => {
                const realIdx = projecaoAtual.indexOf(v);
                return <circle key={`a-${realIdx}`} cx={getX(realIdx)} cy={getY(v)} r="2.7" fill="#19B36B" />;
              })}

              <circle cx={destaqueX} cy={destaqueY} r="8" fill="#2E2E2E" opacity="0.95" />
              <text x={destaqueX} y={destaqueY + 3} textAnchor="middle" style={styles.focusText}>1</text>

              {ages.map((age, index) => {
                if (index % 5 !== 0 && age !== idadeAposentadoria && age !== expectativaVida) return null;
                return (
                  <text key={age} x={getX(index)} y={chart.height - chart.marginBottom + 28} textAnchor="middle" style={styles.axisText}>
                    {age}
                  </text>
                );
              })}
            </svg>

            <div style={styles.tooltip}>
              <p style={styles.tooltipTitle}>Projeção na aposentadoria ({idadeAposentadoria} anos)</p>
              <p style={styles.tooltipValues}>
                Atual: {formatBRL(projecaoAtual[destaqueIdx] ?? 0)}{"\n"}
                Preservação: {formatBRL(preservacaoVals[destaqueIdx] ?? 0)}{"\n"}
                Consumo: {formatBRL(consumoVals[destaqueIdx] ?? 0)}
              </p>
              <p style={styles.tooltipAge}>Idade</p>
              <p style={styles.tooltipAgeValue}>{idadeAposentadoria}</p>
            </div>
          </div>

          <div style={styles.miniTrack}>
            <div style={styles.miniTrackFill} />
          </div>

          <div style={styles.legend}>
            <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#19B36B" }} />Projeção Atual</div>
            <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#111111" }} />Preservação do Patrimônio</div>
            <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#7A7A7A" }} />Consumo do Patrimônio</div>
            <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#3A3A3A", boxShadow: "0 0 0 4px rgba(0,0,0,0.12)" }} />Aposentadoria</div>
          </div>

          <div style={styles.legendNote}>
            <span style={styles.legendInfo}>i</span>
            Clique na legenda acima para habilitar ou desabilitar alguma informação do gráfico de projeção
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  shell: { display: "grid", gap: "0.8rem" },
  topRow: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" },
  topTitle: { margin: 0, fontSize: "0.95rem", color: "#D6D9E0", fontWeight: 500 },
  filterButton: { border: "none", borderRadius: "999px", background: "#111111", color: "#FFFFFF", padding: "0.55rem 0.9rem", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  board: { background: "#181B24", borderRadius: "18px", border: "1px solid #252832", padding: "1.2rem 1.1rem", display: "grid", gridTemplateColumns: "1fr", gap: "1rem" },
  leftPanel: { display: "grid", alignContent: "start", gap: "1rem" },
  statusRow: { display: "flex", alignItems: "center", gap: "0.7rem" },
  statusDot: { width: "12px", height: "12px", borderRadius: "999px", background: "#19B36B", flexShrink: 0 },
  statusTitle: { margin: 0, fontSize: "1.05rem", fontWeight: 500, color: "#F0F0F0" },
  separator: { width: "100%", height: "1px", background: "#2B3140" },
  description: { margin: 0, fontSize: "0.92rem", color: "#B4BCC9", lineHeight: 1.55 },
  assumptions: { display: "grid", gap: "0.45rem" },
  assumptionRow: { display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" },
  assumptionLabel: { fontSize: "0.8rem", color: "#A7AFBC" },
  assumptionValue: { fontSize: "0.82rem", color: "#D49A4F", fontWeight: 700, textAlign: "right" },
  scenarioList: { display: "grid", gap: "0.85rem" },
  scenarioCard: { border: "1px solid #252832", borderRadius: "12px", padding: "0.95rem 1rem", boxShadow: "0 1px 2px rgba(0,0,0,0.16)" },
  scenarioHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.9rem" },
  scenarioTitleWrap: { display: "flex", alignItems: "center", gap: "0.7rem" },
  scenarioDot: { width: "12px", height: "12px", borderRadius: "999px", flexShrink: 0 },
  scenarioTitle: { fontSize: "0.92rem", color: "#0F172A", fontWeight: 500 },
  infoIcon: { width: "18px", height: "18px", borderRadius: "999px", border: "1px solid #8B909B", color: "#C9CFDA", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, flexShrink: 0 },
  metricRow: { display: "flex", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.55rem", alignItems: "center" },
  metricLabel: { fontSize: "0.77rem", color: "#64748B" },
  metricValue: { fontSize: "0.8rem", color: "#111827", fontWeight: 700, textAlign: "right" },
  rightPanel: { minWidth: 0, display: "grid", gap: "0.55rem" },
  chartActions: { display: "flex", justifyContent: "flex-end", marginBottom: "0.15rem" },
  resetButton: { border: "none", background: "#FFC700", color: "#111111", padding: "0.75rem 1.35rem", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  chartWrapper: { position: "relative", overflowX: "auto", background: "#10131A", border: "1px solid #252832", borderRadius: "14px", padding: "0.45rem" },
  svg: { width: "100%", minWidth: "640px", height: "auto", display: "block" },
  axisText: { fontSize: "12px", fill: "#8B909B", fontWeight: 500 },
  focusText: { fontSize: "11px", fill: "#FFFFFF", fontWeight: 700 },
  tooltip: { position: "absolute", left: "50%", top: "49%", transform: "translateX(-50%)", background: "#0B0B0B", color: "#FFFFFF", borderRadius: "12px", padding: "0.95rem 1rem", width: "310px", maxWidth: "calc(100% - 24px)", boxShadow: "0 12px 24px rgba(0,0,0,0.18)", whiteSpace: "pre-line" },
  tooltipTitle: { margin: "0 0 0.45rem", fontSize: "0.88rem", fontWeight: 700 },
  tooltipValues: { margin: "0 0 0.7rem", fontSize: "0.8rem", lineHeight: 1.45, fontWeight: 700 },
  tooltipAge: { margin: 0, fontSize: "0.78rem", opacity: 0.8 },
  tooltipAgeValue: { margin: "0.1rem 0 0", fontSize: "1rem", fontWeight: 700 },
  miniTrack: { height: "24px", background: "#1B2230", marginTop: "0.15rem", position: "relative", overflow: "hidden", borderRadius: "8px" },
  miniTrackFill: { position: "absolute", left: "2%", right: "2%", top: "7px", height: "10px", borderRadius: "10px", background: "linear-gradient(90deg, #2E3953 0%, #425071 100%)" },
  legend: { display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap", marginTop: "1rem" },
  legendItem: { display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.75rem", color: "#B4BCC9", fontWeight: 600 },
  legendDot: { width: "11px", height: "11px", borderRadius: "999px", display: "inline-block", flexShrink: 0 },
  legendNote: { display: "flex", justifyContent: "center", alignItems: "center", gap: "0.55rem", marginTop: "1rem", fontSize: "0.75rem", color: "#8B909B", textAlign: "center" },
  legendInfo: { width: "16px", height: "16px", borderRadius: "999px", border: "1px solid #8B909B", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700, color: "#C9CFDA", flexShrink: 0 },
};
