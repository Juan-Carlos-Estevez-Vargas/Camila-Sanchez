import { stickerById } from "@/domain/stickers";

/** Dibujo de un sticker: emoji grande con su frase. */
export function StickerArt({ id, size = "md" }: { id: string | null; size?: "sm" | "md" }) {
  const sticker = stickerById(id);
  return (
    <span className={`sticker sticker--${size} sticker--${sticker.tone}`} role="img" aria-label={`Sticker: ${sticker.text}`}>
      <span className="sticker__emoji" aria-hidden>{sticker.emoji}</span>
      <span className="sticker__text" aria-hidden>{sticker.text}</span>
    </span>
  );
}
