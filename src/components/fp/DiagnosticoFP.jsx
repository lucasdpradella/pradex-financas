import { useEffect, useState } from "react";

const SUPABASE_URL = "https://sjvuhqqsjboncwpboclv.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE";

const IPCA_ANUAL = 0.045;
// Taxa real DEFAULT. 4,5% e o valor com que a matematica foi validada contra a XP
// (gap < 0,4%), entao ele e o ponto de partida e o "voltar ao padrao" — nao um chute.
const SPREAD_PADRAO = 0.045;
const SPREAD_MIN = 0;
const SPREAD_MAX = 0.20;      // acima disso nao e projecao, e fantasia
const CHAVE_TAXA = "pdx_taxa_real";

// Persistencia POR DISPOSITIVO, de proposito provisorio: a casa certa desta
// preferencia e uma coluna em fp_perfil, o que exige migration. Enquanto isso, o
// localStorage evita o pior — que e a taxa voltar pro padrao toda visita e a pessoa
// achar que o app ignorou ela.
const lerTaxaSalva = () => {
  try {
    const v = Number(localStorage.getItem(CHAVE_TAXA));
    return Number.isFinite(v) && v >= SPREAD_MIN && v <= SPREAD_MAX ? v : SPREAD_PADRAO;
  } catch { return SPREAD_PADRAO; }
};
const nominalDe = (spread) => (1 + IPCA_ANUAL) * (1 + spread) - 1;

const taxaMensal = (taxaAnual) => Math.pow(1 + taxaAnual, 1 / 12) - 1;

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
// Convenção XP: anuidade ordinária na retirada (saque no fim do mês) — sem (1+i) extra.
function pvAnuidadeCrescente(PMT_inicial, n_meses, i, g) {
  if (Math.abs(i - g) < 1e-10) {
    return PMT_inicial * n_meses;
  }
  const razao = (1 + g) / (1 + i);
  return PMT_inicial * ((1 - Math.pow(razao, n_meses)) / (i - g));
}

// 3. PV de perpetuidade crescente (Preservação - Gordon ordinária)
function pvPerpetuidadeCrescente(PMT_inicial, i, g) {
  if (i <= g) {
    throw new Error('Taxa precisa ser maior que inflação para perpetuidade crescente');
  }
  return PMT_inicial / (i - g);
}

// 4. Inverso da acumulação com aporte FIXO (XP usa aporte mínimo constante para Consumo/Preservação)
function pmtParaAtingirVF(VF_alvo, VP, n_meses, i) {
  const vfPrincipal = VP * Math.pow(1 + i, n_meses);
  const fatorPMT_plano = ((Math.pow(1 + i, n_meses) - 1) / i) * (1 + i);
  return (VF_alvo - vfPrincipal) / fatorPMT_plano;
}

