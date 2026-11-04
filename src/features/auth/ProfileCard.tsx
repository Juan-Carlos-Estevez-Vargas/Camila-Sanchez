import { birthdayCountdown, birthdayInfo } from "@/domain/profile";
import type { Profile } from "@/domain/types";
import { Avatar } from "@/ui/Avatar";
import { Modal } from "@/ui/Modal";
import { useT } from "@/i18n";

/** Perfil de otra persona: foto, nombre, frase y cumpleaños. */
export function ProfileCard({ profile, onClose }: { profile: Profile; onClose(): void }) {
  const birthday = profile.birthday ? birthdayInfo(profile.birthday) : null;
  const countdown = birthday ? birthdayCountdown(birthday) : null;
  const t = useT().auth.profile;
  return (
    <Modal title={profile.displayName || t.fallbackTitle} onClose={onClose}>
      <div className="profile-card">
        <Avatar person={profile} size={120} />
        {profile.bio && <p className="profile-card__bio">“{profile.bio}”</p>}
        {birthday && (
          <p className="muted profile-card__birthday">
            {t.birthday(birthday.label)}{countdown ? <><br /><strong>{countdown}</strong></> : null}
          </p>
        )}
        {!profile.bio && !birthday && <p className="muted">{t.empty}</p>}
      </div>
    </Modal>
  );
}
