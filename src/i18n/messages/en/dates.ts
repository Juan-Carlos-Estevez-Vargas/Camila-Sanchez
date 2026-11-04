import type { Messages } from "@/i18n";

export const dates: Messages["dates"] = {
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  countdownToday: (title) => `Today is ${title}!`,
  countdownTomorrow: (title) => `Tomorrow: ${title}`,
  countdownDays: (days, title) => `${days} days until ${title}`,
  remainingLessThanMinute: "less than a minute",
  remainingOneMinute: "one minute",
  remainingMinutes: (n) => `about ${n} minutes`,
  remainingHours: (h, m) => `${h} h${m ? ` ${m} min` : ""}`,
};
