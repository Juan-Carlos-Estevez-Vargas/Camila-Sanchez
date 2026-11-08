/**
 * Modelo de dominio. Refleja las tablas de supabase/migrations pero en
 * camelCase y con tipos estrictos; los repositorios hacen la traducción.
 */
import type { ContentTranslations } from "./contentTranslations";

export type Uuid = string;
/** Fecha de calendario sin hora, formato YYYY-MM-DD. */
export type IsoDate = string;
/** Instante con zona horaria, ISO 8601. */
export type IsoDateTime = string;

export const ROLES = ["super_admin", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export interface Profile {
  id: Uuid;
  displayName: string;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
  createdAt: IsoDateTime;
  /** Foto de perfil en el almacenamiento privado (gana sobre el icono). */
  avatarPath: string | null;
  /** Icono (emoji) que eligió si no tiene foto. */
  avatarEmoji: string | null;
  /** Frase o estado corto. */
  bio: string;
  birthday: IsoDate | null;
  /** Colores que eligió para sí (null = los de la página). */
  themeColors: Partial<Pick<ThemeTokens, "primary" | "primaryContrast" | "accent" | "background" | "surface" | "text" | "muted">> | null;
}

export interface PermissionDefinition {
  key: string;
  description: string;
}

export interface RolePermission {
  role: Role;
  permission: string;
}

export interface ThemeTokens {
  primary: string;
  primaryContrast: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
  fontDisplay: string;
  fontBody: string;
  radius: number;
  darkMode: "auto" | "light" | "dark";
}

export interface EffectsConfig {
  floating: { enabled: boolean; emojis: string[]; density: number };
  cursorHearts: boolean;
  reduceOnMobile: boolean;
}

export interface SiteSettings {
  siteTitle: string;
  siteSubtitle: string;
  relationshipStart: IsoDate | null;
  isPublic: boolean;
  musicUrl: string | null;
  theme: ThemeTokens;
  effects: EffectsConfig;
  updatedAt: IsoDateTime;
  /** Título y subtítulo en otros idiomas (ver contentTranslations.ts). */
  translations?: ContentTranslations;
}

export const SECTION_ANIMATIONS = [
  "none", "fade-up", "zoom-in", "slide-left", "slide-right", "float", "heartbeat",
] as const;
export type SectionAnimation = (typeof SECTION_ANIMATIONS)[number];

export interface LoveNoteCard {
  icon: string;
  title: string;
  body: string;
}

/** Contenido específico de cada tipo de sección (unión discriminada). */
export interface SectionContentMap {
  hero: Record<string, never>;
  together_counter: Record<string, never>;
  countdowns: Record<string, never>;
  milestones: Record<string, never>;
  gallery: Record<string, never>;
  love_notes: { cards: LoveNoteCard[] };
  letter: {
    greeting: string;
    paragraphs: string[];
    wishes: string[];
    signature: string;
    surprise: { button: string; title: string; text: string } | null;
  };
  text: { body: string };
  quote: { text: string; author: string };
}

export type SectionKind = keyof SectionContentMap;

export const SECTION_KINDS: readonly SectionKind[] = [
  "hero", "together_counter", "countdowns", "love_notes", "milestones",
  "gallery", "letter", "text", "quote",
];

interface SectionBase {
  id: Uuid;
  title: string;
  subtitle: string;
  animation: SectionAnimation;
  position: number;
  isVisible: boolean;
  /** Textos de la sección en otros idiomas. */
  translations?: ContentTranslations;
}

export type Section = {
  [K in SectionKind]: SectionBase & { kind: K; content: SectionContentMap[K] };
}[SectionKind];

export type SectionOf<K extends SectionKind> = Extract<Section, { kind: K }>;

export interface Photo {
  id: Uuid;
  storagePath: string | null;
  thumbPath: string | null;
  externalUrl: string | null;
  caption: string;
  takenOn: IsoDate;
  position: number;
  width: number | null;
  height: number | null;
  bytes: number | null;
  /** SHA-256 del archivo original; sirve para no subir dos veces la misma foto. */
  sourceHash?: string | null;
  createdAt: IsoDateTime;
}

/** URLs listas para pintar (firmadas o estáticas). */
export interface PhotoUrls {
  full: string;
  thumb: string;
}

export interface Milestone {
  id: Uuid;
  title: string;
  description: string;
  happenedOn: IsoDate;
  icon: string;
  photoId: Uuid | null;
  position: number;
  translations?: ContentTranslations;
}

export interface ImportantDate {
  id: Uuid;
  title: string;
  eventDate: IsoDate;
  recursYearly: boolean;
  icon: string;
  message: string;
  isVisible: boolean;
  translations?: ContentTranslations;
}

export const INTERRUPTION_STYLES = ["modal", "banner", "confetti", "hearts"] as const;
export type InterruptionStyle = (typeof INTERRUPTION_STYLES)[number];

export interface Interruption {
  id: Uuid;
  title: string;
  body: string;
  style: InterruptionStyle;
  startsAt: IsoDateTime;
  endsAt: IsoDateTime | null;
  isActive: boolean;
  showOnce: boolean;
  /** Para quién es. Sólo esa persona la ve; nunca quien la creó. */
  recipientId: Uuid | null;
  /** Quién la creó (lo pone el servidor). */
  createdBy: Uuid | null;
}

export const NOTE_KINDS = ["love", "apology", "note", "surprise", "reminder"] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export interface Note {
  id: Uuid;
  senderId: Uuid;
  recipientId: Uuid;
  kind: NoteKind;
  title: string;
  body: string;
  readAt: IsoDateTime | null;
  createdAt: IsoDateTime;
}

export type ChatKind = "text" | "image" | "sticker";

/** Foto de un mensaje: rutas en el almacenamiento privado y tamaño. */
export interface ChatImage {
  path: string;
  thumbPath: string;
  width: number | null;
  height: number | null;
}

/** Lo que se muestra del mensaje al que se responde. */
export interface ChatReplyPreview {
  id: Uuid;
  senderId: Uuid;
  body: string;
  kind?: ChatKind;
  sticker?: string | null;
  /** El original se borró para todos. */
  deleted?: boolean;
}

/** Reacción de una persona a un mensaje (una por persona). */
export interface ChatReaction {
  userId: Uuid;
  emoji: string;
}

export interface ChatMessage {
  id: Uuid;
  /** Conversación a la que pertenece. */
  conversationId: Uuid;
  senderId: Uuid;
  kind: ChatKind;
  /** Texto, o pie de foto (puede ir vacío en fotos y stickers). */
  body: string;
  image: ChatImage | null;
  /** Id del sticker del catálogo (src/domain/stickers.ts). */
  sticker: string | null;
  createdAt: IsoDateTime;
  /** Mensaje citado, o null si no responde a nada (o el original se borró). */
  replyTo: ChatReplyPreview | null;
  /** Cuándo se editó por última vez (null: nunca). */
  editedAt: IsoDateTime | null;
  /** Borrado para todos: queda «Se eliminó este mensaje». */
  deletedAt: IsoDateTime | null;
  reactions: ChatReaction[];
}

/** Qué relación tengo con alguien en el chat. */
export type ChatRelation = "none" | "outgoing" | "incoming" | "contact" | "blocked";

/** Persona encontrada en la búsqueda del chat. */
export interface ChatPerson {
  id: Uuid;
  displayName: string;
  avatarPath: string | null;
  avatarEmoji: string | null;
  bio: string;
  relation: ChatRelation;
  /** Solicitud o contacto que nos une (si hay). */
  contactId: Uuid | null;
}

/** Solicitud de contacto (pending) o contacto ya aceptado. */
export interface ChatContact {
  id: Uuid;
  requesterId: Uuid;
  addresseeId: Uuid;
  status: "pending" | "accepted";
  /** Mensajito que acompaña la solicitud. */
  message: string;
  createdAt: IsoDateTime;
  respondedAt: IsoDateTime | null;
}

/** Último mensaje de una conversación, para la bandeja. */
export interface ChatLastMessage {
  id: Uuid;
  senderId: Uuid;
  kind: ChatKind;
  body: string;
  sticker: string | null;
  createdAt: IsoDateTime;
  deleted: boolean;
}

/** Una conversación de la bandeja, con mis preferencias para ella. */
export interface ChatConversation {
  id: Uuid;
  kind: "direct" | "group";
  title: string;
  createdAt: IsoDateTime;
  lastMessageAt: IsoDateTime | null;
  participantIds: Uuid[];
  pinnedAt: IsoDateTime | null;
  archivedAt: IsoDateTime | null;
  muted: boolean;
  lastReadAt: IsoDateTime | null;
  unread: number;
  lastMessage: ChatLastMessage | null;
}

/** Vistos y «escribiendo…» de una persona en una conversación. */
export interface ChatParticipant {
  conversationId: Uuid;
  userId: Uuid;
  lastReadAt: IsoDateTime | null;
  typingAt: IsoDateTime | null;
}

/** Última conexión de una persona y hasta cuándo leyó el chat. */
export interface ChatPresence {
  userId: Uuid;
  lastSeenAt: IsoDateTime;
  lastReadAt: IsoDateTime | null;
}

export type NotificationKind = "note" | "chat" | "system" | "list" | "dedication";

export interface AppNotification {
  id: Uuid;
  userId: Uuid;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string | null;
  readAt: IsoDateTime | null;
  createdAt: IsoDateTime;
}

/** Lista de cosas por hacer compartida con una o varias personas. */
export interface TodoList {
  id: Uuid;
  ownerId: Uuid;
  title: string;
  description: string;
  emoji: string;
  dueOn: IsoDate | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /** Quienes la ven y la editan (incluye a quien la creó). */
  memberIds: Uuid[];
}

/** Lista con su avance, para el listado. */
export interface TodoListSummary extends TodoList {
  total: number;
  done: number;
  /** Fecha más cercana entre las tareas pendientes (o la de la lista). */
  nextDue: IsoDate | null;
}

/** Tarea o subtarea (si tiene parentId). */
export interface TodoItem {
  id: Uuid;
  listId: Uuid;
  parentId: Uuid | null;
  title: string;
  description: string;
  dueOn: IsoDate | null;
  assigneeId: Uuid | null;
  doneAt: IsoDateTime | null;
  doneBy: Uuid | null;
  position: number;
  createdBy: Uuid | null;
  createdAt: IsoDateTime;
}

export interface TodoMaterial {
  id: Uuid;
  itemId: Uuid;
  name: string;
  quantity: string;
  isReady: boolean;
  position: number;
}

/** Foto de una tarea, en el almacenamiento privado de la lista. */
export interface TodoImage {
  id: Uuid;
  itemId: Uuid;
  listId: Uuid;
  path: string;
  thumbPath: string;
  width: number | null;
  height: number | null;
  createdBy: Uuid | null;
  createdAt: IsoDateTime;
}

/** Todo lo que se pinta en la página de una lista. */
export interface TodoListDetail {
  list: TodoList;
  items: TodoItem[];
  materials: TodoMaterial[];
  images: TodoImage[];
}

/**
 * Dedicatoria: un mensaje con fotos y canciones de una persona para otra
 * (o para todas, si recipientId es null).
 */
export interface Dedication {
  id: Uuid;
  authorId: Uuid;
  /** Para quién es; null = para todas las personas que usan dedicatorias. */
  recipientId: Uuid | null;
  title: string;
  message: string;
  emoji: string;
  /** El día que se recuerda (por defecto, el de hoy). */
  dedicatedOn: IsoDate;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** Foto de una dedicatoria, en la carpeta privada de la dedicatoria. */
export interface DedicationPhoto {
  id: Uuid;
  dedicationId: Uuid;
  path: string;
  thumbPath: string;
  width: number | null;
  height: number | null;
  position: number;
  createdAt: IsoDateTime;
}

/**
 * De dónde suena una canción: YouTube o Spotify (se reproducen incrustados),
 * un archivo de audio subido a la app, o cualquier otro enlace (se abre aparte).
 */
export const SONG_SOURCES = ["youtube", "spotify", "audio", "link"] as const;
export type SongSource = (typeof SONG_SOURCES)[number];

export interface DedicationSong {
  id: Uuid;
  dedicationId: Uuid;
  title: string;
  artist: string;
  /** Por qué esta canción (opcional). */
  note: string;
  source: SongSource;
  /** Enlace https (YouTube, Spotify u otro); null en los archivos subidos. */
  url: string | null;
  /** Ruta del archivo en el almacenamiento privado (sólo source = "audio"). */
  audioPath: string | null;
  position: number;
  createdAt: IsoDateTime;
}

/** Dedicatoria con sus fotos y canciones ya ordenadas. */
export interface DedicationWithMedia {
  dedication: Dedication;
  photos: DedicationPhoto[];
  songs: DedicationSong[];
}

export interface AuditEntry {
  id: number;
  actorId: Uuid | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  tableName: string;
  recordId: string | null;
  oldData: Record<string, unknown> | null;
  newData: Record<string, unknown> | null;
  createdAt: IsoDateTime;
}

export interface SessionUser {
  id: Uuid;
  email: string;
}

/** Todo lo que la página pública necesita para pintarse. */
export interface SiteContent {
  settings: SiteSettings;
  sections: Section[];
  photos: Photo[];
  milestones: Milestone[];
  dates: ImportantDate[];
  interruptions: Interruption[];
}

/** Rol que puede llevar un enlace de invitación (nunca super admin). */
export type InvitableRole = Exclude<Role, "super_admin">;

export interface Invitation {
  id: Uuid;
  role: InvitableRole;
  note: string;
  createdAt: IsoDateTime;
  expiresAt: IsoDateTime;
  usedAt: IsoDateTime | null;
}
