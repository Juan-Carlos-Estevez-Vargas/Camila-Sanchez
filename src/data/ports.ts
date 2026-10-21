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
  Section, SessionUser, SiteSettings, TodoImage, TodoItem, TodoList, TodoListDetail, TodoListSummary, TodoMaterial, Uuid,
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
  /** Aviso de prueba para mí (también llega al celular si tiene push). */
  sendTestNotification(): Promise<void>;
}

/** Foto ya optimizada lista para subir (al chat o a una tarea). */
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

export interface NewTodoListInput {
  title: string;
  description: string;
  emoji: string;
  dueOn: string | null;
  /** Con quién se comparte (quien la crea entra sola). */
  memberIds: Uuid[];
}

export type TodoListPatch = Partial<Pick<TodoList, "title" | "description" | "emoji" | "dueOn">>;

export type TodoItemInput = Partial<Pick<TodoItem, "title" | "description" | "dueOn" | "assigneeId" | "parentId">> & {
  id?: Uuid;
  listId: Uuid;
};

export type TodoMaterialInput = Partial<Pick<TodoMaterial, "name" | "quantity" | "isReady">> & {
  id?: Uuid;
  itemId: Uuid;
};

/**
 * Listas de cosas por hacer compartidas. Sólo sus miembros las ven; la base
 * de datos decide quién puede qué (RLS) y avisa a los demás.
 */
export interface ListsRepository {
  /** Mis listas con su avance, las más nuevas primero. */
  list(): Promise<TodoListSummary[]>;
  /** null si no existe o no soy miembro. */
  get(id: Uuid): Promise<TodoListDetail | null>;
  /** Crea la lista y suma a las personas elegidas. Devuelve su id. */
  create(input: NewTodoListInput): Promise<Uuid>;
  update(id: Uuid, patch: TodoListPatch): Promise<void>;
  /** Sólo quien la creó. Borra también sus tareas y fotos. */
  remove(id: Uuid): Promise<void>;
  addMember(listId: Uuid, userId: Uuid): Promise<void>;
  /** Sacar a alguien (quien la creó) o salirse (cualquiera). */
  removeMember(listId: Uuid, userId: Uuid): Promise<void>;

  saveItem(item: TodoItemInput): Promise<TodoItem>;
  setItemDone(id: Uuid, done: boolean): Promise<void>;
  /** Borra la tarea, sus subtareas, materiales y fotos. */
  deleteItem(id: Uuid): Promise<void>;

  saveMaterial(material: TodoMaterialInput): Promise<TodoMaterial>;
  deleteMaterial(id: Uuid): Promise<void>;

  addImage(listId: Uuid, itemId: Uuid, image: ChatImageUpload): Promise<TodoImage>;
  deleteImage(image: TodoImage): Promise<void>;
  /** URLs firmadas (o locales en demo) de las fotos, por ruta. */
  resolveImages(paths: string[]): Promise<Map<string, string>>;
}

export type MyProfilePatch = Partial<Pick<Profile, "displayName" | "avatarEmoji" | "bio" | "birthday">>;

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
  /** Nombre, icono, frase y cumpleaños de quien tiene la sesión. */
  updateMyProfile(patch: MyProfilePatch): Promise<Profile>;
  /** Sube la foto de perfil (o la quita con null) y borra la anterior. */
  setMyAvatar(image: ChatImageUpload | null): Promise<Profile>;
  /** URLs firmadas (o locales en demo) de fotos de perfil, por ruta. */
  resolveAvatars(paths: string[]): Promise<Map<string, string>>;
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
  | "interruptions" | "notes" | "chat_messages" | "chat_reads" | "notifications"
  | "todo_lists" | "todo_list_members" | "todo_items" | "todo_materials" | "todo_item_images";

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
  readonly lists: ListsRepository;
  readonly users: UserRepository;
  readonly invitations: InvitationRepository;
  readonly realtime: RealtimeGateway;
  readonly push: PushRepository;
}
