/** El ramo de flores de cada fecha especial (ver domain/bouquets.ts). */
interface Where {
  place: string;
  time: string;
}

interface Invite {
  /** «en el restaurante de siempre a las 8:00 p. m.» (o la frase de «pronto te digo»). */
  where: string;
  name: string;
  /** La noche anterior: «mañana cumples años». */
  eve: boolean;
}

// Sin el punto final de la hora («8 p. m.»): la frase ya sigue con su propio punto.
const where = ({ place, time: rawTime }: Where, time = rawTime.replace(/\.+$/, "")) =>
  place && time ? `en ${place} a las ${time}` : place ? `en ${place}` : time ? `a las ${time}` : "en el lugar que muy pronto te voy a decir";

export const bouquet = {
  button: "Tu ramo",
  buttonLabel: (flowers: string) => `Volver a abrir tu ramo de ${flowers}`,
  dialog: (flowers: string) => `Tu ramo de ${flowers}`,
  intro: "Tengo algo para ti…",
  skip: "Toca para verlo ya",
  forName: (name: string) => (name ? `Para ${name}` : "Para ti"),
  meaningTitle: (flowers: string) => `¿Por qué ${flowers}?`,
  placeLabel: "Dónde",
  timeLabel: "Cuándo",
  today: "Hoy ✨",
  tomorrow: "Mañana ✨",
  tomorrowAt: (time: string) => `Mañana, ${time}`,
  soon: "Pronto te digo 🤫",
  signedBy: (name: string) => `Con todo mi amor, ${name}`,
  defaultSignature: "Con todo mi amor, el que te espera 💋",
  accept: "Ahí estaré 💋",
  close: "Cerrar el ramo",
  where,
  flowers: {
    birthday: {
      name: "gerberas",
      meaning: "La gerbera es la flor de la alegría: significa felicidad, inocencia y ganas de vivir. Regalarla es desearle a alguien un año lleno de luz y de colores. Por eso hoy son tuyas, porque tú eres la alegría de mis días.",
    },
    anniversary: {
      name: "peonías",
      meaning: "La peonía es la flor del amor que dura: de las parejas que se siguen eligiendo y de un futuro feliz juntos. Un año más contigo y todavía me florece el pecho cuando te veo.",
    },
    valentine: {
      name: "rosas rojas",
      meaning: "La rosa roja es el «te amo» que no necesita palabras: amor apasionado, deseo y entrega. No encontré una forma más clara de decirte lo que me haces sentir.",
    },
    friendship: {
      name: "girasoles",
      meaning: "El girasol significa lealtad y admiración: siempre se gira buscando al sol. Yo hago lo mismo contigo, mi mejor amiga y mi persona favorita.",
    },
    halloween: {
      name: "dalias",
      meaning: "La dalia es elegancia, misterio y un compromiso que no se rompe. Morada como la noche y naranja como el fuego: intensa y preciosa, igual que tú.",
    },
    christmas: {
      name: "flores de Nochebuena",
      meaning: "La flor de Nochebuena es la flor de la Navidad: alegría, buenos deseos y celebración. Su rojo es el color del amor en las noches frías, y este año el mío es todo tuyo.",
    },
    newYear: {
      name: "tulipanes",
      meaning: "El tulipán es la flor de los nuevos comienzos y del amor perfecto: florece cuando todo vuelve a empezar. Quiero que todo lo nuevo de este año empiece contigo.",
    },
  },
  invites: {
    birthday: ({ where, name, eve }: Invite) =>
      `${name ? `${name}, ${eve ? "mañana" : "hoy"}` : eve ? "Mañana" : "Hoy"} cumples años y yo cumplo el antojo de celebrarte como mereces. Te espero ${where}. Ponte linda (aunque ya lo eres), lleva tu mejor actitud y déjate atender en todos los aspectos… sí, en todos 😏. Lo demás corre por mi cuenta.`,
    anniversary: ({ where }: Invite) =>
      `Un año más a tu lado y todavía me pones nervioso. Te espero ${where}. Arréglate bonita, trae esa sonrisa que me desarma y prepárate para que te consienta de pies a cabeza… sin prisa 😏.`,
    valentine: ({ where }: Invite) =>
      `Esta noche no hay planes: hay un plan, y eres tú. Te espero ${where}. Ponte eso que sabes que me encanta, lleva la mejor actitud y déjate querer en todos los sentidos 😘.`,
    friendship: ({ where }: Invite) =>
      `Mi mejor amiga, mi cómplice y mi tentación favorita. Te espero ${where}. Ve linda, con ganas de pasarla rico, y déjame encargarme de que no te falte nada 😉.`,
    halloween: ({ where }: Invite) =>
      `¿Dulce o truco? Esta noche, las dos cosas 😈. Te espero ${where}. Ve preciosa, con tu mejor actitud y lista para que te consienta… sin miedo a nada.`,
    christmas: ({ where }: Invite) =>
      `Este año el regalo eres tú, pero quien te va a envolver en mimos soy yo 🎁. Te espero ${where}. Ponte linda, lleva tu mejor actitud y déjate atender en todos los aspectos 😏.`,
    newYear: ({ where }: Invite) =>
      `Quiero empezar el año como se debe: contigo. Te espero ${where}. Ponte radiante, lleva la mejor actitud y déjate atender… a las doce, y después de las doce también 🥂😏.`,
  },
  admin: {
    title: "💐 Ramo de flores",
    hint: "Desde la noche anterior (o ese día), al entrar, le sale una animación que le revela un ramo con su notita de invitación, y hasta el final del día le queda un botón 💐 para volver a abrirlo. Cada vez que lo abre queda en Auditoría → Actividad. No sale en las novedades: es sorpresa.",
    enabled: "Regalarle un ramo en cada fecha especial",
    recipient: "Para quién es",
    recipientAuto: "Quien entra y no edita la Apariencia",
    signature: "Firma de la notita",
    signaturePlaceholder: "Tu Juan",
    eve: "Desde cuándo lo puede ver",
    eveMidnight: "Sólo el día, desde la medianoche",
    eveAt: (hour: number) => `Desde la noche anterior a las ${hour - 12} p. m.`,
    eveHint: "Hasta las 11:59 p. m. del día. La víspera la nota dice «mañana».",
    summary: (flowers: string) => `💐 Ramo: ${flowers}`,
    place: "Lugar",
    placePlaceholder: "el restaurante de siempre",
    time: "Hora",
    timePlaceholder: "8:00 p. m.",
    message: "Mensaje propio (opcional)",
    messageHint: "Vacío: la invitación de la app. Puedes usar {lugar}, {hora} y {nombre}.",
    save: "Guardar la notita",
    saved: "Notita guardada 💐",
    preview: "Ver el ramo",
    meaning: "Por qué estas flores",
    private: "El lugar, la hora y el mensaje no se ven sin iniciar sesión.",
  },
  activity: {
    title: "💐 Ramos de flores",
    hint: "Cada vez que abrió el ramo de una fecha especial y cuánto tiempo lo miró.",
    empty: "Todavía no ha abierto ningún ramo con estos filtros.",
    day: "Fecha",
    how: "Cómo",
    auto: "Al entrar",
    button: "Con el botón 💐",
    looked: "Lo miró",
  },
};
