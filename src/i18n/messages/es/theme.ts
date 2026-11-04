/** Paletas, tipografías y editor de apariencia. */
export const theme = {
  palettes: {
    "rosa-suave": { name: "Rosa suave", description: "La de la primera versión: rosado pastel y fucsia." },
    "rosa-vino": { name: "Rosa vino", description: "Más elegante y sobria." },
    durazno: { name: "Durazno", description: "Cálida y suave, como un atardecer." },
    lavanda: { name: "Lavanda", description: "Lila tranquila con toques rosados." },
    menta: { name: "Menta", description: "Verde fresco con detalles en rosa." },
    cielo: { name: "Cielo", description: "Azul claro y sereno." },
    medianoche: { name: "Medianoche", description: "Oscura, para ver de noche." },
  } as Record<string, { name: string; description: string }>,
};
