// Semeia a conta de DEMONSTRAÇÃO do Pradex com a persona do canal @pradexapp.
//
// 🔴 DESTRUTIVO: apaga tudo do usuário demo antes de inserir. Roda só contra a conta
// de demo — o token vem do login dela, e a RLS não alcança mais ninguém. Nunca rodar
// com credencial da conta real do Lucas.
//
// A PERSONA (decisão do PRADELLA, 2026-09-15): 19 anos, estágio, mora com os pais,
// pouco salário e muita organização. É o público do TikTok, e é quem cabe no plano de
// R$ 29,90 — o prospect de assessoria vive no canal pessoal, não neste.
// A persona anterior (Marina, 40 anos, R$ 35 mil/mês) era exatamente quem NÃO está
// rolando o feed.
//
// Uso:
//   PDX_EMAIL=demo@pradex.com.br PDX_SENHA=... node scripts/seed-demo.mjs

const SB = "https://sjvuhqqsjboncwpboclv.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqdnVocXFzamJvbmN3cGJvY2x2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTM1NzEsImV4cCI6MjA5MTI2OTU3MX0.qpOXjpyJ29Hr9kvee3uxNS1LmJNUEZqDtMCCEpaHjsE";

const EMAIL = process.env.PDX_EMAIL;
const SENHA = process.env.PDX_SENHA;
if (!EMAIL || !SENHA) {
  console.error("Faltou PDX_EMAIL / PDX_SENHA.");
  process.exit(1);
}

