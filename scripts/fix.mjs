const SB = "https://sjvuhqqsjboncwpboclv.supabase.co";
const KEY = process.env.PDX_KEY, TOK = process.env.PDX_TOK, UID = process.env.PDX_UID;
const H = { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${TOK}` };
const hoje = new Date();

async function req(m, path, body, prefer = "return=minimal") {
  const res = await fetch(`${SB}/rest/v1/${path}`, { method: m, headers: { ...H, Prefer: prefer }, body: body ? JSON.stringify(body) : undefined });
  const txt = await res.text();
  console.log(`  ${res.ok ? "✓" : "✗"} ${m} ${path.split("?")[0]} ${res.ok ? "" : res.status + " " + txt.slice(0,160)}`);
  return res.ok ? (txt ? JSON.parse(txt) : []) : null;
}
// Todas as linhas de um lote precisam ter EXATAMENTE as mesmas chaves (PGRST102).
const uniformizar = (linhas) => {
  const chaves = [...new Set(linhas.flatMap(Object.keys))];
  return linhas.map(l => Object.fromEntries(chaves.map(k => [k, l[k] ?? null])));
};
const post = (t, linhas) => req("POST", t, uniformizar(linhas.map(l => ({ user_id: UID, ...l }))));

// 1. O app filtra por tipo === "gasto"; o seed gravou "despesa".
await req("PATCH", `Lancamentos?user_id=eq.${UID}&tipo=eq.despesa`, { tipo: "gasto" });

// 2. Telefone: o formato do banco é 55 + DDD + 9 dígitos (13 ao todo).
await post("fp_perfil", [{
  nome: "Marina Demo", data_nascimento: "1986-04-22", telefone: "5511988887777",
  profissao: "Arquiteta", estado_civil: "Casado(a)", regime_uniao: "Comunhao Parcial de Bens",
  dupla_cidadania: false, saida_fiscal: false, expectativa_vida: 90,
  esportes: "Corrida, pilates", hobbies: "Cozinhar, viajar",
}]);

// 3. Categorias: o tipo é "gasto"/"receita", e as PADRÃO não moram no banco —
//    o app as deriva no código. Aqui entram só as customizadas que o seed usou.
await post("categorias", [
  ...["Mercado", "Restaurante", "Vestuário", "Casa"].map(nome => ({ nome, tipo: "gasto", removida: false })),
  ...["Pró-labore", "Dividendos"].map(nome => ({ nome, tipo: "receita", removida: false })),
]);

// 4. Os três lotes que caíram por chaves desiguais.
await post("fp_despesas", [
  { membro_familiar: "Marina Demo", categoria: "Moradia", descricao: "Condomínio e IPTU", valor_bruto: 2150, frequencia: "Mensal", previsao_termino: "Sem previsao", data_inicio: "2019-03-01" },
  { membro_familiar: "Marina Demo", categoria: "Educacao", descricao: "Escola dos filhos", valor_bruto: 4200, frequencia: "Mensal", previsao_termino: "Sem previsao", data_inicio: "2022-02-01" },
  { membro_familiar: "Rafael Demo", categoria: "Saude", descricao: "Plano de saúde família", valor_bruto: 2680, frequencia: "Mensal", previsao_termino: "Sem previsao", data_inicio: "2020-01-01" },
  { membro_familiar: "Marina Demo", categoria: "Alimentacao", descricao: "Mercado e feira", valor_bruto: 2600, frequencia: "Mensal", previsao_termino: "Sem previsao", data_inicio: "2019-03-01" },
  { membro_familiar: "Rafael Demo", categoria: "Transporte", descricao: "Combustível, seguro e manutenção", valor_bruto: 1250, frequencia: "Mensal", previsao_termino: "Sem previsao", data_inicio: "2019-03-01" },
  { membro_familiar: "Marina Demo", categoria: "Financiamentos", descricao: "Parcela do apartamento", valor_bruto: 4800, frequencia: "Mensal", previsao_termino: "Apos algumas ocorrencias", data_inicio: "2019-03-01", data_fim: "2033-03-01" },
  { membro_familiar: "Marina Demo", categoria: "Lazer", descricao: "Restaurantes, viagens e passeios", valor_bruto: 1600, frequencia: "Mensal", previsao_termino: "Sem previsao", data_inicio: "2019-03-01" },
]);
await post("fp_objetivos", [
  { nome: "Aposentadoria", categoria: "Aposentadoria", idade_atingimento: 60, frequencia: "Parcelada", aposentadoria_frequencia: "Parcelada", valor: 22000, expectativa_vida: 90, aposentadoria_expectativa_vida: 90 },
  { nome: "Intercâmbio do Theo", categoria: "Educacao", idade_atingimento: 48, frequencia: "Unica", valor: 120000 },
  { nome: "Casa na praia", categoria: "Imoveis", idade_atingimento: 52, frequencia: "Unica", valor: 850000 },
  { nome: "Trocar o carro", categoria: "Veiculos", idade_atingimento: 44, frequencia: "Unica", valor: 180000 },
]);
await post("fp_imoveis", [
  { descricao: "Apartamento onde moram", tipo: "Residencial", estado: "SP", cidade: "São Paulo", valor_atual: 1450000, participacao_pct: 100, financiado: true, seguro_prestamista: true, data_quitacao: "2033-03-01", adquirido_apos_uniao: true, participacao_conjuge: true },
  { descricao: "Sala comercial alugada", tipo: "Comercial", estado: "SP", cidade: "São Caetano do Sul", valor_atual: 420000, participacao_pct: 100, financiado: false, seguro_prestamista: false, adquirido_apos_uniao: true, participacao_conjuge: true },
]);
