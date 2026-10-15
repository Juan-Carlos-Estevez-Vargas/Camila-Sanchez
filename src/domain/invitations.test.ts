import { describe, expect, it } from "vitest";
import {
  buildInviteUrl, expiryFromNow, generateInviteToken, hashInviteToken, invitationStatus,
  isInviteToken, readInviteToken,
} from "./invitations";

describe("tokens de invitación", () => {
  it("son de 43 caracteres base64url y distintos cada vez", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(isInviteToken(a)).toBe(true);
    expect(a).not.toBe(b);
  });

  it("se guardan como SHA-256 en hexadecimal", async () => {
    expect(await hashInviteToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("viajan en el #fragmento de la URL", () => {
    const token = generateInviteToken();
    const url = buildInviteUrl("https://ejemplo.app/", token);
    expect(url).toBe(`https://ejemplo.app/invitacion#${token}`);
    expect(readInviteToken(new URL(url).hash)).toBe(token);
    expect(readInviteToken(`#token=${token}`)).toBe(token);
    expect(readInviteToken("#corto")).toBeNull();
    expect(readInviteToken("")).toBeNull();
  });
});

describe("estado de una invitación", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  it("pendiente, usada o vencida", () => {
    expect(invitationStatus({ usedAt: null, expiresAt: expiryFromNow(24, now) }, now)).toBe("pending");
    expect(invitationStatus({ usedAt: now.toISOString(), expiresAt: expiryFromNow(24, now) }, now)).toBe("used");
    expect(invitationStatus({ usedAt: null, expiresAt: expiryFromNow(-1, now) }, now)).toBe("expired");
  });
});