let TOK, UID;
const H = () => ({ "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${TOK}` });

// ── datas ────────────────────────────────────────────────────────────────────
const HOJE = new Date();
const ANO = HOJE.getFullYear();
const MES = HOJE.getMonth(); // 0-based
const dia = (m, d) => {                       // m = meses atrás
  const x = new Date(ANO, MES - m, d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const primeiroDia = (m = 0) => {
  const x = new Date(ANO, MES - m, 1);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-01`;
};

// ── http ─────────────────────────────────────────────────────────────────────
async function req(metodo, caminho, corpo) {
  const res = await fetch(`${SB}/rest/v1/${caminho}`, {
    method: metodo,
    headers: { ...H(), Prefer: "return=minimal" },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`${metodo} ${caminho.split("?")[0]} → ${res.status} ${txt.slice(0, 200)}`);
  }
}

// Lotes: TODAS as linhas precisam ter exatamente as mesmas chaves, senão PostgREST
// devolve PGRST102 sem dizer qual linha destoou.
async function inserir(tabela, linhas) {
  if (!linhas.length) return;
  const chaves = JSON.stringify(Object.keys(linhas[0]).sort());
  for (const l of linhas) {
    if (JSON.stringify(Object.keys(l).sort()) !== chaves) {
      throw new Error(`${tabela}: linhas com chaves diferentes no mesmo lote`);
    }
  }
  await req("POST", tabela, linhas.map((l) => ({ user_id: UID, ...l })));
  console.log(`  + ${tabela.padEnd(18)} ${linhas.length}`);
}

async function limpar(tabela) {
  await req("DELETE", `${tabela}?user_id=eq.${UID}`);
  console.log(`  − ${tabela}`);
}

// ── A PERSONA ────────────────────────────────────────────────────────────────
// Léo, 19. Estágio de R$ 1.800 + freela de design que varia. Mora com os pais, então
// não tem aluguel — e é justamente por isso que o dinheiro some sem ele ver: sem a
// despesa grande pra ancorar, tudo é pequeno e tudo é invisível.
const NASC = `${ANO - 19}-03-15`;

const PERFIL = {
  nome: "Léo Demo",
  data_nascimento: NASC,
  profissao: "Estagiário de design",
  estado_civil: "Solteiro(a)",
  regime_uniao: null,
  dupla_cidadania: false,
  pais_cidadania: null,
  saida_fiscal: false,
  pais_saida_fiscal: null,
  expectativa_vida: 90,
  esportes: "Skate, academia",
  hobbies: "Desenho digital, música",
  comentarios: null,
};

const RENDAS = [
  { descricao: "Bolsa de estágio", categoria: "Rendimento", valor_bruto: 1800, frequencia: "Mensal", data_inicio: dia(14, 1), previsao_termino: "Sem previsao" },
  { descricao: "Freelas de design", categoria: "Outras rendas", valor_bruto: 400, frequencia: "Mensal", data_inicio: dia(9, 1), previsao_termino: "Sem previsao" },
];

const DESPESAS = [
  { descricao: "Faculdade (mensalidade)", categoria: "Educacao", valor_bruto: 620, frequencia: "Mensal", data_inicio: dia(14, 5), previsao_termino: "Ao se aposentar" },
  { descricao: "Transporte (ônibus e metrô)", categoria: "Transporte", valor_bruto: 220, frequencia: "Mensal", data_inicio: dia(14, 5), previsao_termino: "Sem previsao" },
  { descricao: "Lanche e delivery", categoria: "Alimentacao", valor_bruto: 380, frequencia: "Mensal", data_inicio: dia(14, 5), previsao_termino: "Sem previsao" },
  { descricao: "Academia", categoria: "Saude", valor_bruto: 90, frequencia: "Mensal", data_inicio: dia(11, 3), previsao_termino: "Sem previsao" },
  { descricao: "Celular (plano)", categoria: "Moradia", valor_bruto: 60, frequencia: "Mensal", data_inicio: dia(14, 5), previsao_termino: "Sem previsao" },
  { descricao: "Assinaturas (streaming e música)", categoria: "Lazer", valor_bruto: 45, frequencia: "Mensal", data_inicio: dia(14, 5), previsao_termino: "Sem previsao" },
  { descricao: "Rolê de fim de semana", categoria: "Lazer", valor_bruto: 300, frequencia: "Mensal", data_inicio: dia(14, 5), previsao_termino: "Sem previsao" },
];

const OBJETIVOS = [
  // O obrigatório do app. Aos 19, é o objetivo mais abstrato que existe — e por isso
  // mesmo o Diagnóstico dele vira conteúdo: transforma abstração em idade.
  { nome: "Aposentadoria", categoria: "Aposentadoria", idade_atingimento: 60, frequencia: "Parcelada", valor: 6000, expectativa_vida: 90, ocorrencias: null, aposentadoria_frequencia: "Parcelada", aposentadoria_expectativa_vida: 90, comentarios: null },
  { nome: "Intercâmbio", categoria: "Viagem", idade_atingimento: 23, frequencia: "Unica", valor: 18000, expectativa_vida: null, ocorrencias: null, aposentadoria_frequencia: null, aposentadoria_expectativa_vida: null, comentarios: "Quatro meses estudando fora" },
  { nome: "Reserva de emergência", categoria: "Reserva", idade_atingimento: 21, frequencia: "Unica", valor: 8000, expectativa_vida: null, ocorrencias: null, aposentadoria_frequencia: null, aposentadoria_expectativa_vida: null, comentarios: "Seis meses de custo de vida" },
  { nome: "Notebook novo", categoria: "Compra", idade_atingimento: 20, frequencia: "Unica", valor: 5500, expectativa_vida: null, ocorrencias: null, aposentadoria_frequencia: null, aposentadoria_expectativa_vida: null, comentarios: "O atual trava no Figma" },
];

const INVESTIMENTOS = [
  { mes_ano_referencia: `${String(MES + 1).padStart(2, "0")}/${ANO}`, instituicao: "XP", tipo: "Investimentos", valor: 2200, origem: "Renda Fixa", comentarios: "Reserva, liquidez diária" },
  { mes_ano_referencia: `${String(MES + 1).padStart(2, "0")}/${ANO}`, instituicao: "XP", tipo: "Investimentos", valor: 600, origem: "Renda Fixa", comentarios: null },
  { mes_ano_referencia: `${String(MES + 1).padStart(2, "0")}/${ANO}`, instituicao: "XP", tipo: "Investimentos", valor: 300, origem: "Renda Variável", comentarios: "Primeiras compras" },
];

// Aos 19 morando com os pais, Imóveis e Participações ficam VAZIOS de propósito. É a
// verdade da persona, e é a tela com que o público se identifica — encher aquilo de
// bem fictício quebraria o realismo que faz o conteúdo funcionar.
// Primeiro cartão aos 19: limite baixo, e é nele que cai o delivery e o rolê. Sem
// cartão cadastrado o tile "CARTÕES" do topo fica vazio e a tela parece inacabada.
const CARTAO = { nome: "Cartão do banco digital", bandeira: "Visa", dia_fechamento: 28, dia_vencimento: 8, banco_id: null };

const OUTROS_BENS = [
  { descricao: "Notebook", valor_atual: 3200, comentarios: "Comprado em 2023, é a ferramenta de trabalho" },
  { descricao: "Bicicleta", valor_atual: 900, comentarios: null },
];

// ── LANÇAMENTOS ──────────────────────────────────────────────────────────────
// Valores pequenos e repetidos de propósito: é o padrão de gasto de quem ganha pouco,
// e é exatamente o que a memória não guarda. Um mês com R$ 8 de café vinte vezes conta
// uma história melhor que um mês com uma compra de R$ 160.
function lancamentos(cartaoId) {
  const L = [];
  // `poderia_ter_evitado` alimenta o "em gastos evitáveis neste mês" do Histórico.
  // Marcar delivery e rolê como evitáveis é o que faz aquela linha dizer alguma coisa —
  // e é o número que o PRADEX usa no dorama.
  const g = (data_lancamento, descricao, valor, categoria, forma, evitavel = false) =>
    L.push({ data_lancamento, descricao, valor, categoria, tipo: "gasto", forma_pagamento: forma,
             cartao_id: forma === "Crédito" ? cartaoId : null, poderia_ter_evitado: evitavel, recorrente: false,
             recorrente_grupo_id: null, parcela_atual: null, total_parcelas: null, parcela_grupo_id: null });
  const r = (data_lancamento, descricao, valor, categoria) =>
    L.push({ data_lancamento, descricao, valor, categoria, tipo: "receita", forma_pagamento: "Pix",
             cartao_id: null, poderia_ter_evitado: false, recorrente: false,
             recorrente_grupo_id: null, parcela_atual: null, total_parcelas: null, parcela_grupo_id: null });

  for (let m = 3; m >= 0; m--) {
    r(dia(m, 5), "Bolsa de estágio", 1800, "Salário");
    if (m !== 1) r(dia(m, 18), "Freela de design", [420, 350, 0, 480][3 - m] || 400, "Freelance");

    // transporte: quase todo dia útil, valor pequeno
    [2, 3, 4, 8, 9, 10, 11, 15, 16, 17, 22, 23, 24, 25].forEach((d) =>
      g(dia(m, d), "Passagem", 5.4, "Transporte", "Débito"));

    // o café: o gasto que ninguém anota
    [2, 4, 8, 10, 12, 16, 18, 22, 24, 26].forEach((d) =>
      g(dia(m, d), "Café", 8, "Alimentação", "Débito"));

    // lanche na faculdade
    [3, 9, 11, 17, 23, 25].forEach((d) =>
      g(dia(m, d), "Lanche", 22, "Alimentação", "Débito"));

    // delivery de fim de semana: o vilão silencioso
    [6, 13, 20, 27].forEach((d) =>
      g(dia(m, d), "Delivery", [38, 52, 41, 47][[6, 13, 20, 27].indexOf(d)], "Alimentação", "Crédito", true));

    g(dia(m, 5), "Mensalidade da faculdade", 620, "Educação", "Débito");
    g(dia(m, 7), "Academia", 90, "Saúde", "Débito");
    g(dia(m, 10), "Plano do celular", 60, "Moradia", "Débito");
    g(dia(m, 12), "Streaming", 45, "Assinaturas", "Crédito");
    g(dia(m, 14), "Rolê com os amigos", [95, 120, 88, 140][3 - m], "Lazer", "Crédito", true);
    g(dia(m, 21), "Cinema", 34, "Lazer", "Crédito", true);
    if (m % 2 === 0) g(dia(m, 19), "Material de desenho", 78, "Outros", "Crédito");
  }
  return L;
}

// Tetos: o de Alimentação e o de Lazer ficam ABAIXO do gasto real do mês, de propósito.
// A tela do teto só ensina alguma coisa quando mostra o limite sendo ultrapassado.
const ORCAMENTOS = [
  { categoria: "Alimentação", limite: 380, mes: primeiroDia() },
  { categoria: "Transporte", limite: 260, mes: primeiroDia() },
  { categoria: "Lazer", limite: 250, mes: primeiroDia() },
  { categoria: "Educação", limite: 620, mes: primeiroDia() },
  { categoria: "Saúde", limite: 100, mes: primeiroDia() },
  { categoria: "Moradia", limite: 80, mes: primeiroDia() },
  { categoria: "Assinaturas", limite: 50, mes: primeiroDia() },
];

// ── execução ─────────────────────────────────────────────────────────────────
async function main() {
  const login = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: KEY },
    body: JSON.stringify({ email: EMAIL, password: SENHA }),
  }).then((r) => r.json());

  if (!login.access_token) throw new Error("Login falhou: " + JSON.stringify(login).slice(0, 200));
  TOK = login.access_token;
  UID = login.user.id;
  console.log(`→ logado como ${EMAIL}\n`);

  console.log("Limpando:");
  for (const t of ["Lancamentos", "orcamentos", "fp_rendas", "fp_despesas", "fp_objetivos",
                   "fp_investimentos", "fp_imoveis", "fp_veiculos", "fp_participacoes",
                   "fp_outros_bens", "fp_membros", "cartoes"]) {
    await limpar(t);
  }

  console.log("\nSemeando:");
  // fp_perfil é UPDATE, não INSERT: a linha já existe (nasce com a conta) e carrega
  // plano e telefone, que não podem ser recriados por aqui.
  await req("PATCH", `fp_perfil?user_id=eq.${UID}`, PERFIL);
  console.log(`  ~ fp_perfil          ${PERFIL.nome}, ${PERFIL.profissao}`);

  await inserir("fp_membros", [{ nome: PERFIL.nome, data_nascimento: NASC, parentesco: "Titular" }]);
  await inserir("fp_rendas", RENDAS.map((x) => ({ ...x, membro_familiar: PERFIL.nome, imposto_pct: 0, tributavel: false, data_fim: null, comentarios: null })));
  await inserir("fp_despesas", DESPESAS.map((x) => ({ ...x, membro_familiar: PERFIL.nome, data_fim: null, comentarios: null })));
  await inserir("fp_objetivos", OBJETIVOS);
  await inserir("fp_investimentos", INVESTIMENTOS);
  await inserir("fp_outros_bens", OUTROS_BENS);
  await inserir("orcamentos", ORCAMENTOS);

  // return=representation pra pegar o id: os lançamentos no crédito precisam apontar
  // pro cartão, senão a fatura do topo não soma nada.
  const resCartao = await fetch(`${SB}/rest/v1/cartoes`, {
    method: "POST", headers: { ...H(), Prefer: "return=representation" },
    body: JSON.stringify({ user_id: UID, ...CARTAO }),
  });
  if (!resCartao.ok) throw new Error("cartoes → " + (await resCartao.text()).slice(0, 200));
  const CARTAO_ID = (await resCartao.json())[0].id;
  console.log(`  + cartoes            ${CARTAO.nome}`);

  const L = lancamentos(CARTAO_ID);
  for (let i = 0; i < L.length; i += 40) await inserir("Lancamentos", L.slice(i, i + 40));

  console.log(`\n✓ conta de demo semeada — ${PERFIL.nome}, 19 anos`);
}

main().catch((e) => { console.error("\n✗ " + e.message); process.exit(1); });
