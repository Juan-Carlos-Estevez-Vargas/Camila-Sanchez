/**
 * Reglas de las dedicatorias que no dependen de la interfaz: quién puede
 * recibirlas, cómo se ordenan y cómo se filtran.
 */
import { PERMISSIONS } from "./permissions";
import type { Dedication, DedicationWithMedia, Profile, RolePermission, Uuid } from "./types";

export const DEDICATION_EMOJIS = ["💌", "💖", "🌹", "🎶", "✨", "🥰", "🌙", "☀️", "🎂", "🫶", "🌻", "🎁"] as const;

/** Igual que en la base de datos (guard_dedication_photo / guard_dedication_song). */
export const MAX_DEDICATION_PHOTOS = 12;
export const MAX_DEDICATION_SONGS = 50;

/** ¿Se le puede dedicar algo a esta persona? (activa y con dedications.use) */
export function canUseDedications(profile: Pick<Profile, "role" | "isActive">, rolePermissions: readonly RolePermission[]): boolean {
  return profile.isActive && (profile.role === "super_admin"
    || rolePermissions.some((rp) => rp.role === profile.role && rp.permission === PERMISSIONS.dedicationsUse));
}

/** Las más recientes primero (por el día que se recuerda y luego por cuándo se escribió). */
export function sortDedications<T extends { dedication: Dedication }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) =>
    b.dedication.dedicatedOn.localeCompare(a.dedication.dedicatedOn) || b.dedication.createdAt.localeCompare(a.dedication.createdAt));
}

export type DedicationFilter = "all" | "received" | "sent";

/** Recibidas (para mí o para todos, de otra persona), enviadas (las mías) o todas. */
export function filterDedications(items: readonly DedicationWithMedia[], filter: DedicationFilter, me: Uuid | null): DedicationWithMedia[] {
  if (filter === "all" || !me) return [...items];
  if (filter === "sent") return items.filter((i) => i.dedication.authorId === me);
  return items.filter((i) => i.dedication.authorId !== me && (i.dedication.recipientId === me || i.dedication.recipientId === null));
}

/** ¿La puede ver esta persona? (la escribió, es para ella o es para todos) */
export function canSeeDedication(dedication: Pick<Dedication, "authorId" | "recipientId">, userId: Uuid): boolean {
  return dedication.authorId === userId || dedication.recipientId === userId || dedication.recipientId === null;
}
