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

const ROOT = join(__dirname, "..");
const JUAN = "11111111-1111-1111-1111-111111111111";
const CAMI = "22222222-2222-2222-2222-222222222222";
const GUEST = "33333333-3333-3333-3333-333333333333";

const SUPABASE_STUB = `
  create role anon; create role authenticated; create role service_role;
  create schema auth; create schema storage;
  create table auth.users (
    id uuid primary key, email text,
    raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}'
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public bool,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  create publication supabase_realtime;
  grant usage on schema public, auth, storage to anon, authenticated;
`;

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
      "notes.send", "photos.manage", "site.view", "theme.palette",
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
    await expect(as(CAMI, `update site_settings set theme = theme || '{"fontDisplay":"Lora"}'`)).rejects.toThrow(/permiso para cambiar el tema/);
    await expect(as(CAMI, `update site_settings set effects = '{"cursorHearts":true}'`)).rejects.toThrow(/permiso para cambiar el tema/);
    expect(await as(GUEST, `update site_settings set theme = theme || '{"primary":"#aa0000"}' returning id`)).toEqual([]);
    const rows = await as(JUAN, `update site_settings set theme = theme || '{"primary":"#aa0000","fontDisplay":"Lora"}' returning theme->>'primary' as p`);
    expect(rows).toEqual([{ p: "#aa0000" }]);
  });

  it("la editora puede elegir la paleta de colores (sólo colores válidos)", async () => {
    const rows = await as(CAMI, `update site_settings set theme = theme || '{"primary":"#c2185b","background":"#ffe6ec"}' returning theme->>'background' as bg, theme->>'fontDisplay' as font`);
    expect(rows).toEqual([{ bg: "#ffe6ec", font: "Lora" }]);
    await expect(as(CAMI, `update site_settings set theme = theme || '{"primary":"red; background:url(x)"}'`)).rejects.toThrow(/Color no válido/);
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
    const rows = await as(JUAN, "select count(*)::int as n from notifications where kind = 'chat'");
    expect(rows).toEqual([{ n: 1 }]);
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
