/**
 * Adaptador "demo": implementa los mismos puertos que Supabase pero guarda
 * todo en el navegador (localStorage + IndexedDB para las imágenes).
 *
 * - Sirve para probar la app sin crear ninguna cuenta.
 * - Emula las reglas importantes del backend (permisos, notificaciones,
 *   auditoría) para que el comportamiento sea el mismo.
 * - Cada pestaña puede tener su propia sesión (sessionStorage) y los cambios
 *   viajan entre pestañas con BroadcastChannel, así se puede probar el chat
 *   abriendo una pestaña como Juan y otra como Camila.
 */
import { del as idbDel, get as idbGet, set as idbSet } from "idb-keyval";
import { AccessPolicy, DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, type Permission } from "@/domain/permissions";
import { messagePreview, upsertPresence } from "@/domain/chat";
import { isKnownSticker } from "@/domain/stickers";
import { MAX_TASK_IMAGES, nextDueOf, progressOf } from "@/domain/lists";
import { sanitizeColors } from "@/domain/palettes";
import { AppError } from "@/core/errors";
import {
  expiryFromNow, generateInviteToken, hashInviteToken, invitationStatus, isInviteToken, MIN_PASSWORD_LENGTH,
} from "@/domain/invitations";
import { RECOVERY_LINK_HOURS } from "@/domain/recovery";
import type {
  AppNotification, AuditEntry, ChatImage, ChatMessage, ChatPresence, ImportantDate, Interruption, Invitation, Milestone, Note,
  PermissionDefinition, Photo, PhotoUrls, Profile, Role, RolePermission, Section, SessionUser,
  SiteSettings, TodoImage, TodoItem, TodoList, TodoMaterial, Uuid,
} from "@/domain/types";
import type { Backend, ListsRepository, RealtimeChange, RealtimeTable } from "@/data/ports";
import { SEED_DATES, SEED_MILESTONES, SEED_PHOTOS, SEED_SECTIONS, SEED_SETTINGS } from "./seed";

// Cambia de versión cuando cambian los datos de fábrica (tema, permisos...).
const STORAGE_KEY = "love-demo-v3";
const REVISION_KEY = "love-demo-rev";
const SESSION_KEY = "love-demo-session";
const CHANNEL = "love-demo";

export const DEMO_ACCOUNTS = [
  { email: "juan@demo.local", password: "demo1234", displayName: "Juan", role: "super_admin" as Role },
  { email: "camila@demo.local", password: "demo1234", displayName: "Camila", role: "editor" as Role },
];

interface DemoUser extends Profile {
  email: string;
  password: string;
}

interface DemoInvitation extends Invitation {
  tokenHash: string;
}

interface DemoRecovery {
  tokenHash: string;
  userId: Uuid;
  expiresAt: string;
}

interface DemoState {
  settings: SiteSettings;
  sections: Section[];
  photos: Photo[];
  milestones: Milestone[];
  dates: ImportantDate[];
  interruptions: Interruption[];
  interruptionViews: Record<Uuid, Uuid[]>;
  notes: Note[];
  chat: ChatMessage[];
  chatReads: ChatPresence[];
  notifications: AppNotification[];
  todoLists: TodoList[];
  todoItems: TodoItem[];
  todoMaterials: TodoMaterial[];
  todoImages: TodoImage[];
  users: DemoUser[];
  invitations: DemoInvitation[];
  recoveries: DemoRecovery[];
  rolePermissions: RolePermission[];
  audit: AuditEntry[];
}

const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  "site.view": "Ver el sitio cuando es privado",
  "content.edit": "Editar textos, tarjetas, hitos y animaciones de secciones",
  "photos.manage": "Subir, mover, editar y borrar fotos",
  "dates.manage": "Gestionar fechas importantes y contadores",
  "interruptions.manage": "Crear interrupciones (sorpresas emergentes)",
  "notes.send": "Enviar notitas a la cajita de mensajes",
  "chat.use": "Usar el chat",
  "lists.use": "Crear listas de cosas por hacer y compartirlas",
  "sections.manage": "Crear, ordenar y ocultar secciones",
  "theme.manage": "Cambiar colores, tipografías, efectos y animaciones",
  "settings.manage": "Configuración general del sitio",
  "users.manage": "Gestionar usuarios, roles y permisos",
  "audit.view": "Ver el registro de auditoría",
};

const uuid = () => crypto.randomUUID();
const nowIso = () => new Date().toISOString();

function initialState(): DemoState {
  const created = nowIso();
  return {
    settings: SEED_SETTINGS,
    sections: SEED_SECTIONS.map((s) => ({ ...s, id: uuid() }) as Section),
    photos: SEED_PHOTOS.map((p) => ({ ...p, id: uuid() })),
    milestones: SEED_MILESTONES.map((m) => ({ ...m, id: uuid() })),
    dates: SEED_DATES.map((d) => ({ ...d, id: uuid() })),
    interruptions: [],
    interruptionViews: {},
    notes: [],
    chat: [],
    chatReads: [],
    notifications: [],
    todoLists: [],
    todoItems: [],
    todoMaterials: [],
    todoImages: [],
    users: DEMO_ACCOUNTS.map((a) => ({
      id: uuid(), email: a.email, password: a.password, displayName: a.displayName,
      role: a.role, isActive: true, avatarUrl: null, createdAt: created, themeColors: null,
    })),
    invitations: [],
    recoveries: [],
    rolePermissions: (["editor", "viewer"] as const).flatMap((role) =>
      DEFAULT_ROLE_PERMISSIONS[role].map((permission) => ({ role, permission })),
    ),
    audit: [],
  };
}

function safeStorage<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

class DemoDatabase {
  private current: DemoState;
  /** Revisión de los datos que tiene esta pestaña (cambia con cada escritura). */
  private revision: string | null;
  private readonly listeners = new Set<(change: RealtimeChange) => void>();
  private readonly channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(CHANNEL) : null;

  constructor() {
    this.current = this.load();
    this.revision = safeStorage(() => localStorage.getItem(REVISION_KEY), null);
    // Otra pestaña cambió algo: avisamos a los suscriptores (los datos se
    // releen solos al pedir `state`).
    this.channel?.addEventListener("message", (event: MessageEvent<RealtimeChange>) => {
      this.listeners.forEach((l) => l(event.data));
    });
  }

