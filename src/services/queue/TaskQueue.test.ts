import { describe, expect, it } from "vitest";
import { TaskQueue } from "./TaskQueue";

const noSleep = () => Promise.resolve();
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("TaskQueue", () => {
  it("nunca ejecuta más tareas que la concurrencia indicada", async () => {
    const queue = new TaskQueue<number>({ concurrency: 2 });
    let active = 0;
    let peak = 0;
    const job = (n: number) => async () => {
      active++;
      peak = Math.max(peak, active);
      await tick();
      active--;
      return n;
    };
    const results = await Promise.all([1, 2, 3, 4, 5].map((n) => queue.add(`t${n}`, job(n))));
    expect(results).toEqual([1, 2, 3, 4, 5]);
    expect(peak).toBe(2);
  });

  it("reintenta errores transitorios con backoff y luego tiene éxito", async () => {
    const delays: number[] = [];
    const queue = new TaskQueue<string>({ retries: 2, baseDelayMs: 100, sleep: async (ms) => void delays.push(ms) });
    let calls = 0;
    const result = await queue.add("x", async () => {
      if (++calls < 3) throw new Error("Failed to fetch");
      return "ok";
    });
    expect(result).toBe("ok");
    expect(delays).toEqual([100, 200]);
  });

  it("no reintenta errores permanentes", async () => {
    const queue = new TaskQueue({ retries: 3, sleep: noSleep });
    let calls = 0;
    await expect(queue.add("x", async () => {
      calls++;
      throw new Error("permiso denegado");
    })).rejects.toThrow("permiso");
    expect(calls).toBe(1);
    expect(queue.snapshot[0]?.status).toBe("error");
  });

  it("cancela tareas en espera", async () => {
    const queue = new TaskQueue({ concurrency: 1 });
    const first = queue.add("a", () => new Promise((r) => setTimeout(() => r(1), 10)));
    const second = queue.add("b", async () => 2);
    queue.cancel(queue.snapshot[1]!.id);
    await expect(second).rejects.toThrow("Cancelado");
    await expect(first).resolves.toBe(1);
    expect(queue.snapshot.map((t) => t.status)).toEqual(["done", "cancelled"]);
  });

  it("publica el progreso reportado por la tarea", async () => {
    const queue = new TaskQueue();
    const seen: number[] = [];
    queue.subscribe((tasks) => tasks[0] && seen.push(tasks[0].progress));
    await queue.add("x", async ({ report }) => {
      report(0.5, "Subiendo");
      return null;
    });
    expect(seen).toContain(0.5);
    expect(seen.at(-1)).toBe(1);
  });
});
