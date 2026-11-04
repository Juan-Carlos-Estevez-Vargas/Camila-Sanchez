import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toUserMessage } from "@/core/errors";
import { INVITE_PATH, MIN_PASSWORD_LENGTH, readInviteToken } from "@/domain/invitations";
import { passwordProblem } from "@/domain/password";
import { roleLabel } from "@/domain/permissions";
import type { InvitableRole } from "@/domain/types";
import { legalPath, markConsentPending } from "@/domain/legal";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useCaptcha } from "@/services/captcha/useCaptcha";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { Field } from "@/ui/Field";
import { useT } from "@/i18n";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Check = { state: "checking" } | { state: "invalid" } | { state: "valid"; role: InvitableRole };

/** Lee el token una sola vez y lo quita de la barra de direcciones y del historial. */
function useInviteToken(): string | null {
  const [token] = useState(() => readInviteToken(window.location.hash));
  useEffect(() => {
    if (window.location.hash) window.history.replaceState(window.history.state, "", INVITE_PATH);
  }, []);
  return token;
}

/** Página pública a la que lleva el enlace o el QR de invitación. */
export default function InvitePage() {
  const backend = useBackend();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = useInviteToken();
  const [check, setCheck] = useState<Check>({ state: token ? "checking" : "invalid" });
  const [form, setForm] = useState({ displayName: "", email: "", password: "", confirm: "" });
  // Consentimiento expreso: la casilla nunca viene marcada.
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const captcha = useCaptcha();
  const i18n = useT();
  const t = i18n.auth.invite;

  useEffect(() => {
    if (!token) return;
    let alive = true;
    backend.invitations.check(token)
      .then((r) => alive && setCheck(r.valid && r.role ? { state: "valid", role: r.role } : { state: "invalid" }))
      .catch(() => alive && setCheck({ state: "invalid" }));
    return () => {
      alive = false;
    };
  }, [backend, token]);

  if (user && !busy) {
    return (
      <main id="contenido-principal" className="gate">
        <EmptyState icon="💞" title={t.signedIn}>
          <p className="muted">{t.signedInHint}</p>
          <button className="btn" onClick={() => void backend.auth.signOut()}>{t.signOut}</button>
        </EmptyState>
      </main>
    );
  }
  if (check.state === "checking") return <PageLoader />;
  if (check.state === "invalid" || !token) {
    return (
      <main id="contenido-principal" className="gate">
        <EmptyState icon="💌" title={t.invalid}>
          <p className="muted">{t.invalidHint}</p>
        </EmptyState>
      </main>
    );
  }

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = form.email.trim();
    if (!form.displayName.trim()) return setError(i18n.auth.nameRequired);
    if (!EMAIL.test(email)) return setError(i18n.auth.invalidEmail);
    const problem = passwordProblem(form.password, [email, form.displayName]);
    if (problem) return setError(problem);
    if (form.password !== form.confirm) return setError(i18n.auth.mismatch);
    if (!accepted) return setError(t.mustAccept);
    // Al entrar por primera vez, ConsentGate guarda la aceptación con esta cuenta.
    markConsentPending(email);
    setBusy(true);
    try {
      await backend.invitations.redeem({
        token, email, password: form.password, displayName: form.displayName.trim(), captchaToken: await captcha.take(),
      });
      // Cada ficha del CAPTCHA sirve una vez: entrar pide la siguiente.
      await backend.auth.signInWithPassword(email, form.password, { remember: true, captchaToken: await captcha.take() });
      navigate(check.role === "editor" ? "/panel" : "/", { replace: true });
    } catch (err) {
      setError(toUserMessage(err));
      setBusy(false);
    }
  };

  return (
    <main id="contenido-principal" className="gate">
      <form className="gate__card card stack" onSubmit={submit} noValidate>
        <div className="gate__heart" aria-hidden>💌</div>
        <h1 style={{ fontSize: "2rem" }}>{t.title}</h1>
        <p className="muted" style={{ margin: 0, textAlign: "center" }}>
          {t.joinAsBefore} <strong>{roleLabel(check.role)}</strong>.
        </p>
        <Field label={t.yourName}>
          {(id) => <input id={id} className="input" autoComplete="given-name" maxLength={80} required value={form.displayName} onChange={(e) => set("displayName")(e.target.value)} />}
        </Field>
        <Field label={t.yourEmail} hint={t.yourEmailHint}>
          {(id) => <input id={id} className="input" type="email" autoComplete="email" required value={form.email} onChange={(e) => set("email")(e.target.value)} />}
        </Field>
        <Field label={i18n.auth.passwordLabel} hint={i18n.auth.minChars(MIN_PASSWORD_LENGTH)}>
          {(id) => <input id={id} className="input" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={form.password} onChange={(e) => set("password")(e.target.value)} />}
        </Field>
        <Field label={i18n.auth.repeatPassword}>
          {(id) => <input id={id} className="input" type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => set("confirm")(e.target.value)} />}
        </Field>
        {captcha.widget}
        {captcha.error && <p className="field__error" role="alert">{captcha.error}</p>}
        {error && <p className="field__error" role="alert">{error}</p>}
        <label className="consent-dialog__check">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} required />
          <span>
            {t.acceptBefore} <Link to={legalPath("terminos")} target="_blank" rel="noopener noreferrer">{t.terms}<span className="visually-hidden"> {i18n.common.opensNewTab}</span></Link> {t.acceptMiddle}{" "}
            <Link to={legalPath("privacidad")} target="_blank" rel="noopener noreferrer">{t.privacy}<span className="visually-hidden"> {i18n.common.opensNewTab}</span></Link>.
          </span>
        </label>
        <button className="btn btn--block" disabled={busy}>{busy ? t.creating : t.create}</button>
      </form>
    </main>
  );
}
