import { useState, type FormEvent } from "react";
import { toUserMessage } from "@/core/errors";
import { isValidCode } from "@/domain/totp";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { Field } from "@/ui/Field";
import { useT } from "@/i18n";
import { CodeInput } from "./CodeInput";

/**
 * Segundo paso al entrar: aparece en lugar de cualquier página mientras la
 * sesión espera el código de la app de autenticación (contraseña, enlace
 * mágico o de recuperación, o al volver a abrir la app).
 */
export default function TwoStepGate() {
  const backend = useBackend();
  const { twoStepPending, refresh, signOut } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const i18n = useT();
  const t = i18n.auth.twoStep;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!isValidCode(code)) return setError(t.invalidCode);
    setBusy(true);
    setError(null);
    try {
      await backend.auth.verifyTwoStep(code);
      await refresh();
    } catch (err) {
      setError(toUserMessage(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main id="contenido-principal" className="gate">
      <form className="gate__card card stack" onSubmit={submit} noValidate>
        <div className="gate__heart" aria-hidden>🛡️</div>
        <h1 style={{ fontSize: "2rem" }}>{t.gateTitle}</h1>
        <p className="muted" style={{ margin: 0 }}>{t.gateIntro(twoStepPending?.email ?? "")}</p>
        <Field label={t.code} error={error}>
          {(id) => <CodeInput id={id} value={code} onChange={setCode} autoFocus />}
        </Field>
        <button className="btn btn--block" disabled={busy}>{busy ? t.verifying : t.verify}</button>
        <button type="button" className="btn btn--sm btn--ghost" style={{ justifySelf: "center" }} onClick={() => void signOut()}>
          {t.otherAccount}
        </button>
        <p className="field__hint" style={{ margin: 0 }}>{t.lostPhone}</p>
      </form>
    </main>
  );
}
