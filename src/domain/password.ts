/** Las mismas reglas de contraseña que aplican las Edge Functions, con el mensaje en el idioma activo. */
import { msg } from "@/i18n";
import { passwordIssue } from "../../supabase/functions/_shared/password";

export { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, passwordIssue, type PasswordIssue } from "../../supabase/functions/_shared/password";

/** Por qué la contraseña no sirve (en el idioma activo), o null si está bien. */
export function passwordProblem(password: string, personal: Array<string | null | undefined> = []): string | null {
  const issue = passwordIssue(password, personal);
  return issue ? msg().auth.password[issue] : null;
}