  /**
   * Datos al día. Si otra pestaña escribió desde la última lectura se releen
   * antes de usarlos, así una pestaña nunca pisa lo que guardó la otra.
   */
  get state(): DemoState {
    const revision = safeStorage(() => localStorage.getItem(REVISION_KEY), null);
    if (revision !== this.revision) {
      this.current = this.load();
      this.revision = revision;
    }
    return this.current;
  }

  set state(value: DemoState) {
    this.current = value;
  }

  private load(): DemoState {
    const raw = safeStorage(() => localStorage.getItem(STORAGE_KEY), null);
    if (raw) {
      try {
        return { ...initialState(), ...(JSON.parse(raw) as DemoState) };
      } catch {
        /* estado corrupto: se reinicia */
      }
    }
    const fresh = initialState();
    safeStorage(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)), undefined);
    return fresh;
  }

  commit(change: Omit<RealtimeChange, "old"> & { old?: RealtimeChange["old"] }): void {
    const revision = uuid();
    safeStorage(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.current));
      localStorage.setItem(REVISION_KEY, revision);
    }, undefined);
    this.revision = revision;
    const full: RealtimeChange = { old: null, ...change };
    // Copia "plana" para que BroadcastChannel pueda clonarla.
    const message = JSON.parse(JSON.stringify(full)) as RealtimeChange;
    this.channel?.postMessage(message);
    // Asíncrono, como un evento realtime real.
    queueMicrotask(() => this.listeners.forEach((l) => l(message)));
  }

  subscribe(listener: (change: RealtimeChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  reset(): void {
    this.state = initialState();
    this.commit({ table: "site_settings", type: "UPDATE", record: null });
  }
}

let db: DemoDatabase | null = null;
const database = () => (db ??= new DemoDatabase());

/** Reinicia la demo a los datos de fábrica. */
export function resetDemoData(): void {
  database().reset();
}

// --- sesión y permisos ------------------------------------------------------

const authListeners = new Set<(user: SessionUser | null) => void>();

function sessionUser(): DemoUser | null {
  const id = safeStorage(() => sessionStorage.getItem(SESSION_KEY), null);
  return database().state.users.find((u) => u.id === id && u.isActive) ?? null;
}

function setSession(user: DemoUser | null) {
  safeStorage(() => (user ? sessionStorage.setItem(SESSION_KEY, user.id) : sessionStorage.removeItem(SESSION_KEY)), undefined);
  const value = user ? { id: user.id, email: user.email } : null;
  authListeners.forEach((l) => l(value));
}

function policyOf(user: DemoUser | null): AccessPolicy {
  if (!user) return AccessPolicy.anonymous();
  const perms = database().state.rolePermissions.filter((rp) => rp.role === user.role).map((rp) => rp.permission);
  return new AccessPolicy(user.role, perms);
}

function requireUser(): DemoUser {
  const user = sessionUser();
  if (!user) throw new AppError("Necesitas iniciar sesión.");
  return user;
}

function require(...permissions: Permission[]): DemoUser {
  const user = requireUser();
  if (!policyOf(user).canAny(...permissions)) throw new AppError("No tienes permiso para hacer esto.");
  return user;
}

function canViewSite(): boolean {
  return database().state.settings.isPublic || policyOf(sessionUser()).can(PERMISSIONS.siteView);
}

const delay = <T>(value: T): Promise<T> => new Promise((r) => setTimeout(() => r(value), 60));
const clone = <T>(value: T): T => structuredClone(value);

type CollectionKey = "sections" | "photos" | "milestones" | "dates" | "interruptions";
const TABLE_OF: Record<CollectionKey, RealtimeTable> = {
  sections: "sections", photos: "photos", milestones: "milestones",
  dates: "important_dates", interruptions: "interruptions",
};

function audit(action: AuditEntry["action"], table: string, recordId: string | null, oldData: unknown, newData: unknown) {
  const state = database().state;
  state.audit.unshift({
    id: (state.audit[0]?.id ?? 0) + 1,
    actorId: sessionUser()?.id ?? null,
    action, tableName: table, recordId,
    oldData: (oldData as Record<string, unknown>) ?? null,
    newData: (newData as Record<string, unknown>) ?? null,
    createdAt: nowIso(),
  });
  state.audit.length = Math.min(state.audit.length, 500);
}

/** Alta/edición genérica sobre una colección con auditoría y realtime. */
function upsertIn<T extends { id: Uuid }>(key: CollectionKey, item: Omit<T, "id"> & { id?: Uuid }): T {
  const list = database().state[key] as unknown as T[];
  const index = item.id ? list.findIndex((x) => x.id === item.id) : -1;
  const table = TABLE_OF[key];
  if (index >= 0) {
    const old = list[index]!;
    const updated = { ...old, ...item } as T;
    list[index] = updated;
    audit("UPDATE", table, updated.id, old, updated);
    database().commit({ table, type: "UPDATE", record: updated as never, old: old as never });
    return clone(updated);
  }
  const created = { ...item, id: item.id ?? uuid() } as T;
  list.push(created);
  audit("INSERT", table, created.id, null, created);
  database().commit({ table, type: "INSERT", record: created as never });
  return clone(created);
}

function removeFrom(key: CollectionKey, id: Uuid): void {
  const state = database().state;
  const list = state[key] as Array<{ id: Uuid }>;
  const old = list.find((x) => x.id === id);
  (state[key] as Array<{ id: Uuid }>) = list.filter((x) => x.id !== id);
  const table = TABLE_OF[key];
  audit("DELETE", table, id, old, null);
  database().commit({ table, type: "DELETE", record: null, old: { id } });
}

function notify(userId: Uuid, kind: AppNotification["kind"], title: string, body: string, link: string) {
  const n: AppNotification = { id: uuid(), userId, kind, title, body: body.slice(0, 140), link, readAt: null, createdAt: nowIso() };
  database().state.notifications.unshift(n);
  database().commit({ table: "notifications", type: "INSERT", record: n as never });
}

async function findPendingInvitation(token: string): Promise<DemoInvitation | null> {
  if (!isInviteToken(token)) return null;
  const hash = await hashInviteToken(token);
  const invitation = database().state.invitations.find((i) => i.tokenHash === hash);
  return invitation && invitationStatus(invitation) === "pending" ? invitation : null;
}

const NOTE_TITLES: Record<Note["kind"], string> = {
  apology: "te pide perdón 🥺", love: "te mandó amor 💌", surprise: "te dejó una sorpresa 🎁",
  note: "te dejó una notita ✉️", reminder: "te dejó una notita ✉️",
};

const objectUrls = new Map<string, string>();

/** URLs locales de imágenes guardadas en IndexedDB. */
async function localImageUrls(paths: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  for (const path of new Set(paths)) {
    let url = objectUrls.get(path);
    if (!url) {
      const blob = await idbGet<Blob>(path);
      if (!blob) continue;
      url = URL.createObjectURL(blob);
      objectUrls.set(path, url);
    }
    result.set(path, url);
  }
  return result;
}

// --- listas compartidas (mismas reglas que la base de datos) -----------------

function listOf(id: Uuid): TodoList | undefined {
  return database().state.todoLists.find((l) => l.id === id);
}

/** La lista, si quien tiene la sesión es miembro y puede usar listas. */
function memberList(listId: Uuid): { user: DemoUser; list: TodoList } {
  const user = require(PERMISSIONS.listsUse);
  const list = listOf(listId);
  if (!list || !list.memberIds.includes(user.id)) throw new AppError("Esta lista no existe o no eres parte de ella.");
  return { user, list };
}

function memberItem(itemId: Uuid): { user: DemoUser; list: TodoList; item: TodoItem } {
  const item = database().state.todoItems.find((i) => i.id === itemId);
  if (!item) throw new AppError("Esta tarea ya no existe.");
  return { ...memberList(item.listId), item };
}

const canUseLists = (userId: Uuid) => {
  const other = database().state.users.find((u) => u.id === userId);
  return !!other?.isActive && policyOf(other).can(PERMISSIONS.listsUse);
};

/** Avisa a los demás miembros; si ya tienen uno sin leer de la lista, se actualiza. */
function notifyList(actor: DemoUser, list: TodoList, body: string, only?: Uuid) {
  const state = database().state;
  const link = `/listas/${list.id}`;
  const title = `${actor.displayName} · ${list.emoji} ${list.title}`.slice(0, 160);
  for (const userId of list.memberIds) {
    if (userId === actor.id || (only && userId !== only) || !canUseLists(userId)) continue;
    const unread = state.notifications.find((n) => n.userId === userId && n.kind === "list" && n.link === link && !n.readAt);
    if (unread) {
      Object.assign(unread, { title, body: body.slice(0, 140), createdAt: nowIso() });
      database().commit({ table: "notifications", type: "UPDATE", record: unread as never });
    } else {
      notify(userId, "list", title, body, link);
    }
  }
}

function addListMember(actor: DemoUser, list: TodoList, userId: Uuid) {
  if (list.memberIds.includes(userId)) return;
  if (!canUseLists(userId)) throw new AppError("Esa persona no puede usar listas.");
  list.memberIds.push(userId);
  database().commit({ table: "todo_list_members", type: "INSERT", record: { list_id: list.id, user_id: userId } });
  if (userId !== actor.id) {
    notify(userId, "list", `${actor.displayName} te sumó a la lista ${list.emoji} ${list.title}`.slice(0, 160),
      list.description.trim() || "Ábrela para ver qué hay por hacer.", `/listas/${list.id}?nueva=1`);
  }
}

function dropImages(images: TodoImage[]) {
  for (const image of images) {
    for (const path of [image.path, image.thumbPath]) {
      void idbDel(path);
      const url = objectUrls.get(path);
      if (url) URL.revokeObjectURL(url);
      objectUrls.delete(path);
    }
  }
}

const textOf = (value: string, max: number, what: string) => {
  const text = value.trim();
  if (!text) throw new AppError(`Escribe ${what}.`);
  return text.slice(0, max);
};

const demoLists: ListsRepository = {
  async list() {
    const user = require(PERMISSIONS.listsUse);
    const state = database().state;
    return clone(
      state.todoLists
        .filter((l) => l.memberIds.includes(user.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((l) => {
          const items = state.todoItems.filter((i) => i.listId === l.id);
          const { total, done } = progressOf(items);
          return { ...l, total, done, nextDue: nextDueOf(items, l.dueOn) };
        }),
    );
  },
  async get(id) {
    const user = require(PERMISSIONS.listsUse);
    const state = database().state;
    const list = listOf(id);
    if (!list || !list.memberIds.includes(user.id)) return null;
    const items = state.todoItems.filter((i) => i.listId === id);
    const ids = new Set(items.map((i) => i.id));
    return clone({
      list,
      items,
      materials: state.todoMaterials.filter((m) => ids.has(m.itemId)).sort((a, b) => a.position - b.position),
      images: state.todoImages.filter((i) => i.listId === id),
    });
  },
  async create(input) {
    const user = require(PERMISSIONS.listsUse);
    const now = nowIso();
    const list: TodoList = {
      id: uuid(), ownerId: user.id, title: textOf(input.title, 120, "un nombre para la lista"),
      description: input.description.trim().slice(0, 2000), emoji: input.emoji || "📝", dueOn: input.dueOn || null,
      createdAt: now, updatedAt: now, memberIds: [user.id],
    };
    for (const id of input.memberIds) {
      if (id !== user.id && !canUseLists(id)) throw new AppError("Una de las personas elegidas no puede usar listas.");
    }
    database().state.todoLists.push(list);
    database().commit({ table: "todo_lists", type: "INSERT", record: list as never });
    for (const id of input.memberIds) if (id !== user.id) addListMember(user, list, id);
    return list.id;
  },
  async update(id, patch) {
    const { list } = memberList(id);
    if (patch.title !== undefined) list.title = textOf(patch.title, 120, "un nombre para la lista");
    if (patch.description !== undefined) list.description = patch.description.slice(0, 2000);
    if (patch.emoji !== undefined) list.emoji = patch.emoji || "📝";
    if (patch.dueOn !== undefined) list.dueOn = patch.dueOn || null;
    list.updatedAt = nowIso();
    database().commit({ table: "todo_lists", type: "UPDATE", record: list as never });
  },
  async remove(id) {
    const { user, list } = memberList(id);
    if (list.ownerId !== user.id) throw new AppError("Sólo quien creó la lista puede borrarla.");
    const state = database().state;
    const itemIds = new Set(state.todoItems.filter((i) => i.listId === id).map((i) => i.id));
    dropImages(state.todoImages.filter((i) => i.listId === id));
    state.todoImages = state.todoImages.filter((i) => i.listId !== id);
    state.todoMaterials = state.todoMaterials.filter((m) => !itemIds.has(m.itemId));
    state.todoItems = state.todoItems.filter((i) => i.listId !== id);
    state.todoLists = state.todoLists.filter((l) => l.id !== id);
    database().commit({ table: "todo_lists", type: "DELETE", record: null, old: { id } });
  },
  async addMember(listId, userId) {
    const { user, list } = memberList(listId);
    addListMember(user, list, userId);
  },
  async removeMember(listId, userId) {
    const { user, list } = memberList(listId);
    if (userId === list.ownerId || (userId !== user.id && list.ownerId !== user.id)) {
      throw new AppError("No puedes sacar a esta persona de la lista.");
    }
    list.memberIds = list.memberIds.filter((id) => id !== userId);
    database().commit({ table: "todo_list_members", type: "DELETE", record: null, old: { list_id: listId, user_id: userId } });
  },

  async saveItem(input) {
    const state = database().state;
    const existing = input.id ? memberItem(input.id) : null;
    const { user, list } = existing ?? memberList(input.listId);
    const parentId = input.parentId !== undefined ? input.parentId : existing?.item.parentId ?? null;
    if (parentId && (!existing || parentId !== existing.item.parentId)) {
      const parent = state.todoItems.find((i) => i.id === parentId);
      if (!parent || parent.listId !== list.id) throw new AppError("La subtarea debe ser de la misma lista.");
      if (parent.parentId) throw new AppError("Una subtarea no puede tener subtareas.");
    }
    if (input.assigneeId && input.assigneeId !== existing?.item.assigneeId && !list.memberIds.includes(input.assigneeId)) {
      throw new AppError("Sólo se puede asignar a alguien de la lista.");
    }
    const patch: Partial<TodoItem> = { parentId };
    if (input.title !== undefined) patch.title = textOf(input.title, 300, "la tarea");
    if (input.description !== undefined) patch.description = input.description.slice(0, 4000);
    if (input.dueOn !== undefined) patch.dueOn = input.dueOn || null;
    if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId;
    if (existing) {
      const before = { ...existing.item };
      Object.assign(existing.item, patch);
      database().commit({ table: "todo_items", type: "UPDATE", record: existing.item as never });
      if (patch.assigneeId && patch.assigneeId !== before.assigneeId && patch.assigneeId !== user.id) {
        notifyList(user, list, `👉 Te asignó: ${existing.item.title}`, patch.assigneeId);
      }
      return clone(existing.item);
    }
    const item: TodoItem = {
      id: uuid(), listId: list.id, parentId, title: patch.title ?? textOf("", 1, "la tarea"),
      description: patch.description ?? "", dueOn: patch.dueOn ?? null, assigneeId: patch.assigneeId ?? null,
      doneAt: null, doneBy: null, position: Date.now() / 1000, createdBy: user.id, createdAt: nowIso(),
    };
    state.todoItems.push(item);
    database().commit({ table: "todo_items", type: "INSERT", record: item as never });
    if (!parentId) notifyList(user, list, `➕ ${item.title}`);
    if (item.assigneeId && item.assigneeId !== user.id) notifyList(user, list, `👉 Te asignó: ${item.title}`, item.assigneeId);
    return clone(item);
  },
  async setItemDone(id, done) {
    const { user, list, item } = memberItem(id);
    if (!!item.doneAt === done) return;
    item.doneAt = done ? nowIso() : null;
    item.doneBy = done ? user.id : null;
    database().commit({ table: "todo_items", type: "UPDATE", record: item as never });
    if (done && !item.parentId) notifyList(user, list, `✅ ${item.title}`);
  },
  async deleteItem(id) {
    memberItem(id);
    const state = database().state;
    const ids = new Set([id, ...state.todoItems.filter((i) => i.parentId === id).map((i) => i.id)]);
    dropImages(state.todoImages.filter((i) => ids.has(i.itemId)));
    state.todoImages = state.todoImages.filter((i) => !ids.has(i.itemId));
    state.todoMaterials = state.todoMaterials.filter((m) => !ids.has(m.itemId));
    state.todoItems = state.todoItems.filter((i) => !ids.has(i.id));
    database().commit({ table: "todo_items", type: "DELETE", record: null, old: { id } });
  },

  async saveMaterial(input) {
    const state = database().state;
    const existing = input.id ? state.todoMaterials.find((m) => m.id === input.id) : undefined;
    if (input.id && !existing) throw new AppError("Este material ya no existe.");
    memberItem(existing?.itemId ?? input.itemId);
    const patch: Partial<TodoMaterial> = {};
    if (input.name !== undefined) patch.name = textOf(input.name, 120, "el material");
    if (input.quantity !== undefined) patch.quantity = input.quantity.trim().slice(0, 40);
    if (input.isReady !== undefined) patch.isReady = input.isReady;
    if (existing) {
      Object.assign(existing, patch);
      database().commit({ table: "todo_materials", type: "UPDATE", record: existing as never });
      return clone(existing);
    }
    const material: TodoMaterial = {
      id: uuid(), itemId: input.itemId, name: patch.name ?? textOf("", 1, "el material"),
      quantity: patch.quantity ?? "", isReady: patch.isReady ?? false, position: Date.now() / 1000,
    };
    state.todoMaterials.push(material);
    database().commit({ table: "todo_materials", type: "INSERT", record: material as never });
    return clone(material);
  },
  async deleteMaterial(id) {
    const state = database().state;
    const material = state.todoMaterials.find((m) => m.id === id);
    if (!material) return;
    memberItem(material.itemId);
    state.todoMaterials = state.todoMaterials.filter((m) => m.id !== id);
    database().commit({ table: "todo_materials", type: "DELETE", record: null, old: { id } });
  },

  async addImage(listId, itemId, image) {
    const { user, item } = memberItem(itemId);
    if (item.listId !== listId) throw new AppError("La foto debe estar en la carpeta de su lista.");
    const state = database().state;
    if (state.todoImages.filter((i) => i.itemId === itemId).length >= MAX_TASK_IMAGES) {
      throw new AppError(`Máximo ${MAX_TASK_IMAGES} fotos por tarea.`);
    }
    const id = uuid();
    const path = `lists/${listId}/${id}.${image.extension}`;
    const thumbPath = `lists/${listId}/${id}.thumb.${image.extension}`;
    await idbSet(path, image.full);
    await idbSet(thumbPath, image.thumb);
    const saved: TodoImage = {
      id, itemId, listId, path, thumbPath, width: image.width, height: image.height, createdBy: user.id, createdAt: nowIso(),
    };
    // Tras las esperas se releen los datos por si otra pestaña escribió.
    database().state.todoImages.push(saved);
    database().commit({ table: "todo_item_images", type: "INSERT", record: saved as never });
    return clone(saved);
  },
  async deleteImage(image) {
    memberList(image.listId);
    const state = database().state;
    dropImages(state.todoImages.filter((i) => i.id === image.id));
    state.todoImages = state.todoImages.filter((i) => i.id !== image.id);
    database().commit({ table: "todo_item_images", type: "DELETE", record: null, old: { id: image.id } });
  },
  async resolveImages(paths) {
    require(PERMISSIONS.listsUse);
    return localImageUrls(paths);
  },
};

export const demoBackend: Backend = {
  mode: "demo",

  auth: {
    getSession: async () => {
      const u = sessionUser();
      return u ? { id: u.id, email: u.email } : null;
    },
    onChange(listener) {
      authListeners.add(listener);
      return () => authListeners.delete(listener);
    },
    async signInWithPassword(email, password) {
      const user = database().state.users.find((u) => u.email === email.trim().toLowerCase());
      if (!user || user.password !== password) throw new Error("Invalid login credentials");
      if (!user.isActive) throw new AppError("Esta cuenta está desactivada.");
      setSession(user);
    },
    async sendMagicLink() {
      throw new AppError("En el modo demo usa la contraseña: demo1234");
    },
    async sendPasswordReset() {
      throw new AppError("En el modo demo no se envían correos: pide el enlace en Administración → Usuarios.");
    },
    async verifyRecovery(tokenHash) {
      const state = database().state;
      const now = nowIso();
      const recovery = state.recoveries.find((r) => r.tokenHash === tokenHash && r.expiresAt > now);
      state.recoveries = state.recoveries.filter((r) => r !== recovery && r.expiresAt > now);
      database().commit({ table: "site_settings", type: "UPDATE", record: null });
      const user = state.users.find((u) => u.id === recovery?.userId && u.isActive);
      if (!user) throw new AppError("Este enlace ya no es válido. Pide uno nuevo.");
      setSession(user);
    },
    async updatePassword(password) {
      requireUser().password = password;
      database().commit({ table: "site_settings", type: "UPDATE", record: null });
    },
    async signOut() {
      setSession(null);
    },
  },

  content: {
    getSettings: async () => delay(clone(database().state.settings)),
    async updateSettings(patch) {
      const user = requireUser();
      const policy = policyOf(user);
      if ((patch.theme || patch.effects) && !policy.can(PERMISSIONS.themeManage)) throw new AppError("No tienes permiso para cambiar el tema.");
      const { theme: _t, effects: _e, ...rest } = patch;
      if (Object.keys(rest).length && !policy.can(PERMISSIONS.settingsManage)) throw new AppError("No tienes permiso para cambiar la configuración.");
      const state = database().state;
      const old = state.settings;
      state.settings = { ...old, ...patch, updatedAt: nowIso() };
      audit("UPDATE", "site_settings", "1", old, state.settings);
      database().commit({ table: "site_settings", type: "UPDATE", record: state.settings as never });
      return clone(state.settings);
    },

    async listSections() {
      const policy = policyOf(sessionUser());
      const all = [...database().state.sections].sort((a, b) => a.position - b.position);
      if (policy.canAny(PERMISSIONS.contentEdit, PERMISSIONS.sectionsManage)) return delay(clone(all));
      return delay(canViewSite() ? clone(all.filter((s) => s.isVisible)) : []);
    },
    async saveSection(section) {
      const user = require(PERMISSIONS.contentEdit, PERMISSIONS.sectionsManage);
      if (!policyOf(user).can(PERMISSIONS.sectionsManage)) {
        const old = database().state.sections.find((s) => s.id === section.id);
        if (!old || old.kind !== section.kind || old.position !== section.position || old.isVisible !== section.isVisible) {
          throw new AppError("Sólo quien gestiona secciones puede crearlas, moverlas u ocultarlas.");
        }
      }
      return upsertIn<Section>("sections", section);
    },
    async deleteSection(id) {
      require(PERMISSIONS.sectionsManage);
      removeFrom("sections", id);
    },

    listMilestones: async () =>
      delay(canViewSite() ? clone([...database().state.milestones].sort((a, b) => a.happenedOn.localeCompare(b.happenedOn) || a.position - b.position)) : []),
    async saveMilestone(m) {
      require(PERMISSIONS.contentEdit);
      return upsertIn<Milestone>("milestones", m);
    },
    async deleteMilestone(id) {
      require(PERMISSIONS.contentEdit);
      removeFrom("milestones", id);
    },

    async listDates() {
      const manage = policyOf(sessionUser()).can(PERMISSIONS.datesManage);
      const all = database().state.dates;
      return delay(clone(manage ? all : canViewSite() ? all.filter((d) => d.isVisible) : []));
    },
    async saveDate(d) {
      require(PERMISSIONS.datesManage);
      return upsertIn<ImportantDate>("dates", d);
    },
    async deleteDate(id) {
      require(PERMISSIONS.datesManage);
      removeFrom("dates", id);
    },

    async listInterruptions(scope) {
      const all = database().state.interruptions;
      if (scope === "all") {
        require(PERMISSIONS.interruptionsManage);
        return clone(all);
      }
      const now = Date.now();
      return canViewSite()
        ? clone(all.filter((i) => i.isActive && Date.parse(i.startsAt) <= now && (!i.endsAt || Date.parse(i.endsAt) > now)))
        : [];
    },
    async saveInterruption(i) {
      const author = require(PERMISSIONS.interruptionsManage);
      const saved = upsertIn<Interruption>("interruptions", i);
      const now = Date.now();
      const live = saved.isActive && new Date(saved.startsAt).getTime() <= now && (!saved.endsAt || new Date(saved.endsAt).getTime() > now);
      if (!i.id && live) {
        for (const other of database().state.users) {
          if (other.id !== author.id && other.isActive && policyOf(other).can(PERMISSIONS.siteView)) {
            notify(other.id, "system", `${author.displayName} te dejó una sorpresa 🎁`, saved.title, "/");
          }
        }
      }
      return saved;
    },
    async deleteInterruption(id) {
      require(PERMISSIONS.interruptionsManage);
      removeFrom("interruptions", id);
    },
    async markInterruptionSeen(id) {
      const user = sessionUser();
      if (!user) return;
      const views = (database().state.interruptionViews[user.id] ??= []);
      if (!views.includes(id)) views.push(id);
      database().commit({ table: "interruptions", type: "UPDATE", record: null });
    },
    listSeenInterruptions: async () => {
      const user = sessionUser();
      return user ? [...(database().state.interruptionViews[user.id] ?? [])] : [];
    },

    async reorder(table, orderedIds) {
      const permission = { sections: PERMISSIONS.sectionsManage, photos: PERMISSIONS.photosManage, milestones: PERMISSIONS.contentEdit }[table];
      require(permission);
      const list = database().state[table] as Array<{ id: Uuid; position: number }>;
      orderedIds.forEach((id, index) => {
        const item = list.find((x) => x.id === id);
        if (item) item.position = index;
      });
      audit("UPDATE", table, null, null, { order: orderedIds });
      database().commit({ table, type: "UPDATE", record: null });
    },
  },

  photos: {
    list: async () =>
      delay(canViewSite() ? clone([...database().state.photos].sort((a, b) => a.takenOn.localeCompare(b.takenOn) || a.position - b.position)) : []),
    async save(photo) {
      require(PERMISSIONS.photosManage);
      return upsertIn<Photo>("photos", { createdAt: nowIso(), ...photo });
    },
    async delete(photo) {
      require(PERMISSIONS.photosManage);
      removeFrom("photos", photo.id);
      for (const path of [photo.storagePath, photo.thumbPath]) {
        if (path) await idbDel(path).catch(() => undefined);
      }
    },
    async upload(full, thumb, extension) {
      require(PERMISSIONS.photosManage);
      const id = uuid();
      const storagePath = `demo/${id}.${extension}`;
      const thumbPath = `demo/${id}.thumb.${extension}`;
      await idbSet(storagePath, full);
      await idbSet(thumbPath, thumb);
      return { storagePath, thumbPath };
    },
    async resolveUrls(photos) {
      const result = new Map<Uuid, PhotoUrls>();
      const urlFor = async (path: string) => {
        let url = objectUrls.get(path);
        if (!url) {
          const blob = await idbGet<Blob>(path);
          if (!blob) return null;
          url = URL.createObjectURL(blob);
          objectUrls.set(path, url);
        }
        return url;
      };
      await Promise.all(photos.map(async (p) => {
        if (p.externalUrl) return void result.set(p.id, { full: p.externalUrl, thumb: p.externalUrl });
        if (!p.storagePath) return;
        const full = await urlFor(p.storagePath);
        const thumb = p.thumbPath ? await urlFor(p.thumbPath) : full;
        if (full) result.set(p.id, { full, thumb: thumb ?? full });
      }));
      return result;
    },
  },

  messaging: {
    async listNotes() {
      const user = requireUser();
      return clone(database().state.notes.filter((n) => n.senderId === user.id || n.recipientId === user.id));
    },
    async sendNote({ recipientId, kind, title, body }) {
      const user = require(PERMISSIONS.notesSend);
      if (recipientId === user.id) throw new AppError("No puedes enviarte una notita a ti mismo.");
      const note: Note = { id: uuid(), senderId: user.id, recipientId, kind, title, body, readAt: null, createdAt: nowIso() };
      database().state.notes.unshift(note);
      database().commit({ table: "notes", type: "INSERT", record: note as never });
      notify(recipientId, "note", `${user.displayName} ${NOTE_TITLES[kind]}`, title || body, "/mensajes");
      return clone(note);
    },
    async markNoteRead(id) {
      const user = requireUser();
      const note = database().state.notes.find((n) => n.id === id && n.recipientId === user.id);
      if (note && !note.readAt) {
        note.readAt = nowIso();
        database().commit({ table: "notes", type: "UPDATE", record: note as never });
      }
    },
    async deleteNote(id) {
      const user = requireUser();
      const state = database().state;
      state.notes = state.notes.filter((n) => !(n.id === id && (n.senderId === user.id || n.recipientId === user.id)));
      database().commit({ table: "notes", type: "DELETE", record: null, old: { id } });
    },

    async listChat({ before, limit = 50 } = {}) {
      require(PERMISSIONS.chatUse);
      const all = database().state.chat.filter((m) => !before || m.createdAt < before);
      // Mensajes guardados antes de que existieran las respuestas.
      return clone(all.slice(-limit)).map((m) => ({
        ...m, kind: m.kind ?? "text", image: m.image ?? null, sticker: m.sticker ?? null, replyTo: m.replyTo ?? null,
      }));
    },
    async resolveChatImages(paths) {
      require(PERMISSIONS.chatUse);
      return localImageUrls(paths);
    },
    async sendChat(body, { replyToId = null, image, sticker } = {}) {
      const user = require(PERMISSIONS.chatUse);
      const original = replyToId ? database().state.chat.find((m) => m.id === replyToId) : undefined;
      if (replyToId && !original) throw new AppError("El mensaje al que respondes ya no existe.");
      if (sticker && !isKnownSticker(sticker)) throw new AppError("Ese sticker no existe.");
      const text = sticker ? "" : body.trim().slice(0, 2000);
      if (!image && !sticker && !text) throw new AppError("Escribe un mensaje.");
      const id = uuid();
      let chatImage: ChatImage | null = null;
      if (image) {
        const path = `chat/${user.id}/${id}.${image.extension}`;
        const thumbPath = `chat/${user.id}/${id}.thumb.${image.extension}`;
        await idbSet(path, image.full);
        await idbSet(thumbPath, image.thumb);
        chatImage = { path, thumbPath, width: image.width, height: image.height };
      }
      const message: ChatMessage = {
        id, senderId: user.id, kind: image ? "image" : sticker ? "sticker" : "text", body: text,
        image: chatImage, sticker: sticker ?? null, createdAt: nowIso(),
        replyTo: original
          ? { id: original.id, senderId: original.senderId, body: original.body, kind: original.kind ?? "text", sticker: original.sticker ?? null }
          : null,
      };
      // Tras subir la foto se releen los datos por si otra pestaña escribió.
      const state = database().state;
      state.chat.push(message);
      state.chat = state.chat.slice(-1000);
      database().commit({ table: "chat_messages", type: "INSERT", record: message as never });
      // Igual que la base de datos: si ya hay un aviso de chat sin leer se
      // actualiza con el último mensaje en vez de crear otro.
      for (const other of state.users) {
        if (other.id === user.id || !other.isActive || !policyOf(other).can(PERMISSIONS.chatUse)) continue;
        const title = `${user.displayName} te escribió 💬`;
        const preview = messagePreview(message, 140);
        const unread = state.notifications.find((n) => n.userId === other.id && n.kind === "chat" && !n.readAt);
        if (unread) {
          Object.assign(unread, { title, body: preview, createdAt: nowIso() });
          database().commit({ table: "notifications", type: "UPDATE", record: unread as never });
        } else {
          notify(other.id, "chat", title, preview, "/chat");
        }
      }
      return clone(message);
    },
    async deleteChat(id) {
      const user = requireUser();
      const state = database().state;
      const deleted = state.chat.some((m) => m.id === id && m.senderId === user.id);
      state.chat = state.chat
        .filter((m) => !(m.id === id && m.senderId === user.id))
        // Como en la base: las respuestas a un mensaje borrado pierden la cita.
        .map((m) => (deleted && m.replyTo?.id === id ? { ...m, replyTo: null } : m));
      database().commit({ table: "chat_messages", type: "DELETE", record: null, old: { id } });
    },
    async listChatPresence() {
      require(PERMISSIONS.chatUse);
      return clone(database().state.chatReads);
    },
    async touchChatPresence({ read = false } = {}) {
      const user = require(PERMISSIONS.chatUse);
      const state = database().state;
      const now = nowIso();
      const previous = state.chatReads.find((p) => p.userId === user.id);
      const presence: ChatPresence = { userId: user.id, lastSeenAt: now, lastReadAt: read ? now : previous?.lastReadAt ?? null };
      state.chatReads = upsertPresence(state.chatReads, presence);
      database().commit({ table: "chat_reads", type: previous ? "UPDATE" : "INSERT", record: presence as never });
    },

    async listNotifications(limit = 30) {
      const user = requireUser();
      return clone(database().state.notifications.filter((n) => n.userId === user.id).slice(0, limit));
    },
    async markNotificationRead(id) {
      const user = requireUser();
      const n = database().state.notifications.find((x) => x.id === id && x.userId === user.id);
      if (n && !n.readAt) {
        n.readAt = nowIso();
        database().commit({ table: "notifications", type: "UPDATE", record: n as never });
      }
    },
    async sendTestNotification() {
      const user = requireUser();
      const recent = database().state.notifications.some(
        (n) => n.userId === user.id && n.link === "/cuenta" && Date.now() - new Date(n.createdAt).getTime() < 60_000,
      );
      if (recent) throw new AppError("Espera un minuto antes de probar otra vez.");
      notify(user.id, "system", "Así te llegarán los avisos 💖", "Si ves esto en tu celular, ya quedaron activados.", "/cuenta");
    },
    async markAllNotificationsRead(kind) {
      const user = requireUser();
      database().state.notifications
        .filter((n) => n.userId === user.id && !n.readAt && (!kind || n.kind === kind))
        .forEach((n) => (n.readAt = nowIso()));
      database().commit({ table: "notifications", type: "UPDATE", record: null });
    },
  },

  lists: demoLists,

  users: {
    async getProfile(id) {
      const u = database().state.users.find((x) => x.id === id);
      return u ? toProfile(u) : null;
    },
    async listProfiles() {
      requireUser();
      return database().state.users.map(toProfile);
    },
    async updateProfile(id, patch) {
      const actor = requireUser();
      const state = database().state;
      const user = state.users.find((u) => u.id === id);
      if (!user) throw new AppError("Usuario no encontrado.");
      const changesAccess = (patch.role !== undefined && patch.role !== user.role) || (patch.isActive !== undefined && patch.isActive !== user.isActive);
      if (changesAccess && !policyOf(actor).can(PERMISSIONS.usersManage)) throw new AppError("No tienes permiso para cambiar roles o estados.");
      if (!changesAccess && actor.id !== id && !policyOf(actor).can(PERMISSIONS.usersManage)) throw new AppError("No tienes permiso para hacer esto.");
      const losesSuper = user.role === "super_admin" && user.isActive && (patch.role && patch.role !== "super_admin" || patch.isActive === false);
      if (losesSuper && !state.users.some((u) => u.id !== id && u.role === "super_admin" && u.isActive)) {
        throw new AppError("Debe quedar al menos un super administrador activo.");
      }
      const old = toProfile(user);
      Object.assign(user, patch);
      audit("UPDATE", "profiles", id, old, toProfile(user));
      database().commit({ table: "site_settings", type: "UPDATE", record: null });
      return toProfile(user);
    },
    async updateMyColors(colors) {
      const actor = requireUser();
      const user = database().state.users.find((u) => u.id === actor.id);
      if (!user) throw new AppError("Usuario no encontrado.");
      const old = toProfile(user);
      user.themeColors = sanitizeColors(colors);
      audit("UPDATE", "profiles", user.id, old, toProfile(user));
      database().commit({ table: "site_settings", type: "UPDATE", record: null });
      return toProfile(user);
    },
    async myPermissions() {
      const user = sessionUser();
      if (!user) return [];
      const policy = policyOf(user);
      return Object.values(PERMISSIONS).filter((p) => policy.can(p));
    },
    async listPermissions(): Promise<PermissionDefinition[]> {
      return Object.values(PERMISSIONS).map((key) => ({ key, description: PERMISSION_DESCRIPTIONS[key] }));
    },
    async listRolePermissions() {
      return clone(database().state.rolePermissions);
    },
    async setRolePermission(role, permission, granted) {
      require(PERMISSIONS.usersManage);
      const state = database().state;
      state.rolePermissions = state.rolePermissions.filter((rp) => !(rp.role === role && rp.permission === permission));
      if (granted) state.rolePermissions.push({ role, permission });
      audit(granted ? "INSERT" : "DELETE", "role_permissions", role, null, { role, permission });
      database().commit({ table: "site_settings", type: "UPDATE", record: null });
    },
    async createUser({ email, displayName, role, password }) {
      require(PERMISSIONS.usersManage);
      const state = database().state;
      const normalized = email.trim().toLowerCase();
      if (state.users.some((u) => u.email === normalized)) throw new AppError("Ya existe un usuario con ese correo.");
      const user: DemoUser = {
        id: uuid(), email: normalized, password: password || "demo1234", displayName, role,
        isActive: true, avatarUrl: null, createdAt: nowIso(), themeColors: null,
      };
      state.users.push(user);
      audit("INSERT", "profiles", user.id, null, toProfile(user));
      database().commit({ table: "site_settings", type: "UPDATE", record: null });
    },
    async deleteUser(id) {
      const actor = require(PERMISSIONS.usersManage);
      if (actor.id === id) throw new AppError("No puedes eliminar tu propia cuenta.");
      const state = database().state;
      const user = state.users.find((u) => u.id === id);
      if (user?.role === "super_admin" && !state.users.some((u) => u.id !== id && u.role === "super_admin" && u.isActive)) {
        throw new AppError("Debe quedar al menos un super administrador activo.");
      }
      state.users = state.users.filter((u) => u.id !== id);
      audit("DELETE", "profiles", id, user ? toProfile(user) : null, null);
      database().commit({ table: "site_settings", type: "UPDATE", record: null });
    },
    async createRecoveryLink(id) {
      require(PERMISSIONS.usersManage);
      if (!database().state.users.some((u) => u.id === id)) throw new AppError("Ese usuario no existe.");
      const tokenHash = generateInviteToken();
      database().state.recoveries.push({ tokenHash, userId: id, expiresAt: expiryFromNow(RECOVERY_LINK_HOURS) });
      database().commit({ table: "site_settings", type: "UPDATE", record: null });
      return tokenHash;
    },
    async listAudit({ page, pageSize, table }) {
      require(PERMISSIONS.auditView);
      const rows = database().state.audit.filter((a) => !table || a.tableName === table);
      return clone(rows.slice(page * pageSize, (page + 1) * pageSize));
    },
  },

  invitations: {
    async list() {
      require(PERMISSIONS.usersManage);
      return clone(database().state.invitations.map(({ tokenHash: _hash, ...rest }) => rest))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async create({ role, note, expiresInHours }) {
      require(PERMISSIONS.usersManage);
      const token = generateInviteToken();
      const invitation: DemoInvitation = {
        id: uuid(), role, note: note.trim().slice(0, 80), createdAt: nowIso(),
        expiresAt: expiryFromNow(expiresInHours), usedAt: null, tokenHash: await hashInviteToken(token),
      };
      database().state.invitations.push(invitation);
      audit("INSERT", "invitations", invitation.id, null, { role, note: invitation.note });
      database().commit({ table: "site_settings", type: "UPDATE", record: null });
      const { tokenHash: _hash, ...visible } = invitation;
      return { invitation: visible, token };
    },
    async revoke(id) {
      require(PERMISSIONS.usersManage);
      const state = database().state;
      state.invitations = state.invitations.filter((i) => i.id !== id);
      audit("DELETE", "invitations", id, null, null);
      database().commit({ table: "site_settings", type: "UPDATE", record: null });
    },
    async check(token) {
      const invitation = await findPendingInvitation(token);
      return invitation ? { valid: true, role: invitation.role } : { valid: false };
    },
    async redeem({ token, email, password, displayName }) {
      const invitation = await findPendingInvitation(token);
      if (!invitation) throw new AppError("Este enlace ya no es válido. Pide uno nuevo.");
      const state = database().state;
      const normalized = email.trim().toLowerCase();
      if (state.users.some((u) => u.email === normalized)) throw new AppError("Ya existe una cuenta con ese correo.");
      if (password.length < MIN_PASSWORD_LENGTH) throw new AppError(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      const user: DemoUser = {
        id: uuid(), email: normalized, password, displayName: displayName.trim().slice(0, 80), role: invitation.role,
        isActive: true, avatarUrl: null, createdAt: nowIso(), themeColors: null,
      };
      state.users.push(user);
      invitation.usedAt = nowIso();
      audit("INSERT", "profiles", user.id, null, toProfile(user));
      database().commit({ table: "site_settings", type: "UPDATE", record: null });
    },
  },

  realtime: {
    subscribe(tables, listener) {
      return database().subscribe((change) => {
        if (tables.includes(change.table)) listener(change);
      });
    },
  },

  push: {
    async register() {
      /* En demo no hay servidor de push: sólo notificaciones locales. */
    },
    async unregister() {
      /* nada que hacer */
    },
  },
};

function toProfile(u: DemoUser): Profile {
  return {
    id: u.id, displayName: u.displayName, avatarUrl: u.avatarUrl, role: u.role, isActive: u.isActive, createdAt: u.createdAt,
    themeColors: sanitizeColors(u.themeColors),
  };
}
