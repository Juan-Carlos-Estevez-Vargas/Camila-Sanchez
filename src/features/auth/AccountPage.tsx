import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MIN_PASSWORD_LENGTH } from "@/domain/invitations";
import { passwordProblem } from "@/domain/password";
import { roleLabel } from "@/domain/permissions";
import { LanguagePicker } from "@/app/LanguagePicker";
import { useSaver } from "@/features/admin/useSaver";
import { PrivacyCard } from "@/features/legal/PrivacyCard";
import { InstallAccountCard } from "@/features/install/InstallAccountCard";
import { DeviceNotificationsCard } from "@/features/messages/EnableNotifications";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { Avatar } from "@/ui/Avatar";
import { Field } from "@/ui/Field";
import { useConfirm } from "@/ui/useConfirm";
import { useT } from "@/i18n";

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
  const i18n = useT();
  const t = i18n.auth.account;

  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    const problem = passwordProblem(password, [user?.email, profile?.displayName]);
    if (problem) return setError(problem);
    if (password !== repeat) return setError(i18n.auth.mismatch);
    setError(null);
    const ok = await run(() => backend.auth.updatePassword(password).then(() => true), t.passwordUpdated);
    if (ok) {
      setPassword("");
      setRepeat("");
    }
  };

  const signOutEverywhere = async () => {
    const yes = await confirm({
      title: t.confirmAllTitle,
      body: t.confirmAllBody,
      confirmLabel: t.confirmAllLabel,
      danger: true,
    });
    if (!yes) return;
    await run(() => signOut({ everywhere: true }), t.allClosed);
    navigate("/entrar", { replace: true });
  };

  return (
    <main className="container" id="contenido-principal" style={{ maxWidth: 640, paddingBlock: "32px 64px" }}>
      <h1>{t.title}</h1>
      <p className="muted">
        {profile?.displayName} · {user?.email}{profile ? ` · ${roleLabel(profile.role)}` : ""}
      </p>

      <section className="card account-profile" data-tour="account-profile" style={{ marginBottom: 16 }}>
        <Avatar person={profile} size={64} />
        <div className="account-profile__text">
          <strong>{profile?.displayName || t.noName}</strong>
          <span className="muted">{profile?.bio || t.noBio}</span>
        </div>
        <Link className="btn btn--soft" to="/cuenta/perfil">{t.editProfile}</Link>
      </section>

      <section className="card row-between" data-tour="account-colors">
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t.colorsTitle}</h2>
          <p className="muted" style={{ margin: 0 }}>{t.colorsHint}</p>
        </div>
        <Link className="btn btn--soft" to="/cuenta/colores">{t.changeColors}</Link>
      </section>

      <section className="card row-between" data-tour="account-language" style={{ marginTop: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t.languageTitle}</h2>
          <p className="muted" style={{ margin: 0 }}>{t.languageHint}</p>
        </div>
        <LanguagePicker />
      </section>

      <InstallAccountCard />
      <DeviceNotificationsCard />

      <form className="card stack" style={{ marginTop: 16 }} onSubmit={changePassword} noValidate data-tour="account-password">
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t.changePassword}</h2>
        <Field label={i18n.auth.newPassword} hint={i18n.auth.minChars(MIN_PASSWORD_LENGTH)}>
          {(id) => <input id={id} className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Field label={t.repeatShort}>
          {(id) => <input id={id} className="input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />}
        </Field>
        {error && <p className="field__error" role="alert">{error}</p>}
        <button className="btn" style={{ justifySelf: "start" }} disabled={busy || !password}>{t.savePassword}</button>
      </form>

      <section className="card stack" style={{ marginTop: 16 }} data-tour="account-sessions">
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t.sessions}</h2>
        <p className="muted" style={{ margin: 0 }}>{t.sessionsHint}</p>
        <div className="row">
          <button className="btn btn--soft" onClick={() => void signOut().then(() => navigate("/", { replace: true }))}>{t.signOutHere}</button>
          <button className="btn btn--danger" onClick={() => void signOutEverywhere()}>{t.signOutAll}</button>
        </div>
      </section>

      <PrivacyCard />
      {confirmElement}
    </main>
  );
}
