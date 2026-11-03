/**
 * Fichas del CAPTCHA (Turnstile). Cada ficha sirve una sola vez: quien la
 * toma se la lleva y el widget debe pedir otra. Si alguien la pide antes de
 * que llegue, espera a la siguiente.
 */
export class CaptchaTokenQueue {
  private token: string | null = null;
  private waiters: Array<(token: string) => void> = [];

  /** El widget entregó una ficha. Devuelve true si alguien la estaba esperando. */
  offer(token: string): boolean {
    const waiter = this.waiters.shift();
    if (waiter) {
      waiter(token);
      return true;
    }
    this.token = token;
    return false;
  }

  /** La ficha venció o falló: ya no sirve. */
  expire(): void {
    this.token = null;
  }

  /** Toma la ficha lista o espera la siguiente (máximo timeoutMs). */
  take(timeoutMs: number): Promise<string> {
    const ready = this.token;
    this.token = null;
    if (ready) return Promise.resolve(ready);
    return new Promise((resolve, reject) => {
      const waiter = (token: string) => {
        clearTimeout(timer);
        resolve(token);
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new Error("timeout"));
      }, timeoutMs);
      this.waiters.push(waiter);
    });
  }

  get hasToken(): boolean {
    return this.token !== null;
  }
}
