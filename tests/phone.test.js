// Telefone do WhatsApp. A heurística antiga via "11 dígitos → põe 55", o que
// servia pro celular BR sem DDI e estragava o NANP (1 + 10 também tem 11).
// Lookup e onboarding comparam a string exata em fp_perfil.telefone, então o
// agente e o app têm que normalizar igual.
import { describe, it, expect } from "vitest";
import { normalizePhone, isBrazilMobileE164, isNanpE164, isDenmarkE164, parseSilenciados } from "../supabase/functions/agente-pradex/phone.ts";
import {
  normalizeTelefone, isValidTelefone, isValidTelefoneBr, isValidTelefoneNanp, isValidTelefoneDk,
  formatTelefoneInput, formatTelefoneDisplay,
} from "../src/utils/phone.js";

describe("normalizePhone", () => {
  it("celular BR sem DDI ganha 55, inclusive DDD 11", () => {
    expect(normalizePhone("11999998888")).toBe("5511999998888");
    expect(normalizePhone("(11) 99999-8888")).toBe("5511999998888");
    expect(normalizePhone("21988887777")).toBe("5521988887777");
    // Interior de SP começa com 1 e o terceiro dígito é 9. Continua Brasil:
    // o empate com NANP (área N9X, reservada) fica com o DDD.
    expect(normalizePhone("19988887777")).toBe("5519988887777");
  });

  it("número que já começa com 55 fica como está", () => {
    expect(normalizePhone("5511999998888")).toBe("5511999998888");
    expect(normalizePhone("+55 11 99999-8888")).toBe("5511999998888");
    expect(normalizePhone("55 21 98888-7777")).toBe("5521988887777");
    // 11 dígitos que já são 55 não ganham outro 55.
    expect(normalizePhone("55987654321")).toBe("55987654321");
  });

  it("EUA com +1, com 11 dígitos e com 10 dígitos fica com DDI 1", () => {
    expect(normalizePhone("+1 (202) 555-0147")).toBe("12025550147");
    expect(normalizePhone("12025550147")).toBe("12025550147");
    expect(normalizePhone("1-202-555-0147")).toBe("12025550147");
    expect(normalizePhone("2025550147")).toBe("12025550147");
    expect(normalizePhone("+1 917 555 1234")).toBe("19175551234");
    // O bug: 11 dígitos começando com 1 não podem virar 55…
    expect(normalizePhone("12025550147").startsWith("55")).toBe(false);
  });

  it("Dinamarca +45 fica 45 + 8 dígitos e nunca ganha 55 nem 1", () => {
    // Plano fechado: DDI 45 + assinante de 8 dígitos. Referência móvel da série 81.
    expect(normalizePhone("+45 81 92 71 02")).toBe("4581927102");
    expect(normalizePhone("4581927102")).toBe("4581927102");
    expect(normalizePhone("45 81927102")).toBe("4581927102");
    expect(normalizePhone("0045 81 92 71 02")).toBe("4581927102");
    expect(normalizePhone("+45 81 92 71 02").startsWith("55")).toBe(false);
    expect(normalizePhone("4581927102").startsWith("5545")).toBe(false);
    expect(normalizePhone("+45 81 92 71 02").startsWith("1")).toBe(false);
    // Móvel 22 também parece área NANP 452. O +45 completo não ganha o 1.
    expect(normalizePhone("+45 22 34 56 78")).toBe("4522345678");
    expect(normalizePhone("4522345678")).toBe("4522345678");
    // Nacional de 8 dígitos sem o 9 do celular BR ganha 45.
    expect(normalizePhone("22345678")).toBe("4522345678");
    // 81 92 71 02 sem o 45 é empate com DDD 81 (Recife) pela metade. Não inventa DDI.
    expect(normalizePhone("81927102")).toBe("81927102");
    expect(normalizePhone("81927102").startsWith("55")).toBe(false);
    expect(normalizePhone("81927102").startsWith("45")).toBe(false);
  });

  it("é idempotente", () => {
    for (const bruto of ["11999998888", "5511999998888", "+1 202 555 0147", "2025550147", "+45 81 92 71 02", "22345678", "351912345678"]) {
      const uma = normalizePhone(bruto);
      expect(normalizePhone(uma)).toBe(uma);
    }
  });

  it("casos estranhos não inventam DDI", () => {
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone(undefined)).toBe("");
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("abc")).toBe("");
    expect(normalizePhone("123")).toBe("123");
    // JID do WhatsApp e prefixo internacional 00.
    expect(normalizePhone("14155552671@c.us")).toBe("14155552671");
    expect(normalizePhone("0012025550147")).toBe("12025550147");
    // Outro país: a Z-API já manda o número completo. Não vira 55.
    expect(normalizePhone("351912345678")).toBe("351912345678");
    expect(normalizePhone("+44 7911 123456")).toBe("447911123456");
    // Área 450 (Québec) não é assinante DK: terceiro dígito 0. Continua NANP.
    expect(normalizePhone("4505551234")).toBe("14505551234");
    // Oregon 458 com +1 explícito continua EUA. Sem o 1, 10 dígitos 45 + assinante fica DK.
    expect(normalizePhone("+1 458 555 0147")).toBe("14585550147");
    expect(normalizePhone("4585550147")).toBe("4585550147");
    // DDD 45 do Paraná continua Brasil, 11 dígitos com o 9.
    expect(normalizePhone("45999998888")).toBe("5545999998888");
    expect(normalizePhone("(45) 99999-8888")).toBe("5545999998888");
  });

  it("o app usa a mesma função", () => {
    expect(normalizeTelefone("+1 (202) 555-0147")).toBe(normalizePhone("+1 (202) 555-0147"));
    expect(normalizeTelefone("11999998888")).toBe("5511999998888");
    expect(normalizeTelefone("+45 81 92 71 02")).toBe("4581927102");
  });

  it("silenciados comparam o mesmo dígito do perfil", () => {
    const set = parseSilenciados("+45 81 92 71 02, 5511999998888, +1 202 555 0147");
    expect(set.has(normalizePhone("4581927102"))).toBe(true);
    expect(set.has(normalizePhone("45 81927102"))).toBe(true);
    expect(set.has("5511999998888")).toBe(true);
    expect(set.has(normalizePhone("12025550147"))).toBe(true);
    expect(set.has("554581927102")).toBe(false);
  });
});

