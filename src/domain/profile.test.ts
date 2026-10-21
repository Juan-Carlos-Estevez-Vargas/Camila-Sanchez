import { describe, expect, it } from "vitest";
import { birthdayCountdown, birthdayInfo, initialOf } from "./profile";

const NOW = new Date("2026-10-21T10:00:00");

describe("perfil", () => {
  it("usa la primera letra del nombre, también con tildes o emojis", () => {
    expect(initialOf("camila")).toBe("C");
    expect(initialOf("  Ángela")).toBe("Á");
    expect(initialOf("")).toBe("?");
  });

  it("calcula el próximo cumpleaños sin el año", () => {
    expect(birthdayInfo("2001-10-21", NOW)).toEqual({ label: "21 de octubre", daysLeft: 0 });
    expect(birthdayInfo("1999-10-22", NOW).daysLeft).toBe(1);
    expect(birthdayInfo("2000-10-20", NOW).daysLeft).toBe(364);
    expect(birthdayInfo("2000-02-29", new Date("2027-02-27T10:00:00")).daysLeft).toBe(1);
  });

  it("avisa cuando se acerca", () => {
    expect(birthdayCountdown({ label: "", daysLeft: 0 })).toMatch(/Hoy/);
    expect(birthdayCountdown({ label: "", daysLeft: 1 })).toMatch(/Mañana/);
    expect(birthdayCountdown({ label: "", daysLeft: 12 })).toBe("Cumple en 12 días");
    expect(birthdayCountdown({ label: "", daysLeft: 90 })).toBeNull();
  });
});
