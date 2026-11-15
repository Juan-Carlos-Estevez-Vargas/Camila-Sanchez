/**
 * «Para ti»: una carta en tarjetas («No quiero perderte…») que se pasan una a
 * una, con «Iris» de Dean Lewis sonando de fondo.
 *
 * Los pasos van de -1 (la portada «Para ti, Cami») a `total` (la última
 * tarjeta, la del «Te amo»): las frases son 0..total-1.
 */

/** «Iris» de Dean Lewis (audio oficial en YouTube). */
export const FOR_YOU_SONG = "https://www.youtube.com/watch?v=hpy8F9uzqv0";

export const INTRO_STEP = -1;

/** El paso siguiente o anterior, sin salirse de la portada ni del final. */
export function moveStep(current: number, delta: number, phrases: number): number {
  return Math.min(phrases, Math.max(INTRO_STEP, current + delta));
}

/** Las tarjetas alternan: terracota con letra crema y crema con letra terracota. */
export function cardTone(step: number): "warm" | "cream" {
  return step % 2 === 0 ? "warm" : "cream";
}
