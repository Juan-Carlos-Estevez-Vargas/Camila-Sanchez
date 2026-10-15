/**
 * Versión y notas de cada despliegue.
 *
 * El flujo Deploy lo ejecuta después de desplegar y crea con su salida un tag
 * `vX.Y.Z` y un release en GitHub. La versión sigue SemVer a partir de los
 * mensajes de commit (Conventional Commits) desde el último tag:
 *
 *   - `tipo!:` o "BREAKING CHANGE" → versión mayor (3.0.0)
 *   - `feat:`                      → versión menor (2.1.0)
 *   - cualquier otro cambio         → parche       (2.0.1)
 *
 * El primer release toma la versión de package.json. Para forzar un salto
 * (por ejemplo a 3.0.0) basta con subir la versión en package.json.
 *
 *   node scripts/release.mjs   (sin argumentos: modo GitHub Actions)
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = /^v?(\d+)\.(\d+)\.(\d+)$/;
const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
const MERGED_PR = /^Merge pull request #(\d+)/;

/** Secciones de las notas, en el orden en que se muestran. */
const SECTIONS = [
  { title: "⚠️ Cambios importantes", match: (c) => c.breaking },
  { title: "✨ Novedades", match: (c) => c.type === "feat" },
  { title: "🐛 Correcciones", match: (c) => c.type === "fix" },
  { title: "🔒 Seguridad", match: (c) => c.type === "security" },
  { title: "🗄️ Base de datos", match: (c) => c.type === "db" },
  { title: "⚡ Rendimiento", match: (c) => c.type === "perf" },
  { title: "📝 Documentación", match: (c) => c.type === "docs" },
  { title: "🛠️ Mantenimiento", match: () => true },
];

