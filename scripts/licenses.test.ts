/**
 * Auditoría de licencias: todo lo que llega al navegador (dependencias de
 * producción y sus dependencias) debe tener una licencia permisiva que deje
 * usarlo y publicarlo sin pedir permiso. Si una actualización trae otra
 * licencia, esta prueba falla antes de publicarla. Las de desarrollo no se
 * distribuyen, así que no cuentan.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ALLOWED = new Set(["MIT", "ISC", "Apache-2.0", "0BSD", "BSD-2-Clause", "BSD-3-Clause"]);

interface LockPackage {
  license?: string;
  dev?: boolean;
  devOptional?: boolean;
}

const lock = JSON.parse(readFileSync(join(__dirname, "..", "package-lock.json"), "utf8")) as { packages: Record<string, LockPackage> };
const production = Object.entries(lock.packages).filter(([path, pkg]) => path !== "" && !pkg.dev && !pkg.devOptional);

describe("licencias de las dependencias", () => {
  it("hay dependencias de producción que revisar", () => {
    expect(production.length).toBeGreaterThan(0);
  });

  it("todas tienen una licencia permisiva conocida", () => {
    const problems = production
      .filter(([, pkg]) => !pkg.license || !ALLOWED.has(pkg.license))
      .map(([path, pkg]) => `${path.replace(/^.*node_modules\//, "")}: ${pkg.license ?? "sin licencia"}`);
    expect(problems).toEqual([]);
  });
});
