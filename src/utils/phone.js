// Brasil: DDI 55 + DDD (11-99) + 9 + 8 dígitos
const TELEFONE_REGEX = /^55[1-9][0-9]9[0-9]{8}$/;

const onlyDigits = (value) => String(value || "").replace(/\D/g, "");

export function normalizeTelefone(value) {
  let digits = onlyDigits(value);
  if (digits.length === 11) digits = "55" + digits;
  return digits;
}

export function isValidTelefoneBr(normalizado) {
  return TELEFONE_REGEX.test(String(normalizado || ""));
}

export function formatTelefoneDisplay(normalizado) {
  const digits = String(normalizado || "");
  if (!isValidTelefoneBr(digits)) return digits;
  const ddd = digits.slice(2, 4);
  const prefix = digits.slice(4, 9);
  const suffix = digits.slice(9, 13);
  return `(${ddd}) ${prefix}-${suffix}`;
}

// Máscara progressiva durante digitação. Aceita string parcial e devolve no formato (11) 99999-9999.
export function formatTelefoneInput(value) {
  let digits = onlyDigits(value);
  if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
