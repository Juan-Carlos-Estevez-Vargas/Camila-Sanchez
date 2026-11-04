/** Página principal (los textos que escribe la pareja vienen de la base de datos y no se traducen). */
export const site = {
  loadError: "No pude cargar nuestros recuerdos",
  loadErrorHint: "Revisa tu conexión y recarga la página.",
  private: "Este rincón es privado. Entra con tu cuenta para ver lo que te preparé.",
  noAccess: "Tu cuenta todavía no tiene acceso. Pídele permiso al administrador.",
  signIn: "Entrar",
  noSections: "Aún no hay secciones",
  noSectionsHint: "Agrégalas desde el panel de administración.",
  thanks: "💖 Gracias",
  music: "Música de fondo",
  pauseMusic: "Pausar música",
  playMusic: "Poner música",
  together: (date: string) => `Juntos desde el ${date}`,
  seeMore: "Ver más",
  surprise: "¡Sorpresa!",
  countdown: {
    today: "¡Hoy!",
    days: (n: number) => (n === 1 ? "día" : "días"),
    until: (title: string) => `para ${title}`,
    years: (n: number) => ` · ${n} ${n === 1 ? "año" : "años"}`,
  },
  counter: {
    units: ["días", "horas", "minutos", "segundos"],
    months: (n: number) => `Son ${n} ${n === 1 ? "mes" : "meses"} eligiéndonos cada día.`,
  },
  gallery: {
    years: "Años",
    summary: (total: number, months: number, year: number) =>
      `${total} ${total === 1 ? "recuerdo" : "recuerdos"} en ${months} ${months === 1 ? "mes" : "meses"} de ${year}`,
    memories: (n: number) => `${n} ${n === 1 ? "recuerdo" : "recuerdos"}`,
    empty: "Sin fotos aún",
    monthLabel: (month: string, count: number) =>
      `${month}: ${count === 0 ? "sin fotos aún" : `${count} ${count === 1 ? "recuerdo" : "recuerdos"}, ver fotos`}`,
  },
  lightbox: {
    position: (i: number, n: number) => `Foto ${i} de ${n}`,
    close: "Cerrar el visor",
    prev: "Foto anterior",
    next: "Foto siguiente",
    fallbackAlt: "Recuerdo",
    all: "Todas las fotos",
    thumb: (i: number) => `Foto ${i}`,
  },
  milestonePhoto: (title: string) => `Foto de «${title}»`,
};
