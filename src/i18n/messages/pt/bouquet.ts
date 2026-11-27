import type { Messages } from "@/i18n";

export const bouquet: Messages["bouquet"] = {
  button: "Seu buquê",
  buttonLabel: (flowers) => `Abrir de novo seu buquê de ${flowers}`,
  dialog: (flowers) => `Seu buquê de ${flowers}`,
  intro: "Tenho algo para você…",
  skip: "Toque para ver agora",
  forName: (name) => (name ? `Para ${name}` : "Para você"),
  meaningTitle: (flowers) => `Por que ${flowers}?`,
  placeLabel: "Onde",
  timeLabel: "Quando",
  today: "Hoje ✨",
  tomorrow: "Amanhã ✨",
  tomorrowAt: (time) => `Amanhã, ${time}`,
  soon: "Logo eu te conto 🤫",
  signedBy: (name) => `Com todo o meu amor, ${name}`,
  defaultSignature: "Com todo o meu amor, quem te espera 💋",
  accept: "Estarei lá 💋",
  close: "Fechar o buquê",
  where: ({ place, time: rawTime }, time = rawTime.replace(/\.+$/, "")) =>
    place && time ? `em ${place} às ${time}` : place ? `em ${place}` : time ? `às ${time}` : "no lugar que muito em breve vou te contar",
  flowers: {
    birthday: {
      name: "gérberas",
      meaning: "A gérbera é a flor da alegria: significa felicidade, inocência e vontade de viver. Dá-las é desejar a alguém um ano cheio de luz e de cores. Por isso hoje são suas, porque você é a alegria dos meus dias.",
    },
    anniversary: {
      name: "peônias",
      meaning: "A peônia é a flor do amor que dura: dos casais que continuam se escolhendo e de um futuro feliz juntos. Mais um ano com você e meu peito ainda floresce quando te vejo.",
    },
    valentine: {
      name: "rosas vermelhas",
      meaning: "A rosa vermelha é o «eu te amo» que não precisa de palavras: amor apaixonado, desejo e entrega. Não encontrei forma mais clara de dizer o que você me faz sentir.",
    },
    friendship: {
      name: "girassóis",
      meaning: "O girassol significa lealdade e admiração: sempre se vira procurando o sol. Eu faço o mesmo com você, minha melhor amiga e minha pessoa favorita.",
    },
    halloween: {
      name: "dálias",
      meaning: "A dália é elegância, mistério e um compromisso que não se rompe. Roxa como a noite e laranja como o fogo: intensa e linda, igual a você.",
    },
    christmas: {
      name: "bicos-de-papagaio",
      meaning: "O bico-de-papagaio é a flor do Natal: alegria, bons desejos e celebração. Seu vermelho é a cor do amor nas noites frias, e este ano o meu é todo seu.",
    },
    newYear: {
      name: "tulipas",
      meaning: "A tulipa é a flor dos recomeços e do amor perfeito: floresce quando tudo volta a começar. Quero que tudo de novo deste ano comece com você.",
    },
  },
  invites: {
    birthday: ({ where, name, eve }) =>
      `${name ? `${name}, ${eve ? "amanhã" : "hoje"}` : eve ? "Amanhã" : "Hoje"} é seu aniversário e eu realizo a vontade de te celebrar como você merece. Te espero ${where}. Fique linda (você já é), leve sua melhor atitude e deixe-se cuidar em todos os sentidos… sim, em todos 😏. O resto é por minha conta.`,
    anniversary: ({ where }) =>
      `Mais um ano ao seu lado e você ainda me deixa nervoso. Te espero ${where}. Arrume-se bonita, traga esse sorriso que me desarma e prepare-se para ser mimada da cabeça aos pés… sem pressa 😏.`,
    valentine: ({ where }) =>
      `Esta noite não há planos: há um plano, e é você. Te espero ${where}. Use aquilo que você sabe que eu adoro, leve sua melhor atitude e deixe-se amar em todos os sentidos 😘.`,
    friendship: ({ where }) =>
      `Minha melhor amiga, minha cúmplice e minha tentação favorita. Te espero ${where}. Venha linda, com vontade de curtir, e deixe que eu cuide para que não te falte nada 😉.`,
    halloween: ({ where }) =>
      `Doce ou travessura? Esta noite, os dois 😈. Te espero ${where}. Venha linda, com sua melhor atitude e pronta para ser mimada… sem medo de nada.`,
    christmas: ({ where }) =>
      `Este ano o presente é você, mas quem vai te embrulhar em carinho sou eu 🎁. Te espero ${where}. Fique linda, leve sua melhor atitude e deixe-se cuidar em todos os sentidos 😏.`,
    newYear: ({ where }) =>
      `Quero começar o ano do jeito certo: com você. Te espero ${where}. Fique radiante, leve sua melhor atitude e deixe-se cuidar… à meia-noite, e depois da meia-noite também 🥂😏.`,
  },
  admin: {
    title: "💐 Buquê de flores",
    hint: "Desde a noite anterior (ou nesse dia), ao entrar, uma animação revela um buquê com seu bilhete de convite, e até o fim do dia fica um botão 💐 para abri-lo de novo. Cada vez que ela abre fica em Auditoria → Atividade. Não aparece nas novidades: é surpresa.",
    enabled: "Dar um buquê em cada data especial",
    recipient: "Para quem é",
    recipientAuto: "Quem entra e não edita a Aparência",
    signature: "Assinatura do bilhete",
    signaturePlaceholder: "Seu Juan",
    eve: "Desde quando ela pode ver",
    eveMidnight: "Só no dia, desde a meia-noite",
    eveAt: (hour) => `Desde a noite anterior às ${hour}h`,
    eveHint: "Até 23h59 do dia. Na véspera, o bilhete diz “amanhã”.",
    summary: (flowers) => `💐 Buquê: ${flowers}`,
    place: "Lugar",
    placePlaceholder: "o restaurante de sempre",
    time: "Hora",
    timePlaceholder: "20:00",
    message: "Mensagem própria (opcional)",
    messageHint: "Vazio: o convite do app. Você pode usar {lugar}, {hora} e {nombre} (nome).",
    save: "Salvar o bilhete",
    saved: "Bilhete salvo 💐",
    preview: "Ver o buquê",
    meaning: "Por que estas flores",
    private: "O lugar, a hora e a mensagem não aparecem sem entrar na conta.",
  },
  activity: {
    title: "💐 Buquês de flores",
    hint: "Cada vez que ela abriu o buquê de uma data especial e quanto tempo olhou.",
    empty: "Nenhum buquê foi aberto com estes filtros ainda.",
    day: "Data",
    how: "Como",
    auto: "Ao entrar",
    button: "Com o botão 💐",
    looked: "Olhou",
  },
};
