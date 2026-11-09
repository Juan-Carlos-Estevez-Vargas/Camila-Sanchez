import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateSecret, groupSecret, isValidCode, otpauthUri, totpAt, verifyTotp } from "./totp";

// Secreto de los vectores de prueba del RFC 6238 ("12345678901234567890").
const RFC_SECRET = base32Encode(new TextEncoder().encode("12345678901234567890"));

describe("TOTP (verificación en dos pasos)", () => {
  it("da los códigos de los vectores del RFC 6238 (SHA-1, 8 dígitos)", async () => {
    expect(await totpAt(RFC_SECRET, 59_000, 8)).toBe("94287082");
    expect(await totpAt(RFC_SECRET, 1_111_111_109_000, 8)).toBe("07081804");
    expect(await totpAt(RFC_SECRET, 1_234_567_890_000, 8)).toBe("89005924");
    expect(await totpAt(RFC_SECRET, 20_000_000_000_000, 8)).toBe("65353130");
  });

  it("acepta el código actual y el de 30 s antes o después, no otros", async () => {
    const now = 1_700_000_000_000;
    expect(await verifyTotp(RFC_SECRET, await totpAt(RFC_SECRET, now), now)).toBe(true);
    expect(await verifyTotp(RFC_SECRET, await totpAt(RFC_SECRET, now - 30_000), now)).toBe(true);
    expect(await verifyTotp(RFC_SECRET, await totpAt(RFC_SECRET, now + 30_000), now)).toBe(true);
    expect(await verifyTotp(RFC_SECRET, await totpAt(RFC_SECRET, now - 120_000), now)).toBe(false);
    expect(await verifyTotp(RFC_SECRET, "12345", now)).toBe(false);
  });

  it("valida el formato del código (6 dígitos, se ignoran espacios)", () => {
    expect(isValidCode("123 456")).toBe(true);
    expect(isValidCode("12345a")).toBe(false);
    expect(isValidCode("1234567")).toBe(false);
  });

  it("codifica y decodifica base32 y genera secretos de 160 bits", () => {
    const secret = generateSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(groupSecret("ABCDEFGH")).toBe("ABCD EFGH");
  });

  it("arma el enlace otpauth:// para el QR", () => {
    const uri = otpauthUri("ABCD", "cami@demo.local", "Nuestra historia");
    expect(uri).toMatch(/^otpauth:\/\/totp\/Nuestra%20historia%3Acami%40demo\.local\?/);
    expect(uri).toContain("secret=ABCD");
    expect(uri).toContain("digits=6");
  });
});
