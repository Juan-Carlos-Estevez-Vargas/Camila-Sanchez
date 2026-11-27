import type { Messages } from "@/i18n";

export const bouquet: Messages["bouquet"] = {
  button: "Your bouquet",
  buttonLabel: (flowers) => `Open your bouquet of ${flowers} again`,
  dialog: (flowers) => `Your bouquet of ${flowers}`,
  intro: "I have something for you…",
  skip: "Tap to see it now",
  forName: (name) => (name ? `For ${name}` : "For you"),
  meaningTitle: (flowers) => `Why ${flowers}?`,
  placeLabel: "Where",
  timeLabel: "When",
  today: "Today ✨",
  tomorrow: "Tomorrow ✨",
  tomorrowAt: (time) => `Tomorrow, ${time}`,
  soon: "I'll tell you soon 🤫",
  signedBy: (name) => `With all my love, ${name}`,
  defaultSignature: "With all my love, the one waiting for you 💋",
  accept: "I'll be there 💋",
  close: "Close the bouquet",
  where: ({ place, time: rawTime }, time = rawTime.replace(/\.+$/, "")) =>
    place && time ? `at ${place} at ${time}` : place ? `at ${place}` : time ? `at ${time}` : "at a place I'll tell you about very soon",
  flowers: {
    birthday: {
      name: "gerberas",
      meaning: "The gerbera is the flower of joy: it means happiness, innocence and a love of life. Giving them is wishing someone a year full of light and color. That's why they're yours today, because you are the joy of my days.",
    },
    anniversary: {
      name: "peonies",
      meaning: "The peony is the flower of a love that lasts: of couples who keep choosing each other and of a happy future together. One more year with you and my heart still blooms when I see you.",
    },
    valentine: {
      name: "red roses",
      meaning: "A red rose is the \"I love you\" that needs no words: passionate love, desire and devotion. I couldn't find a clearer way to tell you what you make me feel.",
    },
    friendship: {
      name: "sunflowers",
      meaning: "The sunflower means loyalty and admiration: it always turns to find the sun. I do the same with you, my best friend and my favorite person.",
    },
    halloween: {
      name: "dahlias",
      meaning: "The dahlia is elegance, mystery and a commitment that never breaks. Purple like the night and orange like fire: intense and gorgeous, just like you.",
    },
    christmas: {
      name: "poinsettias",
      meaning: "The poinsettia is the Christmas flower: joy, good wishes and celebration. Its red is the color of love on cold nights, and this year mine is all yours.",
    },
    newYear: {
      name: "tulips",
      meaning: "The tulip is the flower of new beginnings and perfect love: it blooms when everything starts again. I want everything new this year to begin with you.",
    },
  },
  invites: {
    birthday: ({ where, name, eve }) =>
      `${name ? `${name}, ${eve ? "tomorrow" : "today"}` : eve ? "Tomorrow" : "Today"} is your birthday and I get to celebrate you the way you deserve. I'll be waiting for you ${where}. Look pretty (you already do), bring your best attitude and let me take care of you in every way… yes, every way 😏. Everything else is on me.`,
    anniversary: ({ where }) =>
      `One more year by your side and you still make me nervous. I'll be waiting for you ${where}. Dress up, bring that smile that disarms me and get ready to be spoiled from head to toe… slowly 😏.`,
    valentine: ({ where }) =>
      `Tonight there are no plans: there's one plan, and it's you. I'll be waiting for you ${where}. Wear that thing you know I love, bring your best attitude and let me love you in every sense 😘.`,
    friendship: ({ where }) =>
      `My best friend, my partner in crime and my favorite temptation. I'll be waiting for you ${where}. Come looking lovely and ready to have a great time, and let me make sure you lack nothing 😉.`,
    halloween: ({ where }) =>
      `Trick or treat? Tonight, both 😈. I'll be waiting for you ${where}. Come gorgeous, with your best attitude and ready to be spoiled… fearless.`,
    christmas: ({ where }) =>
      `This year you are the gift, but I'm the one who'll wrap you in affection 🎁. I'll be waiting for you ${where}. Look pretty, bring your best attitude and let me take care of you in every way 😏.`,
    newYear: ({ where }) =>
      `I want to start the year the right way: with you. I'll be waiting for you ${where}. Look radiant, bring your best attitude and let me take care of you… at midnight, and after midnight too 🥂😏.`,
  },
  admin: {
    title: "💐 Flower bouquet",
    hint: "From the night before (or that day), when she opens the app, an animation reveals a bouquet with its invitation note, and until the end of the day there's a 💐 button to open it again. Every time she opens it shows up in Audit → Activity. It isn't listed in What's new: it's a surprise.",
    enabled: "Give her a bouquet on every special date",
    recipient: "Who it's for",
    recipientAuto: "Whoever signs in and can't edit Appearance",
    signature: "Note signature",
    signaturePlaceholder: "Your Juan",
    eve: "When she can see it",
    eveMidnight: "Only on the day, from midnight",
    eveAt: (hour) => `From the night before at ${hour - 12} p.m.`,
    eveHint: "Until 11:59 p.m. on the day. The night before, the note says “tomorrow”.",
    summary: (flowers) => `💐 Bouquet: ${flowers}`,
    place: "Place",
    placePlaceholder: "our usual restaurant",
    time: "Time",
    timePlaceholder: "8:00 p.m.",
    message: "Custom message (optional)",
    messageHint: "Empty: the app's invitation. You can use {lugar} (place), {hora} (time) and {nombre} (name).",
    save: "Save the note",
    saved: "Note saved 💐",
    preview: "See the bouquet",
    meaning: "Why these flowers",
    private: "The place, time and message can't be seen without signing in.",
  },
  activity: {
    title: "💐 Flower bouquets",
    hint: "Every time she opened a special date's bouquet and how long she looked at it.",
    empty: "No bouquet has been opened with these filters yet.",
    day: "Date",
    how: "How",
    auto: "On arrival",
    button: "With the 💐 button",
    looked: "Looked at it",
  },
};
