/**
 * Traductores fila (snake_case) <-> dominio (camelCase). Cada campo pasa por
 * los normalizadores para que datos corruptos nunca rompan la UI.
 */
import {
  normalizeAnimation, normalizeEffects, normalizeSectionContent, normalizeTheme, safeMusicUrl,
} from "@/domain/defaults";
import type {
  AppNotification, AuditEntry, ChatMessage, ChatPresence, ImportantDate, Interruption, Invitation, InvitableRole,
  Milestone, Note, Photo, Profile, Section, SectionKind, SiteSettings,
} from "@/domain/types";
import type { Row } from "./client";

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const strOrNull = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" ? v : fallback);
const numOrNull = (v: unknown): number | null => (typeof v === "number" ? v : null);

export const toSettings = (r: Row): SiteSettings => ({
  siteTitle: str(r.site_title),
  siteSubtitle: str(r.site_subtitle),
  relationshipStart: strOrNull(r.relationship_start),
  isPublic: r.is_public === true,
  musicUrl: safeMusicUrl(r.music_url),
  theme: normalizeTheme(r.theme),
  effects: normalizeEffects(r.effects),
  updatedAt: str(r.updated_at),
});

export const fromSettings = (s: Partial<SiteSettings>): Row => {
  const row: Row = {};
  if (s.siteTitle !== undefined) row.site_title = s.siteTitle;
  if (s.siteSubtitle !== undefined) row.site_subtitle = s.siteSubtitle;
  if (s.relationshipStart !== undefined) row.relationship_start = s.relationshipStart;
  if (s.isPublic !== undefined) row.is_public = s.isPublic;
  if (s.musicUrl !== undefined) row.music_url = s.musicUrl;
  if (s.theme !== undefined) row.theme = s.theme;
  if (s.effects !== undefined) row.effects = s.effects;
  return row;
};

export const toSection = (r: Row): Section => {
  const kind = str(r.kind) as SectionKind;
  return {
    id: str(r.id),
    kind,
    title: str(r.title),
    subtitle: str(r.subtitle),
    animation: normalizeAnimation(r.animation),
    position: num(r.position),
    isVisible: r.is_visible !== false,
    content: normalizeSectionContent(kind, r.content),
  } as Section;
};

export const fromSection = (
  s: Partial<Omit<Section, "kind" | "content">> & { kind?: SectionKind; content?: unknown },
): Row => ({
  ...(s.id ? { id: s.id } : {}),
  kind: s.kind,
  title: s.title,
  subtitle: s.subtitle,
  animation: s.animation,
  position: s.position,
  is_visible: s.isVisible,
  content: s.content,
});

export const toPhoto = (r: Row): Photo => ({
  id: str(r.id),
  storagePath: strOrNull(r.storage_path),
  thumbPath: strOrNull(r.thumb_path),
  externalUrl: strOrNull(r.external_url),
  caption: str(r.caption),
  takenOn: str(r.taken_on),
  position: num(r.position),
  width: numOrNull(r.width),
  height: numOrNull(r.height),
  bytes: numOrNull(r.bytes),
  sourceHash: strOrNull(r.source_hash),
  createdAt: str(r.created_at),
});

export const fromPhoto = (p: Partial<Photo>): Row => ({
  ...(p.id ? { id: p.id } : {}),
  storage_path: p.storagePath,
  thumb_path: p.thumbPath,
  external_url: p.externalUrl,
  caption: p.caption,
  taken_on: p.takenOn,
  position: p.position,
  width: p.width,
  height: p.height,
  bytes: p.bytes,
  source_hash: p.sourceHash,
});

export const toMilestone = (r: Row): Milestone => ({
  id: str(r.id),
  title: str(r.title),
  description: str(r.description),
  happenedOn: str(r.happened_on),
  icon: str(r.icon, "💖"),
  photoId: strOrNull(r.photo_id),
  position: num(r.position),
});

export const fromMilestone = (m: Partial<Milestone>): Row => ({
  ...(m.id ? { id: m.id } : {}),
  title: m.title,
  description: m.description,
  happened_on: m.happenedOn,
  icon: m.icon,
  photo_id: m.photoId,
  position: m.position,
});

