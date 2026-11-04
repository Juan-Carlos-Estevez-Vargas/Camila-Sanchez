import type { Messages } from "@/i18n";

export const dates: Messages["dates"] = {
  months: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
  countdownToday: (title) => `Hoje é ${title}!`,
  countdownTomorrow: (title) => `Amanhã: ${title}`,
  countdownDays: (days, title) => `Faltam ${days} dias para ${title}`,
  remainingLessThanMinute: "menos de um minuto",
  remainingOneMinute: "um minuto",
  remainingMinutes: (n) => `uns ${n} minutos`,
  remainingHours: (h, m) => `${h} h${m ? ` ${m} min` : ""}`,
};
