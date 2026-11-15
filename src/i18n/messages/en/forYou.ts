import type { Messages } from "@/i18n";

export const forYou: Messages["forYou"] = {
  pageTitle: "For you",
  invite: {
    title: "I have something for you",
    body: "Juan left you a letter. Turn the volume up.",
    open: "Open it 💌",
    later: "Later",
  },
  intro: {
    to: "For you, Cami",
    hint: "Turn the volume up and go slowly.",
    open: "Open it 💌",
  },
  cards: [
    "I don't want to lose you.",
    "I don't want to stop listening to your stories.",
    "I don't want to lose our little habits.",
    "I don't want to lose the joy of coming home and seeing you.",
    "I don't want to lose our ways of saying I love you.",
    "I don't want to stop looking at you and feeling I need nothing else.",
  ],
  final: {
    title: "I love you, Cami.",
    message: "I'm not giving up on us. I want to keep listening to you, take care of our habits and choose you every day, the hard days too.",
    signature: "— Juan",
    again: "Watch it again",
    write: "Write to Juan",
  },
  counter: (current, total) => `${current}/${total}`,
  next: "Next",
  previous: "Previous",
  close: "Leave",
  song: "Iris · Dean Lewis",
  songFrame: "Song: Iris by Dean Lewis",
  pause: "Pause the song",
  play: "Play the song",
  swipe: "Tap on the right or swipe to continue",
};
