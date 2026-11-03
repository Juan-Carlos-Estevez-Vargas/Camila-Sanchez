/**
 * Las migraciones nuevas de un PR tienen que ir DESPUÉS de todas las que ya
 * están en la rama base.
 *
 * `supabase db push` se niega a aplicar una migración con fecha anterior a la
 * última que ya corrió en producción. Pasa cuando dos PRs agregan migraciones
 * a la vez y se fusiona primero el que tiene la fecha más nueva: el despliegue
 * del segundo falla. Esta revisión lo detecta en el PR, antes del merge.
 *
 *   node scripts/check-migration-order.mjs origin/master
 */
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = "supabase/migrations";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Migraciones nuevas que quedarían antes de la última de la base.
 * @param {string[]} base   nombres de archivo en la rama base
 * @param {string[]} branch nombres de archivo en esta rama
 */
export function misorderedMigrations(base, branch) {
  const known = new Set(base);
  const last = [...base].sort().at(-1) ?? "";
  return branch.filter((f) => !known.has(f) && f < last);
}

function main(baseRef) {
  const base = execFileSync("git", ["ls-tree", "--name-only", `${baseRef}:${DIR}`], { cwd: ROOT, encoding: "utf8" })
    .split("\n").filter((f) => f.endsWith(".sql"));
  const branch = readdirSync(join(ROOT, DIR)).filter((f) => f.endsWith(".sql"));
  const wrong = misorderedMigrations(base, branch);
  if (wrong.length > 0) {
    const last = [...base].sort().at(-1);
    console.error(
      `Estas migraciones quedan antes de ${last}, que ya está en ${baseRef}:\n  ${wrong.join("\n  ")}\n` +
        "Cámbiales el nombre a una fecha posterior (y corre npm run db:setup-sql); si no, supabase db push las rechaza.",
    );
    process.exit(1);
  }
  console.log("Migraciones en orden ✔");
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main(process.argv[2] ?? "origin/master");
}
