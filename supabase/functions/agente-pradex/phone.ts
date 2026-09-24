// Normalização de telefone do WhatsApp.
//
// Espelhada por src/utils/phone.js (reexporta daqui). O agente grava em
// fp_perfil.telefone o mesmo dígito que cadastro e perfil salvam. Se as duas
// pontas divergirem, o lookup não acha a conta e o onboarding acha que já
// existe outro WhatsApp.
//
// Z-API manda o número internacional já completo: DDI + número, só dígitos.
// Celular BR chega como 55 + 11. EUA/Canadá (NANP) chega como 1 + 10, que
// também tem 11 dígitos. A heurística antiga prefixava 55 em todo mundo com
// 11 dígitos — era o celular BR sem DDI (DDD + 9 + número) — e transformava
// +1 202 555 0147 em 5512025550147. Lookup e onboarding nunca batiam.
//
// Separação, sem tabela de códigos de área:
// - Celular BR nacional: DDD [1-9][0-9] + nono dígito 9 + 8 dígitos.
// - NANP com DDI: 1 + área NXX + central NXX + 4. Área e central não começam
//   com 0 ou 1. DDD 11 começa com 11, então nunca é NANP.
// - Empate (DDD 12–19, terceiro dígito 9, que também passa na regra NANP)
//   fica com o Brasil. Códigos N9X estão reservados e fora de serviço, e o
//   webhook BR da Z-API já traz o 55.

const BR_MOBILE_NATIONAL = /^[1-9][0-9]9\d{8}$/;
const BR_MOBILE_E164 = /^55[1-9][0-9]9\d{8}$/;
const NANP_E164 = /^1[2-9]\d{2}[2-9]\d{6}$/;
const NANP_NATIONAL = /^[2-9]\d{2}[2-9]\d{6}$/;

export function normalizePhone(phone: unknown): string {
  let digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits) return "";

  // Já tem DDI 55: não prefixa de novo, mesmo num tamanho estranho.
  if (digits.startsWith("55")) return digits;

  // Celular BR sem DDI, inclusive DDD 11–19 (começam com 1).
  if (BR_MOBILE_NATIONAL.test(digits)) return "55" + digits;

  // EUA/Canadá já com DDI 1.
  if (NANP_E164.test(digits)) return digits;

  // EUA/Canadá sem DDI. Dez dígitos também é telefone BR antigo (sem o nono),
  // mas esse caso com DDD 1 não cai aqui, e a Z-API manda o DDI. O número
  // americano de 10 dígitos é o que precisa ganhar o 1.
  if (NANP_NATIONAL.test(digits)) return "1" + digits;

  // Outro país, ou resto curto: não inventa 55. A Z-API já manda o completo.
  return digits;
}

export function isBrazilMobileE164(digits: string): boolean {
  return BR_MOBILE_E164.test(String(digits || ""));
}

export function isNanpE164(digits: string): boolean {
  return NANP_E164.test(String(digits || ""));
}
