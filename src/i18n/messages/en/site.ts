import type { Messages } from "@/i18n";

export const site: Messages["site"] = {
  loadError: "I couldn't load our memories",
  loadErrorHint: "Check your connection and reload the page.",
  private: "This corner is private. Sign in to see what I made for you.",
  noAccess: "Your account doesn't have access yet. Ask the administrator for permission.",
  signIn: "Sign in",
  noSections: "There are no sections yet",
  noSectionsHint: "Add them from the admin panel.",
  thanks: "💖 Thank you",
  music: "Background music",
  pauseMusic: "Pause music",
  playMusic: "Play music",
  together: (date: string) => `Together since ${date}`,
  seeMore: "See more",
  surprise: "Surprise!",
  countdown: {
    today: "Today!",
    days: (n: number) => (n === 1 ? "day" : "days"),
    until: (title: string) => `until ${title}`,
    years: (n: number) => ` · ${n} ${n === 1 ? "year" : "years"}`,
  },
  counter: {
    units: ["days", "hours", "minutes", "seconds"],
    months: (n: number) => `${n} ${n === 1 ? "month" : "months"} of choosing each other every day.`,
  },
  gallery: {
    years: "Years",
    summary: (total: number, months: number, year: number) =>
      `${total} ${total === 1 ? "memory" : "memories"} in ${months} ${months === 1 ? "month" : "months"} of ${year}`,
    memories: (n: number) => `${n} ${n === 1 ? "memory" : "memories"}`,
    empty: "No photos yet",
    monthLabel: (month: string, count: number) =>
      `${month}: ${count === 0 ? "no photos yet" : `${count} ${count === 1 ? "memory" : "memories"}, see photos`}`,
  },
  lightbox: {
    position: (i: number, n: number) => `Photo ${i} of ${n}`,
    close: "Close the viewer",
    prev: "Previous photo",
    next: "Next photo",
    fallbackAlt: "Memory",
    all: "All photos",
    thumb: (i: number) => `Photo ${i}`,
  },
  milestonePhoto: (title: string) => `Photo of “${title}”`,
};
