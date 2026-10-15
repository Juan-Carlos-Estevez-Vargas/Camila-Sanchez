/**
 * Datos iniciales del modo demo. Generado a partir de supabase/seed.sql para
 * que la demo muestre exactamente lo mismo que la base real recién creada.
 */
import { DEFAULT_EFFECTS, DEFAULT_THEME } from "@/domain/defaults";
import type { ImportantDate, Milestone, Photo, Section, SiteSettings } from "@/domain/types";

export const SEED_SETTINGS: SiteSettings = {
  siteTitle: "Para el amor de mi vida 💖",
  siteSubtitle: "Esta página es un reflejo de lo mucho que te amo. Cada detalle está hecho para ti.",
  relationshipStart: "2025-05-31",
  isPublic: true,
  musicUrl: null,
  theme: DEFAULT_THEME,
  effects: DEFAULT_EFFECTS,
  updatedAt: "2026-10-15T00:00:00.000Z",
};

type Seed<T> = Array<Omit<T, "id">>;

export const SEED_SECTIONS = [
  {
    "kind": "hero",
    "title": "Para el amor de mi vida 💖",
    "subtitle": "Esta página es un reflejo de lo mucho que te amo. Cada detalle está hecho para ti.",
    "content": {},
    "animation": "fade-up",
    "position": 0,
    "isVisible": true
  },
  {
    "kind": "together_counter",
    "title": "Tiempo juntos",
    "subtitle": "Y contando, cada segundo a tu lado",
    "content": {},
    "animation": "zoom-in",
    "position": 1,
    "isVisible": true
  },
  {
    "kind": "countdowns",
    "title": "Fechas que esperamos",
    "subtitle": "Lo que falta para nuestros días especiales",
    "content": {},
    "animation": "fade-up",
    "position": 2,
    "isVisible": true
  },
  {
    "kind": "love_notes",
    "title": "Mensajes del corazón",
    "subtitle": "",
    "content": {
      "cards": [
        {
          "icon": "☀️",
          "title": "Cuando pienso en ti...",
          "body": "Mi día se ilumina solo con recordar tu sonrisa. Eres mi razón para sonreír cada mañana."
        },
        {
          "icon": "💗",
          "title": "Lo que más amo de ti",
          "body": "Tu forma de ver la vida, tu bondad, y cómo haces que todo sea mejor con tu presencia."
        },
        {
          "icon": "🤞",
          "title": "Promesas",
          "body": "Prometo estar a tu lado en cada paso, celebrar tus logros y secar tus lágrimas."
        }
      ]
    },
    "animation": "fade-up",
    "position": 3,
    "isVisible": true
  },
  {
    "kind": "milestones",
    "title": "Nuestra historia",
    "subtitle": "Los momentos que nos hicieron nosotros",
    "content": {},
    "animation": "slide-left",
    "position": 4,
    "isVisible": true
  },
  {
    "kind": "gallery",
    "title": "Nuestra historia en fotos",
    "subtitle": "Elige un año y un mes para revivir nuestros recuerdos",
    "content": {},
    "animation": "fade-up",
    "position": 5,
    "isVisible": true
  },
  {
    "kind": "letter",
    "title": "Mi carta para ti",
    "subtitle": "",
    "content": {
      "greeting": "Mi amor...",
      "paragraphs": [
        "Quiero recordarte que eres el mejor regalo que la vida me ha dado. Cada día a tu lado es una bendición y quiero renovar mis promesas de amor eterno."
      ],
      "wishes": [
        "❤️ Que cada Navidad la pasemos juntos",
        "✨ Que nuestros sueños se hagan realidad",
        "🎁 Que nuestro amor siga creciendo",
        "🌟 Que creemos tradiciones juntos"
      ],
      "signature": "Con todo mi amor, tu novio",
      "surprise": {
        "button": "Abrir regalo sorpresa",
        "title": "¡Sorpresa!",
        "text": "Mi regalo más grande para ti es mi amor eterno. Prometo amarte, cuidarte y hacerte feliz cada día de mi vida."
      }
    },
    "animation": "zoom-in",
    "position": 6,
    "isVisible": true
  }
] as unknown as Seed<Section>;

