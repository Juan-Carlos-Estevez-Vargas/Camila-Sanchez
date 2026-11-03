/**
 * Escaneo de dependencias de las Edge Functions.
 *
 * Las funciones de supabase/functions importan paquetes con `npm:nombre@x.y.z`
 * y no tienen package.json, así que ni `npm audit` ni Dependabot las ven.
 * Este script:
 *   1. exige que cada import tenga una versión exacta (nada de ^, ~ o latest);
 *   2. arma un package.json temporal con esas versiones y corre `npm audit`
 *      sobre él (incluye las dependencias de las dependencias).
 *
 *   node scripts/audit-edge-deps.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMPORT = /["']npm:((?:@[\w.-]+\/)?[\w.-]+)@([^"'/]+)(?:\/[^"']*)?["']/g;
const EXACT = /^\d+\.\d+\.\d+(?:-[\w.]+)?$/;

/**
 * Imports `npm:` de un archivo.
 * @param {string} source
 * @returns {Array<{ name: string, version: string }>}
 */
export function parseNpmImports(source) {
  return [...source.matchAll(IMPORT)].map((m) => ({ name: m[1], version: m[2] }));
}

/**
 * Junta los imports de todas las funciones y señala los problemas: versiones
 * no exactas o el mismo paquete en dos versiones distintas.
 * @param {Array<{ file: string, source: string }>} files
 */
export function collectEdgeDeps(files) {
  const deps = new Map();
  const problems = [];
  for (const { file, source } of files) {
    for (const { name, version } of parseNpmImports(source)) {
      if (!EXACT.test(version)) problems.push(`${file}: ${name}@${version} debe tener una versión exacta (x.y.z)`);
      const seen = deps.get(name);
      if (seen && seen !== version) problems.push(`${file}: ${name} aparece en ${seen} y en ${version}; usa una sola versión`);
      deps.set(name, seen ?? version);
    }
  }
  return { deps: Object.fromEntries(deps), problems };
}

function listTs(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return listTs(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

function main() {
  const files = listTs(join(ROOT, "supabase", "functions")).map((path) => ({
    file: path.slice(ROOT.length + 1),
    source: readFileSync(path, "utf8"),
  }));
  const { deps, problems } = collectEdgeDeps(files);
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(`Dependencias de las Edge Functions: ${Object.entries(deps).map(([n, v]) => `${n}@${v}`).join(", ")}`);

  const dir = mkdtempSync(join(tmpdir(), "edge-deps-"));
  try {
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "edge-functions", private: true, dependencies: deps }));
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    execFileSync(npm, ["install", "--package-lock-only", "--ignore-scripts", "--no-audit", "--no-fund", "--silent"], { cwd: dir, stdio: "inherit" });
    execFileSync(npm, ["audit", "--audit-level=moderate"], { cwd: dir, stdio: "inherit" });
  } catch {
    console.error("\nLas Edge Functions usan una versión con fallas de seguridad: sube la versión en sus imports npm:.");
    process.exitCode = 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) main();
