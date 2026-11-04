import { describe, expect, it } from "vitest";
import {
  canEditMessage, conversationPresences, deletedLabel, groupReactions, inboxTime, isOnline, isTyping, lastSeenLabel,
  matchesSearch, messagePreview, otherParticipant, quoteSnippet, readersOf, receiptOf, sortConversations, toggleReaction,
  upsertParticipant, upsertPresence,
} from "./chat";
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

  it("las fotos y los stickers se citan con un texto corto", () => {
    expect(messagePreview({ kind: "image", body: "" })).toBe("📷 Foto");
    expect(messagePreview({ kind: "image", body: "mira  esto" })).toBe("📷 Foto: mira esto");
    expect(messagePreview({ kind: "sticker", body: "", sticker: "te-amo" })).toBe("💖 Sticker «Te amo»");
    expect(messagePreview({ kind: "sticker", body: "", sticker: "ya-no-existe" })).toBe("✨ Sticker «Sticker»");
    expect(messagePreview({ kind: "text", body: "hola" })).toBe("hola");
  });

  it("actualizar la conexión de alguien reemplaza la anterior", () => {
    const first: ChatPresence = { userId: CAMI, lastSeenAt: ago(9_000), lastReadAt: null };
    const next: ChatPresence = { userId: CAMI, lastSeenAt: ago(0), lastReadAt: ago(0) };
    expect(upsertPresence([first], next)).toEqual([next]);
  });
});

describe("app de chat", () => {
  it("«escribiendo…» dura unos segundos después de la última tecla", () => {
    expect(isTyping(ago(2_000), NOW)).toBe(true);
    expect(isTyping(ago(7_000), NOW)).toBe(false);
    expect(isTyping(null, NOW)).toBe(false);
  });

  it("sólo se edita lo propio, que no sea sticker, durante 15 minutos", () => {
    const base = { senderId: JUAN, kind: "text" as const, createdAt: ago(60_000), deletedAt: null };
    expect(canEditMessage(base, JUAN, NOW)).toBe(true);
    expect(canEditMessage(base, CAMI, NOW)).toBe(false);
    expect(canEditMessage({ ...base, kind: "sticker" }, JUAN, NOW)).toBe(false);
    expect(canEditMessage({ ...base, createdAt: ago(16 * 60_000) }, JUAN, NOW)).toBe(false);
    expect(canEditMessage({ ...base, deletedAt: ago(0) }, JUAN, NOW)).toBe(false);
  });

  it("una reacción por persona: la misma la quita, otra la cambia", () => {
    const put = toggleReaction([], JUAN, "❤️");
    expect(put).toEqual({ next: [{ userId: JUAN, emoji: "❤️" }], emoji: "❤️" });
    const change = toggleReaction([...put.next, { userId: CAMI, emoji: "❤️" }], JUAN, "😂");
    expect(change.emoji).toBe("😂");
    expect(groupReactions(change.next)).toEqual([{ emoji: "❤️", userIds: [CAMI] }, { emoji: "😂", userIds: [JUAN] }]);
    expect(toggleReaction(change.next, JUAN, "😂")).toEqual({ next: [{ userId: CAMI, emoji: "❤️" }], emoji: null });
  });

  it("los fijados van arriba y luego lo más reciente", () => {
    const chats = [
      { id: "a", pinnedAt: null, lastMessageAt: ago(1_000), createdAt: ago(9_000) },
      { id: "b", pinnedAt: ago(5_000), lastMessageAt: ago(90_000), createdAt: ago(99_000) },
      { id: "c", pinnedAt: null, lastMessageAt: null, createdAt: ago(500) },
    ];
    expect(sortConversations(chats).map((c) => c.id)).toEqual(["b", "c", "a"]);
  });

  it("la otra persona del chat y la búsqueda sin tildes", () => {
    expect(otherParticipant({ participantIds: [JUAN, CAMI] }, JUAN)).toBe(CAMI);
    expect(matchesSearch("Camíla Sánchez", "camila sanch")).toBe(true);
    expect(matchesSearch("Juan", "cami")).toBe(false);
  });

  it("la hora de la bandeja: hoy la hora, luego «ayer», el día o la fecha", () => {
    expect(inboxTime(ago(60_000), NOW)).toMatch(/2:59/);
    expect(inboxTime(ago(24 * 3_600_000), NOW)).toBe("ayer");
    expect(inboxTime(ago(3 * 24 * 3_600_000), NOW)).toBe("sábado");
    expect(inboxTime(ago(30 * 24 * 3_600_000), NOW)).toMatch(/20\/9\/26/);
  });

  it("los vistos de la conversación usan su propia lectura y la conexión global", () => {
    const participants = [{ conversationId: "x", userId: CAMI, lastReadAt: ago(1_000), typingAt: null }];
    const merged = conversationPresences(participants, [{ userId: CAMI, lastSeenAt: ago(500), lastReadAt: ago(99_000) }]);
    expect(merged).toEqual([{ userId: CAMI, lastSeenAt: ago(500), lastReadAt: ago(1_000) }]);
    expect(receiptOf({ senderId: JUAN, createdAt: ago(2_000) }, merged)).toBe("read");
    const updated = upsertParticipant(participants, { ...participants[0]!, typingAt: ago(0) });
    expect(updated).toHaveLength(1);
    expect(updated[0]?.typingAt).toBe(ago(0));
  });

  it("un mensaje borrado para todos se cita como borrado", () => {
    expect(messagePreview({ kind: "text", body: "", deleted: true })).toBe(deletedLabel());
    expect(messagePreview({ kind: "image", body: "", deletedAt: ago(0) })).toBe(deletedLabel());
  });
});
