import { describe, expect, it } from "vitest";
import { assertPublicEnv, findSecrets, isForbiddenFile } from "./check-secrets.mjs";

// Las claves de prueba se arman por partes para que el propio buscador no
// las encuentre en este archivo.
const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (role: string) => `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ iss: "supabase", role })}.${"s".repeat(43)}`;
const SERVICE_ROLE = jwt("service_role");
const ANON = jwt("anon");

describe("findSecrets", () => {
  it("encuentra la service_role key pero no la anon key (que es pública)", () => {
    expect(findSecrets(`const key = "${SERVICE_ROLE}";`)).toEqual([{ line: 1, kind: "service_role key de Supabase" }]);
    expect(findSecrets(`VITE_SUPABASE_ANON_KEY=${ANON}`)).toEqual([]);
  });

  it("reconoce formatos de claves conocidos", () => {
    const samples = [
      "sb_" + "secret_" + "a".repeat(30),
      "sbp_" + "0".repeat(40),
      "-----BEGIN " + "PRIVATE KEY-----",
      "ghp_" + "A".repeat(36),
      "AKIA" + "ABCDEFGHIJKLMNOP",
    ];
    for (const sample of samples) expect(findSecrets(sample)).toHaveLength(1);
  });

  it("detecta asignaciones con valores reales y deja pasar las referencias", () => {
    expect(findSecrets("SMTP_PASS=" + "hunter2hunter2hunter2")).toHaveLength(1);
    expect(findSecrets('DB_PASSWORD: "' + "S3cr3tValue!2024" + '"')).toHaveLength(1);
    expect(findSecrets("SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}")).toEqual([]);
    expect(findSecrets('const SECRET = Deno.env.get("PUSH_WEBHOOK_SECRET");')).toEqual([]);
    expect(findSecrets("VAPID_PRIVATE_KEY=")).toEqual([]);
    expect(findSecrets("SMTP_PASS=xxxxxxxxxxxxxxxx")).toEqual([]);
    expect(findSecrets("{ SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_TOKEN }")).toEqual([]);
    // Una propiedad de un objeto no es un valor; algo con números sí puede serlo.
    expect(findSecrets("const SPANISH_PASSWORD = spanish.auth.password;")).toEqual([]);
    expect(findSecrets("DB_PASSWORD=" + "hunter2.hunter2.hunter2")).toHaveLength(1);
  });

  it("respeta la marca para falsos positivos", () => {
    expect(findSecrets("SMTP_PASS=" + "hunter2hunter2hunter2 # secret-scan: ignore")).toEqual([]);
  });

  it("indica la línea", () => {
    expect(findSecrets(`uno\ndos\nkey=${SERVICE_ROLE}`)[0]?.line).toBe(3);
  });
});

describe("isForbiddenFile", () => {
  it("no deja versionar .env ni llaves, pero sí .env.example", () => {
    expect(isForbiddenFile(".env")).toBe(true);
    expect(isForbiddenFile("app/.env.local")).toBe(true);
    expect(isForbiddenFile("certs/server.pem")).toBe(true);
    expect(isForbiddenFile(".env.example")).toBe(false);
    expect(isForbiddenFile("src/main.tsx")).toBe(false);
  });
});

describe("assertPublicEnv", () => {
  it("no compila si la anon key es en realidad la service_role", () => {
    expect(() => assertPublicEnv({ VITE_SUPABASE_ANON_KEY: SERVICE_ROLE })).toThrow(/VITE_SUPABASE_ANON_KEY/);
    expect(() => assertPublicEnv({ VITE_SUPABASE_ANON_KEY: "sb_" + "secret_" + "x1".repeat(15) })).toThrow();
  });

  it("acepta la anon key y las variables que no son VITE_*", () => {
    expect(() => assertPublicEnv({ VITE_SUPABASE_ANON_KEY: ANON, VITE_SUPABASE_URL: "https://x.supabase.co" })).not.toThrow();
    expect(() => assertPublicEnv({ SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE })).not.toThrow();
  });
});
