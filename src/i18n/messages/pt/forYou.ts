import type { Messages } from "@/i18n";

export const forYou: Messages["forYou"] = {
  pageTitle: "Para você",
  invite: {
    title: "Tenho algo para você",
    body: "O Juan te deixou uma carta. Aumente o volume.",
    open: "Abra 💌",
    later: "Depois",
  },
  intro: {
    to: "Para você, Cami",
    hint: "Aumente o volume e vá passando devagarinho.",
    open: "Abra 💌",
  },
  cards: [
    "Não quero te perder.",
    "Não quero deixar de ouvir as suas coisas.",
    "Não quero perder os nossos pequenos costumes.",
    "Não quero perder a felicidade de voltar para casa e te ver.",
    "Não quero perder as nossas formas de dizer eu te amo.",
    "Não quero deixar de te olhar e sentir que não preciso de mais nada.",
  ],
  final: {
    title: "Eu te amo, Cami.",
    message: "Não vou desistir de nós. Quero continuar te ouvindo, cuidar dos nossos costumes e te escolher todos os dias, também nos dias difíceis.",
    signature: "— Juan",
    again: "Ver de novo",
    write: "Escrever para o Juan",
  },
  counter: (current, total) => `${current}/${total}`,
  next: "Próximo",
  previous: "Anterior",
  close: "Sair",
  song: "Iris · Dean Lewis",
  songFrame: "Música: Iris de Dean Lewis",
  pause: "Pausar a música",
  play: "Tocar a música",
  swipe: "Toque à direita ou deslize para continuar",
};
