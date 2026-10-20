/**
 * Puertos (interfaces) de la capa de datos — arquitectura hexagonal.
 *
 * La UI sólo conoce estas interfaces. Hay dos adaptadores:
 *   - data/supabase: producción (Postgres + RLS, Auth, Storage, Realtime).
 *   - data/demo:     todo en el navegador, para probar sin backend.
 * La fábrica de data/backend.ts elige uno al arrancar (patrón Strategy).
 */
import type {
  AppNotification, AuditEntry, ChatMessage, ChatPresence, ImportantDate, Interruption, Invitation, InvitableRole,
  Milestone, Note, NoteKind, PermissionDefinition, Photo, PhotoUrls, Profile, Role, RolePermission,
  Section, SessionUser, SiteSettings, Uuid,
} from "@/domain/types";

export type Unsubscribe = () => void;

export interface AuthGateway {
  getSession(): Promise<SessionUser | null>;
  onChange(listener: (user: SessionUser | null) => void): Unsubscribe;
  /** remember=false: la sesión vive sólo en esta pestaña y termina al cerrarla. */
  signInWithPassword(email: string, password: string, options?: { remember?: boolean }): Promise<void>;
  sendMagicLink(email: string): Promise<void>;
  /** Correo con un enlace a /recuperar. */
  sendPasswordReset(email: string): Promise<void>;
  /** Abre la sesión de recuperación con el token del enlace (un solo uso). */
  verifyRecovery(tokenHash: string): Promise<void>;
  /** signOutOthers=true cierra las sesiones de los demás dispositivos. */
  updatePassword(password: string, options?: { signOutOthers?: boolean }): Promise<void>;
  /** everywhere=true también revoca las sesiones de los demás dispositivos. */
  signOut(options?: { everywhere?: boolean }): Promise<void>;
}

export type ReorderableTable = "sections" | "photos" | "milestones";

export interface ContentRepository {
  getSettings(): Promise<SiteSettings>;
  updateSettings(patch: Partial<Omit<SiteSettings, "updatedAt">>): Promise<SiteSettings>;

  listSections(): Promise<Section[]>;
  saveSection(section: Omit<Section, "id"> & { id?: Uuid }): Promise<Section>;
  deleteSection(id: Uuid): Promise<void>;

  listMilestones(): Promise<Milestone[]>;
  saveMilestone(milestone: Omit<Milestone, "id"> & { id?: Uuid }): Promise<Milestone>;
  deleteMilestone(id: Uuid): Promise<void>;

  listDates(): Promise<ImportantDate[]>;
  saveDate(date: Omit<ImportantDate, "id"> & { id?: Uuid }): Promise<ImportantDate>;
  deleteDate(id: Uuid): Promise<void>;

  /** Activas ahora (página pública) o todas (panel). */
  listInterruptions(scope: "active" | "all"): Promise<Interruption[]>;
  saveInterruption(item: Omit<Interruption, "id"> & { id?: Uuid }): Promise<Interruption>;
  deleteInterruption(id: Uuid): Promise<void>;
  markInterruptionSeen(id: Uuid): Promise<void>;
  listSeenInterruptions(): Promise<Uuid[]>;

  reorder(table: ReorderableTable, orderedIds: Uuid[]): Promise<void>;
}

export interface UploadedImage {
  storagePath: string;
  thumbPath: string;
}

export interface PhotoRepository {
  list(): Promise<Photo[]>;
  save(photo: Omit<Photo, "id" | "createdAt"> & { id?: Uuid }): Promise<Photo>;
  delete(photo: Photo): Promise<void>;
  /** Sube el archivo optimizado y su miniatura. */
  upload(full: Blob, thumb: Blob, extension: string): Promise<UploadedImage>;
  /** URLs listas para <img>, resueltas en lote (una petición). */
  resolveUrls(photos: Photo[]): Promise<Map<Uuid, PhotoUrls>>;
}

export interface MessagingRepository {
  listNotes(): Promise<Note[]>;
  sendNote(note: { recipientId: Uuid; kind: NoteKind; title: string; body: string }): Promise<Note>;
  markNoteRead(id: Uuid): Promise<void>;
  deleteNote(id: Uuid): Promise<void>;

