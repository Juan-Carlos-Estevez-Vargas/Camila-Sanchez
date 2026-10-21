import { birthdayCountdown, birthdayInfo } from "@/domain/profile";
import type { Profile } from "@/domain/types";
import { Avatar } from "@/ui/Avatar";
import { Modal } from "@/ui/Modal";

/** Perfil de otra persona: foto, nombre, frase y cumpleaños. */
export function ProfileCard({ profile, onClose }: { profile: Profile; onClose(): void }) {
  const birthday = profile.birthday ? birthdayInfo(profile.birthday) : null;
  const countdown = birthday ? birthdayCountdown(birthday) : null;
  return (
    <Modal title={profile.displayName || "Perfil"} onClose={onClose}>
      <div className="profile-card">
        <Avatar person={profile} size={120} />
        {profile.bio && <p className="profile-card__bio">“{profile.bio}”</p>}
        {birthday && (
          <p className="muted profile-card__birthday">
            🎂 Cumple el {birthday.label}{countdown ? <><br /><strong>{countdown}</strong></> : null}
          </p>
        )}
        {!profile.bio && !birthday && <p className="muted">Todavía no ha escrito nada en su perfil.</p>}
      </div>
    </Modal>
  );
}
