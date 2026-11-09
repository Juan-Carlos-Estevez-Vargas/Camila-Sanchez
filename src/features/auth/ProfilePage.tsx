import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AVATAR_EMOJIS, MAX_BIO_LENGTH } from "@/domain/profile";
import { useSaver } from "@/features/admin/useSaver";
import { ImageProcessor } from "@/services/images/ImageProcessor";
import { isImageFile } from "@/services/images/bulk";
import { useAuth } from "@/state/AuthContext";
import { useBackend } from "@/state/BackendContext";
import { useToast } from "@/state/ToastContext";
import { Avatar } from "@/ui/Avatar";
import { PageLoader } from "@/ui/Feedback";
import { Field } from "@/ui/Field";
import { onRovingKeyDown, rovingTabIndex } from "@/ui/rovingFocus";
import { useT } from "@/i18n";
import { AVATAR_IMAGE_OPTIONS } from "@/services/images/sizing";

// Una foto de perfil se ve pequeña: 512 px y liviana.

/** Mi perfil: nombre, foto o icono, frase y cumpleaños. */
export default function ProfilePage() {
  const backend = useBackend();
  const toast = useToast();
  const { profile, refresh } = useAuth();
  const { run, busy } = useSaver();
  const [form, setForm] = useState({ displayName: "", bio: "", birthday: "" });
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const t = useT().auth.profile;
  const processor = useMemo(() => new ImageProcessor(AVATAR_IMAGE_OPTIONS), []);
  useEffect(() => () => processor.dispose(), [processor]);

  // El formulario arranca con lo guardado (y se rellena cuando llega el perfil).
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!profile || loadedFor.current === profile.id) return;
    loadedFor.current = profile.id;
    setForm({ displayName: profile.displayName, bio: profile.bio, birthday: profile.birthday ?? "" });
  }, [profile]);

  if (!profile) return <main className="container" id="contenido-principal"><PageLoader /></main>;

  const preview = { ...profile, displayName: form.displayName || profile.displayName };
  const changed = form.displayName.trim() !== profile.displayName || form.bio.trim() !== profile.bio || (form.birthday || null) !== profile.birthday;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.displayName.trim()) return toast.show({ title: t.nameRequired, tone: "error" });
    const ok = await run(() => backend.users.updateMyProfile({
      displayName: form.displayName, bio: form.bio, birthday: form.birthday || null,
    }).then(() => true), t.saved);
    if (ok) await refresh();
  };

  const pickEmoji = async (emoji: string | null) => {
    const ok = await run(() => backend.users.updateMyProfile({ avatarEmoji: emoji }).then(() => true));
    if (ok) await refresh();
  };

  const uploadPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!isImageFile(file)) return toast.show({ title: t.notPhoto, body: t.notPhotoBody, tone: "error" });
    setUploading(true);
    try {
      const optimized = await processor.process(file);
      await backend.users.setMyAvatar({
        full: optimized.full, thumb: optimized.thumb, extension: optimized.extension, width: optimized.width, height: optimized.height,
      });
      await refresh();
      toast.success(t.photoUpdated);
    } catch (error) {
      toast.error(error, t.photoFailed);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    const ok = await run(() => backend.users.setMyAvatar(null).then(() => true), t.photoRemoved);
    if (ok) await refresh();
  };

  return (
    <main className="container stack profile-page" id="contenido-principal">
      <div>
        <Link to="/cuenta" className="profile-page__back">{t.back}</Link>
        <h1>{t.title}</h1>
        <p className="muted">{t.intro}</p>
      </div>

      <section className="card profile-page__photo" data-tour="profile-photo">
        <Avatar person={preview} size={112} label={t.photoOf(preview.displayName)} />
        <div className="stack profile-page__photo-actions">
          <div className="row">
            <button className="btn" disabled={uploading || busy} onClick={() => fileInput.current?.click()}>
              {uploading ? t.uploading : profile.avatarPath ? t.changePhoto : t.uploadPhoto}
            </button>
            {profile.avatarPath && <button className="btn btn--ghost" disabled={uploading || busy} onClick={() => void removePhoto()}>{t.removePhoto}</button>}
          </div>
          <p className="muted" style={{ margin: 0 }}>
            {profile.avatarPath ? t.removeHint : t.noPhotoHint}
          </p>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => void uploadPhoto(e)} />
        </div>
      </section>

      <section className="card stack" data-tour="profile-icon">
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t.iconTitle}</h2>
        <div className="emoji-grid" role="radiogroup" aria-label={t.iconGroup} onKeyDown={onRovingKeyDown}>
          <button type="button" role="radio" aria-checked={!profile.avatarEmoji} tabIndex={rovingTabIndex(!profile.avatarEmoji || !(AVATAR_EMOJIS as readonly string[]).includes(profile.avatarEmoji))} aria-label={t.noIcon} className={`emoji-grid__option${!profile.avatarEmoji ? " is-active" : ""}`}
            disabled={busy} onClick={() => void pickEmoji(null)} title={t.noIcon}>
            <Avatar person={{ ...preview, avatarPath: null, avatarEmoji: null }} size={30} />
          </button>
          {AVATAR_EMOJIS.map((emoji) => (
            <button key={emoji} type="button" role="radio" aria-checked={profile.avatarEmoji === emoji} tabIndex={rovingTabIndex(profile.avatarEmoji === emoji)} aria-label={emoji}
              className={`emoji-grid__option${profile.avatarEmoji === emoji ? " is-active" : ""}`} disabled={busy} onClick={() => void pickEmoji(emoji)}>
              {emoji}
            </button>
          ))}
        </div>
      </section>

      <form className="card stack" onSubmit={save} data-tour="profile-details">
        <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t.about}</h2>
        <Field label={t.name}>
          {(id) => <input id={id} className="input" maxLength={80} autoComplete="nickname" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />}
        </Field>
        <Field label={t.bio} hint={`${form.bio.length}/${MAX_BIO_LENGTH}`}>
          {(id) => <input id={id} className="input" maxLength={MAX_BIO_LENGTH} placeholder={t.bioPlaceholder} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />}
        </Field>
        <Field label={t.birthdayLabel} hint={t.birthdayHint}>
          {(id) => <input id={id} type="date" className="input" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />}
        </Field>
        <button className="btn" style={{ justifySelf: "start" }} disabled={busy || !changed || !form.displayName.trim()}>{t.save}</button>
      </form>
    </main>
  );
}
