import type { Messages } from "@/i18n";

export const goodbye: Messages["goodbye"] = {
  pageTitle: "Goodbye",
  invite: {
    title: "I have something to tell you",
    body: "Juan left you one last letter. Turn the volume up.",
    open: "Open it 💌",
    later: "Later",
  },
  intro: {
    to: "For you, Cami",
    hint: "Turn the volume up and read it slowly.",
    open: "Open it 💌",
  },
  cards: [
    "I don't really know how to start this letter, because it's the one I never wanted to write.",
    "I love you. I say it plainly, because it's the biggest truth I have.",
    "I miss you in the little things: the good morning messages, your laugh, the way the day felt lighter when you were in it. I miss you even now, and that's what hurts the most.",
    "I would have given everything for you. My time, my patience, my plans, whatever it took to see you happy. Loving you was never a sacrifice; it was the most beautiful thing that ever happened to me.",
    "If I could turn back time, I would do so many things differently. I would listen to you more, take better care of you, be there in the moments that really mattered.",
    "I would tell you more often what you mean to me, instead of taking it for granted. I can't change what happened, but I want you to know that I see it, and that I'm sorry.",
    "Today I understand something that's hard for me to accept: you don't feel the same about me anymore. It shows, and I don't blame you. Love can't be asked for or forced, and you deserve to be wherever your heart wants to be.",
    "That's why I'm stepping away, even if it hurts. Not because I stopped loving you, but precisely because I love you. I'd rather see you happy far from me than have you close and not happy.",
    "I hope you find someone who values you the way you deserve, who sees in you everything I saw and reminds you of it every day.",
  ],
  final: {
    title: "Be happy, Cami.",
    message: "Thank you for every moment, every laugh, for letting me love you. A part of me will always hold what we were with love. Take good care of yourself. Truly.",
    signature: "With all the love I still have, Juan",
    again: "Read it again",
    write: "Back to the start",
  },
  counter: (current, total) => `${current}/${total}`,
  next: "Next",
  previous: "Previous",
  close: "Leave",
  song: "Lloro por ti · Enrique Iglesias",
  songFrame: "Song: Lloro por ti by Enrique Iglesias",
  pause: "Pause the song",
  play: "Play the song",
  swipe: "Tap on the right or swipe to continue",
};