export const SEED_MILESTONES: Seed<Milestone> = [
  {
    "title": "Primera cita",
    "description": "Recuerdo cada detalle de ese día. Cómo me hacías reír, cómo brillaban tus ojos. Desde entonces, supe que cada momento contigo sería especial.",
    "happenedOn": "2025-05-10",
    "icon": "🌟",
    "position": 0
  },
  {
    "title": "El día que te pedí ser mi novia",
    "description": "Con mucho nerviosismo, te pedí poder compartir una vida contigo.",
    "happenedOn": "2025-05-30",
    "icon": "💍",
    "position": 1
  },
  {
    "title": "Primer beso",
    "description": "Tuve miedo, nervios, y una emoción que no puedo describir. Pero cuando tus labios tocaron los míos, todo cobró sentido.",
    "happenedOn": "2025-05-31",
    "icon": "💋",
    "position": 2
  },
  {
    "title": "Tus primeras flores",
    "description": "Cómo olvidar la emoción que sentía al esperar tu reacción.",
    "happenedOn": "2025-06-09",
    "icon": "💐",
    "position": 3
  },
  {
    "title": "Nuestro primer viaje",
    "description": "Caminar de tu mano por calles nuevas, descubrir sabores, paisajes y miradas. Fue un nuevo inicio para nosotros.",
    "happenedOn": "2025-06-28",
    "icon": "🏙️",
    "position": 4
  },
  {
    "title": "Todo lo que nos falta por explorar",
    "description": "Apenas estamos empezando. Nos esperan ciudades, sueños, retos, abrazos y atardeceres.",
    "happenedOn": "2026-12-31",
    "icon": "🌈",
    "position": 5
  }
].map((m) => ({ ...m, photoId: null }));

export const SEED_DATES: Seed<ImportantDate> = [
  { title: "Nuestro aniversario", eventDate: "2025-05-31", recursYearly: true, icon: "💞", message: "Un año más eligiéndonos", isVisible: true },
  { title: "Navidad juntos", eventDate: "2025-12-24", recursYearly: true, icon: "🎄", message: "Que cada Navidad la pasemos juntos", isVisible: true },
  { title: "Tu cumpleaños", eventDate: "2025-01-01", recursYearly: true, icon: "🎂", message: "El día en que el mundo se volvió más bonito", isVisible: false },
];

