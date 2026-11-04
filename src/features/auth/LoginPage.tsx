import { useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { AppError, toUserMessage } from "@/core/errors";
import { safeNextPath } from "@/core/safeRedirect";
import { remembersSession } from "@/data/sessionPersistence";
import { RECOVERY_PATH } from "@/domain/recovery";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useCaptcha } from "@/services/captcha/useCaptcha";
import { Field, Switch } from "@/ui/Field";
import { useT } from "@/i18n";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Mode = "password" | "magic" | "reset";

export default function LoginPage() {
  const backend = useBackend();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("modo") === "recuperar" ? "reset" : "password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(remembersSession);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const captcha = useCaptcha();
  const i18n = useT();
  const t = i18n.auth.login;

  // Enlaces de recuperación antiguos (/entrar?recuperar=1) ahora van a /recuperar.
  if (params.get("recuperar")) return <Navigate to={RECOVERY_PATH} replace />;
  if (user) return <Navigate to={safeNextPath(params.get("next"))} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "reset" && !EMAIL.test(email.trim())) throw new AppError(i18n.auth.invalidEmail);
      const captchaToken = await captcha.take();
      if (mode === "password") await backend.auth.signInWithPassword(email, password, { remember, captchaToken });
      if (mode === "magic") {
        await backend.auth.sendMagicLink(email, { captchaToken });
        setInfo(t.magicSent);
      }
      if (mode === "reset") {
        await backend.auth.sendPasswordReset(email.trim(), { captchaToken });
        // Mismo mensaje exista o no la cuenta: no revela qué correos están registrados.
        setInfo(t.resetSent);
      }
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Mode, string> = t.titles;

  return (
    <main id="contenido-principal" className="gate">
      <form className="gate__card card stack" onSubmit={submit} noValidate data-tour="login-form">
        <div className="gate__heart" aria-hidden>💗</div>
        <h1 style={{ fontSize: "2rem" }}>{titles[mode]}</h1>
        {backend.mode === "demo" && (
          <p className="badge" style={{ justifySelf: "center" }}>{t.demo}</p>
        )}
        {mode === "reset" && (
          <p className="muted" style={{ margin: 0, textAlign: "center" }}>
            {t.resetIntro}
          </p>
        )}
        <Field label={i18n.auth.email}>
          {(id) => <input id={id} className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        {mode === "password" && (
          <Field label={i18n.auth.passwordLabel}>
            {(id) => (
              <input id={id} className="input" type="password" required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </Field>
        )}
        {mode === "password" && backend.mode === "supabase" && (
          <div className="stack" style={{ gap: 2 }}>
            <Switch checked={remember} onChange={setRemember} label={t.remember} />
            <span className="field__hint">{t.rememberHint}</span>
          </div>
        )}
        {captcha.widget}
        {captcha.error && <p className="field__error" role="alert">{captcha.error}</p>}
        {error && <p className="field__error" role="alert">{error}</p>}
        {info && <p className="badge badge--success" role="status" style={{ justifySelf: "center" }}>{info}</p>}
        <button className="btn btn--block" disabled={busy}>
          {busy ? t.wait : mode === "password" ? t.signIn : t.sendLink}
        </button>
        <div className="row" style={{ justifyContent: "center" }} data-tour="login-modes">
          {mode !== "password" && <button type="button" className="btn btn--sm btn--ghost" onClick={() => setMode("password")}>{t.usePassword}</button>}
          {mode !== "magic" && <button type="button" className="btn btn--sm btn--ghost" onClick={() => setMode("magic")}>{t.magicLink}</button>}
          {mode === "password" && <button type="button" className="btn btn--sm btn--ghost" onClick={() => setMode("reset")}>{t.forgot}</button>}
        </div>
        {mode === "reset" && (
          <p className="field__hint" style={{ margin: 0, textAlign: "center" }}>
            {t.noEmail}
          </p>
        )}
      </form>
    </main>
  );
}
