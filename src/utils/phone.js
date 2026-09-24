// Brasil: DDI 55 + DDD + 9 + 8 dígitos. EUA/Canadá: DDI 1 + 10 dígitos.
// A normalização mora em phone.ts do agente — cadastro, perfil e WhatsApp
// precisam gravar o mesmo dígito em fp_perfil.telefone.
import { normalizePhone, isBrazilMobileE164, isNanpE164 } from "../../supabase/functions/agente-pradex/phone.ts";

const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

export function normalizeTelefone(value) {
  return normalizePhone(value);
}

export function isValidTelefoneBr(normalizado) {
  return isBrazilMobileE164(String(normalizado || ""));
}

export function isValidTelefoneNanp(normalizado) {
  return isNanpE164(String(normalizado || ""));
}

export function isValidTelefone(normalizado) {
  const digits = String(normalizado || "");
  return isValidTelefoneBr(digits) || isValidTelefoneNanp(digits);
}

export function formatTelefoneDisplay(normalizado) {
  const digits = String(normalizado || "");
  if (isValidTelefoneBr(digits)) {
    const ddd = digits.slice(2, 4);
    const prefix = digits.slice(4, 9);
    const suffix = digits.slice(9, 13);
    return `(${ddd}) ${prefix}-${suffix}`;
  }
  if (isValidTelefoneNanp(digits)) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }
  return digits;
}

// "1" sozinho ou DDD 11 ainda é máscara brasileira. NANP só quando o segundo
// dígito já é área (2–9) e o terceiro não é o 9 do celular BR (DDD 12–19).
function isNanpTyping(digits) {
  if (!digits.startsWith("1") || digits.length < 3) return false;
  if (digits[1] < "2" || digits[1] > "9") return false;
  if (digits[2] === "9") return false;
  return true;
}

function formatNanpInput(digits) {
  const rest = digits.slice(1);
  if (rest.length === 0) return "+1";
  if (rest.length <= 3) return `+1 (${rest}`;
  if (rest.length <= 6) return `+1 (${rest.slice(0, 3)}) ${rest.slice(3)}`;
  return `+1 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 10)}`;
}

function formatBrInput(digits) {
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Máscara progressiva. BR continua (11) 99999-9999. EUA com DDI vira +1 (202) 555-0147.
export function formatTelefoneInput(value) {
  let digits = onlyDigits(value);
  if (isNanpTyping(digits)) return formatNanpInput(digits.slice(0, 11));
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  return formatBrInput(digits.slice(0, 11));
}
