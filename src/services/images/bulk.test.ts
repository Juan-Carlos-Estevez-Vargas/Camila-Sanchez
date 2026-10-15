import { describe, expect, it } from "vitest";
import { dedupeByIdentity, estimateRemainingMs, fingerprint, formatRemaining, isImageFile } from "./bulk";

const file = (name: string, size = 10, lastModified = 1, type = "") => ({ name, size, lastModified, type });

describe("isImageFile", () => {
  it("acepta imágenes por tipo o extensión", () => {
    expect(isImageFile(file("a.jpg"))).toBe(true);
    expect(isImageFile(file("IMG_0001.HEIC"))).toBe(true);
    expect(isImageFile(file("sin-extension", 1, 1, "image/png"))).toBe(true);
  });
  it("descarta ocultos, basura de macOS y otros archivos", () => {
    expect(isImageFile(file("._IMG_0001.jpg"))).toBe(false);
    expect(isImageFile(file(".DS_Store"))).toBe(false);
    expect(isImageFile(file("video.mp4", 1, 1, "video/mp4"))).toBe(false);
    expect(isImageFile(file("notas.txt"))).toBe(false);
  });
});

describe("dedupeByIdentity", () => {
  it("separa archivos idénticos de la misma tanda", () => {
    const { unique, repeated } = dedupeByIdentity([file("a.jpg"), file("b.jpg"), file("a.jpg"), file("a.jpg", 11)]);
    expect(unique.map((f) => `${f.name}:${f.size}`)).toEqual(["a.jpg:10", "b.jpg:10", "a.jpg:11"]);
    expect(repeated).toHaveLength(1);
  });
});

describe("fingerprint", () => {
  it("da la misma huella al mismo contenido aunque cambie el nombre", async () => {
    const a = await fingerprint(new Blob(["hola"]));
    const b = await fingerprint(new File(["hola"], "otra.jpg"));
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
    expect(await fingerprint(new Blob(["chao"]))).not.toBe(a);
  });
});

describe("tiempo restante", () => {
  it("estima con el ritmo observado", () => {
    expect(estimateRemainingMs(1, 10, 1000)).toBeNull();
    expect(estimateRemainingMs(10, 10, 1000)).toBeNull();
    expect(estimateRemainingMs(4, 10, 8000)).toBe(12000);
  });
  it("lo dice en palabras", () => {
    expect(formatRemaining(null)).toBeNull();
    expect(formatRemaining(20_000)).toBe("menos de un minuto");
    expect(formatRemaining(60_000)).toBe("un minuto");
    expect(formatRemaining(5 * 60_000)).toBe("unos 5 minutos");
    expect(formatRemaining(95 * 60_000)).toBe("1 h 35 min");
  });
});
