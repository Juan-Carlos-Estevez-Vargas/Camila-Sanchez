/**
 * Reglas de contraseña (OWASP ASVS 2.1): largo mínimo 10 y máximo 72 (lo que
 * acepta bcrypt), y nada de contraseñas de las más usadas ni el propio correo
 * o nombre. La app (src/domain/password.ts) usa este mismo archivo, así el
 * navegador y las Edge Functions nunca piensan distinto.
 */
export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 72;

// Las más usadas de 10 o más caracteres (listas públicas de filtraciones),
// más algunas de la propia app. Se comparan en minúsculas.
const COMMON = new Set([
  "1234567890", "0123456789", "12345678910", "123456789a", "1234567890a", "a123456789",
  "qwertyuiop", "qwerty1234", "1q2w3e4r5t", "1qaz2wsx3edc", "zaq12wsxcde", "asdfghjkl1",
  "password12", "password123", "password1234", "passw0rd123", "contraseña", "contraseña1",
  "contraseña123", "contrasena", "contrasena1", "contrasena123", "iloveyou12", "iloveyou123",
  "teamo12345", "teamo123456", "teamomucho", "mi amor123", "miamor1234", "miamor12345",
  "princesa123", "princesa12", "corazon123", "tequiero123", "1111111111", "0000000000",
  "abcdefghij", "abc1234567", "abcd123456", "nuestrorincon", "camila1234", "camila12345",
]);

/** Devuelve por qué la contraseña no sirve, o null si está bien. */
export function passwordProblem(password: string, personal: Array<string | null | undefined> = []): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `La contraseña puede tener como máximo ${MAX_PASSWORD_LENGTH} caracteres.`;
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || new Set(lower).size <= 2) return "Esa contraseña es muy fácil de adivinar. Prueba con una frase que sólo tú conozcas.";
  for (const value of personal) {
    const word = (value ?? "").toLowerCase().split("@")[0]!.trim();
    if (word.length >= 4 && lower.includes(word)) return "La contraseña no puede contener tu nombre ni tu correo.";
  }
  return null;
}
