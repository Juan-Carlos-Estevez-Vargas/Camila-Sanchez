import { afterEach, describe, expect, it } from "vitest";
import { fromServer, toUserMessage, AppError } from "@/core/errors";
import es from "./messages/es";
import en from "./messages/en";
import pt from "./messages/pt";
import { getLocale, msg, setLocale } from "./index";
import { matchLocale } from "./locales";

describe("idioma del sistema", () => {
  it("toma el primer idioma disponible de las preferencias", () => {
    expect(matchLocale(["pt-BR", "en-US"])).toBe("pt");
    expect(matchLocale(["fr-FR", "en-GB"])).toBe("en");
    expect(matchLocale(["es_CO"])).toBe("es");
  });

  it("si ninguno está disponible, usa español", () => {
    expect(matchLocale(["de-DE", "fr"])).toBe("es");
    expect(matchLocale([])).toBe("es");
    expect(matchLocale(undefined)).toBe("es");
  });
});

/** Recorre el diccionario y devuelve cada ruta con el tipo de su valor. */
function shape(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return [`${path}:array:${value.length}`];
  if (value && typeof value === "object") {
    return Object.keys(value).sort().flatMap((k) => shape((value as Record<string, unknown>)[k], `${path}.${k}`));
  }
  return [`${path}:${typeof value}`];
}

describe("diccionarios", () => {
  it("inglés y portugués tienen exactamente las mismas claves que el español", () => {
    expect(shape(en)).toEqual(shape(es));
    expect(shape(pt)).toEqual(shape(es));
  });

  it("ningún texto traducido queda vacío salvo los que lo están en español", () => {
    const empties = (value: unknown, path = ""): string[] =>
      value === "" ? [path] : value && typeof value === "object"
        ? Object.entries(value).flatMap(([k, v]) => empties(v, `${path}.${k}`)) : [];
    // El aviso de traducción de los legales sólo está vacío en español.
    const allowed = new Set(empties(es));
    expect(empties(en).filter((p) => !allowed.has(p))).toEqual([]);
    expect(empties(pt).filter((p) => !allowed.has(p))).toEqual([]);
  });
});

describe("cambio de idioma", () => {
  afterEach(async () => {
    await setLocale("es", { remember: false });
  });

  it("cambia el diccionario activo", async () => {
    await setLocale("en", { remember: false });
    expect(getLocale()).toBe("en");
    expect(msg().common.cancel).toBe(en.common.cancel);
  });

  it("muestra en el idioma activo los errores conocidos del servidor", async () => {
    await setLocale("pt", { remember: false });
    expect(fromServer(es.errors.server.invalidLink)).toBe(pt.errors.server.invalidLink);
    expect(toUserMessage(new Error("Esa solicitud ya no está pendiente"))).toBe(pt.errors.backend.requestNotPending);
    expect(toUserMessage(new AppError("No puedes bloquearte a ti."))).toBe(pt.errors.backend.blockSelf);
  });

  it("deja tal cual un mensaje desconocido", async () => {
    await setLocale("en", { remember: false });
    expect(fromServer("Algo muy raro")).toBe("Algo muy raro");
  });
});
