import { config } from "@/core/config";
import { useT } from "@/i18n";

/**
 * Enlace «Invítame un café» (ver core/donation.ts). Sin VITE_DONATION_URL no
 * se dibuja nada. `variant="header"` es la píldora destacada de la cabecera,
 * que en pantallas angostas se queda sólo con el ☕.
 */
export function DonateLink({ variant }: { variant: "header" | "footer" }) {
  const donation = config.donation;
  const t = useT().donate;
  if (!donation) return null;
  return (
    <a className={`donate-link donate-link--${variant}`} href={donation.url} target="_blank" rel="noopener noreferrer"
      aria-label={t.label(donation.platform)}
      title={t.title}>
      <span className="donate-link__icon" aria-hidden="true">☕</span>
      <span className="donate-link__text">{t.text}</span>
    </a>
  );
}
