// Popula a conta demo do Pradex com dados plausíveis de uma família de classe
// média alta. Tudo via PostgREST com o token do PRÓPRIO usuário demo — a RLS
// escreve só nas linhas dele, então este script não precisa de service_role.
const SB = "https://sjvuhqqsjboncwpboclv.supabase.co";
const KEY = process.env.PDX_KEY, TOK = process.env.PDX_TOK, UID = process.env.PDX_UID;
const H = { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${TOK}` };

let ok = 0, fail = 0;
async function post(tabela, linhas, devolver = false) {
  if (!linhas.length) return [];
  const res = await fetch(`${SB}/rest/v1/${tabela}`, {
    method: "POST",
    headers: { ...H, Prefer: devolver ? "return=representation" : "return=minimal" },
    body: JSON.stringify(linhas.map(l => ({ user_id: UID, ...l }))),
  });
  if (!res.ok) { fail++; console.log(`  ✗ ${tabela}: ${res.status} ${(await res.text()).slice(0,180)}`); return []; }
  ok++; console.log(`  ✓ ${tabela}: ${linhas.length}`);
  return devolver ? await res.json() : [];
}

const hoje = new Date();
const iso = d => d.toISOString().slice(0,10);
const diaDoMes = (voltarMeses, dia) => iso(new Date(hoje.getFullYear(), hoje.getMonth()-voltarMeses, dia));
const mes1 = v => iso(new Date(hoje.getFullYear(), hoje.getMonth()-v, 1));

// ── Perfil e família ────────────────────────────────────────────────────────
await fetch(`${SB}/rest/v1/fp_perfil?user_id=eq.${UID}`, { method: "DELETE", headers: H });
await post("fp_perfil", [{
  nome: "Marina Demo", data_nascimento: "1986-04-22", telefone: "11988887777",
  profissao: "Arquiteta", estado_civil: "Casado(a)", regime_uniao: "Comunhao Parcial de Bens",
  dupla_cidadania: false, saida_fiscal: false, expectativa_vida: 90,
  esportes: "Corrida, pilates", hobbies: "Cozinhar, viajar",
}]);
await post("fp_membros", [
  { nome: "Marina Demo", parentesco: "Titular", data_nascimento: "1986-04-22" },
  { nome: "Rafael Demo", parentesco: "Conjuge", data_nascimento: "1983-11-08" },
  { nome: "Theo Demo", parentesco: "Filho(a)", data_nascimento: "2016-02-14" },
  { nome: "Alice Demo", parentesco: "Filho(a)", data_nascimento: "2020-07-30" },
]);

// ── Categorias, bancos, cartões ─────────────────────────────────────────────
await post("categorias", [
  ...["Mercado","Restaurante","Transporte","Moradia","Saúde","Educação","Lazer","Assinaturas","Vestuário","Casa"]
    .map(nome => ({ nome, tipo: "despesa", removida: false })),
  ...["Salário","Pró-labore","Aluguel recebido","Dividendos"].map(nome => ({ nome, tipo: "receita", removida: false })),
]);
const bancos = await post("bancos", [
  { nome: "Itaú", codigo_compe: "341", removido: false },
  { nome: "Nubank", codigo_compe: "260", removido: false },
  { nome: "XP", codigo_compe: "102", removido: false },
], true);
const bancoId = n => bancos.find(b => b.nome === n)?.id ?? null;
const cartoes = await post("cartoes", [
  { nome: "Itaú Personnalité", bandeira: "Visa", dia_fechamento: 28, dia_vencimento: 5, banco_id: bancoId("Itaú") },
  { nome: "Nubank Ultravioleta", bandeira: "Mastercard", dia_fechamento: 18, dia_vencimento: 25, banco_id: bancoId("Nubank") },
], true);
const cartaoId = n => cartoes.find(c => c.nome === n)?.id ?? null;

// ── Lançamentos: 4 meses de histórico ───────────────────────────────────────
// Dias distintos importam: o score de disciplina exige 15 dias com lançamento
// no mês pra liberar o prêmio, então o mês corrente é espalhado de propósito.
const desp = (m, dia, descricao, valor, categoria, pag, cartao, evitavel = false) => ({
  descricao, valor, tipo: "despesa", categoria, data_lancamento: diaDoMes(m, dia),
  forma_pagamento: pag, cartao_id: cartao ? cartaoId(cartao) : null,
  poderia_ter_evitado: evitavel, recorrente: false, recorrente_grupo_id: null,
  parcela_atual: null, total_parcelas: null, parcela_grupo_id: null,
});
const rec = (m, dia, descricao, valor, categoria) => ({
  descricao, valor, tipo: "receita", categoria, data_lancamento: diaDoMes(m, dia),
  forma_pagamento: "Pix", cartao_id: null, poderia_ter_evitado: false,
  recorrente: false, recorrente_grupo_id: null, parcela_atual: null,
  total_parcelas: null, parcela_grupo_id: null,
});

const linhas = [];
for (let m = 3; m >= 0; m--) {
  const r = () => 0.9 + Math.random() * 0.2;                 // variação mês a mês
  linhas.push(rec(m, 5, "Salário", Math.round(18500 * r()), "Salário"));
  linhas.push(rec(m, 5, "Pró-labore Rafael", Math.round(12000 * r()), "Pró-labore"));
  linhas.push(rec(m, 10, "Aluguel sala comercial", 3200, "Aluguel recebido"));
  linhas.push(desp(m, 8, "Condomínio", 1850, "Moradia", "Débito"));
  linhas.push(desp(m, 8, "Escola Theo e Alice", 4200, "Educação", "Débito"));
  linhas.push(desp(m, 12, "Plano de saúde família", 2680, "Saúde", "Débito"));
  linhas.push(desp(m, 15, "Energia + água", Math.round(540 * r()), "Moradia", "Débito"));
  linhas.push(desp(m, 3, "Mercado do mês", Math.round(1900 * r()), "Mercado", "Crédito", "Itaú Personnalité"));
  linhas.push(desp(m, 17, "Mercado reposição", Math.round(680 * r()), "Mercado", "Crédito", "Itaú Personnalité"));
  linhas.push(desp(m, 22, "Combustível", Math.round(720 * r()), "Transporte", "Crédito", "Itaú Personnalité"));
  linhas.push(desp(m, 6, "Netflix + Spotify + iCloud", 119, "Assinaturas", "Crédito", "Nubank Ultravioleta"));
  linhas.push(desp(m, 11, "Academia", 320, "Saúde", "Crédito", "Nubank Ultravioleta"));
  linhas.push(desp(m, 14, "Jantar fora", Math.round(390 * r()), "Restaurante", "Crédito", "Nubank Ultravioleta", true));
  linhas.push(desp(m, 20, "Delivery", Math.round(260 * r()), "Restaurante", "Crédito", "Nubank Ultravioleta", true));
  linhas.push(desp(m, 25, "Cinema e passeio", Math.round(210 * r()), "Lazer", "Crédito", "Nubank Ultravioleta"));
  if (m % 2 === 0) linhas.push(desp(m, 19, "Roupas", Math.round(450 * r()), "Vestuário", "Crédito", "Itaú Personnalité", true));
  if (m === 0) {
    // mês corrente com mais dias distintos, pra a nota de disciplina ficar alta
    [2, 4, 7, 9, 13, 16, 18, 21, 23, 24].forEach((d, i) =>
      linhas.push(desp(0, d, ["Padaria","Uber","Farmácia","Feira","Pet shop","Estacionamento","Livraria","Café","Barbearia","Presente"][i],
        Math.round(45 + Math.random() * 180), ["Mercado","Transporte","Saúde","Mercado","Casa","Transporte","Lazer","Restaurante","Casa","Lazer"][i],
        "Débito", null, i % 4 === 0)));
  }
}
// Compra parcelada em aberto
const gid = crypto.randomUUID();
for (let p = 1; p <= 10; p++) {
  linhas.push({
    descricao: "Sofá da sala", valor: 480, tipo: "despesa", categoria: "Casa",
    data_lancamento: diaDoMes(2 - (p - 1), 15), forma_pagamento: "Crédito",
    cartao_id: cartaoId("Itaú Personnalité"), poderia_ter_evitado: false,
    recorrente: false, recorrente_grupo_id: null,
    parcela_atual: p, total_parcelas: 10, parcela_grupo_id: gid,
  });
}
for (let i = 0; i < linhas.length; i += 60) await post("Lancamentos", linhas.slice(i, i + 60));

// ── Tetos de gasto ──────────────────────────────────────────────────────────
await post("orcamentos", [
  { categoria: "Mercado", limite: 2800, mes: mes1(0) },
  { categoria: "Restaurante", limite: 700, mes: mes1(0) },
  { categoria: "Transporte", limite: 900, mes: mes1(0) },
  { categoria: "Lazer", limite: 500, mes: mes1(0) },
  { categoria: "Vestuário", limite: 400, mes: mes1(0) },
]);

// ── Planejamento Financeiro ─────────────────────────────────────────────────
await post("fp_rendas", [
  { membro_familiar: "Marina Demo", categoria: "Rendimento", descricao: "Salário CLT", valor_bruto: 18500, frequencia: "Mensal", previsao_termino: "Ao se aposentar", data_inicio: "2019-03-01" },
  { membro_familiar: "Rafael Demo", categoria: "Pro-labore", descricao: "Pró-labore da empresa", valor_bruto: 12000, frequencia: "Mensal", previsao_termino: "Ao se aposentar", data_inicio: "2017-06-01" },
  { membro_familiar: "Marina Demo", categoria: "Aluguel", descricao: "Sala comercial no centro", valor_bruto: 3200, frequencia: "Mensal", previsao_termino: "Sem previsao", data_inicio: "2022-01-01" },
  { membro_familiar: "Rafael Demo", categoria: "Dividendos", descricao: "Carteira de FIIs", valor_bruto: 1400, frequencia: "Mensal", previsao_termino: "Sem previsao", data_inicio: "2021-09-01" },
]);
await post("fp_despesas", [
  { membro_familiar: "Marina Demo", categoria: "Moradia", descricao: "Condomínio e IPTU", valor_bruto: 2150, frequencia: "Mensal", previsao_termino: "Sem previsao", data_inicio: "2019-03-01" },
  { membro_familiar: "Marina Demo", categoria: "Educacao", descricao: "Escola dos filhos", valor_bruto: 4200, frequencia: "Mensal", previsao_termino: "Apos algumas ocorrencias", data_inicio: "2022-02-01" },
  { membro_familiar: "Rafael Demo", categoria: "Saude", descricao: "Plano de saúde família", valor_bruto: 2680, frequencia: "Mensal", previsao_termino: "Sem previsao", data_inicio: "2020-01-01" },
  { membro_familiar: "Marina Demo", categoria: "Alimentacao", descricao: "Mercado e feira", valor_bruto: 2600, frequencia: "Mensal", previsao_termino: "Sem previsao", data_inicio: "2019-03-01" },
  { membro_familiar: "Rafael Demo", categoria: "Transporte", descricao: "Combustível, seguro e manutenção", valor_bruto: 1250, frequencia: "Mensal", previsao_termino: "Sem previsao", data_inicio: "2019-03-01" },
  { membro_familiar: "Marina Demo", categoria: "Financiamentos", descricao: "Parcela do apartamento", valor_bruto: 4800, frequencia: "Mensal", previsao_termino: "Apos algumas ocorrencias", data_inicio: "2019-03-01", data_fim: "2033-03-01" },
  { membro_familiar: "Marina Demo", categoria: "Lazer", descricao: "Restaurantes, viagens e passeios", valor_bruto: 1600, frequencia: "Mensal", previsao_termino: "Sem previsao", data_inicio: "2019-03-01" },
]);
await post("fp_objetivos", [
  { nome: "Aposentadoria", categoria: "Aposentadoria", idade_atingimento: 60, frequencia: "Parcelada",
    aposentadoria_frequencia: "Parcelada", valor: 22000, expectativa_vida: 90, aposentadoria_expectativa_vida: 90 },
  { nome: "Intercâmbio do Theo", categoria: "Educacao", idade_atingimento: 48, frequencia: "Unica", valor: 120000 },
  { nome: "Casa na praia", categoria: "Imoveis", idade_atingimento: 52, frequencia: "Unica", valor: 850000 },
  { nome: "Trocar o carro", categoria: "Veiculos", idade_atingimento: 44, frequencia: "Unica", valor: 180000 },
]);
const mesAno = `${String(hoje.getMonth()+1).padStart(2,"0")}/${hoje.getFullYear()}`;
await post("fp_investimentos", [
  { mes_ano_referencia: mesAno, tipo: "Investimentos", origem: "Renda Fixa", instituicao: "XP", valor: 385000 },
  { mes_ano_referencia: mesAno, tipo: "Investimentos", origem: "Ações", instituicao: "XP", valor: 142000 },
  { mes_ano_referencia: mesAno, tipo: "Investimentos", origem: "FIIs", instituicao: "XP", valor: 168000 },
  { mes_ano_referencia: mesAno, tipo: "Investimentos", origem: "Internacional", instituicao: "Avenue", valor: 96000 },
  { mes_ano_referencia: mesAno, tipo: "Previdência", origem: "PGBL", instituicao: "XP Seguros", valor: 210000 },
  { mes_ano_referencia: mesAno, tipo: "Previdência", origem: "VGBL", instituicao: "Brasilprev", valor: 74000 },
  { mes_ano_referencia: mesAno, tipo: "Outros", origem: "Outros", instituicao: "Reserva na conta", valor: 38000 },
]);
await post("fp_imoveis", [
  { descricao: "Apartamento onde moram", tipo: "Residencial", estado: "SP", cidade: "São Paulo", valor_atual: 1450000, participacao_pct: 100, financiado: true, seguro_prestamista: true, data_quitacao: "2033-03-01", adquirido_apos_uniao: true, participacao_conjuge: true },
  { descricao: "Sala comercial alugada", tipo: "Comercial", estado: "SP", cidade: "São Caetano do Sul", valor_atual: 420000, participacao_pct: 100, financiado: false, seguro_prestamista: false, adquirido_apos_uniao: true, participacao_conjuge: true },
]);
await post("dividas", [
  { descricao: "Financiamento do apartamento", saldo_devedor: 512000, valor_parcela: 4800, parcelas_restantes: 102, taxa_juros_mensal: 0.79, removida: false },
]);

console.log(`\n${ok} inserções ok, ${fail} falharam`);
