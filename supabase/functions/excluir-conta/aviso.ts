// Texto do aviso pro Lucas quando alguém exclui a conta. Puro (sem Deno, sem rede)
// para o vitest testar direto, como o regras.ts do cakto-webhook.

export type Preparo = {
  modo: "casal" | "sozinho" | "sem_livro";
  parceiro_id: string | null;
  nome: string | null;
  telefone: string | null;
  plano: string;
  plano_ate: string | null;
  trial_ate: string | null;
  pagou_cakto: boolean;
};

const dataBR = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

// Assinatura a cancelar: já passou pela Cakto e o plano pago ainda não venceu.
// Trial (sem evento da Cakto) não conta.
export function precisaCancelarNaCakto(p: Preparo, agora = new Date()): boolean {
  if (!p.pagou_cakto || !p.plano || p.plano === "none") return false;
  return !p.plano_ate || new Date(p.plano_ate) > agora;
}

export function montarAviso(email: string, p: Preparo, agora = new Date()): string {
  const cancelar = precisaCancelarNaCakto(p, agora);
  const linhas = [
    cancelar ? "⚠️ *Conta excluída — CANCELAR NA CAKTO*" : "🗑️ *Conta excluída*",
    "",
    `${p.nome ?? "(sem nome)"} — ${email}`,
  ];
  if (p.telefone) linhas.push(`WhatsApp: ${p.telefone}`);
  linhas.push(`Plano: ${p.plano}${p.plano !== "none" ? ` até ${dataBR(p.plano_ate)}` : ""}`);
  if (p.modo === "casal") linhas.push("Era casal: o Livro ficou com o parceiro, que segue com o plano até vencer.");
  else if (p.modo === "sozinho") linhas.push("Usava sozinho: o Livro foi apagado.");
  if (cancelar) linhas.push("", "A assinatura continua cobrando até ser cancelada no painel da Cakto.");
  return linhas.join("\n");
}
