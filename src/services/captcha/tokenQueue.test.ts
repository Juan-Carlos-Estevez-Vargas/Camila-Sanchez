import { describe, expect, it, vi } from "vitest";
import { CaptchaTokenQueue } from "./tokenQueue";

describe("CaptchaTokenQueue", () => {
  it("entrega la ficha lista una sola vez", async () => {
    const q = new CaptchaTokenQueue();
    expect(q.offer("a")).toBe(false);
    await expect(q.take(1000)).resolves.toBe("a");
    expect(q.hasToken).toBe(false);
  });

  it("quien pide antes espera a la siguiente ficha", async () => {
    const q = new CaptchaTokenQueue();
    const pending = q.take(1000);
    expect(q.offer("b")).toBe(true);
    await expect(pending).resolves.toBe("b");
    expect(q.hasToken).toBe(false);
  });

  it("una ficha vencida no se entrega", async () => {
    vi.useFakeTimers();
    const q = new CaptchaTokenQueue();
    q.offer("vieja");
    q.expire();
    const pending = q.take(500);
    vi.advanceTimersByTime(600);
    await expect(pending).rejects.toThrow("timeout");
    // Tras el tiempo de espera, la próxima ficha queda guardada para después.
    expect(q.offer("nueva")).toBe(false);
    vi.useRealTimers();
  });
});
