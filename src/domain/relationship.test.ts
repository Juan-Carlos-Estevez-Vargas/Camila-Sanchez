import { describe, expect, it } from "vitest";
import { elapsedSince } from "./dates";
import {
  anniversaryStart, countdownDates, counterUntil, isAnniversaryDate, relationshipEnded, validRelationshipEnd,
} from "./relationship";
import type { ImportantDate } from "./types";

const together = { relationshipStart: "2025-05-31", relationshipEnd: null };
const ended = { relationshipStart: "2025-05-31", relationshipEnd: "2026-10-31" };
const date = (patch: Partial<ImportantDate>): ImportantDate => ({
  id: "x", title: "Nuestro aniversario", eventDate: "2025-05-31", recursYearly: true, icon: "💞", message: "", isVisible: true, ...patch,
});

describe("fin de la relación", () => {
  it("sin fecha de fin todo sigue como antes", () => {
    const now = new Date(2026, 10, 9, 15);
    expect(relationshipEnded(together)).toBe(false);
    expect(counterUntil(together, now)).toBe(now);
    expect(anniversaryStart(together)).toBe("2025-05-31");
  });

  it("el contador se queda quieto el 31 de octubre de 2026", () => {
    const until = counterUntil(ended, new Date(2026, 10, 9, 15));
    expect(until).toEqual(new Date(2026, 9, 31));
    const t = elapsedSince(new Date(2025, 4, 31), until);
    expect(t).toEqual({ days: 518, hours: 0, minutes: 0, seconds: 0 });
    // Un mes después marca lo mismo.
    expect(counterUntil(ended, new Date(2026, 11, 9))).toEqual(until);
  });

  it("antes del día del fin sigue contando", () => {
    const now = new Date(2026, 9, 20, 10);
    expect(counterUntil(ended, now)).toBe(now);
  });

  it("el aniversario deja de celebrarse y sale de las cuentas regresivas", () => {
    expect(anniversaryStart(ended)).toBeNull();
    const navidad = date({ title: "Navidad", eventDate: "2025-12-25" });
    const unica = date({ title: "Viaje", eventDate: "2025-05-31", recursYearly: false });
    expect(isAnniversaryDate(date({}), "2025-05-31")).toBe(true);
    expect(isAnniversaryDate(navidad, "2025-05-31")).toBe(false);
    expect(countdownDates([date({}), navidad, unica], ended).map((d) => d.title)).toEqual(["Navidad", "Viaje"]);
    expect(countdownDates([date({}), navidad], together)).toHaveLength(2);
  });

  it("el fin no puede ser antes del inicio", () => {
    expect(validRelationshipEnd(ended)).toBe(true);
    expect(validRelationshipEnd({ relationshipStart: "2025-05-31", relationshipEnd: "2025-01-01" })).toBe(false);
    expect(validRelationshipEnd({ relationshipStart: null, relationshipEnd: "2025-01-01" })).toBe(true);
  });
});
