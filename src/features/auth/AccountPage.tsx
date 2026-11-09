import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { MIN_PASSWORD_LENGTH } from "@/domain/invitations";
import { passwordProblem } from "@/domain/password";
import { roleLabel } from "@/domain/permissions";
import { LanguagePicker } from "@/app/LanguagePicker";
import { AdminLayout, AdminPage, type AdminNavItem } from "@/features/admin/AdminLayout";
import { useSaver } from "@/features/admin/useSaver";
import { PrivacyCard } from "@/features/legal/PrivacyCard";
import { InstallAccountCard } from "@/features/install/InstallAccountCard";
import { DeviceNotificationsCard } from "@/features/messages/EnableNotifications";
import { TwoStepCard } from "./TwoStepCard";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { Avatar } from "@/ui/Avatar";
import { Field } from "@/ui/Field";
import { useConfirm } from "@/ui/useConfirm";
import { msg, useT } from "@/i18n";

/** Opciones del menú de Mi cuenta (todas para cualquier cuenta). */
export function accountItems(): AdminNavItem[] {
  const t = msg().auth.account.nav;
  const always = () => true;
  return [
    { to: "/cuenta/perfil", label: t.profile, icon: "👤", visible: always },
    { to: "/cuenta/colores", label: t.colors, icon: "🎨", visible: always },
    { to: "/cuenta/idioma", label: t.language, icon: "🌐", visible: always },
    { to: "/cuenta/avisos", label: t.device, icon: "🔔", visible: always },
    { to: "/cuenta/seguridad", label: t.security, icon: "🔐", visible: always },
    { to: "/cuenta/privacidad", label: t.privacy, icon: "🔒", visible: always },
  ];
}

/**
 * Mi cuenta: las opciones a la izquierda y la elegida en el centro (en el
 * celular, una fila de pestañas arriba). Cada opción tiene su dirección
 * (/cuenta/perfil, /cuenta/seguridad…), así se puede volver atrás o compartirla.
 */
export default function AccountLayout() {
  const { user, profile } = useAuth();
  const t = useT().auth.account;
  const header = (
    <div className="account-side">
      <Avatar person={profile} size={56} />
      <div className="account-side__text">
        <strong>{profile?.displayName || t.noName}</strong>
        <span className="muted">{user?.email}</span>
        {profile && <span className="badge">{roleLabel(profile.role)}</span>}
      </div>
    </div>
  );
  return <AdminLayout title={t.title} subtitle="" header={header} items={accountItems()} navTour="account-nav" />;
}

/** Idioma de la app en este dispositivo. */
export function AccountLanguage() {
  const t = useT().auth.account;
  return (
    <AdminPage title={t.languageTitle} description={t.languageHint}>
      <section className="card row-between" data-tour="account-language">
        <strong>{t.languageLabel}</strong>
        <LanguagePicker />
      </section>
    </AdminPage>
  );
}

/** La app instalada y los avisos en este dispositivo. */
export function AccountDevice() {
  const t = useT().auth.account;
  return (
    <AdminPage title={t.deviceTitle} description={t.deviceHint}>
      <div className="stack account-cards">
        <InstallAccountCard />
        <DeviceNotificationsCard />
      </div>
    </AdminPage>
  );
}

/** Contraseña, verificación en dos pasos y sesiones abiertas. */
export function AccountSecurity() {
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
    <AdminPage title={t.securityTitle} description={t.securityHint}>
      <div className="stack account-cards">
        <form className="card stack" onSubmit={changePassword} noValidate data-tour="account-password">
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

        <TwoStepCard />

        <section className="card stack" data-tour="account-sessions">
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t.sessions}</h2>
          <p className="muted" style={{ margin: 0 }}>{t.sessionsHint}</p>
          <div className="row">
            <button className="btn btn--soft" onClick={() => void signOut().then(() => navigate("/", { replace: true }))}>{t.signOutHere}</button>
            <button className="btn btn--danger" onClick={() => void signOutEverywhere()}>{t.signOutAll}</button>
          </div>
        </section>
      </div>
      {confirmElement}
    </AdminPage>
  );
}

/** Qué aceptaste y cómo pedir tus datos. */
export function AccountPrivacy() {
  const t = useT().auth.account;
  return (
    <AdminPage title={t.privacyTitle} description={t.privacyHint}>
      <div className="account-cards">
        <PrivacyCard />
      </div>
    </AdminPage>
  );
}
