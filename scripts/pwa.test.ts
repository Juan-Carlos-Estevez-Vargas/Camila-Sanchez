import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAssetLinks, precacheList, stampServiceWorker } from "./pwa.mjs";

const PRINT = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0").toUpperCase()).join(":");

describe("app instalable", () => {
  it("guarda sin conexión sólo el código y estilos del build", () => {
    expect(precacheList(["index.html", "assets/index-a1.js", "assets/index-a1.css", "assets/x.js.map", "assets/font.woff2", "assets/index-a1.js"]))
      .toEqual(["/assets/font.woff2", "/assets/index-a1.css", "/assets/index-a1.js"]);
  });

  it("el sw.js publicado lleva la lista y una versión nueva en cada build", () => {
    const source = readFileSync(join(__dirname, "..", "public", "sw.js"), "utf8");
    const a = stampServiceWorker(source, ["/assets/a.js"]);
    const b = stampServiceWorker(source, ["/assets/b.js"]);
    expect(a).toContain('const PRECACHE = ["/assets/a.js"];');
    expect(a).not.toContain("v5-dev");
    expect(a.match(/const VERSION = "([^"]+)"/)![1]).not.toBe(b.match(/const VERSION = "([^"]+)"/)![1]);
  });

  it("assetlinks.json sólo existe con paquete y huella válidos", () => {
    expect(buildAssetLinks("", "")).toBeNull();
    expect(buildAssetLinks("app.netlify.rincon", "")).toBeNull();
    const json = JSON.parse(buildAssetLinks("app.netlify.rincon.twa", `${PRINT.toLowerCase()}, ${PRINT}`)!);
    expect(json[0].target).toEqual({ namespace: "android_app", package_name: "app.netlify.rincon.twa", sha256_cert_fingerprints: [PRINT, PRINT] });
    expect(() => buildAssetLinks("sin puntos", PRINT)).toThrow();
    expect(() => buildAssetLinks("app.rincon", "AB:CD")).toThrow();
  });

  it("el manifiesto tiene lo que piden Android y la Play Store", () => {
    const manifest = JSON.parse(readFileSync(join(__dirname, "..", "public", "manifest.webmanifest"), "utf8"));
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === "maskable")).toBe(true);
    for (const shortcut of manifest.shortcuts) expect(shortcut.url).toMatch(/^\/(?!\/)/);
    for (const shot of manifest.screenshots) expect(shot.src).toMatch(/^\/screenshots\//);
  });
});
