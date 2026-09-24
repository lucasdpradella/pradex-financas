// Telefone do WhatsApp. A heurística antiga via "11 dígitos → põe 55", o que
// servia pro celular BR sem DDI e estragava o NANP (1 + 10 também tem 11).
// Lookup e onboarding comparam a string exata em fp_perfil.telefone, então o
// agente e o app têm que normalizar igual.
import { describe, it, expect } from "vitest";
import { normalizePhone, isBrazilMobileE164, isNanpE164 } from "../supabase/functions/agente-pradex/phone.ts";
import {
  normalizeTelefone, isValidTelefone, isValidTelefoneBr, isValidTelefoneNanp,
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

  it("é idempotente", () => {
    for (const bruto of ["11999998888", "5511999998888", "+1 202 555 0147", "2025550147", "351912345678"]) {
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
  });

  it("o app usa a mesma função", () => {
    expect(normalizeTelefone("+1 (202) 555-0147")).toBe(normalizePhone("+1 (202) 555-0147"));
    expect(normalizeTelefone("11999998888")).toBe("5511999998888");
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
    expect(isValidTelefone("11999998888")).toBe(false);
    expect(isValidTelefone("123")).toBe(false);
    expect(isValidTelefone("351912345678")).toBe(false);
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
});
