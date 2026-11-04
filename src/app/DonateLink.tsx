import { config } from "@/core/config";

/**
 * Enlace «Invítame un café» (ver core/donation.ts). Sin VITE_DONATION_URL no
 * se dibuja nada. `variant="header"` es la píldora destacada de la cabecera,
 * que en pantallas angostas se queda sólo con el ☕.
 */
export function DonateLink({ variant }: { variant: "header" | "footer" }) {
  const donation = config.donation;
  if (!donation) return null;
  return (
    <a className={`donate-link donate-link--${variant}`} href={donation.url} target="_blank" rel="noopener noreferrer"
      aria-label={`Invítame un café: donación voluntaria en ${donation.platform} (se abre en otra pestaña)`}
      title="Donación voluntaria: la app es y seguirá siendo gratis">
      <span className="donate-link__icon" aria-hidden="true">☕</span>
      <span className="donate-link__text">Invítame un café</span>
    </a>
  );
}
