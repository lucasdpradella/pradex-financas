// Normalização de telefone do WhatsApp.
//
// Espelhada por src/utils/phone.js (reexporta daqui). O agente grava em
// fp_perfil.telefone o mesmo dígito que cadastro e perfil salvam. Se as duas
// pontas divergirem, o lookup não acha a conta e o onboarding acha que já
// existe outro WhatsApp.
//
// Z-API manda o número internacional já completo: DDI + número, só dígitos.
// Celular BR chega como 55 + 11. EUA/Canadá (NANP) chega como 1 + 10, que
// também tem 11 dígitos. Dinamarca chega como 45 + 8 = 10. A heurística antiga
// prefixava 55 em todo mundo com 11 dígitos — era o celular BR sem DDI
// (DDD + 9 + número) — e transformava +1 202 555 0147 em 5512025550147.
// Lookup e onboarding nunca batiam.
//
// Plano dinamarquês (Energistyrelsen / ITU-T E.164): fechado, 8 dígitos,
// sem código de área. DDI 45. Assinante começa com 2–9. Séries 0–1 são
// código curto (3 a 6 dígitos), não WhatsApp. A série 37 é M2M de 12 dígitos.
// O de referência, +45 81 92 71 02, é móvel da série 81.
//
// Separação, sem tabela de códigos de área:
// - Celular BR nacional: DDD [1-9][0-9] + nono dígito 9 + 8 dígitos.
// - NANP com DDI: 1 + área NXX + central NXX + 4. Área e central não começam
//   com 0 ou 1. DDD 11 começa com 11, então nunca é NANP.
// - Empate (DDD 12–19, terceiro dígito 9, que também passa na regra NANP)
//   fica com o Brasil. Códigos N9X estão reservados e fora de serviço, e o
//   webhook BR da Z-API já traz o 55.
// - Dinamarca com DDI: 45 + 8 dígitos começando em 2–9. Isso também tem 10
//   dígitos, então vem ANTES de prefixar 1 no NANP nacional — senão
//   +45 22 34 56 78 (área 452 na leitura americana) vira 145….
// - Empate 45X (área NANP 452–459 digitada sem o +1) fica com a Dinamarca.
//   A Z-API manda +45 em 10 dígitos e +1 em 11, com o 1 na frente. Área 450
//   (Québec) tem terceiro dígito 0, não é assinante DK, e continua ganhando o 1.
//   Oregon 458 com +1 explícito continua NANP.
// - Nacional DK de 8 dígitos ganha 45 só sem o 9 na terceira casa. Com esse 9
//   é empate com celular BR pela metade (DDD 81 + 927102… é Recife, e também
//   é 81 92 71 02). Não inventa 45 nem 55: a pessoa manda o +45, que a Z-API
//   já manda completo.

const BR_MOBILE_NATIONAL = /^[1-9][0-9]9\d{8}$/;
const BR_MOBILE_E164 = /^55[1-9][0-9]9\d{8}$/;
const NANP_E164 = /^1[2-9]\d{2}[2-9]\d{6}$/;
const NANP_NATIONAL = /^[2-9]\d{2}[2-9]\d{6}$/;
const DK_E164 = /^45[2-9]\d{7}$/;
// Terceira casa 0–8: não é o nono dígito do celular BR.
const DK_NATIONAL = /^[2-9]\d[0-8]\d{5}$/;

export function normalizePhone(phone: unknown): string {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return "";

  // Já tem DDI 55: não prefixa de novo, mesmo num tamanho estranho.
  if (digits.startsWith("55")) return digits;

  // Celular BR sem DDI, inclusive DDD 11–19 (começam com 1) e DDD 45.
  if (BR_MOBILE_NATIONAL.test(digits)) return "55" + digits;

  // Dinamarca já com DDI 45. Dez dígitos; não pode cair no prefixo 1 do NANP.
  if (DK_E164.test(digits)) return digits;

  // EUA/Canadá já com DDI 1.
  if (NANP_E164.test(digits)) return digits;

  // EUA/Canadá sem DDI. Dez dígitos também é telefone BR antigo (sem o nono),
  // mas esse caso com DDD 1 não cai aqui, e a Z-API manda o DDI. O número
  // americano de 10 dígitos é o que precisa ganhar o 1.
  if (NANP_NATIONAL.test(digits)) return "1" + digits;

  // Dinamarca sem DDI, quando não parece celular BR incompleto.
  if (DK_NATIONAL.test(digits)) return "45" + digits;

  // Outro país, ou resto curto: não inventa 55. A Z-API já manda o completo.
  return digits;
}

// AGENTE_SILENCIADOS e o webhook passam pela mesma normalização. O segredo
// pode vir como +45 81 92 71 02 e o payload da Z-API como 4581927102.
export function parseSilenciados(lista: unknown): Set<string> {
  return new Set(
    String(lista ?? "")
      .split(",")
      .map((s) => normalizePhone(s))
      .filter(Boolean),
  );
}

export function isBrazilMobileE164(digits: string): boolean {
  return BR_MOBILE_E164.test(String(digits || ""));
}

export function isNanpE164(digits: string): boolean {
  return NANP_E164.test(String(digits || ""));
}

export function isDenmarkE164(digits: string): boolean {
  return DK_E164.test(String(digits || ""));
}
