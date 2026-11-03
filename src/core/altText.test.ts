/**
 * Texto alternativo (WCAG 1.1.1): toda <img> de la app tiene que llevar
 * `alt`. Vacío (alt="") sólo cuando la imagen es decorativa o el control que
 * la envuelve ya la describe (un botón con aria-label, por ejemplo).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("texto alternativo", () => {
  it("ninguna <img> queda sin alt", () => {
    const missing: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<img\b[\s\S]*?\/>/g)) {
        if (!/\salt=/.test(match[0])) {
          const line = source.slice(0, match.index).split("\n").length;
          missing.push(`${relative(SRC, file)}:${line}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("las imágenes con contenido de la página no son decorativas", () => {
    // Fotos que se ven solas (no dentro de un botón que ya las describe).
    const lightbox = readFileSync(join(SRC, "features/site/sections/Lightbox.tsx"), "utf8");
    const timeline = readFileSync(join(SRC, "features/site/sections/Milestones.tsx"), "utf8");
    expect(lightbox).toMatch(/alt=\{photo\.caption \|\| "Recuerdo"\}/);
    expect(timeline).not.toMatch(/timeline__photo"[^>]*alt=""/);
  });
});
