/**
 * Prueba del consentimiento (Ley 1581): cada quien registra sólo su propia
 * aceptación, no la puede cambiar ni borrar, y sólo quien gestiona usuarios
 * ve las de los demás.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { SUPABASE_STUB } from "./supabaseStub";

const ROOT = join(__dirname, "..");
const JUAN = "11111111-1111-1111-1111-111111111111";
const CAMI = "22222222-2222-2222-2222-222222222222";
const GUEST = "33333333-3333-3333-3333-333333333333";

let db: PGlite;

async function as<T = Record<string, unknown>>(uid: string | null, sql: string): Promise<T[]> {
  await db.exec(
    `begin; set local role ${uid ? "authenticated" : "anon"};
     select set_config('request.jwt.sub', '${uid ?? ""}', true);`,
  );
  try {
    const result = await db.query<T>(sql);
    await db.exec("commit");
    return result.rows;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(join(ROOT, "migrations")).sort()) {
    await db.exec(readFileSync(join(ROOT, "migrations", file), "utf8"));
  }
  await db.exec(readFileSync(join(ROOT, "seed.sql"), "utf8"));
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to anon, authenticated;
    insert into auth.users (id, email) values
      ('${JUAN}', 'juan@example.com'), ('${CAMI}', 'cami@example.com'), ('${GUEST}', 'guest@example.com');
    update public.profiles set role = 'super_admin' where id = '${JUAN}';
    update public.profiles set role = 'editor' where id = '${CAMI}';
  `);
}, 60_000);

describe("aceptación de términos y privacidad", () => {
  it("cada quien registra la suya y la base pone quién y cuándo", async () => {
    await as(CAMI, `insert into legal_consents (version, accepted_at) values ('2026-11-03', '2000-01-01')`);
    const [row] = await as<{ user_id: string; old: boolean }>(CAMI, "select user_id, accepted_at < '2020-01-01' as old from legal_consents");
    expect(row).toEqual({ user_id: CAMI, old: false });
  });

  it("no se puede registrar a nombre de otra persona", async () => {
    await as(GUEST, `insert into legal_consents (user_id, version) values ('${CAMI}', '2026-12-01')`);
    const rows = await as<{ user_id: string }>(JUAN, "select user_id from legal_consents where version = '2026-12-01'");
    expect(rows).toEqual([{ user_id: GUEST }]);
  });

  it("no se puede cambiar ni borrar una aceptación", async () => {
    await as(CAMI, "update legal_consents set version = '1999-01-01'");
    await as(CAMI, "delete from legal_consents");
    const rows = await as<{ version: string }>(CAMI, "select version from legal_consents");
    expect(rows).toEqual([{ version: "2026-11-03" }]);
  });

  it("sólo quien gestiona usuarios ve las de los demás", async () => {
    expect(await as(GUEST, `select 1 from legal_consents where user_id = '${CAMI}'`)).toEqual([]);
    expect(await as(null, "select 1 from legal_consents")).toEqual([]);
    expect((await as(JUAN, `select 1 from legal_consents where user_id = '${CAMI}'`)).length).toBe(1);
  });

  it("la versión tiene que ser una fecha", async () => {
    await expect(as(CAMI, "insert into legal_consents (version) values ('cualquier cosa')")).rejects.toThrow();
  });
});
