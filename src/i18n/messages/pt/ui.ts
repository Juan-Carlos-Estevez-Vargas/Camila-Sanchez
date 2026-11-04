import type { Messages } from "@/i18n";

export const ui: Messages["ui"] = {
  loader: {
    phrases: [
      "Guardando esta lembrança com todo o meu amor…",
      "Caprichando em cada detalhe do seu sorriso…",
      "Abrindo espaço no nosso álbum…",
      "Embrulhando este momento para sempre…",
      "Cuidando para que fique tão linda quanto você…",
      "Ajustando a luz dos nossos dias felizes…",
      "Só um segundinho, o que é bonito leva tempo…",
    ],
    dialog: "Salvando fotos",
    progress: "Fotos salvas",
    ready: (done, total) => `${done} de ${total} ${total === 1 ? "foto pronta" : "fotos prontas"}`,
    duplicates: (n) => ` · ${n} já estavam`,
    saved: (size) => ` · ${size} mais leves`,
    failed: (n) => ` · ${n} com problemas`,
    remaining: (time) => `Falta ${time}`,
  },
  upload: {
    checking: "Verificando a foto",
    duplicate: "Já estava no álbum",
    optimizing: "Otimizando com carinho",
    saving: "Guardando no nosso álbum",
    finishing: "Colocando um lacinho",
    cantOpen: "Não consegui abrir esta imagem. Tente uma foto JPG, PNG ou WebP.",
    cantOptimize: "Não consegui otimizar esta imagem.",
    notImage: "Esse arquivo não é uma imagem.",
    tooBig: "A imagem tem mais de 40 MB.",
    workerStopped: "O otimizador de imagens parou. Tente de novo.",
  },
  queue: {
    waiting: "Na fila",
    retrying: (n, max) => `Tentando de novo (${n}/${max})`,
    done: "Pronto",
    cancelled: "Cancelado",
    error: "Erro",
  },
  captcha: {
    label: "Verificação anti-robôs",
    failed: "Não consegui verificar que você não é um robô. Recarregue a página e tente de novo.",
    notLoaded: "A verificação anti-robôs não carregou. Verifique sua conexão e recarregue a página.",
    unfinished: "A verificação anti-robôs não terminou. Marque-a e tente de novo.",
  },
};
