import { describe, expect, it } from "vitest";
import { dedicationReaders } from "./dedications";
import type { DedicationView } from "./types";

const view = (userId: string, firstSeenAt: string): DedicationView => ({
  dedicationId: "d", userId, firstSeenAt, lastSeenAt: firstSeenAt,
});

describe("dedicationReaders", () => {
  it("para una persona: la vio o falta ella", () => {
    const d = { authorId: "juan", recipientId: "cami" };
    expect(dedicationReaders(d, [], ["cami", "vale"])).toEqual({ seen: [], pending: ["cami"] });
    const seen = dedicationReaders(d, [view("cami", "2026-11-09T10:00:00Z")], ["cami", "vale"]);
    expect(seen.seen.map((v) => v.userId)).toEqual(["cami"]);
    expect(seen.pending).toEqual([]);
  });

  it("para todos: en el orden en que la vieron, sin contar a quien la escribió", () => {
    const d = { authorId: "juan", recipientId: null };
    const r = dedicationReaders(d, [
      view("vale", "2026-11-09T12:00:00Z"),
      view("juan", "2026-11-09T09:00:00Z"),
      view("cami", "2026-11-09T10:00:00Z"),
    ], ["juan", "cami", "vale", "ana"]);
    expect(r.seen.map((v) => v.userId)).toEqual(["cami", "vale"]);
    expect(r.pending).toEqual(["ana"]);
  });
});
