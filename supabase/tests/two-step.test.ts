/**
 * Verificación en dos pasos: quien la activó no recibe nada de la base hasta
 * escribir el código (sesión aal2); quien no la activó sigue igual.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { SUPABASE_STUB } from "./supabaseStub";

const ROOT = join(__dirname, "..");
const JUAN = "11111111-1111-1111-1111-111111111111";
const CAMI = "22222222-2222-2222-2222-222222222222";
const POLICY = "dos pasos: falta el código";

let db: PGlite;

/** Ejecuta SQL como un usuario con la sesión del nivel indicado. */
async function as<T = Record<string, unknown>>(uid: string, aal: "aal1" | "aal2", sql: string): Promise<T[]> {
  await db.exec(
    `begin; set local role authenticated;
     select set_config('request.jwt.sub', '${uid}', true);
     select set_config('request.jwt.claims', '{"sub":"${uid}","aal":"${aal}"}', true);`,
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
    grant select on auth.mfa_factors to authenticated;
    insert into auth.users (id, email) values ('${JUAN}', 'juan@example.com'), ('${CAMI}', 'cami@example.com');
    update public.profiles set role = 'super_admin', display_name = 'Juan' where id = '${JUAN}';
    update public.profiles set role = 'editor', display_name = 'Camila' where id = '${CAMI}';
    -- Camila activó la verificación; Juan no. Un intento sin terminar no cuenta.
    insert into auth.mfa_factors (user_id, status) values ('${CAMI}', 'verified'), ('${JUAN}', 'unverified');
  `);
}, 60_000);

describe("verificación en dos pasos", () => {
  it("cada tabla con RLS y storage.objects llevan la política restrictiva", async () => {
    const { rows: missing } = await db.query<{ relname: string }>(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
         and not exists (select 1 from pg_policy p where p.polrelid = c.oid and p.polname = '${POLICY}' and not p.polpermissive)`);
    expect(missing).toEqual([]);
    const { rows } = await db.query(`select 1 from pg_policy where polrelid = 'storage.objects'::regclass and polname = '${POLICY}'`);
    expect(rows).toHaveLength(1);
  });

  it("sin la verificación activada, una sesión normal ve todo como siempre", async () => {
    const [row] = await as<{ n: number }>(JUAN, "aal1", "select count(*)::int as n from photos");
    expect(row!.n).toBeGreaterThan(0);
    await expect(as(JUAN, "aal1", "select public.check_request()")).resolves.toBeDefined();
  });

  it("con la verificación activada y sin el código, la base no entrega nada", async () => {
    expect(await as(CAMI, "aal1", "select count(*)::int as n from photos")).toEqual([{ n: 0 }]);
    expect(await as(CAMI, "aal1", "select count(*)::int as n from profiles")).toEqual([{ n: 0 }]);
    await expect(as(CAMI, "aal1", "select public.check_request()")).rejects.toThrow(/dos pasos/);
    await expect(as(CAMI, "aal1", "update profiles set bio = 'hola' where id = auth.uid() returning id")).resolves.toEqual([]);
  });

  it("después de escribir el código (aal2) todo vuelve a funcionar", async () => {
    const [row] = await as<{ n: number }>(CAMI, "aal2", "select count(*)::int as n from photos");
    expect(row!.n).toBeGreaterThan(0);
    await expect(as(CAMI, "aal2", "select public.check_request()")).resolves.toBeDefined();
  });

  it("PostgREST revisa cada petición con check_request", async () => {
    const { rows } = await db.query<{ setconfig: string[] }>(
      "select setconfig from pg_db_role_setting where setrole = 'authenticator'::regrole");
    expect(rows[0]?.setconfig).toContain("pgrst.db_pre_request=public.check_request");
  });

  it("sólo quien gestiona cuentas sabe quién la tiene activada", async () => {
    expect(await as(JUAN, "aal1", "select public.two_step_users() as id")).toEqual([{ id: CAMI }]);
    expect(await as(CAMI, "aal2", "select public.two_step_users() as id")).toEqual([]);
  });
});
