import { describe, expect, it } from "vitest";
import { exifDateToIso, hasExifMetadata, parseCapturedDate } from "./exif";

/** Construye un JPEG mínimo con un bloque EXIF (sólo cabeceras, sin imagen). */
function jpegWithExif(opts: { original?: string; ifd0Date?: string; bigEndian?: boolean }): ArrayBuffer {
  const le = !opts.bigEndian;
  const tiff: number[] = [];
  const u16 = (v: number) => (le ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) => (le ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24] : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat(0);

  // Diseño: cabecera(8) | IFD0 (2 entradas) | ExifIFD (1 entrada) | cadenas
  const ifd0At = 8;
  const ifd0Size = 2 + 2 * 12 + 4;
  const exifAt = ifd0At + ifd0Size;
  const exifSize = 2 + 12 + 4;
  const dataAt = exifAt + exifSize;
  const original = ascii(opts.original ?? "");
  const ifd0Date = ascii(opts.ifd0Date ?? "");

  tiff.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(ifd0At));
  tiff.push(...u16(2));
  tiff.push(...u16(0x0132), ...u16(2), ...u32(ifd0Date.length), ...u32(dataAt + original.length));
  tiff.push(...u16(0x8769), ...u16(4), ...u32(1), ...u32(exifAt));
  tiff.push(...u32(0));
  tiff.push(...u16(1));
  tiff.push(...u16(0x9003), ...u16(2), ...u32(original.length), ...u32(dataAt));
  tiff.push(...u32(0));
  tiff.push(...original, ...ifd0Date);

  const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const length = app1.length + 2;
  const bytes = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xe1, length >> 8, length & 0xff, ...app1, 0xff, 0xda, 0, 2];
  return new Uint8Array(bytes).buffer;
}

describe("parseCapturedDate", () => {
  it("lee DateTimeOriginal (little endian)", () => {
    expect(parseCapturedDate(jpegWithExif({ original: "2024:02:14 18:30:00" }))).toBe("2024-02-14");
  });
  it("lee DateTimeOriginal (big endian)", () => {
    expect(parseCapturedDate(jpegWithExif({ original: "2025:05:31 09:00:00", bigEndian: true }))).toBe("2025-05-31");
  });
  it("cae a DateTime de IFD0 si no hay fecha original válida", () => {
    expect(parseCapturedDate(jpegWithExif({ original: "0000:00:00 00:00:00", ifd0Date: "2023:12:24 20:00:00" }))).toBe("2023-12-24");
  });
  it("devuelve null para archivos sin EXIF o que no son JPEG", () => {
    expect(parseCapturedDate(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toBeNull();
    expect(parseCapturedDate(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull();
    expect(parseCapturedDate(new ArrayBuffer(0))).toBeNull();
  });
  it("no revienta con datos truncados", () => {
    const full = new Uint8Array(jpegWithExif({ original: "2024:02:14 18:30:00" }));
    for (let cut = 0; cut < full.length; cut += 7) {
      expect(() => parseCapturedDate(full.slice(0, cut).buffer)).not.toThrow();
    }
  });
});

describe("exifDateToIso", () => {
  it("valida fechas imposibles", () => {
    expect(exifDateToIso("2024:02:30 10:00:00")).toBeNull();
    expect(exifDateToIso("1970:01:01 00:00:00")).toBeNull();
    expect(exifDateToIso("2024-07-01")).toBe("2024-07-01");
  });
});

describe("hasExifMetadata", () => {
  it("detecta el bloque EXIF de un JPEG", () => {
    expect(hasExifMetadata(jpegWithExif({ original: "2024:02:14 18:30:00" }))).toBe(true);
    expect(hasExifMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2]).buffer)).toBe(false);
  });
});