describe("validação", () => {
  it("aceita celular BR e NANP já normalizados, e recusa o resto", () => {
    expect(isBrazilMobileE164("5511999998888")).toBe(true);
    expect(isValidTelefoneBr("5511999998888")).toBe(true);
    expect(isNanpE164("12025550147")).toBe(true);
    expect(isValidTelefoneNanp("12025550147")).toBe(true);
    expect(isValidTelefone("5511999998888")).toBe(true);
    expect(isValidTelefone("12025550147")).toBe(true);
    expect(isValidTelefone(normalizeTelefone("(11) 99999-8888"))).toBe(true);
    expect(isValidTelefone(normalizeTelefone("+1 202 555 0147"))).toBe(true);
    expect(isValidTelefone(normalizeTelefone("2025550147"))).toBe(true);
    expect(isDenmarkE164("4581927102")).toBe(true);
    expect(isValidTelefoneDk("4581927102")).toBe(true);
    expect(isValidTelefone("4581927102")).toBe(true);
    expect(isValidTelefone(normalizeTelefone("+45 81 92 71 02"))).toBe(true);
    expect(isValidTelefone(normalizeTelefone("45 81927102"))).toBe(true);
    expect(isValidTelefone(normalizeTelefone("+45 22 34 56 78"))).toBe(true);
    expect(isValidTelefone("81927102")).toBe(false);
    expect(isValidTelefone("11999998888")).toBe(false);
    expect(isValidTelefone("123")).toBe(false);
    expect(isValidTelefone("351912345678")).toBe(false);
    // DDD 45 normalizado continua celular BR, não Dinamarca.
    expect(isValidTelefoneBr(normalizeTelefone("45999998888"))).toBe(true);
    expect(isValidTelefoneDk(normalizeTelefone("45999998888"))).toBe(false);
  });
});

describe("máscara", () => {
  it("BR continua (11) 99999-9999, com ou sem 55", () => {
    expect(formatTelefoneInput("11999998888")).toBe("(11) 99999-8888");
    expect(formatTelefoneInput("5511999998888")).toBe("(11) 99999-8888");
    expect(formatTelefoneInput("11")).toBe("(11");
    expect(formatTelefoneInput("19988887777")).toBe("(19) 98888-7777");
    expect(formatTelefoneDisplay("5511999998888")).toBe("(11) 99999-8888");
  });

  it("EUA com DDI aparece como +1", () => {
    expect(formatTelefoneInput("120")).toBe("+1 (20");
    expect(formatTelefoneInput("12025550147")).toBe("+1 (202) 555-0147");
    expect(formatTelefoneInput("+1 (202) 555-0147")).toBe("+1 (202) 555-0147");
    expect(formatTelefoneInput("19175551234")).toBe("+1 (917) 555-1234");
    expect(formatTelefoneDisplay("12025550147")).toBe("+1 (202) 555-0147");
  });

  it("Dinamarca com DDI aparece como +45 81 92 71 02", () => {
    expect(formatTelefoneInput("+45 81 92 71 02")).toBe("+45 81 92 71 02");
    expect(formatTelefoneInput("4581927102")).toBe("+45 81 92 71 02");
    expect(formatTelefoneInput("45 81927102")).toBe("+45 81 92 71 02");
    expect(formatTelefoneInput("458")).toBe("+45 8");
    expect(formatTelefoneInput("4581")).toBe("+45 81");
    expect(formatTelefoneDisplay("4581927102")).toBe("+45 81 92 71 02");
    // DDD 45 ainda é máscara brasileira. O 9 segura até fechar 11 dígitos.
    expect(formatTelefoneInput("45")).toBe("(45");
    expect(formatTelefoneInput("459")).toBe("(45) 9");
    expect(formatTelefoneInput("45999998888")).toBe("(45) 99999-8888");
    expect(formatTelefoneDisplay("5545999998888")).toBe("(45) 99999-8888");
  });
});
