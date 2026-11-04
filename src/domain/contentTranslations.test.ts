import { describe, expect, it } from "vitest";
import {
  localize, localizeContent, normalizeTranslations, overlay, pruneTranslation, setAt, textLeaves, translationProgress,
} from "./contentTranslations";
import type { ImportantDate, SiteContent } from "./types";

const date: ImportantDate = {
  id: "d1", title: "Navidad juntos", eventDate: "2025-12-24", recursYearly: true, icon: "🎄",
  message: "Que cada Navidad la pasemos juntos", isVisible: true,
  translations: { pt: { title: "Natal juntos" } },
};

describe("traducciones del contenido", () => {
  it("usa la traducción del idioma activo y el original donde falta", () => {
    const pt = localize(date, "pt", ["title", "message"]);
    expect(pt.title).toBe("Natal juntos");
    expect(pt.message).toBe("Que cada Navidad la pasemos juntos");
    expect(localize(date, "en", ["title", "message"])).toBe(date);
    expect(localize(date, "es", ["title", "message"])).toBe(date);
  });

  it("la forma la manda el original: no agrega tarjetas ni cambia iconos", () => {
    const source = { cards: [{ icon: "💗", title: "Hola", body: "Mensaje" }] };
    const result = overlay(source, { cards: [{ icon: "😈", title: "Hello" }, { title: "Extra" }] });
    expect(result).toEqual({ cards: [{ icon: "💗", title: "Hello", body: "Mensaje" }] });
  });

  it("ignora textos vacíos y tipos que no cuadran", () => {
    expect(overlay("Hola", "  ")).toBe("Hola");
    expect(overlay("Hola", 42)).toBe("Hola");
    expect(overlay(["a", "b"], "no es lista")).toEqual(["a", "b"]);
  });

  it("lista los textos traducibles con su ruta (sin iconos)", () => {
    const leaves = textLeaves({ title: "T", content: { cards: [{ icon: "💗", title: "C", body: "" }] } });
    expect(leaves).toEqual([
      { path: ["title"], text: "T" },
      { path: ["content", "cards", 0, "title"], text: "C" },
    ]);
  });

  it("escribe en una ruta creando lo que falte y limpia lo vacío", () => {
    const value = setAt({}, ["content", "paragraphs", 1], "Second");
    expect(value).toEqual({ content: { paragraphs: [null, "Second"] } });
    expect(pruneTranslation({ title: "", content: { paragraphs: ["", ""] } })).toBeUndefined();
    expect(pruneTranslation({ title: "Hi", subtitle: " " })).toEqual({ title: "Hi" });
  });

  it("cuenta cuántos textos ya están traducidos", () => {
    expect(translationProgress({ title: "A", subtitle: "B" }, { title: "X" })).toEqual({ done: 1, total: 2 });
  });

  it("descarta idiomas desconocidos y datos corruptos de la base", () => {
    expect(normalizeTranslations({ en: { title: "Hi" }, fr: { title: "Salut" }, pt: "x" })).toEqual({ en: { title: "Hi" } });
    expect(normalizeTranslations("nada")).toEqual({});
    expect(normalizeTranslations({ en: { title: "x".repeat(70_000) } })).toEqual({});
  });

  it("traduce todo el contenido de la página", () => {
    const content = {
      settings: { siteTitle: "Para ti", siteSubtitle: "", translations: { en: { siteTitle: "For you" } } },
      sections: [], photos: [], milestones: [], dates: [date], interruptions: [],
    } as unknown as SiteContent;
    const pt = localizeContent(content, "pt");
    expect(pt.dates[0]!.title).toBe("Natal juntos");
    expect(pt.settings.siteTitle).toBe("Para ti");
    expect(localizeContent(content, "en").settings.siteTitle).toBe("For you");
  });
});
