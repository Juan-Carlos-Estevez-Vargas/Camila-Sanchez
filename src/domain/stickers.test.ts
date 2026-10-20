import { describe, expect, it } from "vitest";
import { STICKERS, isKnownSticker, stickerById } from "./stickers";

describe("catálogo de stickers", () => {
  it("cada id es único y cumple el formato que acepta la base de datos", () => {
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(STICKERS.length);
    for (const s of STICKERS) expect(s.id).toMatch(/^[a-z0-9-]{1,40}$/);
  });

  it("un id desconocido se muestra como un sticker genérico", () => {
    expect(isKnownSticker("te-amo")).toBe(true);
    expect(isKnownSticker("nope")).toBe(false);
    expect(stickerById("nope")).toMatchObject({ emoji: "✨", text: "Sticker" });
  });
});
