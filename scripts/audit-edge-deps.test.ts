import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collectEdgeDeps, parseNpmImports } from "./audit-edge-deps.mjs";

const FUNCTIONS = join(__dirname, "..", "supabase", "functions");
const listTs = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => (statSync(join(dir, e)).isDirectory() ? listTs(join(dir, e)) : e.endsWith(".ts") ? [join(dir, e)] : []));

describe("dependencias de las Edge Functions", () => {
  it("lee los imports npm: con y sin scope", () => {
    expect(parseNpmImports('import a from "npm:web-push@3.6.7";\nimport { b } from "npm:@supabase/supabase-js@2.1.0/dist";'))
      .toEqual([{ name: "web-push", version: "3.6.7" }, { name: "@supabase/supabase-js", version: "2.1.0" }]);
  });

  it("rechaza versiones abiertas y versiones distintas del mismo paquete", () => {
    const { problems } = collectEdgeDeps([
      { file: "a.ts", source: 'import x from "npm:web-push@^3.6.7";' },
      { file: "b.ts", source: 'import x from "npm:web-push@3.6.8";' },
    ]);
    expect(problems).toHaveLength(2);
  });

  it("las funciones de este repo usan versiones exactas y únicas", () => {
    const files = listTs(FUNCTIONS).map((path) => ({ file: path, source: readFileSync(path, "utf8") }));
    const { deps, problems } = collectEdgeDeps(files);
    expect(problems).toEqual([]);
    expect(Object.keys(deps)).toContain("@supabase/supabase-js");
  });
});
