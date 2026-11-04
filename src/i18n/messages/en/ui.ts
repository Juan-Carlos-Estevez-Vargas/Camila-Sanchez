import type { Messages } from "@/i18n";

export const ui: Messages["ui"] = {
  loader: {
    phrases: [
      "Saving this memory with all my love…",
      "Polishing every detail of your smile…",
      "Making room in our album…",
      "Wrapping this moment up forever…",
      "Making sure it looks as lovely as you…",
      "Adjusting the light of our happy days…",
      "Just a second, lovely things take time…",
    ],
    dialog: "Saving photos",
    progress: "Photos saved",
    ready: (done, total) => `${done} of ${total} ${total === 1 ? "photo ready" : "photos ready"}`,
    duplicates: (n) => ` · ${n} were already there`,
    saved: (size) => ` · ${size} lighter`,
    failed: (n) => ` · ${n} with problems`,
    remaining: (time) => `${time} left`,
  },
  upload: {
    checking: "Checking the photo",
    duplicate: "Already in the album",
    optimizing: "Optimizing with care",
    saving: "Saving to our album",
    finishing: "Tying a little bow on it",
    cantOpen: "I couldn't open this image. Try a JPG, PNG or WebP photo.",
    cantOptimize: "I couldn't optimize this image.",
    notImage: "That file isn't an image.",
    tooBig: "The image is larger than 40 MB.",
    workerStopped: "The image optimizer stopped. Please try again.",
  },
  queue: {
    waiting: "Waiting",
    retrying: (n, max) => `Retrying (${n}/${max})`,
    done: "Done",
    cancelled: "Cancelled",
    error: "Error",
  },
  captcha: {
    label: "Anti-robot check",
    failed: "I couldn't verify that you're not a robot. Reload the page and try again.",
    notLoaded: "The anti-robot check didn't load. Check your connection and reload the page.",
    unfinished: "The anti-robot check didn't finish. Tick it and try again.",
  },
};
