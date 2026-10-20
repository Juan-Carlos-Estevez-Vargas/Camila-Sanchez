/**
 * Catálogo de stickers del chat. Son dibujos hechos con emoji y una frase,
 * sin imágenes externas: no pesan, se ven igual en todos lados y no hay que
 * pedir permiso a nadie para usarlos. La base de datos sólo guarda el id.
 */
export interface Sticker {
  id: string;
  emoji: string;
  text: string;
  /** Color de la frase (variable del tema). */
  tone: "primary" | "accent" | "success" | "warning";
}

export const STICKERS: readonly Sticker[] = [
  { id: "te-amo", emoji: "💖", text: "Te amo", tone: "primary" },
  { id: "muak", emoji: "😘", text: "Muak", tone: "primary" },
  { id: "abrazo", emoji: "🤗", text: "Abrazo", tone: "accent" },
  { id: "te-extrano", emoji: "🥺", text: "Te extraño", tone: "accent" },
  { id: "buenos-dias", emoji: "☀️", text: "Buenos días", tone: "warning" },
  { id: "buenas-noches", emoji: "🌙", text: "Buenas noches", tone: "accent" },
  { id: "jajaja", emoji: "😂", text: "Jajaja", tone: "warning" },
  { id: "perdon", emoji: "🙏", text: "Perdón", tone: "accent" },
  { id: "enamorado", emoji: "🥰", text: "Enamorado", tone: "primary" },
  { id: "para-ti", emoji: "💐", text: "Para ti", tone: "success" },
  { id: "comemos", emoji: "🍕", text: "¿Comemos?", tone: "warning" },
  { id: "cafecito", emoji: "☕", text: "¿Un cafecito?", tone: "warning" },
  { id: "celos", emoji: "😤", text: "Celos", tone: "accent" },
  { id: "bien", emoji: "🎉", text: "¡Bien!", tone: "success" },
  { id: "miau", emoji: "🐱", text: "Miau", tone: "accent" },
  { id: "corazon-roto", emoji: "💔", text: "Me dolió", tone: "primary" },
];

const BY_ID = new Map(STICKERS.map((s) => [s.id, s]));

/** El sticker con ese id; si ya no existe en el catálogo, uno genérico. */
export function stickerById(id: string | null | undefined): Sticker {
  return (id && BY_ID.get(id)) || { id: id ?? "desconocido", emoji: "✨", text: "Sticker", tone: "accent" };
}

export function isKnownSticker(id: string): boolean {
  return BY_ID.has(id);
}
