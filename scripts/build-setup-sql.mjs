/**
 * Une todas las migraciones y el seed en `supabase/setup.sql` para poder
 * crear la base de datos pegando un solo archivo en el SQL Editor de
 * Supabase, sin instalar la CLI.
 *
 *   npm run db:setup-sql
 *
 * Una prueba (supabase/tests/setup-sql.test.ts) avisa si se olvida regenerarlo.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SUPABASE = join(dirname(fileURLToPath(import.meta.url)), "..", "supabase");

export function buildSetupSql(dir = SUPABASE) {
  const migrations = readdirSync(join(dir, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  const parts = [...migrations.map((f) => `migrations/${f}`), "seed.sql"].map(
    (file) => `-- >>> ${file}\n${readFileSync(join(dir, file), "utf8").trimEnd()}\n`,
  );
  return [
    "-- =============================================================================",
    "-- Archivo generado con `npm run db:setup-sql`; no lo edites a mano.",
    "-- Crea toda la base de datos (migraciones + contenido inicial) de una vez.",
    "-- Pégalo completo en Supabase → SQL Editor → Run, una sola vez, en un",
    "-- proyecto nuevo.",
    "-- =============================================================================",
    "",
    parts.join("\n"),
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(join(SUPABASE, "setup.sql"), buildSetupSql());
  console.log("supabase/setup.sql actualizado");
}