function calcularProjecoes({
  patrimonioAtual,
  aportesMensais,
  idadeInicio,
  idadeAposentadoria,
  expectativaVida,
  rendaMensalDesejada,
  i_mes,
  g_mes,
  INFLACAO_ANUAL,
}) {
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
          pat = pat * (1 + i_mes) - saqueCorrente;
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

  // IDADE EM QUE O DINHEIRO ACABA — o numero da capa.
  //
  // `simular` empurra o saldo do INICIO de cada idade e trava em 0 quando zera, entao
  // o primeiro indice com 0 depois da aposentadoria e o ano em que acabou. null quando
  // o dinheiro passa da expectativa de vida.
  //
  // Trocamos "patrimonio projetado" por isto porque ninguem sente R$ 1,4 milhao; sente
  // "acaba aos 78". E 78 contra 90 e uma conta que dispensa legenda.
  let idadeAcaba = null;
  for (let k = 0; k < ages.length; k++) {
    if (ages[k] <= idadeAposentadoria) continue;
    if (projecaoAtual[k] <= 0.005) { idadeAcaba = ages[k]; break; }
  }

  // Aporte que falta pra durar ate a expectativa. O alvo padrao e "durar ate os N",
  // nao "viver de renda": brasileiro comum nao esta otimizando heranca.
  const faltaPorMes = Math.max(0, aporteConsumo - aportesMensais);

  return {
    ages,
    idadeAcaba,
    faltaPorMes,
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

// Card CLARO dentro de uma tela escura — a paleta do app escuro não se aplica aqui.
// A migração de 11/09 mapeou #EFEFEF e #E2E2E2 pro mesmo tom e a borda do estado
// destacado sumiu contra o próprio fundo. Valores originais restaurados.
function ScenarioCard({ color, title, aporte, patrimonio, subtitle, highlighted = false }) {
  return (
    <div style={{ ...styles.scenarioCard, background: highlighted ? "var(--surface2, #1E2330)" : "var(--surface, #151821)", borderColor: highlighted ? "#3A4258" : "var(--border, #2C3344)" }}>
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
  const [hoverIdx, setHoverIdx] = useState(null);
  const [modoProjecao, setModoProjecao] = useState('valor_presente');
  const [spread, setSpread] = useState(lerTaxaSalva);
  const [editandoTaxa, setEditandoTaxa] = useState(false);
  const [mostrarPerpetuidade, setMostrarPerpetuidade] = useState(false);

  const aplicarTaxa = (valorPct) => {
    const n = Number(String(valorPct).replace(",", "."));
    if (!Number.isFinite(n)) return;
    const dec = Math.min(SPREAD_MAX, Math.max(SPREAD_MIN, n / 100));
    setSpread(dec);
    try { localStorage.setItem(CHAVE_TAXA, String(dec)); } catch {}
  };

  const TAXA_ANUAL = modoProjecao === 'nominal' ? nominalDe(spread) : spread;
  const INFLACAO_ANUAL = modoProjecao === 'nominal' ? IPCA_ANUAL : 0;
  const i_mes = taxaMensal(TAXA_ANUAL);
  const g_mes = taxaMensal(INFLACAO_ANUAL);

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
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary, #8B93A1)" }}>{loading ? "Carregando..." : "Sem dados suficientes para diagnóstico."}</div>;
  }

  const { patrimonioAtual, aportesMensais, idadeInicio, idadeAposentadoria, expectativaVida, rendaMensalDesejada, somaRendas, somaDespesas } = dados;

  const projecoes = calcularProjecoes({ patrimonioAtual, aportesMensais, idadeInicio, idadeAposentadoria, expectativaVida, rendaMensalDesejada, i_mes, g_mes, INFLACAO_ANUAL });
  const { ages, idadeAcaba, faltaPorMes, projecaoAtual, consumoVals, preservacaoVals, aporteConsumo, aportePreservacao, pvConsumo, pvPreservacao, patrimonioAtualNaAposentadoria } = projecoes;

  const yMaxBase = Math.max(patrimonioAtualNaAposentadoria, pvPreservacao, pvConsumo);
  const yMax = Math.ceil(yMaxBase * 1.25 / 500_000) * 500_000 || 3_500_000;
  const yTicks = Array.from({ length: 8 }, (_, i) => Math.round((yMax / 7) * i));

  const getX = (i) => chart.marginLeft + (i / Math.max(ages.length - 1, 1)) * innerWidth;
  const getY = (v) => chart.marginTop + innerHeight - (Math.max(0, v) / yMax) * innerHeight;

  const aposentadoriaIdx = ages.findIndex((a) => a >= idadeAposentadoria);
  const destaqueIdx = aposentadoriaIdx >= 0 ? aposentadoriaIdx : ages.length - 1;
  const destaqueX = getX(destaqueIdx);
  const destaqueY = getY(projecaoAtual[destaqueIdx] ?? 0);

  const tooltipIdx = hoverIdx ?? destaqueIdx;
  const tooltipLeft = hoverIdx !== null ? `${(getX(hoverIdx) / chart.width) * 100}%` : '50%';

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width;
    const xInChart = (xPct * chart.width - chart.marginLeft) / (chart.width - chart.marginLeft - chart.marginRight);
    if (xInChart < 0 || xInChart > 1) {
      setHoverIdx(null);
      return;
    }
    const idx = Math.round(xInChart * (ages.length - 1));
    setHoverIdx(Math.max(0, Math.min(ages.length - 1, idx)));
  };

  const handleMouseLeave = () => setHoverIdx(null);

  return (
    <div style={styles.shell}>
      <div style={styles.topRow}>
        <p style={styles.topTitle}>Diagnóstico do planejamento</p>
        <div style={styles.topControls}>
          <div style={styles.toggleGroup} role="group" aria-label="Modo de projeção">
            <button
              type="button"
              onClick={() => setModoProjecao('valor_presente')}
              style={{
                ...styles.toggleButton,
                ...(modoProjecao === 'valor_presente' ? styles.toggleButtonActive : {}),
              }}
            >
              Valor Presente
            </button>
            <button
              type="button"
              onClick={() => setModoProjecao('nominal')}
              style={{
                ...styles.toggleButton,
                ...(modoProjecao === 'nominal' ? styles.toggleButtonActive : {}),
              }}
            >
              Nominal
            </button>
          </div>
          <button style={styles.filterButton}>Visualizar por: Ano</button>
        </div>
      </div>

      {/* VEREDITO — o primeiro bloco da tela.
          Responde "vai dar?" antes de "quanto". A pergunta que a pessoa traz e essa;
          patrimonio projetado e resposta de assessor pra pergunta que ela nao fez. */}
      <div style={styles.veredito}>
        <span style={{ ...styles.vereditoSelo, background: idadeAcaba ? "#E06C6518" : "#2FBF8A18", color: idadeAcaba ? "#E06C65" : "#2FBF8A" }}>
          {idadeAcaba ? "Não chega" : "Chega"}
        </span>
        {idadeAcaba ? (
          <>
            <p style={styles.vereditoFrase}>
              No seu ritmo, o dinheiro acaba aos <strong style={styles.vereditoNumero}>{idadeAcaba}</strong>.
            </p>
            <p style={styles.vereditoSub}>
              São {expectativaVida - idadeAcaba} {expectativaVida - idadeAcaba === 1 ? "ano descoberto" : "anos descobertos"} até os {expectativaVida}.
            </p>
            {faltaPorMes > 0 && (
              <div style={styles.vereditoAcao}>
                <span style={styles.vereditoAcaoLabel}>Pra durar até os {expectativaVida}</span>
                <span style={styles.vereditoAcaoValor}>+{formatBRL(faltaPorMes)} por mês</span>
              </div>
            )}
          </>
        ) : (
          <>
            <p style={styles.vereditoFrase}>
              No seu ritmo, o dinheiro passa dos <strong style={styles.vereditoNumero}>{expectativaVida}</strong>.
            </p>
            <p style={styles.vereditoSub}>Pode manter o aporte de {formatBRL(aportesMensais)} por mês.</p>
          </>
        )}
      </div>

      {/* O QUE O NUMERO GRANDE VALE DE VERDADE (ideia do PRADELLA).
          "No futuro tera 1 milhao, e desse 1 milhao equivalera a 700 mil, porque 30%
          sera inflacao." Em vez de um toggle Nominal/Real que obriga a pessoa a
          escolher entre dois numeros sem saber a diferenca, mostra os DOIS de uma vez:
          a barra cheia e o nominal, a parte preenchida e o poder de compra de hoje.
          O toggle continua existindo pro grafico; isto aqui e a explicacao. */}
      {(() => {
        const anos = Math.max(0, idadeAposentadoria - idadeInicio);
        const fator = Math.pow(1 + IPCA_ANUAL, anos);
        const emModoNominal = modoProjecao === "nominal";
        const nominal = emModoNominal ? patrimonioAtualNaAposentadoria : patrimonioAtualNaAposentadoria * fator;
        const real = emModoNominal ? patrimonioAtualNaAposentadoria / fator : patrimonioAtualNaAposentadoria;
        if (!(nominal > 0)) return null;
        const pct = Math.max(4, Math.min(100, (real / nominal) * 100));
        const perdaPct = Math.round(100 - pct);
        return (
          <div style={styles.inflaCard}>
            <p style={styles.inflaTopo}>Aos {idadeAposentadoria} você terá</p>
            <p style={styles.inflaNominal}>{formatBRL(nominal)}</p>
            <div style={styles.inflaTrack}>
              <div style={{ ...styles.inflaFill, width: `${pct}%` }} />
            </div>
            <p style={styles.inflaLegenda}>
              Compra o que <strong style={{ color: "var(--text-primary, #F1F2F4)" }}>{formatBRL(real)}</strong> compram hoje.
              A inflação come {perdaPct}% em {anos} {anos === 1 ? "ano" : "anos"}.
            </p>
          </div>
        );
      })()}

      <div style={styles.board}>
        <div style={styles.leftPanel}>
          <div style={styles.statusRow}>
            <span style={styles.statusDot} />
            <h2 style={styles.statusTitle}>Sua projeção</h2>
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
              {editandoTaxa ? (
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <input
                    autoFocus
                    inputMode="decimal"
                    defaultValue={(spread * 100).toFixed(2).replace(".", ",")}
                    onBlur={(e) => { aplicarTaxa(e.target.value); setEditandoTaxa(false); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { aplicarTaxa(e.target.value); setEditandoTaxa(false); } if (e.key === "Escape") setEditandoTaxa(false); }}
                    aria-label="Retorno real esperado ao ano, em porcento"
                    style={{ width: "72px", textAlign: "right", background: "var(--input-bg, #0C0E14)", color: "var(--text-primary, #F1F2F4)", border: "1px solid var(--accent, #6366F1)", borderRadius: 6, padding: "4px 6px", fontSize: "0.8rem", fontFamily: "inherit", outline: "none" }}
                  />
                  <span style={styles.assumptionLabel}>% a.a.</span>
                </span>
              ) : (
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={styles.assumptionValue}>{modoProjecao === 'nominal' ? `IPCA + ${formatPct(spread)}` : `${formatPct(spread)} real`}</span>
                  <button
                    type="button"
                    onClick={() => setEditandoTaxa(true)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--accent, #6366F1)", fontSize: "0.72rem", fontWeight: 600, fontFamily: "inherit" }}
                  >
                    editar
                  </button>
                  {Math.abs(spread - SPREAD_PADRAO) > 1e-9 && (
                    <button
                      type="button"
                      onClick={() => aplicarTaxa(SPREAD_PADRAO * 100)}
                      title="Voltar pra 4,50%, a taxa com que a conta foi validada"
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-muted, #5C6570)", fontSize: "0.72rem", fontFamily: "inherit" }}
                    >
                      padrão
                    </button>
                  )}
                </span>
              )}
            </div>
            {Math.abs(spread - SPREAD_PADRAO) > 1e-9 && (
              <p style={{ margin: 0, fontSize: "0.72rem", color: "var(--text-muted, #5C6570)", lineHeight: 1.4 }}>
                Taxa alterada por você. A conta foi validada com 4,50% real — mudar aqui muda a projeção, não o retorno.
              </p>
            )}
            <div style={styles.assumptionRow}>
              <span style={styles.assumptionLabel}>Rentabilidade total</span>
              <span style={styles.assumptionValue}>{formatPct(TAXA_ANUAL)} a.a.</span>
            </div>
            <div style={styles.assumptionRow}>
              <span style={styles.assumptionLabel}>Inflação considerada</span>
              <span style={styles.assumptionValue}>{modoProjecao === 'nominal' ? `${formatPct(IPCA_ANUAL)} a.a.` : '0% (valor presente)'}</span>
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
              color="#2FBF8A"
              title="Planejamento atual"
              aporte={`${formatBRL(aportesMensais)}/mês`}
              patrimonio={formatBRL(patrimonioAtualNaAposentadoria)}
              subtitle={`Patrimônio projetado aos ${idadeAposentadoria} anos`}
              highlighted
            />
            {/* O ALVO PADRAO e um so: durar ate a expectativa. Brasileiro comum nao
                esta otimizando heranca — esta perguntando se aposenta. */}
            <ScenarioCard
              color="#8B93A1"
              title={`Durar até os ${expectativaVida}`}
              aporte={`${formatBRL(aporteConsumo)}/mês`}
              patrimonio={formatBRL(pvConsumo)}
              subtitle="O dinheiro chega no fim e zera"
            />

            {/* "Nunca zerar" e UPGRADE, nao terceiro igual. Tres cards lado a lado
                empatavam a projecao DELA com dois cenarios hipoteticos — foi isso que
                o PRADELLA chamou de confuso. Quem quer, pede. */}
            {mostrarPerpetuidade ? (
              <ScenarioCard
                color="var(--text-secondary, #8B93A1)"
                title="Nunca zerar"
                aporte={`${formatBRL(aportePreservacao)}/mês`}
                patrimonio={formatBRL(pvPreservacao)}
                subtitle="Você vive do rendimento e o que já juntou fica"
              />
            ) : (
              <button
                type="button"
                onClick={() => setMostrarPerpetuidade(true)}
                style={{ background: "none", border: "none", padding: "0.4rem 0", textAlign: "left", cursor: "pointer", color: "var(--accent, #6366F1)", fontSize: "0.8rem", fontWeight: 600, fontFamily: "inherit" }}
              >
                E se eu quiser que o dinheiro não acabe nunca?
              </button>
            )}
          </div>
        </div>

        <div style={styles.rightPanel}>
          <div style={styles.chartActions}>
            <button style={styles.resetButton}>Reset zoom</button>
          </div>

          <div style={styles.chartWrapper}>
            <svg viewBox={`0 0 ${chart.width} ${chart.height}`} style={styles.svg} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line x1={chart.marginLeft} y1={getY(tick)} x2={chart.width - chart.marginRight} y2={getY(tick)} stroke="#D9DEE8" strokeWidth="1" />
                  <text x={chart.marginLeft - 12} y={getY(tick) + 4} textAnchor="end" style={styles.axisText}>{formatYAxis(tick)}</text>
                </g>
              ))}

              <line x1={destaqueX} y1={chart.marginTop} x2={destaqueX} y2={chart.height - chart.marginBottom} stroke="#8B93A1" strokeDasharray="4 4" strokeWidth="1.5" />

              {hoverIdx !== null && (
                <line
                  x1={getX(hoverIdx)} y1={chart.marginTop}
                  x2={getX(hoverIdx)} y2={chart.height - chart.marginBottom}
                  stroke="#8B93A1" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="2 2"
                />
              )}

              <path d={buildLinePath(projecaoAtual, ages, yMax)} fill="none" stroke="#2FBF8A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <path d={buildLinePath(consumoVals, ages, yMax)} fill="none" stroke="#8B93A1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d={buildLinePath(preservacaoVals, ages, yMax)} fill="none" stroke="#0C0E14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

              {projecaoAtual.filter((_, i) => i % 5 === 0 || i === destaqueIdx).map((v, _, arr) => {
                const realIdx = projecaoAtual.indexOf(v);
                return <circle key={`a-${realIdx}`} cx={getX(realIdx)} cy={getY(v)} r="2.7" fill="#2FBF8A" />;
              })}

              <circle cx={destaqueX} cy={destaqueY} r="8" fill="#1E2330" opacity="0.95" />
              <text x={destaqueX} y={destaqueY + 3} textAnchor="middle" style={styles.focusText}>1</text>

              {ages.map((age, index) => {
                const isMultiploDe5 = index % 5 === 0;
                const isAposentadoria = age === idadeAposentadoria;
                const isExpectativa = age === expectativaVida;
                const proximoDoFinal = isMultiploDe5 && (expectativaVida - age) < 3;
                if (!isMultiploDe5 && !isAposentadoria && !isExpectativa) return null;
                if (proximoDoFinal && !isAposentadoria && !isExpectativa) return null;
                return (
                  <text key={age} x={getX(index)} y={chart.height - chart.marginBottom + 28} textAnchor="middle" style={styles.axisText}>
                    {age}
                  </text>
                );
              })}
            </svg>

            {hoverIdx !== null && (
              <div style={{ ...styles.tooltip, left: tooltipLeft, transform: 'translateX(-50%)' }}>
                <p style={styles.tooltipTitle}>Projeção aos {ages[tooltipIdx]} anos</p>
                <p style={styles.tooltipValues}>
                  Atual: {formatBRL(projecaoAtual[tooltipIdx] ?? 0)}{"\n"}
                  Preservação: {formatBRL(preservacaoVals[tooltipIdx] ?? 0)}{"\n"}
                  Consumo: {formatBRL(consumoVals[tooltipIdx] ?? 0)}
                </p>
                <p style={styles.tooltipAge}>Idade</p>
                <p style={styles.tooltipAgeValue}>{ages[tooltipIdx]}</p>
              </div>
            )}
          </div>

          <div style={styles.miniTrack}>
            <div style={styles.miniTrackFill} />
          </div>

          <div style={styles.legend}>
            <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#2FBF8A" }} />Projeção Atual</div>
            <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: "var(--input-bg, #0C0E14)" }} />Nunca zerar</div>
            <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: "#8B93A1" }} />Durar até o fim</div>
            <div style={styles.legendItem}><span style={{ ...styles.legendDot, background: "var(--surface2, #1E2330)", boxShadow: "0 0 0 4px rgba(0,0,0,0.12)" }} />Aposentadoria</div>
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
  topControls: { display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" },
  toggleGroup: { display: "inline-flex", borderRadius: "999px", background: "var(--input-bg, #0C0E14)", padding: "3px" },
  toggleButton: {
    border: "none",
    background: "transparent",
    color: "var(--text-secondary, #8B93A1)",
    padding: "0.45rem 0.85rem",
    fontSize: "0.78rem",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    borderRadius: "999px",
    transition: "background 0.15s, color 0.15s",
  },
  toggleButtonActive: { background: "#FFFFFF", color: "#0C0E14" },
  filterButton: { border: "none", borderRadius: "999px", background: "var(--input-bg, #0C0E14)", color: "#FFFFFF", padding: "0.55rem 0.9rem", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  // O grafico e o coracao da tela e vinha DEPOIS de status, descricao, seis premissas
  // e tres cards de cenario. `order` inverte a leitura sem mexer no JSX.
  veredito: { background: "var(--surface, #151821)", border: "1px solid var(--border, #1E2330)", borderRadius: "18px", padding: "1.3rem 1.2rem", marginBottom: "1rem", display: "grid", gap: "0.4rem", justifyItems: "start" },
  vereditoSelo: { fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", padding: "4px 10px", borderRadius: "999px" },
  vereditoFrase: { margin: "0.3rem 0 0", fontSize: "1.05rem", color: "var(--text-primary, #F1F2F4)", lineHeight: 1.35 },
  // 34/600 e o degrau de "numero heroi" da escala do app. A idade e o unico numero
  // grande da tela de proposito — dois herois nao sao heroi nenhum.
  vereditoNumero: { fontSize: "2.1rem", fontWeight: 600, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" },
  vereditoSub: { margin: 0, fontSize: "0.82rem", color: "var(--text-secondary, #8B93A1)" },
  vereditoAcao: { marginTop: "0.7rem", display: "flex", alignItems: "baseline", gap: "0.6rem", flexWrap: "wrap", padding: "0.65rem 0.9rem", borderRadius: "10px", background: "var(--surface2, #1E2330)" },
  vereditoAcaoLabel: { fontSize: "0.78rem", color: "var(--text-secondary, #8B93A1)" },
  vereditoAcaoValor: { fontSize: "1rem", fontWeight: 700, color: "var(--accent, #6366F1)", fontVariantNumeric: "tabular-nums" },
  inflaCard: { background: "var(--surface, #151821)", border: "1px solid var(--border, #1E2330)", borderRadius: "18px", padding: "1.1rem 1.2rem", marginBottom: "1rem" },
  inflaTopo: { margin: 0, fontSize: "0.7rem", color: "var(--text-secondary, #8B93A1)", textTransform: "uppercase", letterSpacing: "0.1em" },
  inflaNominal: { margin: "0.2rem 0 0.7rem", fontSize: "1.5rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary, #F1F2F4)", fontVariantNumeric: "tabular-nums" },
  inflaTrack: { height: "10px", borderRadius: "999px", background: "var(--surface2, #1E2330)", overflow: "hidden" },
  // A parte cheia e o poder de compra REAL; o vazio a direita e a inflacao. O olho
  // le "quanto disso e meu de verdade" sem precisar de legenda de cor.
  inflaFill: { height: "100%", borderRadius: "999px", background: "#2FBF8A", transition: "width .3s" },
  inflaLegenda: { margin: "0.55rem 0 0", fontSize: "0.78rem", color: "var(--text-secondary, #8B93A1)", lineHeight: 1.45 },
  board: { background: "var(--surface, #151821)", borderRadius: "18px", border: "1px solid #1E2330", padding: "1.2rem 1.1rem", display: "grid", gridTemplateColumns: "1fr", gap: "1rem" },
  leftPanel: { display: "grid", alignContent: "start", gap: "1rem", order: 2 },
  statusRow: { display: "flex", alignItems: "center", gap: "0.7rem" },
  statusDot: { width: "12px", height: "12px", borderRadius: "999px", background: "#2FBF8A", flexShrink: 0 },
  statusTitle: { margin: 0, fontSize: "1.35rem", fontWeight: 600, letterSpacing: "-0.02em", color: "var(--text-primary, #F1F2F4)" },
  separator: { width: "100%", height: "1px", background: "var(--surface2, #1E2330)" },
  description: { margin: 0, fontSize: "0.92rem", color: "var(--text-secondary, #8B93A1)", lineHeight: 1.55 },
  assumptions: { display: "grid", gap: "0.45rem" },
  assumptionRow: { display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" },
  assumptionLabel: { fontSize: "0.8rem", color: "var(--text-secondary, #8B93A1)" },
  assumptionValue: { fontSize: "0.8rem", color: "var(--text-primary, #F1F2F4)", fontWeight: 500, textAlign: "right", fontVariantNumeric: "tabular-nums" },
  scenarioList: { display: "grid", gap: "0.85rem" },
  scenarioCard: { border: "1px solid #1E2330", borderRadius: "12px", padding: "0.95rem 1rem", boxShadow: "0 1px 2px rgba(0,0,0,0.16)" },
  scenarioHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.9rem" },
  scenarioTitleWrap: { display: "flex", alignItems: "center", gap: "0.7rem" },
  scenarioDot: { width: "12px", height: "12px", borderRadius: "999px", flexShrink: 0 },
  scenarioTitle: { fontSize: "0.92rem", color: "var(--text-primary, #F1F2F4)", fontWeight: 500 },
  infoIcon: { width: "18px", height: "18px", borderRadius: "999px", border: "1px solid #8B93A1", color: "var(--text-secondary, #8B93A1)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, flexShrink: 0 },
  metricRow: { display: "flex", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.55rem", alignItems: "center" },
  metricLabel: { fontSize: "0.77rem", color: "var(--text-secondary, #8B93A1)" },
  metricValue: { fontSize: "0.8rem", color: "var(--text-primary, #F1F2F4)", fontWeight: 700, textAlign: "right" },
  rightPanel: { order: 1, minWidth: 0, display: "grid", gap: "0.55rem" },
  chartActions: { display: "flex", justifyContent: "flex-end", marginBottom: "0.15rem" },
  // Acao secundaria: nao pode ter mais peso que o grafico que ela controla.
  resetButton: { border: "none", background: "#E8943A", color: "#0C0E14", padding: "0.75rem 1.35rem", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" },
  chartWrapper: { position: "relative", overflowX: "auto", background: "#F2F4F8", border: "1px solid #E2E5EB", borderRadius: "14px", padding: "0.45rem" },
  svg: { width: "100%", minWidth: "640px", height: "auto", display: "block" },
  axisText: { fontSize: "12px", fill: "#5C6570", fontWeight: 500 },
  focusText: { fontSize: "11px", fill: "#FFFFFF", fontWeight: 700 },
  tooltip: { position: "absolute", left: "50%", top: "49%", transform: "translateX(-50%)", background: "var(--input-bg, #0C0E14)", color: "#FFFFFF", borderRadius: "12px", padding: "0.95rem 1rem", width: "310px", maxWidth: "calc(100% - 24px)", boxShadow: "0 12px 24px rgba(0,0,0,0.18)", whiteSpace: "pre-line" },
  tooltipTitle: { margin: "0 0 0.45rem", fontSize: "0.88rem", fontWeight: 700 },
  tooltipValues: { margin: "0 0 0.7rem", fontSize: "0.8rem", lineHeight: 1.45, fontWeight: 700 },
  tooltipAge: { margin: 0, fontSize: "0.78rem", opacity: 0.8 },
  tooltipAgeValue: { margin: "0.1rem 0 0", fontSize: "1rem", fontWeight: 700 },
  miniTrack: { height: "24px", background: "var(--surface, #151821)", marginTop: "0.15rem", position: "relative", overflow: "hidden", borderRadius: "8px" },
  // Gradiente decorativo: os dois stops têm que ser DIFERENTES, senão vira cor chapada.
  // A migração de 11/09 mapeou #2E3953 e #425071 pro mesmo tom e apagou o degradê.
  miniTrackFill: { position: "absolute", left: "2%", right: "2%", top: "7px", height: "10px", borderRadius: "10px", background: "linear-gradient(90deg, #2C3344 0%, #425071 100%)" },
  legend: { display: "flex", justifyContent: "center", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem", background: "#F2F4F8", padding: "0.65rem 0.85rem", borderRadius: "10px" },
  legendItem: { display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.75rem", color: "var(--text-muted, #5C6570)", fontWeight: 600 },
  legendDot: { width: "11px", height: "11px", borderRadius: "999px", display: "inline-block", flexShrink: 0 },
  legendNote: { display: "flex", justifyContent: "center", alignItems: "center", gap: "0.55rem", marginTop: "1rem", fontSize: "0.75rem", color: "var(--text-secondary, #8B93A1)", textAlign: "center" },
  legendInfo: { width: "16px", height: "16px", borderRadius: "999px", border: "1px solid #8B93A1", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.68rem", fontWeight: 700, color: "#C9CFDA", flexShrink: 0 },
};
