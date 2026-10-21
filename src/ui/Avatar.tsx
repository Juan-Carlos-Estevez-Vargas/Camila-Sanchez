import { useEffect, useState, type CSSProperties } from "react";
import { initialOf } from "@/domain/profile";
import type { Profile } from "@/domain/types";
import { useBackend } from "@/state/BackendContext";

type Person = Pick<Profile, "displayName" | "avatarPath" | "avatarEmoji">;

interface AvatarProps {
  person: Person | null | undefined;
  /** Diámetro en píxeles. */
  size?: number;
  /** Texto para lectores de pantalla; por defecto es decorativo. */
  label?: string;
}

/** Foto de perfil, o su icono, o la inicial del nombre. */
export function Avatar({ person, size = 32, label }: AvatarProps) {
  const backend = useBackend();
  const path = person?.avatarPath ?? null;
  const [photo, setPhoto] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    if (!path) return;
    let active = true;
    backend.users.resolveAvatars([path])
      .then((urls) => {
        const url = urls.get(path);
        if (active && url) setPhoto({ path, url });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [backend, path]);

  const url = photo && photo.path === path ? photo.url : null;
  const style = { "--avatar-size": `${size}px` } as CSSProperties;
  const a11y = label ? { role: "img", "aria-label": label } : { "aria-hidden": true };
  return (
    <span className={`avatar${url ? " avatar--photo" : person?.avatarEmoji ? " avatar--emoji" : ""}`} style={style} {...a11y}>
      {url ? <img src={url} alt="" /> : person?.avatarEmoji || initialOf(person?.displayName ?? "")}
    </span>
  );
}

/** Varias caras superpuestas (por ejemplo, con quién se comparte una lista). */
export function AvatarStack({ people, size = 26, max = 4 }: { people: Person[]; size?: number; max?: number }) {
  if (people.length === 0) return null;
  const extra = people.length - max;
  return (
    <span className="avatar-stack" aria-hidden>
      {people.slice(0, max).map((p, i) => <Avatar key={i} person={p} size={size} />)}
      {extra > 0 && <span className="avatar" style={{ "--avatar-size": `${size}px` } as CSSProperties}>+{extra}</span>}
    </span>
  );
}
