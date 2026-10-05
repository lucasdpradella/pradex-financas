// Lê "2/2", "(2/3)" ou "15/15" no FIM da descrição.
// Serve só para lançamento antigo, em que os campos parcela_atual/total_parcelas
// ficaram vazios. Não grava nada e não mexe em gasto, receita ou meta.
//
// Risco que ficou de fora de propósito: "14/15" solto (faixa, não parcela) e uma
// data dd/mm em que o dia é menor ou igual ao mês ("02/10"). Entre parênteses,
// que é o formato que o app grava, esses casos passam — "(2/10)" é parcela.

const TOTAL_MAX = 48;

function validar(atual, total, solto) {
  if (!Number.isInteger(atual) || !Number.isInteger(total)) return null;
  if (atual < 1 || total < 2 || total > TOTAL_MAX || atual > total) return null;
  // Solto, os dois números altos e diferentes: parece faixa ("14/15"), não parcela.
  if (solto && atual > 12 && atual !== total) return null;
  return { atual, total };
}

export function extrairParcelaDaDescricao(descricao) {
  const texto = String(descricao ?? "").trim();
  if (!texto) return null;
  const entreParenteses = texto.match(/(?:^|\s)\((\d{1,2})\/(\d{1,2})\)\s*$/);
  if (entreParenteses) return validar(Number(entreParenteses[1]), Number(entreParenteses[2]), false);
  const solto = texto.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})\s*$/);
  if (!solto) return null;
  return validar(Number(solto[1]), Number(solto[2]), true);
}

export function descricaoBaseParcela(descricao) {
  const texto = String(descricao ?? "").trim();
  if (!extrairParcelaDaDescricao(texto)) return texto;
  return texto.replace(/(?:^|\s)\(?\d{1,2}\/\d{1,2}\)?\s*$/, "").trim();
}

export function indiceEfetivo(lancamento) {
  const atual = Number(lancamento?.parcela_atual);
  const total = Number(lancamento?.total_parcelas);
  if (Number.isInteger(atual) && Number.isInteger(total) && atual >= 1 && total >= 2 && atual <= total) {
    return { atual, total, fonte: "campos" };
  }
  const parsed = extrairParcelaDaDescricao(lancamento?.descricao);
  if (!parsed) return null;
  return { ...parsed, fonte: "descricao" };
}

export function rotuloParcela(lancamento) {
  const indice = indiceEfetivo(lancamento);
  if (!indice) return null;
  return `${indice.atual}/${indice.total}x`;
}
