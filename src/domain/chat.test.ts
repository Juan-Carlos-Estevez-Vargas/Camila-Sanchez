import { describe, expect, it } from "vitest";
import { isOnline, lastSeenLabel, quoteSnippet, readersOf, receiptOf, upsertPresence } from "./chat";
import type { ChatPresence } from "./types";

const NOW = new Date("2026-10-20T15:00:00");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
const JUAN = "juan";
const CAMI = "cami";

describe("última conexión", () => {
  it("dice «en línea» mientras siguen llegando los latidos", () => {
    expect(isOnline(ago(20_000), NOW)).toBe(true);
    expect(lastSeenLabel(ago(20_000), NOW)).toBe("en línea");
    expect(isOnline(ago(120_000), NOW)).toBe(false);
  });

  it("dice hace cuántos minutos, a qué hora de hoy o de ayer, o el día", () => {
    expect(lastSeenLabel(ago(5 * 60_000), NOW)).toBe("últ. vez hace 5 min");
    expect(lastSeenLabel(new Date("2026-10-20T09:05:00").toISOString(), NOW)).toMatch(/^últ\. vez hoy a las 9:05/);
    expect(lastSeenLabel(new Date("2026-10-19T22:30:00").toISOString(), NOW)).toMatch(/^últ\. vez ayer a las 10:30/);
    expect(lastSeenLabel(new Date("2026-10-12T08:00:00").toISOString(), NOW)).toBe("últ. vez el 12 de octubre");
  });
});

describe("vistos", () => {
  const sentAt = ago(10 * 60_000);
  const message = { senderId: JUAN, createdAt: sentAt };
  const presence = (lastSeen: string, lastRead: string | null): ChatPresence[] => [
    { userId: JUAN, lastSeenAt: NOW.toISOString(), lastReadAt: NOW.toISOString() },
    { userId: CAMI, lastSeenAt: lastSeen, lastReadAt: lastRead },
  ];

  it("✓ enviado si la otra persona no se ha conectado desde entonces", () => {
    expect(receiptOf(message, presence(ago(60 * 60_000), null))).toBe("sent");
    expect(receiptOf(message, [])).toBe("sent");
  });

  it("✓✓ entregado si se conectó pero no abrió el chat", () => {
    expect(receiptOf(message, presence(ago(60_000), ago(30 * 60_000)))).toBe("delivered");
  });

  it("✓✓ visto si leyó el chat después de que llegó", () => {
    const seen = presence(ago(60_000), ago(60_000));
    expect(receiptOf(message, seen)).toBe("read");
    expect(readersOf(message, seen)).toEqual([CAMI]);
  });

  it("lo que lee quien lo envió no cuenta como visto", () => {
    expect(receiptOf(message, [{ userId: JUAN, lastSeenAt: NOW.toISOString(), lastReadAt: NOW.toISOString() }])).toBe("sent");
  });

  it("los mensajes en camino o fallidos no tienen visto", () => {
    expect(receiptOf({ ...message, pending: true }, presence(ago(0), ago(0)))).toBe("sending");
    expect(receiptOf({ ...message, failed: true }, presence(ago(0), ago(0)))).toBe("failed");
  });
});

describe("citas y conexiones", () => {
  it("el fragmento citado es una sola línea y se recorta", () => {
    expect(quoteSnippet("hola\n\n  mi   amor")).toBe("hola mi amor");
    expect(quoteSnippet("a".repeat(200), 10)).toBe(`${"a".repeat(9)}…`);
  });

  it("actualizar la conexión de alguien reemplaza la anterior", () => {
    const first: ChatPresence = { userId: CAMI, lastSeenAt: ago(9_000), lastReadAt: null };
    const next: ChatPresence = { userId: CAMI, lastSeenAt: ago(0), lastReadAt: ago(0) };
    expect(upsertPresence([first], next)).toEqual([next]);
  });
});
