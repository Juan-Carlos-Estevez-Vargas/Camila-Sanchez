import type { Messages } from "@/i18n";

export const site: Messages["site"] = {
  loadError: "Não consegui carregar nossas lembranças",
  loadErrorHint: "Verifique sua conexão e recarregue a página.",
  private: "Este cantinho é privado. Entre com sua conta para ver o que preparei para você.",
  noAccess: "Sua conta ainda não tem acesso. Peça permissão ao administrador.",
  signIn: "Entrar",
  noSections: "Ainda não há seções",
  noSectionsHint: "Adicione-as pelo painel de administração.",
  thanks: "💖 Obrigado",
  music: "Música de fundo",
  pauseMusic: "Pausar música",
  playMusic: "Tocar música",
  together: (date: string) => `Juntos desde ${date}`,
  seeMore: "Ver mais",
  surprise: "Surpresa!",
  countdown: {
    today: "Hoje!",
    days: (n: number) => (n === 1 ? "dia" : "dias"),
    until: (title: string) => `para ${title}`,
    years: (n: number) => ` · ${n} ${n === 1 ? "ano" : "anos"}`,
  },
  counter: {
    units: ["dias", "horas", "minutos", "segundos"],
    months: (n: number) => `São ${n} ${n === 1 ? "mês" : "meses"} escolhendo um ao outro todos os dias.`,
  },
  gallery: {
    years: "Anos",
    summary: (total: number, months: number, year: number) =>
      `${total} ${total === 1 ? "lembrança" : "lembranças"} em ${months} ${months === 1 ? "mês" : "meses"} de ${year}`,
    memories: (n: number) => `${n} ${n === 1 ? "lembrança" : "lembranças"}`,
    empty: "Sem fotos ainda",
    monthLabel: (month: string, count: number) =>
      `${month}: ${count === 0 ? "sem fotos ainda" : `${count} ${count === 1 ? "lembrança" : "lembranças"}, ver fotos`}`,
  },
  lightbox: {
    position: (i: number, n: number) => `Foto ${i} de ${n}`,
    close: "Fechar o visualizador",
    prev: "Foto anterior",
    next: "Próxima foto",
    fallbackAlt: "Lembrança",
    all: "Todas as fotos",
    thumb: (i: number) => `Foto ${i}`,
  },
  milestonePhoto: (title: string) => `Foto de “${title}”`,
};
