import { describe, expect, it } from "vitest";
import { buildReleaseNotes, nextVersion, parseCommit } from "./release.mjs";

const c = (subject: string, body = "") => ({ sha: "abcdef1234567890", subject, body });
const REPO = "https://github.com/owner/repo";

describe("nextVersion", () => {
  it("el primer release usa la versión de package.json", () => {
    expect(nextVersion({ lastTag: null, packageVersion: "2.0.0", commits: [c("feat: algo")] })).toBe("2.0.0");
  });

  it("sube el parche, la menor o la mayor según los commits", () => {
    const from = { lastTag: "v2.3.4", packageVersion: "2.0.0" };
    expect(nextVersion({ ...from, commits: [c("fix: algo"), c("docs: x")] })).toBe("2.3.5");
    expect(nextVersion({ ...from, commits: [c("fix: algo"), c("feat(panel): nuevo")] })).toBe("2.4.0");
    expect(nextVersion({ ...from, commits: [c("feat!: rompe")] })).toBe("3.0.0");
    expect(nextVersion({ ...from, commits: [c("refactor: x", "BREAKING CHANGE: cambia la API")] })).toBe("3.0.0");
  });

  it("un salto manual en package.json manda", () => {
    expect(nextVersion({ lastTag: "v2.3.4", packageVersion: "3.0.0", commits: [c("fix: algo")] })).toBe("3.0.0");
  });

  it("sin cambios nuevos (o sólo merges) no hay release", () => {
    expect(nextVersion({ lastTag: "v2.0.0", packageVersion: "2.0.0", commits: [] })).toBeNull();
    expect(
      nextVersion({ lastTag: "v2.0.0", packageVersion: "2.0.0", commits: [c("Merge pull request #4 from a/b")] }),
    ).toBeNull();
  });
});

describe("parseCommit", () => {
  it("entiende tipo, ámbito y commits sin convención", () => {
    expect(parseCommit(c("feat(panel): bulk upload"))).toMatchObject({ type: "feat", scope: "panel", description: "Bulk upload" });
    expect(parseCommit(c("Agrega imágenes"))).toMatchObject({ type: "other", scope: null, breaking: false });
  });
});

describe("buildReleaseNotes", () => {
  const notes = buildReleaseNotes({
    version: "2.1.0",
    previousTag: "v2.0.0",
    commits: [
      c("Merge pull request #3 from a/b"),
      c("feat(panel): invite by QR"),
      c("security: strict CSP"),
      c("ci: release on deploy"),
    ],
    repoUrl: REPO,
    siteUrl: "https://sitio.example",
    date: "2026-10-15",
  });

  it("agrupa los cambios por tipo y omite los merges", () => {
    expect(notes).toContain("### ✨ Novedades\n\n- **panel:** Invite by QR ([abcdef1](https://github.com/owner/repo/commit/abcdef1234567890))");
    expect(notes).toContain("### 🔒 Seguridad\n\n- Strict CSP");
    expect(notes).toContain("### 🛠️ Mantenimiento\n\n- Release on deploy");
    expect(notes).not.toContain("Merge pull request");
    expect(notes.indexOf("Novedades")).toBeLessThan(notes.indexOf("Seguridad"));
  });

  it("enlaza el sitio, los PR y la comparación con la versión anterior", () => {
    expect(notes).toContain("con 3 cambios desde v2.0.0");
    expect(notes).toContain("- Sitio: https://sitio.example");
    expect(notes).toContain("- Pull requests incluidos: #3");
    expect(notes).toContain(`${REPO}/compare/v2.0.0...v2.1.0`);
  });
});
