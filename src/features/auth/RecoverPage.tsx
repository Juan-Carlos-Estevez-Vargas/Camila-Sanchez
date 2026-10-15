import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toUserMessage } from "@/core/errors";
import { MIN_PASSWORD_LENGTH } from "@/domain/invitations";
import { readRecoveryLink, RECOVERY_PATH, type RecoveryLink } from "@/domain/recovery";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { EmptyState, PageLoader } from "@/ui/Feedback";
import { Field } from "@/ui/Field";

type Phase = "verifying" | "ready" | "invalid" | "expired";

/**
 * Lee el enlace una sola vez y quita el token de la barra de direcciones y del
 * historial. La consulta (?code=…) se deja: es del intercambio PKCE que hace
 * el propio cliente de Supabase con la plantilla de correo por defecto.
 */
function useRecoveryLink(): RecoveryLink {
  const [link] = useState(() => {
    const fromHash = readRecoveryLink(window.location.hash);
    return fromHash.kind === "none" ? readRecoveryLink(window.location.search) : fromHash;
  });
  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(window.history.state, "", RECOVERY_PATH + window.location.search);
    }
  }, []);
  return link;
}

const initialPhase = (link: RecoveryLink): Phase =>
  link.kind === "error" ? (link.expired ? "expired" : "invalid") : "verifying";

/** Página pública a la que lleva el correo o el QR para crear una contraseña nueva. */
export default function RecoverPage() {
  const backend = useBackend();
  const navigate = useNavigate();
  const toast = useToast();
  const { user, loading } = useAuth();
  const link = useRecoveryLink();
  const [phase, setPhase] = useState<Phase>(() => initialPhase(link));
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const verified = useRef(false);

  useEffect(() => {
    if (link.kind !== "token" || verified.current) return;
    // El token sirve una sola vez: nunca se verifica dos veces.
    verified.current = true;
    backend.auth.verifyRecovery(link.tokenHash)
      .then(() => setPhase("ready"))
      .catch(() => setPhase("invalid"));
  }, [backend, link]);

  useEffect(() => {
    // Sin token en el enlace: sirve una sesión ya abierta (p. ej. la que deja el
    // enlace del correo con la plantilla por defecto de Supabase).
    if (link.kind === "none" && !loading) setPhase(user ? "ready" : "invalid");
  }, [link.kind, loading, user]);

  if (phase === "verifying") return <PageLoader />;
  if (phase === "invalid" || phase === "expired") {
    return (
      <main className="gate">
        <EmptyState icon="🔑" title={phase === "expired" ? "Este enlace ya venció" : "Este enlace ya no es válido"}>
          <p className="muted">Los enlaces para recuperar la contraseña sirven una sola vez y duran poco. Pide uno nuevo.</p>
          <Link className="btn" to="/entrar?modo=recuperar">Pedir otro enlace</Link>
        </EmptyState>
      </main>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password.length < MIN_PASSWORD_LENGTH) return setError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    if (form.password !== form.confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      await backend.auth.updatePassword(form.password, { signOutOthers: true });
      toast.success("Contraseña nueva guardada 🔐");
      navigate("/", { replace: true });
    } catch (err) {
      setError(toUserMessage(err));
      setBusy(false);
    }
  };

  return (
    <main className="gate">
      <form className="gate__card card stack" onSubmit={submit} noValidate>
        <div className="gate__heart" aria-hidden>🔑</div>
        <h1 style={{ fontSize: "2rem" }}>Crea tu contraseña nueva</h1>
        {user?.email && (
          <p className="muted" style={{ margin: 0, textAlign: "center" }}>Para la cuenta <strong>{user.email}</strong></p>
        )}
        <input type="email" autoComplete="username" value={user?.email ?? ""} readOnly hidden />
        <Field label="Contraseña nueva" hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}>
          {(id) => <input id={id} className="input" type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} required autoFocus value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />}
        </Field>
        <Field label="Repite la contraseña">
          {(id) => <input id={id} className="input" type="password" autoComplete="new-password" required value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} />}
        </Field>
        <p className="field__hint" style={{ margin: 0 }}>Al guardarla se cerrará tu sesión en los demás dispositivos.</p>
        {error && <p className="field__error" role="alert">{error}</p>}
        <button className="btn btn--block" disabled={busy}>{busy ? "Guardando…" : "Guardar y entrar"}</button>
      </form>
    </main>
  );
}
