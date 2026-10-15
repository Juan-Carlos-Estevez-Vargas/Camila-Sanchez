import { describe, expect, it } from "vitest";
import { buildRecoveryUrl, readRecoveryLink } from "./recovery";

const HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c";

describe("enlaces de recuperación", () => {
  it("llevan el token en el #fragmento y se leen de vuelta", () => {
    const url = buildRecoveryUrl("https://ejemplo.app/", HASH);
    expect(url).toBe(`https://ejemplo.app/recuperar#token_hash=${HASH}`);
    expect(readRecoveryLink(new URL(url).hash)).toEqual({ kind: "token", tokenHash: HASH });
  });

  it("reconocen el error de enlace vencido que devuelve Supabase", () => {
    expect(readRecoveryLink("#error=access_denied&error_code=otp_expired&error_description=x"))
      .toEqual({ kind: "error", expired: true });
    expect(readRecoveryLink("#error=server_error")).toEqual({ kind: "error", expired: false });
    expect(readRecoveryLink("?error=access_denied&error_code=otp_expired")).toEqual({ kind: "error", expired: true });
  });

  it("ignoran fragmentos vacíos o con tokens malformados", () => {
    expect(readRecoveryLink("")).toEqual({ kind: "none" });
    expect(readRecoveryLink("#token_hash=corto")).toEqual({ kind: "none" });
    expect(readRecoveryLink("#token_hash=<script>alert(1)</script>xxxxxxxx")).toEqual({ kind: "none" });
  });
});