export const toDate = (r: Row): ImportantDate => ({
  id: str(r.id),
  title: str(r.title),
  eventDate: str(r.event_date),
  recursYearly: r.recurs_yearly !== false,
  icon: str(r.icon, "🎉"),
  message: str(r.message),
  isVisible: r.is_visible !== false,
});

export const fromDate = (d: Partial<ImportantDate>): Row => ({
  ...(d.id ? { id: d.id } : {}),
  title: d.title,
  event_date: d.eventDate,
  recurs_yearly: d.recursYearly,
  icon: d.icon,
  message: d.message,
  is_visible: d.isVisible,
});

export const toInterruption = (r: Row): Interruption => ({
  id: str(r.id),
  title: str(r.title),
  body: str(r.body),
  style: (["modal", "banner", "confetti", "hearts"].includes(str(r.style)) ? r.style : "modal") as Interruption["style"],
  startsAt: str(r.starts_at),
  endsAt: strOrNull(r.ends_at),
  isActive: r.is_active !== false,
  showOnce: r.show_once !== false,
});

export const fromInterruption = (i: Partial<Interruption>): Row => ({
  ...(i.id ? { id: i.id } : {}),
  title: i.title,
  body: i.body,
  style: i.style,
  starts_at: i.startsAt,
  ends_at: i.endsAt,
  is_active: i.isActive,
  show_once: i.showOnce,
});

export const toProfile = (r: Row): Profile => ({
  id: str(r.id),
  displayName: str(r.display_name),
  avatarUrl: strOrNull(r.avatar_url),
  role: (["super_admin", "editor", "viewer"].includes(str(r.role)) ? r.role : "viewer") as Profile["role"],
  isActive: r.is_active !== false,
  createdAt: str(r.created_at),
});

export const toInvitation = (r: Row): Invitation => ({
  id: str(r.id),
  role: (r.role === "viewer" ? "viewer" : "editor") as InvitableRole,
  note: str(r.note),
  createdAt: str(r.created_at),
  expiresAt: str(r.expires_at),
  usedAt: strOrNull(r.used_at),
});

export const toNote = (r: Row): Note => ({
  id: str(r.id),
  senderId: str(r.sender_id),
  recipientId: str(r.recipient_id),
  kind: str(r.kind, "note") as Note["kind"],
  title: str(r.title),
  body: str(r.body),
  readAt: strOrNull(r.read_at),
  createdAt: str(r.created_at),
});

export const toChatMessage = (r: Row): ChatMessage => {
  // `reply` es el mensaje citado, embebido con reply:reply_to(...).
  const embedded = Array.isArray(r.reply) ? r.reply[0] : r.reply;
  const reply = embedded && typeof embedded === "object" ? (embedded as Row) : null;
  return {
    id: str(r.id),
    senderId: str(r.sender_id),
    body: str(r.body),
    createdAt: str(r.created_at),
    replyTo: reply ? { id: str(reply.id), senderId: str(reply.sender_id), body: str(reply.body) } : null,
  };
};

export const toChatPresence = (r: Row): ChatPresence => ({
  userId: str(r.user_id),
  lastSeenAt: str(r.last_seen_at),
  lastReadAt: strOrNull(r.last_read_at),
});

export const toNotification = (r: Row): AppNotification => ({
  id: str(r.id),
  userId: str(r.user_id),
  kind: str(r.kind, "system") as AppNotification["kind"],
  title: str(r.title),
  body: str(r.body),
  link: strOrNull(r.link),
  readAt: strOrNull(r.read_at),
  createdAt: str(r.created_at),
});

export const toAudit = (r: Row): AuditEntry => ({
  id: num(r.id),
  actorId: strOrNull(r.actor_id),
  action: str(r.action) as AuditEntry["action"],
  tableName: str(r.table_name),
  recordId: strOrNull(r.record_id),
  oldData: (r.old_data as Record<string, unknown> | null) ?? null,
  newData: (r.new_data as Record<string, unknown> | null) ?? null,
  createdAt: str(r.created_at),
});
