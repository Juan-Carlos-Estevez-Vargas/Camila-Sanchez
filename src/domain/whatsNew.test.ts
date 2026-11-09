import { describe, expect, it } from "vitest";
import { AccessPolicy, DEFAULT_ROLE_PERMISSIONS, PERMISSIONS } from "@/domain/permissions";
import { featureTour, hasPageTour } from "@/features/tour/tourSteps";
import es from "@/i18n/messages/es";
import { latestRelease, pendingReleases, RELEASES, visibleRelease, type Release } from "./whatsNew";

const releases: Release[] = [
  { id: "2026-12-01", news: [{ id: "c", icon: "3" }] },
  { id: "2026-11-15", news: [{ id: "b", icon: "2", requires: PERMISSIONS.listsUse }] },
  { id: "2026-11-01", news: [{ id: "a", icon: "1" }] },
];

describe("novedades pendientes", () => {
  it("muestra todas las versiones posteriores a la última que vio", () => {
    expect(pendingReleases(releases, { lastSeen: "2026-11-01" }).map((r) => r.id)).toEqual(["2026-12-01", "2026-11-15"]);
    expect(pendingReleases(releases, { lastSeen: "2026-12-01" })).toEqual([]);
  });

  it("si nunca vio ninguna, sólo la última", () => {
    expect(pendingReleases(releases, { lastSeen: null, accountCreatedAt: "2026-10-01T10:00:00Z" }).map((r) => r.id)).toEqual(["2026-12-01"]);
  });

  it("a una cuenta creada después de la última versión no le muestra nada", () => {
    expect(pendingReleases(releases, { lastSeen: null, accountCreatedAt: "2026-12-02T08:00:00Z" })).toEqual([]);
    // El mismo día de la versión sí la ve.
    expect(pendingReleases(releases, { lastSeen: null, accountCreatedAt: "2026-12-01T23:00:00Z" })).toHaveLength(1);
  });

  it("cada quien ve sólo las novedades de lo que puede usar", () => {
    const viewer = new AccessPolicy("viewer", []);
    expect(visibleRelease(releases[1]!, (p) => viewer.can(p)).news).toEqual([]);
    expect(visibleRelease(releases[1]!, () => true).news).toHaveLength(1);
  });

  it("guarda como vista la más nueva", () => {
    expect(latestRelease(releases)).toBe("2026-12-01");
    expect(latestRelease([])).toBeNull();
  });
});

describe("lista de versiones", () => {
  const texts = es.whatsNew.releases as Record<string, { news: Record<string, { title: string; body: string }>; changes: string[] } | undefined>;

  it("va de la más nueva a la más antigua, con fechas válidas y sin repetir", () => {
    const ids = RELEASES.map((r) => r.id);
    expect(ids.every((id) => /^\d{4}-\d{2}-\d{2}$/.test(id) && !Number.isNaN(Date.parse(id)))).toBe(true);
    expect([...ids].sort().reverse()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cada novedad tiene sus textos y cada texto su novedad", () => {
    expect(Object.keys(texts).sort()).toEqual(RELEASES.map((r) => r.id).sort());
    for (const release of RELEASES) {
      const text = texts[release.id]!;
      expect(Object.keys(text.news).sort()).toEqual(release.news.map((n) => n.id).sort());
      for (const item of Object.values(text.news)) {
        expect(item.title.trim()).not.toBe("");
        expect(item.body.trim()).not.toBe("");
      }
    }
  });

  it("«Ver cómo funciona» siempre lleva a una página con tutorial para quien puede verla", () => {
    const admin = new AccessPolicy("super_admin", DEFAULT_ROLE_PERMISSIONS.super_admin);
    for (const novelty of RELEASES.flatMap((r) => r.news).filter((n) => n.tour)) {
      expect(hasPageTour({ pathname: novelty.tour!, loggedIn: true, policy: admin }), novelty.id).toBe(true);
    }
  });

  it("el recorrido de una función empieza con su presentación y termina en el botón del tutorial", () => {
    const policy = new AccessPolicy("viewer", DEFAULT_ROLE_PERMISSIONS.viewer);
    const steps = featureTour({ pathname: "/dedicatorias", loggedIn: true, policy }, { title: "Dedicatorias", body: "…" });
    expect(steps.map((s) => s.id)).toEqual(["whats-new", "dedications-new", "dedications-tabs", "launcher"]);
    expect(steps[0]).toMatchObject({ title: "Dedicatorias", body: "…" });
  });
});
