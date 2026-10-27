import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { toUserMessage } from "@/core/errors";
import { INVITE_PATH, MIN_PASSWORD_LENGTH, readInviteToken } from "@/domain/invitations";
import { passwordProblem } from "@/domain/password";
import { ROLE_LABELS } from "@/domain/permissions";
import type { InvitableRole } from "@/domain/types";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { Field } from "@/ui/Field";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <main className="gate">
        <EmptyState icon="💞" title="Ya tienes una sesión abierta">
          <p className="muted">Para crear una cuenta nueva con esta invitación, primero cierra tu sesión.</p>
          <button className="btn" onClick={() => void backend.auth.signOut()}>Cerrar sesión</button>
        </EmptyState>
      </main>
    );
  }
  if (check.state === "checking") return <PageLoader />;
  if (check.state === "invalid" || !token) {
    return (
      <main className="gate">
        <EmptyState icon="💌" title="Esta invitación ya no es válida">
          <p className="muted">Puede que ya se haya usado o que haya vencido. Pide un enlace nuevo.</p>
        </EmptyState>
      </main>
    );
  }

  const set = (key: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const email = form.email.trim();
    if (!form.displayName.trim()) return setError("Escribe tu nombre.");
    if (!EMAIL.test(email)) return setError("Escribe un correo válido.");
    const problem = passwordProblem(form.password, [email, form.displayName]);
    if (problem) return setError(problem);
    if (form.password !== form.confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      await backend.invitations.redeem({ token, email, password: form.password, displayName: form.displayName.trim() });
      await backend.auth.signInWithPassword(email, form.password, { remember: true });
      navigate(check.role === "editor" ? "/panel" : "/", { replace: true });
    } catch (err) {
      setError(toUserMessage(err));
      setBusy(false);
    }
  };

  return (
    <main className="gate">
      <form className="gate__card card stack" onSubmit={submit} noValidate>
        <div className="gate__heart" aria-hidden>💌</div>
        <h1 style={{ fontSize: "2rem" }}>Te invitaron</h1>
        <p className="muted" style={{ margin: 0, textAlign: "center" }}>
          Crea tu cuenta para entrar como <strong>{ROLE_LABELS[check.role]}</strong>.
        </p>
        <Field label="Tu nombre">
          {(id) => <input id={id} className="input" autoComplete="given-name" maxLength={80} required value={form.displayName} onChange={(e) => set("displayName")(e.target.value)} />}
        </Field>
        <Field label="Tu correo" hint="Con él vas a entrar y recuperar tu contraseña">
          {(id) => <input id={id} className="input" type="email" autoComplete="email" required value={form.email} onChange={(e) => set("email")(e.target.value)} />}
        </Field>
        <Field label="Contraseña" hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}>
          {(id) => <input id={id} className="input" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required value={form.password} onChange={(e) => set("password")(e.target.value)} />}
        </Field>
        <Field label="Repite la contraseña">
          {(id) => <input id={id} className="input" type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => set("confirm")(e.target.value)} />}
        </Field>
        {error && <p className="field__error" role="alert">{error}</p>}
        <button className="btn btn--block" disabled={busy}>{busy ? "Creando tu cuenta…" : "Crear mi cuenta 💖"}</button>
      </form>
    </main>
  );
}
