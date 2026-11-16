/**
 * Las cartas en tarjetas que se pasan una a una, cada una con su canción:
 *
 *   - «Para ti» (/para-ti): «No quiero perderte…», con «Iris» de Dean Lewis.
 *   - «Hasta siempre» (/despedida): la carta de despedida, con «Lloro por ti»
 *     de Enrique Iglesias.
 *
 * Los pasos van de -1 (la portada «Para ti, Cami») a `total` (la última
 * tarjeta, la del final): las frases son 0..total-1.
 */

/** «Iris» de Dean Lewis (audio oficial en YouTube). */
export const FOR_YOU_SONG = "https://www.youtube.com/watch?v=hpy8F9uzqv0";

/** «Lloro por ti» de Enrique Iglesias (video en YouTube). */
export const GOODBYE_SONG = "https://www.youtube.com/watch?v=90iz99vk4jg";

/** Cada carta: sus textos (`useT()[id]`), su ruta, su canción y a dónde lleva el botón del final. */
export type LetterId = "forYou" | "goodbye";

export interface Letter {
  path: string;
  song: string;
  /** El botón principal del final («Escribirle a Juan» o «Volver al inicio»). */
  doneTo: string;
  /** Tarjetas con párrafos largos: letra más pequeña para que quepan. */
  long: boolean;
}

export const LETTERS: Record<LetterId, Letter> = {
  forYou: { path: "/para-ti", song: FOR_YOU_SONG, doneTo: "/chat", long: false },
  goodbye: { path: "/despedida", song: GOODBYE_SONG, doneTo: "/", long: true },
};

/** Rutas de las cartas: a pantalla completa, sin otra música ni avisos encima. */
export const LETTER_PATHS: readonly string[] = Object.values(LETTERS).map((l) => l.path);

/** La carta que anuncia la tarjeta del inicio: la más reciente. */
export const LATEST_LETTER: LetterId = "goodbye";

export const INTRO_STEP = -1;

/** El paso siguiente o anterior, sin salirse de la portada ni del final. */
export function moveStep(current: number, delta: number, phrases: number): number {
  return Math.min(phrases, Math.max(INTRO_STEP, current + delta));
}

/** Las tarjetas alternan: terracota con letra crema y crema con letra terracota. */
export function cardTone(step: number): "warm" | "cream" {
  return step % 2 === 0 ? "warm" : "cream";
}
