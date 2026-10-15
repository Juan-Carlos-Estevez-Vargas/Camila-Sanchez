/**
 * El archivo único `supabase/setup.sql` (para quien no usa la CLI) debe estar
 * al día con las migraciones y crear una base que funcione junto a roles.sql.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildSetupSql } from "../../scripts/build-setup-sql.mjs";
import { SUPABASE_STUB } from "./supabaseStub";

const ROOT = join(__dirname, "..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

const rolesFor = (juan: string, camila: string) =>
  read("roles.sql").replace("CORREO_DE_JUAN", juan).replace("CORREO_DE_CAMILA", camila);

async function freshDatabase() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(read("setup.sql"));
  await db.exec(`insert into auth.users (id, email) values
    ('11111111-1111-1111-1111-111111111111', 'juan@example.com'),
    ('22222222-2222-2222-2222-222222222222', 'Camila@Example.com')`);
  return db;
}

describe("setup.sql", () => {
  it("está al día con las migraciones y el seed (npm run db:setup-sql)", () => {
    expect(read("setup.sql")).toBe(buildSetupSql(ROOT));
  });

  it("junto con roles.sql deja a Juan como super admin, a Camila como editora y el sitio público", async () => {
    const db = await freshDatabase();
    await db.exec(rolesFor("Juan@example.com", "camila@example.com"));
    const { rows } = await db.query<{ display_name: string; role: string }>(
      "select display_name, role::text from public.profiles order by display_name",
    );
    expect(rows).toEqual([
      { display_name: "Camila", role: "editor" },
      { display_name: "Juan", role: "super_admin" },
    ]);
    const settings = await db.query<{ is_public: boolean }>("select is_public from public.site_settings");
    expect(settings.rows).toEqual([{ is_public: true }]);
    await db.close();
  }, 60_000);

  it("roles.sql avisa si una cuenta no existe", async () => {
    const db = await freshDatabase();
    await expect(db.exec(rolesFor("juan@example.com", "nadie@example.com"))).rejects.toThrow(/Camila/);
    await db.close();
  }, 60_000);
});
