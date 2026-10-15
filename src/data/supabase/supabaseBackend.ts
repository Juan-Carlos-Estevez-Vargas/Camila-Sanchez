import type {
  AuthGateway, Backend, ContentRepository, MessagingRepository, PhotoRepository, PushRepository,
  RealtimeChange, RealtimeGateway, RealtimeTable, UserRepository,
} from "@/data/ports";
import type { PhotoUrls, SessionUser, Uuid } from "@/domain/types";
import { getSupabase, unwrap, type Row } from "./client";
import * as map from "./mappers";

const PHOTO_BUCKET = "photos";
/** Las URLs firmadas duran 1 h; se cachean 50 min para reutilizarlas. */
const SIGNED_URL_TTL_S = 3600;
const SIGNED_URL_CACHE_MS = 50 * 60 * 1000;

const sb = () => getSupabase();

const toSessionUser = (user: { id: string; email?: string | undefined } | null | undefined): SessionUser | null =>
  user ? { id: user.id, email: user.email ?? "" } : null;

const redirectTo = (path: string) => `${window.location.origin}${path}`;

const auth: AuthGateway = {
  async getSession() {
    const { data } = await sb().auth.getSession();
    return toSessionUser(data.session?.user);
  },
  onChange(listener) {
    const { data } = sb().auth.onAuthStateChange((_event, session) => listener(toSessionUser(session?.user)));
    return () => data.subscription.unsubscribe();
  },
  async signInWithPassword(email, password) {
    await unwrap(sb().auth.signInWithPassword({ email, password }));
  },
  async sendMagicLink(email) {
    // shouldCreateUser: false → un enlace mágico nunca crea cuentas nuevas.
    await unwrap(sb().auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo("/") } }));
  },
  async sendPasswordReset(email) {
    await unwrap(sb().auth.resetPasswordForEmail(email, { redirectTo: redirectTo("/entrar?recuperar=1") }));
  },
  async updatePassword(password) {
    await unwrap(sb().auth.updateUser({ password }));
  },
  async signOut() {
    await sb().auth.signOut();
  },
};

/** Inserta o actualiza una fila y devuelve la fila resultante mapeada. */
async function upsert<T>(table: string, row: Row, mapper: (r: Row) => T): Promise<T> {
  const query = row.id
    ? sb().from(table).update(row).eq("id", row.id as string).select().single()
    : sb().from(table).insert(row).select().single();
  return mapper(await unwrap<Row>(query));
}

async function remove(table: string, id: Uuid): Promise<void> {
  await unwrap(sb().from(table).delete().eq("id", id));
}

const content: ContentRepository = {
  async getSettings() {
    return map.toSettings(await unwrap<Row>(sb().from("site_settings").select("*").eq("id", 1).single()));
  },
  async updateSettings(patch) {
    const row = await unwrap<Row>(sb().from("site_settings").update(map.fromSettings(patch)).eq("id", 1).select().single());
    return map.toSettings(row);
  },
  async listSections() {
    const rows = await unwrap<Row[]>(sb().from("sections").select("*").order("position"));
    return rows.map(map.toSection);
  },
  saveSection: (section) => upsert("sections", map.fromSection(section), map.toSection),
  deleteSection: (id) => remove("sections", id),

  async listMilestones() {
    const rows = await unwrap<Row[]>(sb().from("milestones").select("*").order("happened_on").order("position"));
    return rows.map(map.toMilestone);
  },
  saveMilestone: (m) => upsert("milestones", map.fromMilestone(m), map.toMilestone),
  deleteMilestone: (id) => remove("milestones", id),

  async listDates() {
    const rows = await unwrap<Row[]>(sb().from("important_dates").select("*").order("event_date"));
    return rows.map(map.toDate);
  },
  saveDate: (d) => upsert("important_dates", map.fromDate(d), map.toDate),
  deleteDate: (id) => remove("important_dates", id),

  async listInterruptions(scope) {
    let query = sb().from("interruptions").select("*").order("starts_at", { ascending: false });
    if (scope === "active") {
      const now = new Date().toISOString();
      query = query.eq("is_active", true).lte("starts_at", now).or(`ends_at.is.null,ends_at.gt.${now}`);
    }
    return (await unwrap<Row[]>(query)).map(map.toInterruption);
  },
  saveInterruption: (i) => upsert("interruptions", map.fromInterruption(i), map.toInterruption),
  deleteInterruption: (id) => remove("interruptions", id),
  async markInterruptionSeen(id) {
    const { data } = await sb().auth.getSession();
    if (!data.session) return; // los anónimos usan localStorage
    await unwrap(sb().from("interruption_views").upsert({ interruption_id: id }, { ignoreDuplicates: true }));
  },
  async listSeenInterruptions() {
    const { data } = await sb().auth.getSession();
    if (!data.session) return [];
    const rows = await unwrap<Row[]>(sb().from("interruption_views").select("interruption_id"));
    return rows.map((r) => String(r.interruption_id));
  },

  async reorder(table, orderedIds) {
    await unwrap(sb().rpc("reorder_items", { p_table: table, p_ids: orderedIds }));
  },
};

