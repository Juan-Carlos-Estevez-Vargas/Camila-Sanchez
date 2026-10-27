import { useId, useLayoutEffect, useRef, type ReactNode } from "react";

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Campo obligatorio: lo dice la etiqueta y el control (aria-required). */
  required?: boolean;
  children: (id: string) => ReactNode;
}

/**
 * Etiqueta + control + ayuda/errores con los atributos ARIA correctos: el
 * control anuncia su ayuda o su error (aria-describedby) y queda marcado
 * como inválido (aria-invalid) mientras haya un error.
 */
export function Field({ label, hint, error, required, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-ayuda`;
  const errorId = `${id}-error`;
  const wrapper = useRef<HTMLDivElement>(null);
  const describedBy = error ? errorId : hint ? hintId : null;

  useLayoutEffect(() => {
    const control = wrapper.current?.querySelector<HTMLElement>(`[id="${CSS.escape(id)}"]`);
    if (!control) return;
    if (describedBy) control.setAttribute("aria-describedby", describedBy);
    else control.removeAttribute("aria-describedby");
    if (error) control.setAttribute("aria-invalid", "true");
    else control.removeAttribute("aria-invalid");
    if (required) control.setAttribute("aria-required", "true");
  });

  return (
    <div className="field" ref={wrapper}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && <span className="field__required" aria-hidden> *</span>}
      </label>
      {children(id)}
      {hint && !error && <span className="field__hint" id={hintId}>{hint}</span>}
      {error && <span className="field__error" id={errorId} role="alert">{error}</span>}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label: string }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
