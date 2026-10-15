/**
 * Quién hizo la app, para el pie de página. Un enlace vacío no se muestra.
 */
export const AUTHOR = {
  name: "Juan Carlos Estevez Vargas",
  links: {
    github: "https://github.com/Juan-Carlos-Estevez-Vargas",
    linkedin: "https://www.linkedin.com/in/juan-carlos-estevez-vargas/",
    instagram: "https://www.instagram.com/juankestevez/",
  },
  repository: "https://github.com/Juan-Carlos-Estevez-Vargas/Camila-Sanchez",
} as const;

export type SocialNetwork = keyof typeof AUTHOR.links;

/** Página del release de una versión en GitHub. */
export const releaseUrl = (version: string): string => `${AUTHOR.repository}/releases/tag/v${version}`;
