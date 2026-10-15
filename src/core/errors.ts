/** Error de aplicación con un mensaje apto para mostrar al usuario. */
export class AppError extends Error {
  constructor(
    readonly userMessage: string,
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = "AppError";
  }
}

const KNOWN: Array<[RegExp, string]> = [
  [/Invalid login credentials/i, "Correo o contraseña incorrectos."],
  [/Email not confirmed/i, "Confirma tu correo antes de entrar."],
  [/row-level security|permission denied|42501|No tienes permiso|Permiso insuficiente/i, "No tienes permiso para hacer esto."],
  [/Failed to fetch|NetworkError|network/i, "Parece que no hay conexión. Inténtalo de nuevo."],
  [/Payload too large|exceeded the maximum/i, "La imagen es demasiado pesada."],
  [/al menos un super administrador/i, "Debe quedar al menos un super administrador activo."],
];

/** Traduce cualquier error a un mensaje amable en español. */
export function toUserMessage(error: unknown): string {
  if (error instanceof AppError) return error.userMessage;
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  for (const [pattern, friendly] of KNOWN) {
    if (pattern.test(message)) return friendly;
  }
  return "Algo salió mal. Inténtalo otra vez en un momento.";
}
