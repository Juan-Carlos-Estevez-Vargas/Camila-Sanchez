import { useState, type FormEvent } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { toUserMessage } from "@/core/errors";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { Field } from "@/ui/Field";

type Mode = "password" | "magic" | "reset" | "new-password";

export default function LoginPage() {
  const backend = useBackend();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get("recuperar") ? "new-password" : "password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (user && mode !== "new-password") return <Navigate to={params.get("next") ?? "/"} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === "password") await backend.auth.signInWithPassword(email, password);
      if (mode === "magic") {
        await backend.auth.sendMagicLink(email);
        setInfo("Te envié un enlace mágico ✨ Revisa tu correo.");
      }
      if (mode === "reset") {
        await backend.auth.sendPasswordReset(email);
        setInfo("Te envié un correo para crear una contraseña nueva.");
      }
      if (mode === "new-password") {
        if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
        await backend.auth.updatePassword(password);
        setInfo("¡Listo! Tu contraseña se actualizó.");
        setMode("password");
      }
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith("La contraseña") ? err.message : toUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<Mode, string> = {
    password: "Bienvenida de nuevo",
    magic: "Entrar con enlace mágico",
    reset: "Recuperar contraseña",
    "new-password": "Crea tu contraseña",
  };

  return (
    <main className="gate">
      <form className="gate__card card stack" onSubmit={submit} noValidate>
        <div className="gate__heart" aria-hidden>💗</div>
        <h1 style={{ fontSize: "2rem" }}>{titles[mode]}</h1>
        {backend.mode === "demo" && (
          <p className="badge" style={{ justifySelf: "center" }}>Modo demo · juan@demo.local o camila@demo.local · demo1234</p>
        )}
        {mode !== "new-password" && (
          <Field label="Correo">
            {(id) => <input id={id} className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
        )}
        {(mode === "password" || mode === "new-password") && (
          <Field label={mode === "new-password" ? "Contraseña nueva" : "Contraseña"} hint={mode === "new-password" ? "Mínimo 8 caracteres" : undefined}>
            {(id) => (
              <input id={id} className="input" type="password" required minLength={mode === "new-password" ? 8 : undefined}
                autoComplete={mode === "new-password" ? "new-password" : "current-password"}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            )}
          </Field>
        )}
        {error && <p className="field__error" role="alert">{error}</p>}
        {info && <p className="badge badge--success" role="status" style={{ justifySelf: "center" }}>{info}</p>}
        <button className="btn btn--block" disabled={busy}>
          {busy ? "Un momento…" : mode === "password" ? "Entrar" : mode === "new-password" ? "Guardar" : "Enviar enlace"}
        </button>
        <div className="row" style={{ justifyContent: "center" }}>
          {mode !== "password" && <button type="button" className="btn btn--sm btn--ghost" onClick={() => setMode("password")}>Usar contraseña</button>}
          {mode !== "magic" && mode !== "new-password" && <button type="button" className="btn btn--sm btn--ghost" onClick={() => setMode("magic")}>Enlace mágico</button>}
          {mode === "password" && <button type="button" className="btn btn--sm btn--ghost" onClick={() => setMode("reset")}>Olvidé mi contraseña</button>}
        </div>
      </form>
    </main>
  );
}
