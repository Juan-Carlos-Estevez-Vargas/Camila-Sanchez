import { TOTP_DIGITS } from "@/domain/totp";

/**
 * Campo para el código de 6 dígitos: teclado numérico en el celular y
 * autocompletar del sistema («one-time-code»). Sólo deja escribir números.
 */
export function CodeInput({ id, value, onChange, autoFocus }: { id: string; value: string; onChange(value: string): void; autoFocus?: boolean }) {
  return (
    <input id={id} className="input two-step-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*"
      maxLength={TOTP_DIGITS} placeholder={"0".repeat(TOTP_DIGITS)} autoFocus={autoFocus}
      value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, TOTP_DIGITS))} />
  );
}
