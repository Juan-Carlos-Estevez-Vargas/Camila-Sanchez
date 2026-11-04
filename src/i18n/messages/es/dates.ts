export const dates = {
  months: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"],
  countdownToday: (title: string) => `¡Hoy es ${title}!`,
  countdownTomorrow: (title: string) => `Mañana: ${title}`,
  countdownDays: (days: number, title: string) => `Faltan ${days} días para ${title}`,
  remainingLessThanMinute: "menos de un minuto",
  remainingOneMinute: "un minuto",
  remainingMinutes: (n: number) => `unos ${n} minutos`,
  remainingHours: (h: number, m: number) => `${h} h${m ? ` ${m} min` : ""}`,
};
