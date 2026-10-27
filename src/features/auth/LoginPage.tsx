import { useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { AppError, toUserMessage } from "@/core/errors";
import { safeNextPath } from "@/core/safeRedirect";
import { remembersSession } from "@/data/sessionPersistence";
import { RECOVERY_PATH } from "@/domain/recovery";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { Field, Switch } from "@/ui/Field";

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

  // Enlaces de recuperación antiguos (/entrar?recuperar=1) ahora van a /recuperar.
  if (params.get("recuperar")) return <Navigate to={RECOVERY_PATH} replace />;
  if (user) return <Navigate to={safeNextPath(params.get("next"))} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "password") await backend.auth.signInWithPassword(email, password, { remember });
      if (mode === "magic") {
        await backend.auth.sendMagicLink(email);
        setInfo("Te envié un enlace mágico ✨ Revisa tu correo.");
      }
      if (mode === "reset") {
        if (!EMAIL.test(email.trim())) throw new AppError("Escribe un correo válido.");
        await backend.auth.sendPasswordReset(email.trim());
        // Mismo mensaje exista o no la cuenta: no revela qué correos están registrados.
        setInfo("Si ese correo tiene cuenta, te llegará un enlace para crear una contraseña nueva. Revisa también el spam.");
      }
    } catch (err) {
      setError(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Mode, string> = {
    password: "Bienvenida de nuevo",
    magic: "Entrar con enlace mágico",
    reset: "Recuperar contraseña",
  };

  return (
    <main id="contenido-principal" className="gate">
      <form className="gate__card card stack" onSubmit={submit} noValidate data-tour="login-form">
        <div className="gate__heart" aria-hidden>💗</div>
        <h1 style={{ fontSize: "2rem" }}>{titles[mode]}</h1>
        {backend.mode === "demo" && (
          <p className="badge" style={{ justifySelf: "center" }}>Modo demo · juan@demo.local o camila@demo.local · demo1234</p>
        )}
        {mode === "reset" && (
          <p className="muted" style={{ margin: 0, textAlign: "center" }}>
            Escribe el correo de tu cuenta y te enviaré un enlace para crear una contraseña nueva.
          </p>
        )}
        <Field label="Correo">
          {(id) => <input id={id} className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        {mode === "password" && (
          <Field label="Contraseña">
            {(id) => (
              <input id={id} className="input" type="password" required autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </Field>
        )}
        {mode === "password" && backend.mode === "supabase" && (
          <div className="stack" style={{ gap: 2 }}>
            <Switch checked={remember} onChange={setRemember} label="Mantener la sesión iniciada" />
            <span className="field__hint">Desactívalo en un computador compartido: la sesión se cerrará al cerrar la pestaña.</span>
          </div>
        )}
        {error && <p className="field__error" role="alert">{error}</p>}
        {info && <p className="badge badge--success" role="status" style={{ justifySelf: "center" }}>{info}</p>}
        <button className="btn btn--block" disabled={busy}>
          {busy ? "Un momento…" : mode === "password" ? "Entrar" : "Enviar enlace"}
        </button>
        <div className="row" style={{ justifyContent: "center" }} data-tour="login-modes">
          {mode !== "password" && <button type="button" className="btn btn--sm btn--ghost" onClick={() => setMode("password")}>Usar contraseña</button>}
          {mode !== "magic" && <button type="button" className="btn btn--sm btn--ghost" onClick={() => setMode("magic")}>Enlace mágico</button>}
          {mode === "password" && <button type="button" className="btn btn--sm btn--ghost" onClick={() => setMode("reset")}>Olvidé mi contraseña</button>}
        </div>
        {mode === "reset" && (
          <p className="field__hint" style={{ margin: 0, textAlign: "center" }}>
            ¿No te llega? Quien administra la página puede darte un enlace o QR para recuperarla.
          </p>
        )}
      </form>
    </main>
  );
}
