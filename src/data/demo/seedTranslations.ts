/**
 * Traducciones del contenido inicial de la demo (las mismas que aplica la
 * migración 20261104000200_seed_translations.sql a la base real). Las
 * secciones van por tipo; los hitos y las fechas, por su título en español.
 */
import type { ContentTranslations } from "@/domain/contentTranslations";

export const SEED_TRANSLATIONS: {
  settings: ContentTranslations;
  sections: Record<string, ContentTranslations>;
  milestones: Record<string, ContentTranslations>;
  dates: Record<string, ContentTranslations>;
} = {
  "settings": {
    "en": {
      "siteTitle": "For the love of my life 💖",
      "siteSubtitle": "This page is a reflection of how much I love you. Every detail is made for you."
    },
    "pt": {
      "siteTitle": "Para o amor da minha vida 💖",
      "siteSubtitle": "Esta página é um reflexo do quanto eu te amo. Cada detalhe foi feito para você."
    }
  },
  "sections": {
    "hero": {
      "en": {
        "title": "For the love of my life 💖",
        "subtitle": "This page is a reflection of how much I love you. Every detail is made for you."
      },
      "pt": {
        "title": "Para o amor da minha vida 💖",
        "subtitle": "Esta página é um reflexo do quanto eu te amo. Cada detalhe foi feito para você."
      }
    },
    "together_counter": {
      "en": {
        "title": "Time together",
        "subtitle": "And counting, every second by your side"
      },
      "pt": {
        "title": "Tempo juntos",
        "subtitle": "E contando, cada segundo ao seu lado"
      }
    },
    "countdowns": {
      "en": {
        "title": "Dates we're looking forward to",
        "subtitle": "How long until our special days"
      },
      "pt": {
        "title": "Datas que esperamos",
        "subtitle": "Quanto falta para os nossos dias especiais"
      }
    },
    "love_notes": {
      "en": {
        "title": "Messages from the heart",
        "content": {
          "cards": [
            {
              "title": "When I think of you...",
              "body": "My day lights up just by remembering your smile. You are my reason to smile every morning."
            },
            {
              "title": "What I love most about you",
              "body": "The way you see life, your kindness, and how you make everything better just by being there."
            },
            {
              "title": "Promises",
              "body": "I promise to be by your side every step of the way, to celebrate your achievements and to dry your tears."
            }
          ]
        }
      },
      "pt": {
        "title": "Mensagens do coração",
        "content": {
          "cards": [
            {
              "title": "Quando penso em você...",
              "body": "Meu dia se ilumina só de lembrar do seu sorriso. Você é o meu motivo para sorrir todas as manhãs."
            },
            {
              "title": "O que eu mais amo em você",
              "body": "Seu jeito de ver a vida, sua bondade e como você deixa tudo melhor com a sua presença."
            },
            {
              "title": "Promessas",
              "body": "Prometo estar ao seu lado em cada passo, celebrar suas conquistas e secar suas lágrimas."
            }
          ]
        }
      }
    },
    "milestones": {
      "en": {
        "title": "Our story",
        "subtitle": "The moments that made us who we are"
      },
      "pt": {
        "title": "Nossa história",
        "subtitle": "Os momentos que fizeram de nós o que somos"
      }
    },
    "gallery": {
      "en": {
        "title": "Our story in photos",
        "subtitle": "Pick a year and a month to relive our memories"
      },
      "pt": {
        "title": "Nossa história em fotos",
        "subtitle": "Escolha um ano e um mês para reviver nossas lembranças"
      }
    },
    "letter": {
      "en": {
        "title": "My letter to you",
        "content": {
          "greeting": "My love...",
          "paragraphs": [
            "I want to remind you that you are the best gift life has given me. Every day by your side is a blessing, and I want to renew my promises of eternal love."
          ],
          "wishes": [
            "❤️ May we spend every Christmas together",
            "✨ May our dreams come true",
            "🎁 May our love keep growing",
            "🌟 May we create traditions together"
          ],
          "signature": "With all my love, your boyfriend",
          "surprise": {
            "button": "Open surprise gift",
            "title": "Surprise!",
            "text": "My greatest gift to you is my eternal love. I promise to love you, take care of you and make you happy every day of my life."
          }
        }
      },
      "pt": {
        "title": "Minha carta para você",
        "content": {
          "greeting": "Meu amor...",
          "paragraphs": [
            "Quero te lembrar que você é o melhor presente que a vida me deu. Cada dia ao seu lado é uma bênção e quero renovar minhas promessas de amor eterno."
          ],
          "wishes": [
            "❤️ Que passemos todos os Natais juntos",
            "✨ Que nossos sonhos se realizem",
            "🎁 Que nosso amor continue crescendo",
            "🌟 Que criemos tradições juntos"
          ],
          "signature": "Com todo o meu amor, seu namorado",
          "surprise": {
            "button": "Abrir presente surpresa",
            "title": "Surpresa!",
            "text": "Meu maior presente para você é o meu amor eterno. Prometo te amar, cuidar de você e te fazer feliz todos os dias da minha vida."
          }
        }
      }
    }
  },
  "milestones": {
    "Primera cita": {
      "en": {
        "title": "First date",
        "description": "I remember every detail of that day. How you made me laugh, how your eyes shone. From then on, I knew every moment with you would be special."
      },
      "pt": {
        "title": "Primeiro encontro",
        "description": "Lembro de cada detalhe daquele dia. Como você me fazia rir, como seus olhos brilhavam. Desde então, eu soube que cada momento com você seria especial."
      }
    },
    "El día que te pedí ser mi novia": {
      "en": {
        "title": "The day I asked you to be my girlfriend",
        "description": "Very nervously, I asked if I could share a life with you."
      },
      "pt": {
        "title": "O dia em que te pedi em namoro",
        "description": "Com muito nervosismo, te pedi para compartilhar uma vida com você."
      }
    },
    "Primer beso": {
      "en": {
        "title": "First kiss",
        "description": "I felt fear, nerves and an excitement I can't describe. But when your lips touched mine, everything made sense."
      },
      "pt": {
        "title": "Primeiro beijo",
        "description": "Senti medo, nervosismo e uma emoção que não consigo descrever. Mas quando seus lábios tocaram os meus, tudo fez sentido."
      }
    },
    "Tus primeras flores": {
      "en": {
        "title": "Your first flowers",
        "description": "How could I forget the excitement of waiting for your reaction."
      },
      "pt": {
        "title": "Suas primeiras flores",
        "description": "Como esquecer a emoção que eu sentia ao esperar a sua reação."
      }
    },
    "Nuestro primer viaje": {
      "en": {
        "title": "Our first trip",
        "description": "Walking hand in hand through new streets, discovering flavors, landscapes and glances. It was a new beginning for us."
      },
      "pt": {
        "title": "Nossa primeira viagem",
        "description": "Caminhar de mãos dadas por ruas novas, descobrir sabores, paisagens e olhares. Foi um novo começo para nós."
      }
    },
    "Todo lo que nos falta por explorar": {
      "en": {
        "title": "Everything we have yet to explore",
        "description": "We're only just getting started. Cities, dreams, challenges, hugs and sunsets are waiting for us."
      },
      "pt": {
        "title": "Tudo o que ainda vamos explorar",
        "description": "Estamos só começando. Nos esperam cidades, sonhos, desafios, abraços e pores do sol."
      }
    }
  },
  "dates": {
    "Nuestro aniversario": {
      "en": {
        "title": "Our anniversary",
        "message": "One more year choosing each other"
      },
      "pt": {
        "title": "Nosso aniversário de namoro",
        "message": "Mais um ano escolhendo um ao outro"
      }
    },
    "Navidad juntos": {
      "en": {
        "title": "Christmas together",
        "message": "May we spend every Christmas together"
      },
      "pt": {
        "title": "Natal juntos",
        "message": "Que passemos todos os Natais juntos"
      }
    },
    "Tu cumpleaños": {
      "en": {
        "title": "Your birthday",
        "message": "The day the world became more beautiful"
      },
      "pt": {
        "title": "Seu aniversário",
        "message": "O dia em que o mundo ficou mais bonito"
      }
    }
  }
};
