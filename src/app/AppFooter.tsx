import type { ReactElement } from "react";
import { AUTHOR, releaseUrl, type SocialNetwork } from "@/core/author";
import { config } from "@/core/config";

const NETWORKS: Record<SocialNetwork, { label: string; icon: ReactElement }> = {
  github: {
    label: "GitHub",
    icon: (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
      </svg>
    ),
  },
  linkedin: {
    label: "LinkedIn",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
      </svg>
    ),
  },
  instagram: {
    label: "Instagram",
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
        <circle cx="12" cy="12" r="4.3" />
        <circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
};

/** Pie de página común: firma, redes y versión de la app. */
export function AppFooter() {
  const links = (Object.keys(NETWORKS) as SocialNetwork[]).filter((network) => AUTHOR.links[network]);
  const version = config.appVersion;

  return (
    <footer className="app-footer">
      <div className="container app-footer__inner">
        <p className="app-footer__signature">
          Hecho con mucho amor <span className="app-footer__heart" aria-label="amor">💖</span> por <strong>{AUTHOR.name}</strong>
        </p>
        <p className="app-footer__subtitle">Diseñado y programado por mí, línea por línea, para ti.</p>
        {links.length > 0 && (
          <ul className="app-footer__social" aria-label="Redes de Juan">
            {links.map((network) => (
              <li key={network}>
                <a href={AUTHOR.links[network]} target="_blank" rel="noopener noreferrer me"
                  aria-label={`${NETWORKS[network].label} de ${AUTHOR.name}`} title={NETWORKS[network].label}>
                  {NETWORKS[network].icon}
                </a>
              </li>
            ))}
          </ul>
        )}
        {version === "dev"
          ? <span className="app-footer__version">versión de desarrollo</span>
          : <a className="app-footer__version" href={releaseUrl(version)} target="_blank" rel="noopener noreferrer" title="Qué trae esta versión">v{version}</a>}
      </div>
    </footer>
  );
}