const signedUrlCache = new Map<string, { url: string; expires: number }>();

const photos: PhotoRepository = {
  async list() {
    const rows = await unwrap<Row[]>(sb().from("photos").select("*").order("taken_on").order("position"));
    return rows.map(map.toPhoto);
  },
  save: (photo) => upsert("photos", map.fromPhoto(photo), map.toPhoto),
  async delete(photo) {
    await remove("photos", photo.id);
    const paths = [photo.storagePath, photo.thumbPath].filter((p): p is string => !!p);
    if (paths.length) await unwrap(sb().storage.from(PHOTO_BUCKET).remove(paths));
  },
  async upload(full, thumb, extension) {
    const id = crypto.randomUUID();
    const folder = new Date().toISOString().slice(0, 7); // YYYY-MM
    const storagePath = `${folder}/${id}.${extension}`;
    const thumbPath = `${folder}/${id}.thumb.${extension}`;
    const options = { cacheControl: "31536000", upsert: false, contentType: full.type };
    await unwrap(sb().storage.from(PHOTO_BUCKET).upload(storagePath, full, options));
    await unwrap(sb().storage.from(PHOTO_BUCKET).upload(thumbPath, thumb, { ...options, contentType: thumb.type }));
    return { storagePath, thumbPath };
  },
  async resolveUrls(list) {
    const result = new Map<Uuid, PhotoUrls>();
    const now = Date.now();
    const missing = new Set<string>();
    for (const p of list) {
      for (const path of [p.storagePath, p.thumbPath]) {
        if (path && !((signedUrlCache.get(path)?.expires ?? 0) > now)) missing.add(path);
      }
    }
    if (missing.size) {
      const signed = await unwrap<Array<{ path: string | null; signedUrl: string }>>(
        sb().storage.from(PHOTO_BUCKET).createSignedUrls([...missing], SIGNED_URL_TTL_S),
      );
      for (const s of signed) {
        if (s.path && s.signedUrl) signedUrlCache.set(s.path, { url: s.signedUrl, expires: now + SIGNED_URL_CACHE_MS });
      }
    }
    for (const p of list) {
      if (p.externalUrl) {
        result.set(p.id, { full: p.externalUrl, thumb: p.externalUrl });
      } else if (p.storagePath) {
        const full = signedUrlCache.get(p.storagePath)?.url;
        const thumb = (p.thumbPath && signedUrlCache.get(p.thumbPath)?.url) || full;
        if (full && thumb) result.set(p.id, { full, thumb });
      }
    }
    return result;
  },
};

async function currentUserId(): Promise<Uuid> {
  const { data } = await sb().auth.getSession();
  if (!data.session) throw new Error("No hay sesión");
  return data.session.user.id;
}

const messaging: MessagingRepository = {
  async listNotes() {
    const rows = await unwrap<Row[]>(sb().from("notes").select("*").order("created_at", { ascending: false }).limit(200));
    return rows.map(map.toNote);
  },
  async sendNote(note) {
    const row = await unwrap<Row>(
      sb().from("notes")
        .insert({ recipient_id: note.recipientId, kind: note.kind, title: note.title, body: note.body })
        .select().single(),
    );
    return map.toNote(row);
  },
  async markNoteRead(id) {
    await unwrap(sb().from("notes").update({ read_at: new Date().toISOString() }).eq("id", id).is("read_at", null));
  },
  deleteNote: (id) => remove("notes", id),

  async listChat({ before, limit = 50 } = {}) {
    let query = sb().from("chat_messages").select("*").order("created_at", { ascending: false }).limit(limit);
    if (before) query = query.lt("created_at", before);
    const rows = await unwrap<Row[]>(query);
    return rows.map(map.toChatMessage).reverse();
  },
  async sendChat(body) {
    return map.toChatMessage(await unwrap<Row>(sb().from("chat_messages").insert({ body }).select().single()));
  },
  deleteChat: (id) => remove("chat_messages", id),

  async listNotifications(limit = 30) {
    const userId = await currentUserId();
    const rows = await unwrap<Row[]>(
      sb().from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(limit),
    );
    return rows.map(map.toNotification);
  },
  async markNotificationRead(id) {
    await unwrap(sb().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id));
  },
  async markAllNotificationsRead(kind) {
    await unwrap(sb().rpc("mark_notifications_read", { p_kind: kind ?? null }));
  },
};