export const SEED_PHOTOS: Seed<Photo> = [
  {
    "externalUrl": "/assets/img/2025/mayo1.jpeg",
    "caption": "Aquí, aún no éramos novios pero el verte trabajar me alegraba mucho el alma",
    "takenOn": "2025-05-10",
    "position": 0
  },
  {
    "externalUrl": "/assets/img/2025/mayo2.jpeg",
    "caption": "Cómo olvidar el día en que con mucho nerviosismo, te pedí poder compartir una vida contigo y ser novios",
    "takenOn": "2025-05-30",
    "position": 1
  },
  {
    "externalUrl": "/assets/img/2025/junio1.jpeg",
    "caption": "Tus primeras flores, cómo olvidar la emoción que sentía al esperar tu reacción",
    "takenOn": "2025-06-09",
    "position": 0
  },
  {
    "externalUrl": "/assets/img/2025/junio2.jpeg",
    "caption": "Mi primer fondo de pantalla alusivo a tí",
    "takenOn": "2025-06-10",
    "position": 1
  },
  {
    "externalUrl": "/assets/img/2025/junio3.jpeg",
    "caption": "Lo hermosa que te ves enamorada de mí",
    "takenOn": "2025-06-16",
    "position": 2
  },
  {
    "externalUrl": "/assets/img/2025/junio4.jpeg",
    "caption": "Dedicarle el cielo a mi cielo, es y será siempre un detalle desde lo profundo de mi corazón",
    "takenOn": "2025-06-18",
    "position": 3
  },
  {
    "externalUrl": "/assets/img/2025/junio5.jpeg",
    "caption": "Lo hermoso de este momento no tiene comparación",
    "takenOn": "2025-06-21",
    "position": 4
  },
  {
    "externalUrl": "/assets/img/2025/junio6.jpeg",
    "caption": "Amo tus ocurrencias",
    "takenOn": "2025-06-23",
    "position": 5
  },
  {
    "externalUrl": "/assets/img/2025/junio7.jpeg",
    "caption": "El que se meta conmigo ya sabe, lleva bala jajajaja",
    "takenOn": "2025-06-25",
    "position": 6
  },
  {
    "externalUrl": "/assets/img/2025/junio8.jpeg",
    "caption": "Imposible olvidar nuestro primer viaje, todas las aventuras vividas y lo felices que fuimos",
    "takenOn": "2025-06-28",
    "position": 7
  },
  {
    "externalUrl": "/assets/img/2025/julio1.jpeg",
    "caption": "Un paseito inolvidable, muchas aventuras, mucho amor y sobre todo un amor muy lindo",
    "takenOn": "2025-07-04",
    "position": 0
  },
  {
    "externalUrl": "/assets/img/2025/julio2.jpeg",
    "caption": "Desbordados de amor, amaba recogerte y que me recibieras con una sonrisa, un beso, un te amo y una pizza",
    "takenOn": "2025-07-08",
    "position": 1
  },
  {
    "externalUrl": "/assets/img/2025/julio3.jpeg",
    "caption": "Salidita a cenar, bailar y amarnos mucho mucho",
    "takenOn": "2025-07-13",
    "position": 2
  },
  {
    "externalUrl": "/assets/img/2025/julio4.jpeg",
    "caption": "Sesión de fotos en el parque con el primo",
    "takenOn": "2025-07-15",
    "position": 3
  },
  {
    "externalUrl": "/assets/img/2025/julio5.jpeg",
    "caption": "Salidita de novios, sesión de fotos y amor que se desborda",
    "takenOn": "2025-07-22",
    "position": 4
  },
  {
    "externalUrl": "/assets/img/2025/julio6.jpeg",
    "caption": "La dueña de las carreteras y dueña de mi corazón",
    "takenOn": "2025-07-22",
    "position": 5
  },
  {
    "externalUrl": "/assets/img/2025/julio7.jpeg",
    "caption": "No tengo palabras para describir lo orgulloso que me sentia en ese momento de que fueras mi novia",
    "takenOn": "2025-07-25",
    "position": 6
  },
  {
    "externalUrl": "/assets/img/2025/julio8.jpeg",
    "caption": "¿Recuerdas esa hamburguesa?",
    "takenOn": "2025-07-25",
    "position": 7
  },
  {
    "externalUrl": "/assets/img/2025/agosto1.jpeg",
    "caption": "Ámame toda la vida",
    "takenOn": "2025-08-11",
    "position": 0
  },
  {
    "externalUrl": "/assets/img/2025/agosto2.jpeg",
    "caption": "Visitandote en el trabajo de tu mamá",
    "takenOn": "2025-08-15",
    "position": 1
  },
  {
    "externalUrl": "/assets/img/2025/agosto3.jpeg",
    "caption": "Felicidad en el cumple de 'Chofi'",
    "takenOn": "2025-08-18",
    "position": 2
  },
  {
    "externalUrl": "/assets/img/2025/agosto4.jpeg",
    "caption": "Simplemente divinos",
    "takenOn": "2025-08-18",
    "position": 3
  },
  {
    "externalUrl": "/assets/img/2025/agosto5.jpeg",
    "caption": "Visita al cementerio",
    "takenOn": "2025-08-22",
    "position": 4
  },
  {
    "externalUrl": "/assets/img/2025/agosto6.jpeg",
    "caption": "Increíble momento",
    "takenOn": "2025-08-24",
    "position": 5
  },
  {
    "externalUrl": "/assets/img/2025/agosto7.jpeg",
    "caption": "Me encanta hacerte feliz",
    "takenOn": "2025-08-29",
    "position": 6
  },
  {
    "externalUrl": "/assets/img/2025/agosto8.jpeg",
    "caption": "Día de picnic",
    "takenOn": "2025-08-30",
    "position": 7
  },
  {
    "externalUrl": "/assets/img/CitaPostres.jpeg",
    "caption": "Nuestra cita de postres, dulces momentos compartidos",
    "takenOn": "2025-07-01",
    "position": 10
  },
  {
    "externalUrl": "/assets/img/CitaPostres2.jpeg",
    "caption": "Risas y postres, la combinación perfecta contigo",
    "takenOn": "2025-07-01",
    "position": 11
  },
  {
    "externalUrl": "/assets/img/Flores.jpeg",
    "caption": "Las flores que te regalé, tan hermosas como tú",
    "takenOn": "2025-07-01",
    "position": 12
  },
  {
    "externalUrl": "/assets/img/PalosTiros.jpeg",
    "caption": "Aventuras y juegos, contigo todo es divertido",
    "takenOn": "2025-07-01",
    "position": 13
  }
].map((p) => ({
  ...p, storagePath: null, thumbPath: null, width: null, height: null, bytes: null,
  createdAt: "2026-10-15T00:00:00.000Z",
}));
