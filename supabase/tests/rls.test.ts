/**
 * Pruebas de seguridad de la base de datos.
 *
 * Levanta un Postgres real en memoria (PGlite), aplica todas las migraciones
 * y el seed sobre un esquema mínimo que imita a Supabase (auth.uid(),
 * auth.users, storage, publicación realtime) y comprueba que las políticas
 * RLS y los triggers impiden lo que deben impedir.
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { SUPABASE_STUB } from "./supabaseStub";

const ROOT = join(__dirname, "..");
const JUAN = "11111111-1111-1111-1111-111111111111";
const CAMI = "22222222-2222-2222-2222-222222222222";
const GUEST = "33333333-3333-3333-3333-333333333333";

let db: PGlite;

/** Ejecuta SQL como un usuario concreto (o anónimo) dentro de una transacción. */
async function as<T = Record<string, unknown>>(uid: string | null, sql: string): Promise<T[]> {
  await db.exec(
    `begin; set local role ${uid ? "authenticated" : "anon"};
     select set_config('request.jwt.sub', '${uid ?? ""}', true);`,
  );
  try {
    const result = await db.query<T>(sql);
    await db.exec("commit");
    return result.rows;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const migrations = readdirSync(join(ROOT, "migrations")).sort();
  for (const file of migrations) {
    await db.exec(readFileSync(join(ROOT, "migrations", file), "utf8"));
  }
  await db.exec(readFileSync(join(ROOT, "seed.sql"), "utf8"));
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to anon, authenticated;
    insert into auth.users (id, email) values
      ('${JUAN}', 'juan@example.com'), ('${CAMI}', 'cami@example.com'), ('${GUEST}', 'guest@example.com');
    update public.profiles set role = 'super_admin', display_name = 'Juan' where id = '${JUAN}';
    update public.profiles set role = 'editor', display_name = 'Camila' where id = '${CAMI}';
  `);
}, 60_000);

describe("visibilidad del sitio", () => {
  it("un anónimo no ve nada mientras el sitio es privado", async () => {
    expect(await as(null, "select count(*)::int as n from sections")).toEqual([{ n: 0 }]);
    expect(await as(null, "select count(*)::int as n from photos")).toEqual([{ n: 0 }]);
  });

  it("un usuario con site.view ve el contenido", async () => {
    const [row] = await as<{ n: number }>(GUEST, "select count(*)::int as n from photos");
    expect(row?.n).toBeGreaterThan(0);
  });
});

describe("roles y escalada de privilegios", () => {
  it("nadie sin users.manage puede cambiar su propio rol", async () => {
    await expect(
      as(CAMI, `update profiles set role = 'super_admin' where id = '${CAMI}'`),
    ).rejects.toThrow(/permiso/);
    await expect(
      as(GUEST, `update profiles set role = 'super_admin' where id = '${GUEST}'`),
    ).rejects.toThrow(/permiso/);
  });

  it("no se puede dejar el sistema sin super administrador", async () => {
    await expect(
      as(JUAN, `update profiles set role = 'viewer' where id = '${JUAN}'`),
    ).rejects.toThrow(/al menos un super administrador/);
  });

  it("un usuario sí puede cambiar su nombre", async () => {
    const rows = await as(GUEST, `update profiles set display_name = 'Invitado' where id = '${GUEST}' returning display_name`);
    expect(rows).toEqual([{ display_name: "Invitado" }]);
  });

  it("los permisos efectivos de la editora son los esperados", async () => {
    const rows = await as<{ p: string }>(CAMI, "select p from my_permissions() p order by p");
    expect(rows.map((r) => r.p)).toEqual([
      "chat.use", "content.edit", "dates.manage", "interruptions.manage",
      "lists.use", "notes.send", "photos.manage", "site.view",
    ]);
  });
});

describe("edición de contenido", () => {
  it("la editora puede cambiar textos pero no ocultar ni reordenar secciones", async () => {
    expect(await as(CAMI, "update sections set title = 'Hola' where kind = 'hero' returning title"))
      .toEqual([{ title: "Hola" }]);
    await expect(as(CAMI, "update sections set is_visible = false where kind = 'hero'"))
      .rejects.toThrow(/gestiona secciones/);
    await expect(
      as(CAMI, "select reorder_items('sections', array(select id from sections))"),
    ).rejects.toThrow(/Permiso insuficiente/);
  });

  it("la editora puede reordenar fotos en una sola llamada", async () => {
    await as(CAMI, "select reorder_items('photos', array(select id from photos order by taken_on desc))");
    const [first] = await as<{ position: number }>(CAMI, "select position from photos order by taken_on desc limit 1");
    expect(first?.position).toBe(0);
  });

  it("la huella de una foto sólo acepta SHA-256 en hexadecimal", async () => {
    const hash = "a".repeat(64);
    const rows = await as(CAMI, `insert into photos (storage_path, source_hash) values ('x/1.webp', '${hash}') returning source_hash`);
    expect(rows).toEqual([{ source_hash: hash }]);
    await expect(as(CAMI, "insert into photos (storage_path, source_hash) values ('x/2.webp', 'no-es-un-hash')"))
      .rejects.toThrow(/source_hash/);
  });

  it("reorder_items rechaza tablas fuera de la lista blanca", async () => {
    await expect(as(JUAN, "select reorder_items('profiles', array[]::uuid[])")).rejects.toThrow(/no permitida/);
  });

  it("sólo theme.manage puede cambiar tipografías y efectos", async () => {
    expect(await as(CAMI, `update site_settings set theme = theme || '{"fontDisplay":"Lora"}' returning id`)).toEqual([]);
    expect(await as(CAMI, `update site_settings set effects = '{"cursorHearts":true}' returning id`)).toEqual([]);
    expect(await as(GUEST, `update site_settings set theme = theme || '{"primary":"#aa0000"}' returning id`)).toEqual([]);
    const rows = await as(JUAN, `update site_settings set theme = theme || '{"primary":"#aa0000","fontDisplay":"Lora"}' returning theme->>'primary' as p`);
    expect(rows).toEqual([{ p: "#aa0000" }]);
  });

  it("la editora ya no cambia los colores de la página", async () => {
    expect(await as(CAMI, `update site_settings set theme = theme || '{"primary":"#123456"}' returning id`)).toEqual([]);
    const [row] = await as<{ p: string }>(JUAN, "select theme->>'primary' as p from site_settings");
    expect(row?.p).toBe("#aa0000");
  });
});

describe("colores por persona", () => {
  it("cada persona guarda sus colores sin tocar los de la página", async () => {
    const rows = await as(CAMI, `update profiles set theme_colors = '{"primary":"#7e4fb5","background":"#f6f0ff"}' where id = '${CAMI}' returning theme_colors->>'primary' as p`);
    expect(rows).toEqual([{ p: "#7e4fb5" }]);
    const [site] = await as<{ p: string }>(JUAN, "select theme->>'primary' as p from site_settings");
    expect(site?.p).toBe("#aa0000");
    expect(await as(CAMI, `update profiles set theme_colors = null where id = '${CAMI}' returning theme_colors`)).toEqual([{ theme_colors: null }]);
  });

  it("nadie cambia los colores de otra persona, ni siquiera el super administrador", async () => {
    expect(await as(GUEST, `update profiles set theme_colors = '{"primary":"#000000"}' where id = '${CAMI}' returning id`)).toEqual([]);
    await expect(as(JUAN, `update profiles set theme_colors = '{"primary":"#000000"}' where id = '${CAMI}'`))
      .rejects.toThrow(/Sólo cada persona/);
  });

  it("sólo acepta colores de la paleta en formato #rrggbb", async () => {
    for (const bad of ['{"primary":"red; background:url(x)"}', '{"fontBody":"#000000"}', '{"primary":"#abc"}', '["#000000"]', '{"primary":1}']) {
      await expect(as(GUEST, `update profiles set theme_colors = '${bad}' where id = '${GUEST}'`)).rejects.toThrow(/theme_colors/);
    }
  });

  it("el permiso theme.palette ya no existe", async () => {
    expect(await as(JUAN, "select key from permissions where key = 'theme.palette'")).toEqual([]);
  });
});

describe("mensajes y notificaciones", () => {
  it("una notita genera una notificación sólo para quien la recibe", async () => {
    await as(JUAN, `insert into notes (recipient_id, kind, body) values ('${CAMI}', 'apology', 'Perdón mi amor')`);
    const notifs = await as<{ title: string }>(CAMI, "select title from notifications where kind = 'note'");
    expect(notifs).toEqual([{ title: "Juan te pide perdón 🥺" }]);
    expect(await as(GUEST, "select count(*)::int as n from notes")).toEqual([{ n: 0 }]);
  });

  it("una notita enviada no se puede alterar, sólo marcar como leída", async () => {
    await expect(as(CAMI, "update notes set body = 'cambiado'")).rejects.toThrow(/no se puede modificar/);
    expect(await as(CAMI, "update notes set read_at = now() returning read_at is not null as read"))
      .toEqual([{ read: true }]);
  });

  it("nadie puede fabricar notificaciones para otro usuario", async () => {
    await expect(
      as(CAMI, `insert into notifications (user_id, kind, title) values ('${JUAN}', 'system', 'falsa')`),
    ).rejects.toThrow(/row-level security/);
  });

  it("un mensaje de chat avisa al resto una sola vez mientras no lo lean", async () => {
    await as(CAMI, "insert into chat_messages (body) values ('te amo')");
    await as(CAMI, "insert into chat_messages (body) values ('mucho')");
    const rows = await as(JUAN, "select count(*)::int as n, max(body) as body from notifications where kind = 'chat'");
    expect(rows).toEqual([{ n: 1, body: "mucho" }]);
  });
});

describe("chat: respuestas, conexión y vistos", () => {
  it("un mensaje puede responder a otro y la cita se suelta si el original se borra", async () => {
    const [original] = await as<{ id: string }>(JUAN, "insert into chat_messages (body) values ('¿cenamos?') returning id");
    const [reply] = await as<{ id: string }>(CAMI, `insert into chat_messages (body, reply_to) values ('¡sí!', '${original!.id}') returning id`);
    await as(JUAN, `delete from chat_messages where id = '${original!.id}'`);
    expect(await as(CAMI, `select reply_to from chat_messages where id = '${reply!.id}'`)).toEqual([{ reply_to: null }]);
  });

  it("chat_presence guarda la conexión y, al leer, hasta dónde leyó", async () => {
    await as(CAMI, "select chat_presence(false)");
    const [seen] = await as<{ seen: boolean; read: string | null }>(CAMI, `select last_seen_at is not null as seen, last_read_at as read from chat_reads where user_id = '${CAMI}'`);
    expect(seen).toEqual({ seen: true, read: null });
    await as(CAMI, "select chat_presence(true)");
    const [read] = await as<{ read: boolean }>(CAMI, `select last_read_at = last_seen_at as read from chat_reads where user_id = '${CAMI}'`);
    expect(read).toEqual({ read: true });
  });

  it("quien usa el chat ve los vistos de los demás, pero nadie los escribe a mano", async () => {
    expect(await as(JUAN, `select count(*)::int as n from chat_reads where user_id = '${CAMI}'`)).toEqual([{ n: 1 }]);
    await expect(
      as(JUAN, `insert into chat_reads (user_id, last_read_at) values ('${JUAN}', now() + interval '1 day')`),
    ).rejects.toThrow(/row-level security/);
    const updated = await as(JUAN, `update chat_reads set last_read_at = now() - interval '1 year' where user_id = '${CAMI}' returning user_id`);
    expect(updated).toEqual([]);
  });

  it("un anónimo no ve la conexión ni puede marcarse en línea", async () => {
    expect(await as(null, "select count(*)::int as n from chat_reads")).toEqual([{ n: 0 }]);
    await expect(as(null, "select chat_presence(true)")).rejects.toThrow();
  });
});

describe("chat: fotos y stickers", () => {
  const ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const photo = (owner: string) =>
    `'${owner}/${ID}.webp', '${owner}/${ID}.thumb.webp'`;

  it("se puede mandar una foto (con o sin pie) y un sticker sin texto", async () => {
    await as(JUAN, "select mark_notifications_read('chat')");
    await as(CAMI, `insert into chat_messages (kind, image_path, thumb_path, image_width, image_height) values ('image', ${photo(CAMI)}, 800, 600)`);
    await as(CAMI, `insert into chat_messages (kind, body, image_path, thumb_path) values ('image', 'mira 😍', ${photo(CAMI)})`);
    await as(JUAN, "insert into chat_messages (kind, sticker) values ('sticker', 'te-amo')");
    const [row] = await as<{ body: string }>(JUAN, "select body from notifications where kind = 'chat' order by created_at desc limit 1");
    expect(row?.body).toMatch(/^📷 Foto/);
  });

  it("cada tipo exige lo suyo", async () => {
    await expect(as(CAMI, "insert into chat_messages (kind) values ('image')")).rejects.toThrow(/chat_messages_content/);
    await expect(as(CAMI, "insert into chat_messages (kind, body) values ('text', '   ')")).rejects.toThrow(/chat_messages_content/);
    await expect(as(CAMI, "insert into chat_messages (kind, sticker, body) values ('sticker', 'te-amo', 'hola')")).rejects.toThrow(/chat_messages_content/);
    await expect(as(CAMI, "insert into chat_messages (kind, sticker) values ('sticker', '../../x')")).rejects.toThrow(/check/);
  });

  it("una foto sólo puede apuntar a la carpeta de quien la envía", async () => {
    await expect(
      as(CAMI, `insert into chat_messages (kind, image_path, thumb_path) values ('image', ${photo(JUAN)})`),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(CAMI, `insert into chat_messages (kind, image_path, thumb_path) values ('image', '../${ID}.webp', '${CAMI}/${ID}.thumb.webp')`),
    ).rejects.toThrow(/row-level security|check/);
  });

  it("en el almacenamiento cada quien sube y borra sólo en su carpeta, y lo ve quien usa el chat", async () => {
    await db.exec(`
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
    `);
    await as(CAMI, `insert into storage.objects (bucket_id, name) values ('chat-media', '${CAMI}/${ID}.webp')`);
    await expect(
      as(CAMI, `insert into storage.objects (bucket_id, name) values ('chat-media', '${JUAN}/${ID}.webp')`),
    ).rejects.toThrow(/row-level security/);
    expect(await as(JUAN, "select count(*)::int as n from storage.objects where bucket_id = 'chat-media'")).toEqual([{ n: 1 }]);
    expect(await as(null, "select count(*)::int as n from storage.objects where bucket_id = 'chat-media'")).toEqual([{ n: 0 }]);
    expect(await as(JUAN, `delete from storage.objects where bucket_id = 'chat-media' returning name`)).toEqual([]);
    expect(await as(CAMI, `delete from storage.objects where bucket_id = 'chat-media' returning name`)).toHaveLength(1);
  });
});

describe("auditoría", () => {
  it("registra cambios y sólo la ve quien tiene audit.view", async () => {
    expect(await as(CAMI, "select count(*)::int as n from audit_log")).toEqual([{ n: 0 }]);
    const [row] = await as<{ n: number }>(JUAN, "select count(*)::int as n from audit_log where table_name = 'sections'");
    expect(row?.n).toBeGreaterThan(0);
  });
});

describe("sitio público", () => {
  it("al hacerlo público un anónimo ve las secciones visibles", async () => {
    await as(JUAN, "update site_settings set is_public = true");
    const [row] = await as<{ n: number }>(null, "select count(*)::int as n from sections");
    expect(row?.n).toBeGreaterThan(0);
  });
});

describe("invitaciones", () => {
  const HASH = "a".repeat(64);
  const insert = (hash: string, role = "editor", extra = "") =>
    `insert into invitations (token_hash, role, expires_at${extra ? ", " + extra.split("=")[0] : ""})
     values ('${hash}', '${role}', now() + interval '1 day'${extra ? ", " + extra.split("=")[1] : ""})`;

  it("sólo quien gestiona usuarios puede crearlas y verlas", async () => {
    await expect(as(CAMI, insert(HASH))).rejects.toThrow(/row-level security/);
    await as(JUAN, insert(HASH));
    expect(await as(CAMI, "select count(*)::int as n from invitations")).toEqual([{ n: 0 }]);
    expect(await as(null, "select count(*)::int as n from invitations")).toEqual([{ n: 0 }]);
    expect(await as(JUAN, "select count(*)::int as n from invitations")).toEqual([{ n: 1 }]);
  });

  it("nunca pueden crear un super administrador", async () => {
    await expect(as(JUAN, insert("b".repeat(64), "super_admin"))).rejects.toThrow(/check/);
  });

  it("no se pueden crear ya usadas ni marcarlas como usadas desde el navegador", async () => {
    await expect(as(JUAN, insert("c".repeat(64), "editor", "used_at=now()"))).rejects.toThrow(/row-level security/);
    await as(JUAN, `update invitations set used_at = now() where token_hash = '${HASH}'`);
    expect(await as(JUAN, `select used_at from invitations where token_hash = '${HASH}'`)).toEqual([{ used_at: null }]);
  });

  it("caducan en 30 días como máximo", async () => {
    await expect(as(JUAN, `insert into invitations (token_hash, role, expires_at)
      values ('${"d".repeat(64)}', 'viewer', now() + interval '31 days')`)).rejects.toThrow(/invitations_expiry/);
  });

  it("al crear una cuenta con app_role del enlace, nace con ese rol", async () => {
    const id = "44444444-4444-4444-4444-444444444444";
    await db.exec(`insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
      values ('${id}', 'nueva@example.com', '{"app_role":"editor"}', '{"display_name":"Camila"}')`);
    const { rows } = await db.query(`select role::text, display_name from profiles where id = '${id}'`);
    expect(rows).toEqual([{ role: "editor", display_name: "Camila" }]);
  });

  it("revocar borra la invitación", async () => {
    await as(JUAN, `delete from invitations where token_hash = '${HASH}'`);
    expect(await as(JUAN, "select count(*)::int as n from invitations")).toEqual([{ n: 0 }]);
  });
});

describe("avisos en el celular", () => {
  const calls = async () => (await db.query<{ n: number }>("select count(*)::int as n from net.calls")).rows[0]!.n;

  it("sin la función configurada no se llama a nadie", async () => {
    const before = await calls();
    await as(JUAN, `insert into notes (recipient_id, kind, body) values ('${CAMI}', 'love', 'hola')`);
    expect(await calls()).toBe(before);
  });

  it("con la función configurada, cada aviso nuevo llama a send-push con el secreto", async () => {
    await db.exec(`insert into vault.decrypted_secrets values
      ('push_function_url', 'https://x.supabase.co/functions/v1/send-push'), ('push_webhook_secret', 's3cr3t')`);
    await db.exec("delete from net.calls");
    await as(JUAN, `insert into notes (recipient_id, kind, body) values ('${CAMI}', 'love', 'te quiero')`);
    const { rows } = await db.query<{ url: string; secret: string; user_id: string; title: string }>(
      "select url, headers->>'x-webhook-secret' as secret, body->'record'->>'user_id' as user_id, body->'record'->>'title' as title from net.calls",
    );
    expect(rows).toEqual([{ url: "https://x.supabase.co/functions/v1/send-push", secret: "s3cr3t", user_id: CAMI, title: "Juan te mandó amor 💌" }]);
  });

  it("cada mensaje de chat avisa al celular aunque la campana tenga uno solo", async () => {
    await db.exec("delete from net.calls");
    await as(CAMI, "insert into chat_messages (body) values ('uno')");
    await as(CAMI, "insert into chat_messages (body) values ('dos')");
    const { rows } = await db.query<{ body: string }>(`select body->'record'->>'body' as body from net.calls where body->'record'->>'user_id' = '${JUAN}' order by id`);
    expect(rows).toEqual([{ body: "uno" }, { body: "dos" }]);
  });

  it("marcar como leído no vuelve a avisar", async () => {
    await db.exec("delete from net.calls");
    await as(JUAN, "select mark_notifications_read()");
    expect(await calls()).toBe(0);
  });

  it("una sorpresa activa avisa a los demás; una programada no", async () => {
    await as(CAMI, "insert into interruptions (title) values ('Mira la página 🎁')");
    expect(await as(JUAN, "select title, body, link from notifications where kind = 'system' and body = 'Mira la página 🎁'"))
      .toEqual([{ title: "Camila te dejó una sorpresa 🎁", body: "Mira la página 🎁", link: "/" }]);
    expect(await as(CAMI, "select count(*)::int as n from notifications where body = 'Mira la página 🎁'")).toEqual([{ n: 0 }]);
    await as(CAMI, "insert into interruptions (title, starts_at) values ('Para mañana', now() + interval '1 day')");
    expect(await as(JUAN, "select count(*)::int as n from notifications where body = 'Para mañana'")).toEqual([{ n: 0 }]);
  });

  it("un celular queda a nombre de quien inició sesión por última vez en él", async () => {
    const endpoint = "https://fcm.googleapis.com/fcm/send/abc";
    await as(JUAN, `select register_push_subscription('${endpoint}', 'k', 'a', 'ua')`);
    await as(CAMI, `select register_push_subscription('${endpoint}', 'k2', 'a2', 'ua')`);
    expect(await as(CAMI, "select p256dh from push_subscriptions")).toEqual([{ p256dh: "k2" }]);
    expect(await as(JUAN, "select count(*)::int as n from push_subscriptions")).toEqual([{ n: 0 }]);
    await expect(as(null, `select register_push_subscription('${endpoint}', 'k', 'a')`)).rejects.toThrow(/permission denied|iniciar sesión/);
  });

  it("el aviso de prueba llega sólo a quien lo pide y no se puede repetir enseguida", async () => {
    await as(GUEST, "select send_test_notification()");
    expect(await as(GUEST, "select count(*)::int as n from notifications where link = '/cuenta'")).toEqual([{ n: 1 }]);
    await expect(as(GUEST, "select send_test_notification()")).rejects.toThrow(/Espera un minuto/);
    await expect(as(null, "select send_test_notification()")).rejects.toThrow(/permission denied|iniciar sesión/);
  });
});

describe("listas compartidas", () => {
  let LIST = "";
  let ITEM = "";
  const IMG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const listNotes = (uid: string) =>
    as<{ title: string; body: string; link: string }>(uid, "select title, body, link from notifications where kind = 'list' and read_at is null order by created_at");

  it("quien crea la lista elige con quién; sólo los miembros la ven", async () => {
    const [row] = await as<{ id: string }>(JUAN, `select create_todo_list('Viaje a la playa', 'Lo que falta', '🏖️', null, array['${CAMI}']::uuid[]) as id`);
    LIST = row!.id;
    expect(await as(JUAN, "select title, owner_id from todo_lists")).toEqual([{ title: "Viaje a la playa", owner_id: JUAN }]);
    expect(await as(CAMI, "select user_id from todo_list_members order by added_at, user_id")).toHaveLength(2);
    expect(await as(GUEST, "select count(*)::int as n from todo_lists")).toEqual([{ n: 0 }]);
    expect(await as(GUEST, "select count(*)::int as n from todo_list_members")).toEqual([{ n: 0 }]);
    expect(await listNotes(CAMI)).toEqual([
      { title: "Juan te sumó a la lista 🏖️ Viaje a la playa", body: "Lo que falta", link: `/listas/${LIST}?nueva=1` },
    ]);
    expect(await listNotes(JUAN)).toEqual([]);
  });

  it("sin el permiso lists.use no se crean listas, y no se crean sin la función", async () => {
    await expect(as(null, "select create_todo_list('x')")).rejects.toThrow(/permission denied|permiso/);
    await expect(as(CAMI, "insert into todo_lists (title) values ('a escondidas')")).rejects.toThrow(/row-level security/);
    await db.exec("delete from role_permissions where role = 'viewer' and permission = 'lists.use'");
    await expect(as(GUEST, "select create_todo_list('x')")).rejects.toThrow(/permiso/);
    await expect(as(JUAN, `select create_todo_list('x', '', '📝', null, array['${GUEST}']::uuid[])`)).rejects.toThrow(/no puede usar listas/);
    await db.exec("insert into role_permissions values ('viewer', 'lists.use')");
  });

  it("los miembros agregan tareas y a los demás les llega un solo aviso que se actualiza", async () => {
    await as(JUAN, "select mark_notifications_read()");
    const [item] = await as<{ id: string }>(CAMI, `insert into todo_items (list_id, title) values ('${LIST}', 'Comprar bloqueador') returning id`);
    ITEM = item!.id;
    await as(CAMI, `insert into todo_items (list_id, title, due_on) values ('${LIST}', 'Reservar hotel', '2026-12-01')`);
    expect(await listNotes(JUAN)).toEqual([
      { title: "Camila · 🏖️ Viaje a la playa", body: "➕ Reservar hotel", link: `/listas/${LIST}` },
    ]);
    await expect(as(GUEST, `insert into todo_items (list_id, title) values ('${LIST}', 'colado')`)).rejects.toThrow(/row-level security/);
    expect(await as(GUEST, "select count(*)::int as n from todo_items")).toEqual([{ n: 0 }]);
  });

  it("las subtareas son de un solo nivel y de la misma lista", async () => {
    const [sub] = await as<{ id: string }>(JUAN, `insert into todo_items (list_id, parent_id, title) values ('${LIST}', '${ITEM}', 'FPS 50') returning id`);
    await expect(as(JUAN, `insert into todo_items (list_id, parent_id, title) values ('${LIST}', '${sub!.id}', 'nieta')`)).rejects.toThrow(/no puede tener subtareas/);
    const [other] = await as<{ id: string }>(JUAN, "select create_todo_list('Otra') as id");
    await expect(as(JUAN, `insert into todo_items (list_id, parent_id, title) values ('${other!.id}', '${ITEM}', 'cruzada')`)).rejects.toThrow(/misma lista/);
    await expect(as(JUAN, `update todo_items set list_id = '${other!.id}' where id = '${ITEM}'`)).rejects.toThrow(/otra lista/);
    await as(JUAN, `delete from todo_lists where id = '${other!.id}'`);
  });

  it("quién y cuándo terminó una tarea lo pone la base de datos", async () => {
    await as(JUAN, "select mark_notifications_read()");
    await as(CAMI, `update todo_items set done_at = '2000-01-01', done_by = '${JUAN}' where id = '${ITEM}'`);
    const [row] = await as<{ done_by: string; recent: boolean }>(CAMI, `select done_by, done_at > now() - interval '1 minute' as recent from todo_items where id = '${ITEM}'`);
    expect(row).toEqual({ done_by: CAMI, recent: true });
    expect((await listNotes(JUAN)).map((n) => n.body)).toEqual(["✅ Comprar bloqueador"]);
    await as(CAMI, `update todo_items set done_at = null where id = '${ITEM}'`);
    expect(await as(CAMI, `select done_by from todo_items where id = '${ITEM}'`)).toEqual([{ done_by: null }]);
  });

  it("sólo se asigna a alguien de la lista, y le llega el aviso", async () => {
    await expect(as(CAMI, `update todo_items set assignee_id = '${GUEST}' where id = '${ITEM}'`)).rejects.toThrow(/alguien de la lista/);
    await as(JUAN, "select mark_notifications_read()");
    await as(CAMI, `update todo_items set assignee_id = '${JUAN}' where id = '${ITEM}'`);
    expect((await listNotes(JUAN)).map((n) => n.body)).toEqual(["👉 Te asignó: Comprar bloqueador"]);
  });

  it("cualquier miembro suma gente; cada quien se sale; sólo quien la creó saca a otros", async () => {
    await as(CAMI, `insert into todo_list_members (list_id, user_id) values ('${LIST}', '${GUEST}')`);
    expect(await as(GUEST, "select title from todo_lists")).toEqual([{ title: "Viaje a la playa" }]);
    expect(await as(GUEST, "select count(*)::int as n from notifications where kind = 'list' and title like 'Camila te sumó%'")).toEqual([{ n: 1 }]);
    expect(await as(CAMI, `delete from todo_list_members where list_id = '${LIST}' and user_id = '${GUEST}' returning user_id`)).toEqual([]);
    expect(await as(CAMI, `delete from todo_list_members where list_id = '${LIST}' and user_id = '${JUAN}' returning user_id`)).toEqual([]);
    expect(await as(GUEST, `delete from todo_list_members where list_id = '${LIST}' and user_id = '${GUEST}' returning user_id`)).toHaveLength(1);
    expect(await as(GUEST, "select count(*)::int as n from todo_lists")).toEqual([{ n: 0 }]);
    await expect(as(GUEST, `insert into todo_list_members (list_id, user_id) values ('${LIST}', '${GUEST}')`)).rejects.toThrow(/row-level security/);
  });

  it("materiales y fotos sólo para los miembros, y las fotos en la carpeta de la lista", async () => {
    await as(CAMI, `insert into todo_materials (item_id, name, quantity) values ('${ITEM}', 'Bloqueador', '2')`);
    expect(await as(JUAN, "select name, quantity, is_ready from todo_materials")).toEqual([{ name: "Bloqueador", quantity: "2", is_ready: false }]);
    expect(await as(GUEST, "select count(*)::int as n from todo_materials")).toEqual([{ n: 0 }]);
    await expect(as(GUEST, `insert into todo_materials (item_id, name) values ('${ITEM}', 'x')`)).rejects.toThrow(/row-level security/);

    await as(CAMI, `insert into todo_item_images (item_id, list_id, path, thumb_path) values ('${ITEM}', '${LIST}', '${LIST}/${IMG}.webp', '${LIST}/${IMG}.thumb.webp')`);
    expect(await as(JUAN, "select list_id from todo_item_images")).toEqual([{ list_id: LIST }]);
    await expect(as(CAMI, `insert into todo_item_images (item_id, list_id, path, thumb_path) values ('${ITEM}', '${LIST}', '${CAMI}/${IMG}.webp', '${CAMI}/${IMG}.thumb.webp')`)).rejects.toThrow(/carpeta de su lista/);

    await as(CAMI, `insert into storage.objects (bucket_id, name) values ('list-media', '${LIST}/${IMG}.webp')`);
    await expect(as(GUEST, `insert into storage.objects (bucket_id, name) values ('list-media', '${LIST}/${IMG}.thumb.webp')`)).rejects.toThrow(/row-level security/);
    await expect(as(CAMI, `insert into storage.objects (bucket_id, name) values ('list-media', '../${IMG}.webp')`)).rejects.toThrow(/row-level security/);
    expect(await as(JUAN, "select count(*)::int as n from storage.objects where bucket_id = 'list-media'")).toEqual([{ n: 1 }]);
    expect(await as(GUEST, "select count(*)::int as n from storage.objects where bucket_id = 'list-media'")).toEqual([{ n: 0 }]);
  });

  it("sólo quien la creó borra la lista, y se borra todo lo de adentro", async () => {
    expect(await as(CAMI, `delete from todo_lists where id = '${LIST}' returning id`)).toEqual([]);
    expect(await as(JUAN, `delete from todo_lists where id = '${LIST}' returning id`)).toHaveLength(1);
    const { rows } = await db.query<{ n: number }>("select (select count(*) from todo_items) + (select count(*) from todo_materials) + (select count(*) from todo_item_images) + (select count(*) from todo_list_members)::int as n");
    expect(Number(rows[0]!.n)).toBe(0);
  });
});

describe("perfil de cada persona", () => {
  const PIC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("cada quien cambia su nombre, foto, icono, frase y cumpleaños", async () => {
    const rows = await as(CAMI, `update profiles set display_name = 'Cami', avatar_path = '${CAMI}/${PIC}.webp',
      avatar_emoji = '🌸', bio = 'Feliz 💖', birthday = '2001-03-15' where id = '${CAMI}'
      returning display_name, avatar_path, avatar_emoji, bio, birthday::text`);
    expect(rows).toEqual([{ display_name: "Cami", avatar_path: `${CAMI}/${PIC}.webp`, avatar_emoji: "🌸", bio: "Feliz 💖", birthday: "2001-03-15" }]);
    expect(await as(GUEST, `select bio from profiles where id = '${CAMI}'`)).toEqual([{ bio: "Feliz 💖" }]);
  });

  it("nadie cambia la foto ni el perfil de otra persona, ni el super administrador", async () => {
    await expect(as(JUAN, `update profiles set avatar_emoji = '🐸' where id = '${CAMI}'`)).rejects.toThrow(/su foto y su perfil/);
    await expect(as(JUAN, `update profiles set bio = 'x' where id = '${CAMI}'`)).rejects.toThrow(/su foto y su perfil/);
    expect(await as(GUEST, `update profiles set bio = 'x' where id = '${CAMI}' returning id`)).toEqual([]);
  });

  it("la foto sólo puede estar en la carpeta propia y la frase es corta", async () => {
    await expect(as(CAMI, `update profiles set avatar_path = '${JUAN}/${PIC}.webp' where id = '${CAMI}'`)).rejects.toThrow(/profiles_avatar_own_folder/);
    await expect(as(CAMI, `update profiles set avatar_path = '../x.webp' where id = '${CAMI}'`)).rejects.toThrow(/check/);
    await expect(as(CAMI, `update profiles set bio = '${"a".repeat(161)}' where id = '${CAMI}'`)).rejects.toThrow(/check/);
  });

  it("en el almacenamiento cada quien sube a su carpeta y lo ve quien tiene sesión", async () => {
    await as(CAMI, `insert into storage.objects (bucket_id, name) values ('avatars', '${CAMI}/${PIC}.webp')`);
    await expect(as(CAMI, `insert into storage.objects (bucket_id, name) values ('avatars', '${JUAN}/${PIC}.webp')`)).rejects.toThrow(/row-level security/);
    expect(await as(GUEST, "select count(*)::int as n from storage.objects where bucket_id = 'avatars'")).toEqual([{ n: 1 }]);
    expect(await as(null, "select count(*)::int as n from storage.objects where bucket_id = 'avatars'")).toEqual([{ n: 0 }]);
    expect(await as(JUAN, "delete from storage.objects where bucket_id = 'avatars' returning name")).toEqual([]);
  });
});

describe("refuerzo OWASP", () => {
  it("un aviso sólo se puede marcar como leído: nadie le cambia el texto ni el enlace", async () => {
    await as(JUAN, `insert into notes (recipient_id, kind, body) values ('${CAMI}', 'love', 'para ti')`);
    const [n] = await as<{ id: string }>(CAMI, "select id from notifications where body = 'para ti'");
    await expect(as(CAMI, `update notifications set link = '/chat' where id = '${n!.id}'`)).rejects.toThrow(/marcar como leído/);
    await expect(as(CAMI, `update notifications set title = 'otro' where id = '${n!.id}'`)).rejects.toThrow(/marcar como leído/);
    expect(await as(CAMI, `update notifications set read_at = now() where id = '${n!.id}' returning id`)).toHaveLength(1);
  });

  it("el enlace de un aviso es siempre una ruta del propio sitio", async () => {
    for (const link of ["//sitio-malo.com", "/\\\\sitio-malo.com", "https://sitio-malo.com", "/chat\n"]) {
      await expect(
        db.query(`insert into notifications (user_id, kind, title, link) values ('${CAMI}', 'system', 'x', $1)`, [link]),
      ).rejects.toThrow(/notifications_link_check/);
    }
    await db.query(`insert into notifications (user_id, kind, title, link, read_at) values ('${CAMI}', 'system', 'x', '/listas/1?nueva=1', now())`);
  });

  it("los avisos al celular sólo van a los servicios de push de verdad", async () => {
    for (const endpoint of ["https://push.example.com/abc", "https://169.254.169.254/latest", "https://fcm.googleapis.com.evil.com/x"]) {
      await expect(as(JUAN, `select register_push_subscription('${endpoint}', 'k', 'a')`)).rejects.toThrow(/push_subscriptions_endpoint_service/);
    }
    await expect(as(JUAN, "select register_push_subscription('https://fcm.googleapis.com/fcm/send/z', 'k<script>', 'a')"))
      .rejects.toThrow(/push_subscriptions_keys_format/);
    for (const endpoint of [
      "https://updates.push.services.mozilla.com/wpush/v2/z", "https://web.push.apple.com/QK7",
      "https://wns2-par02p.notify.windows.com/w/?token=z",
    ]) {
      await as(JUAN, `select register_push_subscription('${endpoint}', 'BOk_-x=', 'aZ09')`);
    }
  });

  it("el autor de una sorpresa o foto lo pone la base, no el navegador", async () => {
    const [row] = await as<{ created_by: string }>(CAMI,
      `insert into interruptions (title, created_by, is_active) values ('fingida', '${JUAN}', false) returning created_by`);
    expect(row?.created_by).toBe(CAMI);
    const [photo] = await as<{ created_by: string }>(CAMI,
      `insert into photos (storage_path, created_by) values ('x/autor.webp', '${JUAN}') returning created_by`);
    expect(photo?.created_by).toBe(CAMI);
  });

  it("sin sesión no se pueden usar las funciones internas", async () => {
    for (const call of [
      "my_permissions()", "mark_notifications_read()", "todo_item_list(gen_random_uuid())",
      "is_list_member(gen_random_uuid())", "is_list_folder_member('x')",
    ]) {
      await expect(as(null, `select ${call}`)).rejects.toThrow(/permission denied/);
    }
    expect(await as(null, "select can_view_site() as ok")).toEqual([{ ok: true }]);
  });

  it("frena a quien manda demasiados mensajes seguidos", async () => {
    await expect(
      as(GUEST, "insert into chat_messages (body) select 'spam ' || i from generate_series(1, 31) i"),
    ).rejects.toThrow(/Vas muy rápido/);
    await expect(
      as(GUEST, `insert into notes (recipient_id, body) select '${CAMI}', 'spam' from generate_series(1, 21)`),
    ).rejects.toThrow(/Vas muy rápido/);
    expect(await as(GUEST, "insert into chat_messages (body) values ('hola, ya sin prisa') returning id")).toHaveLength(1);
  });

  it("una cuenta desactivada ya no sube fotos de perfil", async () => {
    await db.exec(`update profiles set is_active = false where id = '${GUEST}'`);
    try {
      await expect(as(GUEST, `insert into storage.objects (bucket_id, name) values ('avatars', '${GUEST}/x.webp')`))
        .rejects.toThrow(/row-level security/);
    } finally {
      await db.exec(`update profiles set is_active = true where id = '${GUEST}'`);
    }
  });
});
