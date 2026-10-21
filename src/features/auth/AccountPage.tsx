import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MIN_PASSWORD_LENGTH } from "@/domain/invitations";
import { ROLE_LABELS } from "@/domain/permissions";
import { useSaver } from "@/features/admin/useSaver";
import { DeviceNotificationsCard } from "@/features/messages/EnableNotifications";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { Avatar } from "@/ui/Avatar";
import { Field } from "@/ui/Field";
import { useConfirm } from "@/ui/useConfirm";

/** Mi cuenta: mi perfil, mis colores, avisos, cambiar la contraseña y cerrar sesiones. */
export default function AccountPage() {
  const backend = useBackend();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { run, busy } = useSaver();
  const [confirm, confirmElement] = useConfirm();
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [error, setError] = useState<string | null>(null);

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Mínimo ${MIN_PASSWORD_LENGTH} caracteres.`);
    if (password !== repeat) return setError("Las contraseñas no coinciden.");
    setError(null);
    const ok = await run(() => backend.auth.updatePassword(password).then(() => true), "Contraseña actualizada 🔐");
    if (ok) {
      setPassword("");
      setRepeat("");
    }
  };

  const signOutEverywhere = async () => {
    const yes = await confirm({
      title: "¿Cerrar sesión en todos los dispositivos?",
      body: "Tendrás que volver a entrar en cada celular o computador, también en este.",
      confirmLabel: "Cerrar todas",
      danger: true,
    });
    if (!yes) return;
    await run(() => signOut({ everywhere: true }), "Se cerraron todas las sesiones");
    navigate("/entrar", { replace: true });
  };

  return (
    <main className="container" id="contenido-principal" style={{ maxWidth: 640, paddingBlock: "32px 64px" }}>
      <h1>Mi cuenta</h1>
      <p className="muted">
        {profile?.displayName} · {user?.email}{profile ? ` · ${ROLE_LABELS[profile.role]}` : ""}
      </p>

      <section className="card account-profile" data-tour="account-profile" style={{ marginBottom: 16 }}>
        <Avatar person={profile} size={64} />
        <div className="account-profile__text">
          <strong>{profile?.displayName || "Sin nombre"}</strong>
          <span className="muted">{profile?.bio || "Agrega tu foto, un icono y una frase."}</span>
        </div>
        <Link className="btn btn--soft" to="/cuenta/perfil">Editar perfil</Link>
      </section>

      <section className="card row-between" data-tour="account-colors">
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Mis colores 🎨</h2>
          <p className="muted" style={{ margin: 0 }}>Elige la paleta con la que ves la app. Sólo cambia para ti.</p>
        </div>
        <Link className="btn btn--soft" to="/cuenta/colores">Cambiar colores</Link>
      </section>

      <DeviceNotificationsCard />

      <form className="card stack" style={{ marginTop: 16 }} onSubmit={changePassword} noValidate data-tour="account-password">
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Cambiar contraseña</h2>
        <Field label="Contraseña nueva" hint={`Mínimo ${MIN_PASSWORD_LENGTH} caracteres`}>
          {(id) => <input id={id} className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Field label="Repítela">
          {(id) => <input id={id} className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />}
        </Field>
        {error && <p className="field__error" role="alert">{error}</p>}
        <button className="btn" style={{ justifySelf: "start" }} disabled={busy || !password}>Guardar contraseña</button>
      </form>

      <section className="card stack" style={{ marginTop: 16 }} data-tour="account-sessions">
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Sesiones</h2>
        <p className="muted" style={{ margin: 0 }}>
          Si perdiste un celular o entraste desde un equipo que no es tuyo, cierra la sesión en todos lados.
        </p>
        <div className="row">
          <button className="btn btn--soft" onClick={() => void signOut().then(() => navigate("/", { replace: true }))}>Cerrar sesión aquí</button>
          <button className="btn btn--danger" onClick={() => void signOutEverywhere()}>Cerrar en todos los dispositivos</button>
        </div>
      </section>
      {confirmElement}
    </main>
  );
}
