/**
 * Utilidades para la carga masiva de fotos: recorrer carpetas arrastradas,
 * filtrar lo que no es imagen, detectar repetidas y estimar cuánto falta.
 */

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|gif|avif|bmp|heic|heif)$/i;

/** Máximo de fotos por tanda: suficiente para un álbum entero sin colgar un teléfono. */
export const MAX_BATCH = 1000;

interface FileLike {
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

export function isImageFile(file: Pick<FileLike, "name" | "type">): boolean {
  const name = file.name.split("/").pop() ?? file.name;
  // Archivos ocultos y los "._foto.jpg" que deja macOS en memorias USB.
  if (name.startsWith(".")) return false;
  return file.type.startsWith("image/") || IMAGE_EXTENSIONS.test(name);
}

/**
 * Quita repetidas evidentes dentro de la misma tanda (mismo nombre, tamaño y
 * fecha), antes de gastar tiempo en calcular huellas.
 */
export function dedupeByIdentity<T extends FileLike>(files: T[]): { unique: T[]; repeated: T[] } {
  const seen = new Set<string>();
  const unique: T[] = [];
  const repeated: T[] = [];
  for (const file of files) {
    const key = `${file.name}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) repeated.push(file);
    else {
      seen.add(key);
      unique.push(file);
    }
  }
  return { unique, repeated };
}

/** Huella SHA-256 del contenido: detecta la misma foto aunque cambie de nombre. */
export async function fingerprint(file: Blob): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null; // contexto no seguro (http): seguimos sin detectar repetidas
  const digest = await subtle.digest("SHA-256", await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Tiempo restante estimado a partir del ritmo de lo que ya terminó. */
export function estimateRemainingMs(finished: number, total: number, elapsedMs: number): number | null {
  if (finished < 2 || finished >= total || elapsedMs <= 0) return null;
  return Math.round((elapsedMs / finished) * (total - finished));
}

export function formatRemaining(ms: number | null): string | null {
  if (ms === null) return null;
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return "menos de un minuto";
  if (minutes === 1) return "un minuto";
  if (minutes < 60) return `unos ${minutes} minutos`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} h${rest ? ` ${rest} min` : ""}`;
}

/* --- Carpetas arrastradas ------------------------------------------------- */

const readAllEntries = (reader: FileSystemDirectoryReader) =>
  new Promise<FileSystemEntry[]>((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    // readEntries devuelve por lotes (100 en Chrome): hay que llamarlo hasta que venga vacío.
    const next = () => reader.readEntries((batch) => {
      if (!batch.length) return resolve(all);
      all.push(...batch);
      next();
    }, reject);
    next();
  });

const entryFile = (entry: FileSystemFileEntry) => new Promise<File>((resolve, reject) => entry.file(resolve, reject));

async function walk(entry: FileSystemEntry, out: File[], depth: number): Promise<void> {
  if (out.length >= MAX_BATCH * 2 || depth > 8) return;
  if (entry.isFile) {
    const file = await entryFile(entry as FileSystemFileEntry);
    if (isImageFile(file)) out.push(file);
  } else if (entry.isDirectory && !entry.name.startsWith(".")) {
    const children = await readAllEntries((entry as FileSystemDirectoryEntry).createReader());
    for (const child of children) await walk(child, out, depth + 1);
  }
}

/** Fotos de lo que se soltó en la zona de carga, entrando en carpetas y subcarpetas. */
export async function collectDroppedImages(data: DataTransfer): Promise<File[]> {
  const entries = [...data.items]
    .filter((item) => item.kind === "file")
    .map((item) => item.webkitGetAsEntry?.() ?? null);
  if (!entries.length || entries.some((e) => e === null)) {
    return [...data.files].filter(isImageFile);
  }
  const out: File[] = [];
  for (const entry of entries) await walk(entry!, out, 0);
  return out;
}
