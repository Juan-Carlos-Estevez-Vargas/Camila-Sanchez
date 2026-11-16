import type { Messages } from "@/i18n";

export const goodbye: Messages["goodbye"] = {
  pageTitle: "Até sempre",
  invite: {
    title: "Tenho algo para te dizer",
    body: "O Juan te deixou uma última carta. Aumente o volume.",
    open: "Abra 💌",
    later: "Depois",
  },
  intro: {
    to: "Para você, Cami",
    hint: "Aumente o volume e leia devagarinho.",
    open: "Abra 💌",
  },
  cards: [
    "Não sei muito bem como começar esta carta, porque é a que eu nunca quis escrever.",
    "Eu te amo. Digo sem enfeites, porque é a maior verdade que eu tenho.",
    "Sinto sua falta nas coisas pequenas: nas mensagens de bom dia, no seu riso, no jeito como o dia ficava mais leve quando você estava nele. Sinto sua falta até agora, e é isso que mais dói.",
    "Eu teria dado tudo por você. Meu tempo, minha paciência, meus planos, o que fosse preciso para te ver feliz. Te amar nunca foi um sacrifício; foi a coisa mais bonita que me aconteceu.",
    "Se eu pudesse voltar no tempo, faria tantas coisas diferentes. Te escutaria mais, cuidaria melhor de você, estaria presente nos momentos que realmente importavam.",
    "Eu te diria mais vezes o que você significa para mim, em vez de achar que era óbvio. Não posso mudar o que passou, mas quero que você saiba que eu vejo, e que sinto muito.",
    "Hoje entendo algo que me custa aceitar: você já não sente o mesmo por mim. Dá para ver, e não te culpo. O amor não se pede nem se obriga, e você merece estar onde seu coração quiser estar.",
    "Por isso eu me afasto, mesmo que doa. Não porque deixei de te amar, mas justamente porque te amo. Prefiro te ver feliz longe de mim do que te ter perto sem que você seja.",
    "Espero que você encontre alguém que te valorize como você merece, que veja em você tudo o que eu vi e que te lembre disso todos os dias.",
  ],
  final: {
    title: "Seja feliz, Cami.",
    message: "Obrigado por cada momento, por cada risada, por ter me deixado te amar. Uma parte de mim sempre vai guardar com carinho o que fomos. Se cuida muito. De verdade.",
    signature: "Com todo o amor que ainda tenho, Juan",
    again: "Ler de novo",
    write: "Voltar ao início",
  },
  counter: (current, total) => `${current}/${total}`,
  next: "Próximo",
  previous: "Anterior",
  close: "Sair",
  song: "Lloro por ti · Enrique Iglesias",
  songFrame: "Música: Lloro por ti de Enrique Iglesias",
  pause: "Pausar a música",
  play: "Tocar a música",
  swipe: "Toque à direita ou deslize para continuar",
};
