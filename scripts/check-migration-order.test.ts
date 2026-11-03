import { describe, expect, it } from "vitest";
import { misorderedMigrations } from "./check-migration-order.mjs";

describe("orden de las migraciones", () => {
  const base = ["20261103000500_a.sql", "20261103000700_legal.sql"];

  it("acepta migraciones nuevas posteriores a la última de la base", () => {
    expect(misorderedMigrations(base, [...base, "20261103000800_nueva.sql"])).toEqual([]);
  });

  it("señala una migración nueva con fecha anterior a la última ya fusionada", () => {
    expect(misorderedMigrations(base, [...base, "20261103000600_vieja.sql"])).toEqual(["20261103000600_vieja.sql"]);
  });
});
