// Normalização do que o modelo devolve antes do RPC.
// Espelha src/lib/formaPagamento.js — o fechamento e o agente precisam concordar,
// e a edge function não importa o bundle do app. O SQL (`normalizar_forma_pagamento`)
// é a terceira rede, pra insert que escapar daqui: ele só canônica a string já
// gravada em forma_pagamento. A mensagem do WhatsApp não chega no RPC, então
// "no crédito" com forma omitida ou chutada como Débito se resolve aqui.

export const CATEGORIA_PAGAMENTO_FATURA = "Pagamento fatura";

export function semAcento(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizarFormaPagamento(value: unknown): string | null {
  if (value == null) return null;
  const bruto = String(value).trim();
  if (!bruto) return null;
  const n = semAcento(bruto);
  // "cartão de débito" tem que vencer "cartão …", senão o nome do cartão vira crédito.
  if (n === "debito" || n === "debito em conta" || n === "cartao de debito" || n.startsWith("cartao de debito")) {
    return "Débito";
  }
  if (
    n === "credito" || n === "cartao" || n === "cartao de credito" ||
    n === "credito parcelado" || n.startsWith("credito ") || n.startsWith("cartao ")
  ) return "Crédito";
  if (n === "pix") return "PIX";
  if (n === "pix/debito" || n === "pix / debito") return "PIX/Débito";
  if (n === "saldo da conta") return "Saldo da conta";
  if (n === "dinheiro" || n === "especie") return "Dinheiro";
  if (n === "outros") return "Outros";
  return bruto;
}

const RE_PAGAMENTO = /\b(paguei|pago|pagar|pagamento|quitei|quitacao|quitar)\b.{0,40}\b(fatura|cartao|cartoes)\b/;

// "no cartão", "com o cartão de crédito", "cartão de débito" são o MEIO da compra,
// não a conta sendo quitada. Sem tirar isso antes, "paguei 50 no cartão de crédito"
// (compra) casava com RE_PAGAMENTO e virava pagamento de fatura. Cartão de débito
// não tem fatura, então sai sempre.
const RE_CARTAO_COMO_MEIO = /\b(?:(?:no|na|com|pelo|via|usando)(?: o| a)?(?: meu| minha)? cartao(?: de (?:debito|credito))?|cartao de debito)\b/g;

/**
 * Intenção EXPLÍCITA de quitar fatura: "paguei a fatura do XP", "paguei o cartão
 * Santander". É a ÚNICA porta pra "Pagamento fatura" (28/09): categoria do modelo e
 * abate_saldo=false não contam como intenção.
 */
export function textoEhPagamentoFatura(texto: unknown): boolean {
  const n = semAcento(texto).replace(RE_CARTAO_COMO_MEIO, " ");
  return RE_PAGAMENTO.test(n);
}

const ehCategoriaPagamento = (categoria: unknown) => {
  const c = semAcento(categoria);
  return c === "pagamento fatura" || c === "pagamento de fatura";
};

// Categoria de uma compra quando o modelo mandou "Pagamento fatura" sem o cliente
// ter falado em fatura. Ordem importa: a primeira regra que casar vence. Só vale se a
// categoria existir na lista do cliente; senão cai em "Outros", como validarCategorias.
const REGRAS_CATEGORIA: Array<[string, RegExp]> = [
  ["Alimentação", /\b(padaria|restaurante|lanchonete|lanches?|mercado|supermercado|feira|acougue|hortifruti|ifood|keeta|rappi|pizza\w*|hamburguer\w*|burger|sushi|churrasc\w*|espetinho|boteco|bar|chopp|chope|cerveja|bebidas?|sorvete\w*|cafe|cafeteria|almoco|jantar|comida|acai|doceria|conveniencia)\b/],
  ["Transporte", /\b(uber|99pop|taxi|onibus|metro|bilhete unico|posto|gasolina|combustivel|etanol|estacionamento|pedagio)\b/],
  ["Saúde", /\b(farmacia|drogaria|remedios?|medic[oa]|consulta|exames?|dentista|hospital)\b/],
  ["Assinaturas", /\b(netflix|spotify|assinatura|prime video|disney|hbo|youtube premium)\b/],
  ["Lazer", /\b(cinema|show|ingressos?|teatro)\b/],
  ["Educação", /\b(curso|livros?|escola|faculdade)\b/],
  ["Moradia", /\b(aluguel|condominio|conta de luz|conta de agua|internet|energia)\b/],
];

const GASTOS_PADRAO = ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Assinaturas", "Outros"];

export function inferirCategoriaGasto(
  descricao: unknown,
  categorias?: Array<{ nome: string; tipo: string }>,
): string {
  const lista = categorias?.length
    ? categorias.filter((c) => c.tipo === "gasto").map((c) => c.nome)
    : GASTOS_PADRAO;
  const existe = (nome: string) => lista.find((c) => semAcento(c) === semAcento(nome));
  const n = semAcento(descricao);
  for (const [nome, re] of REGRAS_CATEGORIA) {
    if (re.test(n)) {
      const achou = existe(nome);
      if (achou) return achou;
    }
  }
  return existe("Outros") || "Outros";
}

function escaparRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termoPresente(texto: string, termo: string): boolean {
  if (termo.length < 2) return false;
  return new RegExp(`(?:^|[^a-z0-9])${escaparRegex(termo)}(?:[^a-z0-9]|$)`).test(texto);
}

// A fala não usa o nome cadastrado. "AXP" e "cartão XP" são o cartão cujo nome é XP.
const APELIDOS_XP = ["cartao xp", "axp", "xp"];

function cartaoEhXp(nome: string): boolean {
  return nome === "xp" || nome.endsWith(" xp") || nome.startsWith("xp ");
}

function termosDoCartao(nome: unknown): string[] {
  const n = semAcento(nome);
  const termos = new Set<string>();
  if (n.length >= 2) termos.add(n);
  if (cartaoEhXp(n)) for (const t of APELIDOS_XP) termos.add(t);
  return [...termos].sort((a, b) => b.length - a.length);
}

export function acharCartaoNoTexto(
  texto: unknown,
  cartoes: Array<{ id: number; nome?: string }>,
): { id: number; nome?: string } | null {
  const n = semAcento(texto);
  if (!n) return null;
  const hits = (cartoes || []).flatMap((c) => {
    const termo = termosDoCartao(c?.nome).find((t) => termoPresente(n, t));
    return termo ? [{ cartao: c, termo }] : [];
  });
  hits.sort((a, b) => b.termo.length - a.termo.length);
  return hits[0]?.cartao || null;
}

/** "AXP" / "XP" na fala, mas nenhum cartão cadastrado responde por isso. */
function citaCartaoSemDono(texto: string, cartoes: Array<{ id: number; nome?: string }>): boolean {
  const n = semAcento(texto);
  const temApelido = termoPresente(n, "axp") || termoPresente(n, "xp") || termoPresente(n, "cartao xp");
  return temApelido && !acharCartaoNoTexto(texto, cartoes);
}

// "crédito" / "cartão de crédito" na fala. "cartão de débito" não entra.
const RE_CREDITO_NA_FALA = /\bcreditos?\b|\bcartao de credito\b/;
const RE_DEBITO_NA_FALA = /\bdebito\b/;
const RE_PIX_NA_FALA = /\bpix\b/;
const RE_DINHEIRO_NA_FALA = /\bdinheiro\b|\bespecie\b/;

/**
 * O que o cliente disse que foi a forma — não o que o modelo chutou.
 * Crédito ganha se a fala citar crédito e também débito/PIX.
 */
export function formaDitaPeloTexto(texto: unknown): "Crédito" | "Débito" | "PIX" | "Dinheiro" | null {
  const n = semAcento(texto);
  if (!n) return null;
  if (RE_CREDITO_NA_FALA.test(n)) return "Crédito";
  const debito = RE_DEBITO_NA_FALA.test(n);
  const pix = RE_PIX_NA_FALA.test(n);
  const dinheiro = RE_DINHEIRO_NA_FALA.test(n);
  const marcas = [debito, pix, dinheiro].filter(Boolean).length;
  if (marcas !== 1) return null;
  if (debito) return "Débito";
  if (pix) return "PIX";
  return "Dinheiro";
}

/**
 * Uma ação do tool-use, pronta pro RPC.
 * `textoUsuario` só entra na detecção quando a mensagem gerou UMA ação — senão
 * "paguei a fatura e gastei 20 no mercado" marcaria os dois como pagamento.
 */
export function prepararAcao(
  acao: any,
  textoUsuario: string,
  cartoes: Array<{ id: number; nome?: string }>,
  acoesNaMensagem: number,
  categorias?: Array<{ nome: string; tipo: string }>,
): any {
  const dados = acao?.dados;
  if (!dados || (acao.tipo !== "criar" && acao.tipo !== "editar")) return acao;

  const next = { ...dados, forma_pagamento: normalizarFormaPagamento(dados.forma_pagamento) };
  const proprio = `${next.descricao || ""} ${next.categoria || ""}`;
  const contexto = acoesNaMensagem === 1 ? `${proprio} ${textoUsuario || ""}` : proprio;

  // Pagamento de fatura exige que o CLIENTE tenha falado em fatura/pagar o cartão.
  // Bug de 25–27/09: "Gastei 90 no débito restaurante Hong bin" chegou do modelo com
  // categoria "Pagamento fatura" e/ou abate_saldo=false e saiu do Saiu. A categoria
  // do modelo NÃO entra no corpus (ela mesma contém "pagamento ... fatura" e se
  // autoconfirmaria). Com uma ação, vale a fala; com várias, a fala tem que ter a
  // intenção E a descrição tem que ser a da fatura (senão o mercado vira pagamento).
  const falaTemIntencao = textoUsuario ? textoEhPagamentoFatura(textoUsuario) : false;
  const descricaoTemIntencao = textoEhPagamentoFatura(next.descricao || "");
  const pagamento = acoesNaMensagem === 1
    ? (textoUsuario ? falaTemIntencao : descricaoTemIntencao)
    : (textoUsuario ? falaTemIntencao && descricaoTemIntencao : descricaoTemIntencao);

  if (!pagamento && next.meta_id == null) {
    // Gasto comum: nunca "Pagamento fatura", nunca abate_saldo=false.
    if (ehCategoriaPagamento(next.categoria)) {
      next.categoria = next.tipo === "receita" ? "Outros" : inferirCategoriaGasto(next.descricao, categorias);
    }
    if (next.abate_saldo === false) next.abate_saldo = true;
  }

  if (pagamento && next.tipo !== "receita") {
    next.tipo = "gasto";
    next.categoria = CATEGORIA_PAGAMENTO_FATURA;
    next.abate_saldo = false;
    next.parcelado = false;
    next.total_parcelas = null;
    if (!next.forma_pagamento || next.forma_pagamento === "Crédito") next.forma_pagamento = "Débito";
    if (next.cartao_id == null) {
      const hit = acharCartaoNoTexto(contexto, cartoes);
      if (hit) next.cartao_id = hit.id;
    }
  } else if (next.tipo !== "receita" && next.meta_id == null) {
    // Compra. Descrição + fala (a fala inteira só com uma ação, pra não cruzar
    // dois lançamentos). "crédito AXP" mora na descrição quando o modelo não
    // preenche cartao_id.
    const corpusCartao = acoesNaMensagem === 1
      ? `${next.descricao || ""} ${textoUsuario || ""}`
      : `${next.descricao || ""}`;
    const mencionado = acharCartaoNoTexto(corpusCartao, cartoes);
    const dita = formaDitaPeloTexto(contexto);
    if (dita) next.forma_pagamento = dita;
    else if (mencionado) next.forma_pagamento = "Crédito";

    if (next.forma_pagamento === "Crédito" && next.cartao_id == null) {
      if (mencionado) next.cartao_id = mencionado.id;
      else if ((cartoes?.length === 1) && !citaCartaoSemDono(corpusCartao, cartoes)) {
        next.cartao_id = cartoes[0].id;
      }
    } else if (next.cartao_id == null && mencionado) {
      next.cartao_id = mencionado.id;
    }
  }

  return { ...acao, dados: next };
}

export function prepararAcoes(
  acoes: any[],
  textoUsuario: string,
  cartoes: Array<{ id: number; nome?: string }>,
  categorias?: Array<{ nome: string; tipo: string }>,
): any[] {
  const lista = acoes || [];
  return lista.map((acao) => prepararAcao(acao, textoUsuario, cartoes, lista.length, categorias));
}