/** @param {string} version */
export function parseVersion(version) {
  const m = SEMVER.exec(version.trim());
  if (!m) throw new Error(`Versión no válida: ${version}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** @param {[number, number, number]} a @param {[number, number, number]} b */
function compare(a, b) {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/**
 * Convierte un commit en una entrada de las notas.
 * @param {{ sha: string, subject: string, body?: string }} commit
 */
export function parseCommit({ sha, subject, body = "" }) {
  const m = CONVENTIONAL.exec(subject.trim());
  const description = (m ? m[4] : subject).trim();
  return {
    sha,
    type: m ? m[1].toLowerCase() : "other",
    scope: m?.[2] ?? null,
    breaking: Boolean(m?.[3]) || /BREAKING[ -]CHANGE/.test(body),
    description: description.charAt(0).toUpperCase() + description.slice(1),
  };
}

/** @param {{ subject: string }} commit */
export function isMerge({ subject }) {
  return /^Merge (pull request|branch|remote-tracking branch)/.test(subject);
}

/**
 * Calcula la siguiente versión.
 * @param {{ lastTag: string | null, packageVersion: string, commits: { sha: string, subject: string, body?: string }[] }} input
 * @returns {string | null} `null` si no hay nada nuevo que publicar.
 */
export function nextVersion({ lastTag, packageVersion, commits }) {
  const base = parseVersion(packageVersion);
  if (!lastTag) return base.join(".");
  const changes = commits.filter((c) => !isMerge(c)).map(parseCommit);
  if (changes.length === 0) return null;

  const [major, minor, patch] = parseVersion(lastTag);
  let next;
  if (changes.some((c) => c.breaking)) next = [major + 1, 0, 0];
  else if (changes.some((c) => c.type === "feat")) next = [major, minor + 1, 0];
  else next = [major, minor, patch + 1];
  // Un salto manual en package.json manda sobre el cálculo automático.
  return (compare(base, next) > 0 ? base : next).join(".");
}

/**
 * Notas del release en Markdown.
 * @param {{
 *   version: string,
 *   previousTag: string | null,
 *   commits: { sha: string, subject: string, body?: string }[],
 *   repoUrl: string,
 *   siteUrl?: string,
 *   runUrl?: string,
 *   date?: string,
 * }} input
 */
export function buildReleaseNotes({ version, previousTag, commits, repoUrl, siteUrl, runUrl, date }) {
  const prs = commits.map((c) => MERGED_PR.exec(c.subject)?.[1]).filter(Boolean);
  const changes = commits.filter((c) => !isMerge(c)).map(parseCommit);
  const lines = [];

  const intro = previousTag
    ? `Versión **${version}** publicada${date ? ` el ${date}` : ""}, con ${changes.length} ${changes.length === 1 ? "cambio" : "cambios"} desde ${previousTag}.`
    : `Primera versión publicada${date ? ` el ${date}` : ""}: la app reconstruida con paneles para Camila y Juan, mensajes, chat y notificaciones.`;
  lines.push(intro, "");

  const pending = [...changes];
  for (const section of SECTIONS) {
    const items = pending.filter(section.match);
    if (items.length === 0) continue;
    for (const item of items) pending.splice(pending.indexOf(item), 1);
    lines.push(`### ${section.title}`, "");
    for (const c of items) {
      const scope = c.scope ? `**${c.scope}:** ` : "";
      lines.push(`- ${scope}${c.description} ([${c.sha.slice(0, 7)}](${repoUrl}/commit/${c.sha}))`);
    }
    lines.push("");
  }

  lines.push("### 🚀 Despliegue", "");
  if (siteUrl) lines.push(`- Sitio: ${siteUrl}`);
  lines.push("- Base de datos y funciones de Supabase actualizadas por el flujo Deploy.");
  if (runUrl) lines.push(`- Registro del despliegue: ${runUrl}`);
  if (prs.length > 0) lines.push(`- Pull requests incluidos: ${prs.map((n) => `#${n}`).join(", ")}`);
  if (previousTag) lines.push(`- Cambios completos: ${repoUrl}/compare/${previousTag}...v${version}`);
  lines.push("");

  return lines.join("\n");
}

function git(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function lastReleaseTag() {
  try {
    return git("describe", "--tags", "--abbrev=0", "--match", "v[0-9]*.[0-9]*.[0-9]*", "HEAD");
  } catch {
    return null;
  }
}

function commitsSince(tag) {
  const SEP = "\u001f";
  const END = "\u001e";
  const range = tag ? [`${tag}..HEAD`] : ["HEAD"];
  const out = git("log", `--format=%H${SEP}%s${SEP}%b${END}`, ...range);
  return out
    .split(END)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [sha, subject, body] = entry.split(SEP);
      return { sha, subject, body };
    });
}

function main() {
  const env = process.env;
  const { version: packageVersion } = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const lastTag = lastReleaseTag();
  const commits = commitsSince(lastTag);
  const version = nextVersion({ lastTag, packageVersion, commits });
  const output = (line) => (env.GITHUB_OUTPUT ? appendFileSync(env.GITHUB_OUTPUT, `${line}\n`) : console.warn(line));

  if (!version) {
    console.warn(`Nada nuevo desde ${lastTag}: no se crea release.`);
    output("version=");
    return;
  }

  const repoUrl = `${env.GITHUB_SERVER_URL ?? "https://github.com"}/${env.GITHUB_REPOSITORY ?? "OWNER/REPO"}`;
  const notes = buildReleaseNotes({
    version,
    previousTag: lastTag,
    commits,
    repoUrl,
    siteUrl: env.SITE_URL || undefined,
    runUrl: env.GITHUB_RUN_ID ? `${repoUrl}/actions/runs/${env.GITHUB_RUN_ID}` : undefined,
    date: new Date().toISOString().slice(0, 10),
  });
  const notesFile = join(env.RUNNER_TEMP ?? tmpdir(), "release-notes.md");
  writeFileSync(notesFile, notes);
  output(`version=${version}`);
  output(`notes=${notesFile}`);
  console.warn(`Release v${version}${lastTag ? ` (antes ${lastTag})` : ""}\n\n${notes}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
