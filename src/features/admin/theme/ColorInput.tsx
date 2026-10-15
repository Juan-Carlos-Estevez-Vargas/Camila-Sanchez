import { useState } from "react";
import { isHexColor } from "@/core/validation";
import { Field } from "@/ui/Field";

/** Selector de color con campo hexadecimal al lado. */
export function ColorInput({ label, value, onChange }: { label: string; value: string; onChange(v: string): void }) {
  const [text, setText] = useState(value);
  return (
    <Field label={label}>
      {(id) => (
        <div className="color-row">
          <input type="color" className="input" value={value} aria-label={label} onChange={(e) => { setText(e.target.value); onChange(e.target.value); }} />
          <input id={id} className="input" value={text} maxLength={7}
            onChange={(e) => { setText(e.target.value); if (isHexColor(e.target.value)) onChange(e.target.value); }} />
        </div>
      )}
    </Field>
  );
}
