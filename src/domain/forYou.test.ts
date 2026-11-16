import { describe, expect, it } from "vitest";
import { cardTone, INTRO_STEP, LATEST_LETTER, LETTER_PATHS, LETTERS, moveStep } from "./forYou";
import es from "@/i18n/messages/es";
import en from "@/i18n/messages/en";
import pt from "@/i18n/messages/pt";

describe("Para ti", () => {
  it("no se sale de la portada ni de la última tarjeta", () => {
    expect(moveStep(INTRO_STEP, -1, 6)).toBe(INTRO_STEP);
    expect(moveStep(INTRO_STEP, 1, 6)).toBe(0);
    expect(moveStep(5, 1, 6)).toBe(6);
    expect(moveStep(6, 1, 6)).toBe(6);
    expect(moveStep(3, -1, 6)).toBe(2);
  });

  it("alterna terracota y crema empezando por terracota", () => {
    expect([0, 1, 2, 3].map(cardTone)).toEqual(["warm", "cream", "warm", "cream"]);
  });

  it("tiene las mismas seis frases en cada idioma", () => {
    expect(es.forYou.cards).toHaveLength(6);
    expect(en.forYou.cards).toHaveLength(es.forYou.cards.length);
    expect(pt.forYou.cards).toHaveLength(es.forYou.cards.length);
  });
});

describe("Hasta siempre", () => {
  it("tiene las mismas nueve tarjetas en cada idioma", () => {
    expect(es.goodbye.cards).toHaveLength(9);
    expect(en.goodbye.cards).toHaveLength(es.goodbye.cards.length);
    expect(pt.goodbye.cards).toHaveLength(es.goodbye.cards.length);
  });

  it("cada carta tiene su ruta y su canción, y el inicio anuncia la despedida", () => {
    expect(LETTERS.goodbye.path).toBe("/despedida");
    expect(LETTERS.goodbye.song).not.toBe(LETTERS.forYou.song);
    expect(LETTER_PATHS).toEqual(["/para-ti", "/despedida"]);
    expect(LATEST_LETTER).toBe("goodbye");
  });
});