  listChat(options?: { before?: string; limit?: number }): Promise<ChatMessage[]>;
  /** Envía texto, una foto (con pie opcional) o un sticker. */
  sendChat(body: string, options?: ChatSendOptions): Promise<ChatMessage>;
  /** URLs firmadas (o locales en demo) de las fotos del chat, por ruta. */
  resolveChatImages(paths: string[]): Promise<Map<string, string>>;
  deleteChat(id: Uuid): Promise<void>;
  /** Última conexión y vistos de quienes usan el chat. */
  listChatPresence(): Promise<ChatPresence[]>;
  /** Avisa de que sigo conectado; con `read`, además, que leí el chat hasta ahora. */
  touchChatPresence(options?: { read?: boolean }): Promise<void>;

  listNotifications(limit?: number): Promise<AppNotification[]>;
  markNotificationRead(id: Uuid): Promise<void>;
  markAllNotificationsRead(kind?: AppNotification["kind"]): Promise<void>;
}

/** Foto ya optimizada lista para subir al chat. */
export interface ChatImageUpload {
  full: Blob;
  thumb: Blob;
  extension: string;
  width: number;
  height: number;
}

export interface ChatSendOptions {
  replyToId?: Uuid | null;
  image?: ChatImageUpload;
  sticker?: string;
}

export interface NewUserInput {
  email: string;
  displayName: string;
  role: Role;
  /** Si se omite se envía una invitación por correo. */
  password?: string;
}

export interface UserRepository {
  getProfile(id: Uuid): Promise<Profile | null>;
  listProfiles(): Promise<Profile[]>;
  updateProfile(id: Uuid, patch: Partial<Pick<Profile, "displayName" | "avatarUrl" | "role" | "isActive">>): Promise<Profile>;
  /** Colores propios de quien tiene la sesión (null = volver a los de la página). */
  updateMyColors(colors: Profile["themeColors"]): Promise<Profile>;
  myPermissions(): Promise<string[]>;
  listPermissions(): Promise<PermissionDefinition[]>;
  listRolePermissions(): Promise<RolePermission[]>;
  setRolePermission(role: Role, permission: string, granted: boolean): Promise<void>;
  createUser(input: NewUserInput): Promise<void>;
  deleteUser(id: Uuid): Promise<void>;
  /** Token para un enlace de recuperación de contraseña, sin enviar correo. */
  createRecoveryLink(id: Uuid): Promise<string>;
  listAudit(options: { page: number; pageSize: number; table?: string }): Promise<AuditEntry[]>;
}

export interface CreatedInvitation {
  invitation: Invitation;
  /** Token en claro: sólo existe en este momento, para armar el enlace. */
  token: string;
}

export interface RedeemInvitationInput {
  token: string;
  email: string;
  password: string;
  displayName: string;
}

export interface InvitationRepository {
  list(): Promise<Invitation[]>;
  create(input: { role: InvitableRole; note: string; expiresInHours: number }): Promise<CreatedInvitation>;
  revoke(id: Uuid): Promise<void>;
  /** Público: ¿sirve todavía este enlace? (no lo consume). */
  check(token: string): Promise<{ valid: boolean; role?: InvitableRole }>;
  /** Público: crea la cuenta y consume el enlace. */
  redeem(input: RedeemInvitationInput): Promise<void>;
}

export type RealtimeTable =
  | "site_settings" | "sections" | "photos" | "milestones" | "important_dates"
  | "interruptions" | "notes" | "chat_messages" | "chat_reads" | "notifications";

export interface RealtimeChange<T = Record<string, unknown>> {
  table: RealtimeTable;
  type: "INSERT" | "UPDATE" | "DELETE";
  record: T | null;
  old: Partial<T> | null;
}

export interface RealtimeGateway {
  subscribe(tables: RealtimeTable[], listener: (change: RealtimeChange) => void): Unsubscribe;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string;
}

export interface PushRepository {
  register(subscription: PushSubscriptionInput): Promise<void>;
  unregister(endpoint: string): Promise<void>;
}

/** Agregado con todos los puertos: lo que la app recibe por contexto. */
export interface Backend {
  readonly mode: "supabase" | "demo";
  readonly auth: AuthGateway;
  readonly content: ContentRepository;
  readonly photos: PhotoRepository;
  readonly messaging: MessagingRepository;
  readonly users: UserRepository;
  readonly invitations: InvitationRepository;
  readonly realtime: RealtimeGateway;
  readonly push: PushRepository;
}