/** Llama a la Edge Function admin-users (usa la service role en el servidor). */
async function adminUsers(body: Record<string, unknown>): Promise<void> {
  const { data, error } = await sb().functions.invoke<{ error?: string }>("admin-users", { body });
  if (error) throw new Error(error.message, { cause: error });
  if (data?.error) throw new Error(data.error);
}

const users: UserRepository = {
  async getProfile(id) {
    const row = await unwrap<Row | null>(sb().from("profiles").select("*").eq("id", id).maybeSingle());
    return row ? map.toProfile(row) : null;
  },
  async listProfiles() {
    return (await unwrap<Row[]>(sb().from("profiles").select("*").order("created_at"))).map(map.toProfile);
  },
  async updateProfile(id, patch) {
    const row: Row = {};
    if (patch.displayName !== undefined) row.display_name = patch.displayName;
    if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
    if (patch.role !== undefined) row.role = patch.role;
    if (patch.isActive !== undefined) row.is_active = patch.isActive;
    const updated = await unwrap<Row>(sb().from("profiles").update(row).eq("id", id).select().single());
    if (patch.isActive !== undefined) await adminUsers({ action: "set_active", userId: id, active: patch.isActive });
    return map.toProfile(updated);
  },
  async myPermissions() {
    const rows = await unwrap<string[] | Array<{ my_permissions: string }>>(sb().rpc("my_permissions"));
    return rows.map((r) => (typeof r === "string" ? r : r.my_permissions));
  },
  async listPermissions() {
    const rows = await unwrap<Row[]>(sb().from("permissions").select("*").order("key"));
    return rows.map((r) => ({ key: String(r.key), description: String(r.description) }));
  },
  async listRolePermissions() {
    const rows = await unwrap<Row[]>(sb().from("role_permissions").select("*"));
    return rows.map((r) => ({ role: r.role as never, permission: String(r.permission) }));
  },
  async setRolePermission(role, permission, granted) {
    await unwrap(
      granted
        ? sb().from("role_permissions").upsert({ role, permission }, { ignoreDuplicates: true })
        : sb().from("role_permissions").delete().eq("role", role).eq("permission", permission),
    );
  },
  createUser: (input) => adminUsers({ action: input.password ? "create" : "invite", ...input, redirectTo: redirectTo("/entrar") }),
  deleteUser: (id) => adminUsers({ action: "delete", userId: id }),
  async listAudit({ page, pageSize, table }) {
    let query = sb().from("audit_log").select("*").order("created_at", { ascending: false })
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (table) query = query.eq("table_name", table);
    return (await unwrap<Row[]>(query)).map(map.toAudit);
  },
};

let channelSeq = 0;

const realtime: RealtimeGateway = {
  subscribe(tables: RealtimeTable[], listener: (change: RealtimeChange) => void) {
    const channel = sb().channel(`app-${++channelSeq}`);
    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
        listener({
          table,
          type: payload.eventType,
          record: Object.keys(payload.new ?? {}).length ? (payload.new as Row) : null,
          old: Object.keys(payload.old ?? {}).length ? (payload.old as Row) : null,
        });
      });
    }
    channel.subscribe();
    return () => void sb().removeChannel(channel);
  },
};

const push: PushRepository = {
  async register(s) {
    await unwrap(
      sb().from("push_subscriptions").upsert(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, user_agent: s.userAgent },
        { onConflict: "endpoint" },
      ),
    );
  },
  async unregister(endpoint) {
    await unwrap(sb().from("push_subscriptions").delete().eq("endpoint", endpoint));
  },
};

export const supabaseBackend: Backend = {
  mode: "supabase",
  auth,
  content,
  photos,
  messaging,
  users,
  realtime,
  push,
};
