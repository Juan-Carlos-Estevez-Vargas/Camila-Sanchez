/**
 * Lector EXIF mínimo, sin dependencias. Sólo lo necesario para la carga
 * masiva: la fecha en que se tomó la foto (para ubicarla sola en su mes) y
 * saber si un archivo todavía trae metadatos (GPS, cámara...) que no
 * queremos publicar.
 */
import type { IsoDate } from "@/domain/types";

const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;
const TYPE_ASCII = 2;

/** Bytes que leemos del inicio del archivo: el bloque EXIF siempre va al principio. */
export const EXIF_SCAN_BYTES = 256 * 1024;

/** Devuelve el rango [inicio, fin) del bloque TIFF dentro de un JPEG, si lo tiene. */
function findJpegTiff(view: DataView): [number, number] | null {
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null;
    const marker = view.getUint8(offset + 1);
    // Marcadores sin longitud (relleno / RSTn)
    if (marker === 0xff) { offset++; continue; }
    if (marker === 0xda || marker === 0xd9) return null; // inicio de la imagen comprimida
    const length = view.getUint16(offset + 2);
    if (length < 2) return null;
    const start = offset + 4;
    if (
      marker === 0xe1 && start + 6 <= view.byteLength &&
      view.getUint32(start) === 0x45786966 /* "Exif" */ && view.getUint16(start + 4) === 0
    ) {
      return [start + 6, Math.min(view.byteLength, offset + 2 + length)];
    }
    offset += 2 + length;
  }
  return null;
}

/** Devuelve el rango del chunk EXIF de un WebP (RIFF), si lo tiene. */
function findWebpTiff(view: DataView): [number, number] | null {
  if (view.byteLength < 12 || view.getUint32(0) !== 0x52494646 /* RIFF */ || view.getUint32(8) !== 0x57454250 /* WEBP */) return null;
  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const id = view.getUint32(offset);
    const size = view.getUint32(offset + 4, true);
    if (id === 0x45584946 /* EXIF */) {
      let start = offset + 8;
      // Algunos codificadores repiten la cabecera "Exif\0\0" dentro del chunk.
      if (start + 6 <= view.byteLength && view.getUint32(start) === 0x45786966) start += 6;
      return [start, Math.min(view.byteLength, offset + 8 + size)];
    }
    offset += 8 + size + (size % 2);
  }
  return null;
}

function readAscii(view: DataView, start: number, length: number): string {
  let out = "";
  for (let i = 0; i < length && start + i < view.byteLength; i++) {
    const c = view.getUint8(start + i);
    if (c === 0) break;
    out += String.fromCharCode(c);
  }
  return out;
}

/** Lee las etiquetas de un IFD como mapa tag → texto ASCII o puntero numérico. */
function readIfd(view: DataView, tiff: number, end: number, ifdOffset: number, little: boolean): Map<number, string | number> {
  const tags = new Map<number, string | number>();
  const base = tiff + ifdOffset;
  if (base + 2 > end) return tags;
  const count = view.getUint16(base, little);
  for (let i = 0; i < count; i++) {
    const entry = base + 2 + i * 12;
    if (entry + 12 > end) break;
    const tag = view.getUint16(entry, little);
    const type = view.getUint16(entry + 2, little);
    const n = view.getUint32(entry + 4, little);
    if (type === TYPE_ASCII) {
      const at = n <= 4 ? entry + 8 : tiff + view.getUint32(entry + 8, little);
      if (at + n <= end) tags.set(tag, readAscii(view, at, n));
    } else if (tag === TAG_EXIF_IFD) {
      tags.set(tag, view.getUint32(entry + 8, little));
    }
  }
  return tags;
}

/** "2024:02:14 18:30:00" → "2024-02-14" (o null si no es una fecha válida). */
export function exifDateToIso(value: string | undefined): IsoDate | null {
  const match = /^(\d{4})[:-](\d{2})[:-](\d{2})/.exec(value ?? "");
  if (!match) return null;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null; // 31 de febrero, etc.
  return `${match[1]}-${match[2]}-${match[3]}`;
}

function findTiff(view: DataView): [number, number] | null {
  return findJpegTiff(view) ?? findWebpTiff(view);
}

/** Fecha en que se tomó la foto según su EXIF, leída de un ArrayBuffer. */
export function parseCapturedDate(buffer: ArrayBuffer): IsoDate | null {
  try {
    const view = new DataView(buffer);
    const range = findTiff(view);
    if (!range) return null;
    const [tiff, end] = range;
    if (tiff + 8 > end) return null;
    const order = view.getUint16(tiff);
    if (order !== 0x4949 && order !== 0x4d4d) return null;
    const little = order === 0x4949;
    if (view.getUint16(tiff + 2, little) !== 42) return null;
    const ifd0 = readIfd(view, tiff, end, view.getUint32(tiff + 4, little), little);
    const exifPointer = ifd0.get(TAG_EXIF_IFD);
    const exif = typeof exifPointer === "number" ? readIfd(view, tiff, end, exifPointer, little) : new Map();
    const candidates = [exif.get(TAG_DATETIME_ORIGINAL), exif.get(TAG_DATETIME_DIGITIZED), ifd0.get(TAG_DATETIME)];
    for (const candidate of candidates) {
      const iso = exifDateToIso(typeof candidate === "string" ? candidate : undefined);
      if (iso) return iso;
    }
    return null;
  } catch {
    return null;
  }
}

/** ¿El archivo todavía trae un bloque EXIF (posible GPS, modelo de cámara...)? */
export function hasExifMetadata(buffer: ArrayBuffer): boolean {
  try {
    return findTiff(new DataView(buffer)) !== null;
  } catch {
    return false;
  }
}

export async function readCapturedDate(file: Blob): Promise<IsoDate | null> {
  return parseCapturedDate(await file.slice(0, EXIF_SCAN_BYTES).arrayBuffer());
}
