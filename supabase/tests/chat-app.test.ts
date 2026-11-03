/**
 * Pruebas de la app de chat (migración 015): contactos, solicitudes,
 * bloqueos, conversaciones privadas, edición, reacciones, vistos y avisos.
 * Igual que rls.test.ts: un Postgres real en memoria (PGlite).
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { SUPABASE_STUB } from "./supabaseStub";

const ROOT = join(__dirname, "..");
const CHAT_APP = "20261103000100_chat_app.sql";
const JUAN = "11111111-1111-1111-1111-111111111111";
const CAMI = "22222222-2222-2222-2222-222222222222";
const SOFI = "33333333-3333-3333-3333-333333333333";
const LUIS = "44444444-4444-4444-4444-444444444444";

const migrations = readdirSync(join(ROOT, "migrations")).filter((f) => f.endsWith(".sql")).sort();
const read = (file: string) => readFileSync(join(ROOT, "migrations", file), "utf8");

function runner(db: PGlite) {
  return async function as<T = Record<string, unknown>>(uid: string | null, sql: string): Promise<T[]> {
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
  };
}

const USERS = `
  insert into auth.users (id, email) values
    ('${JUAN}', 'juan@example.com'), ('${CAMI}', 'cami@example.com'),
    ('${SOFI}', 'sofi@example.com'), ('${LUIS}', 'luis@example.com');
  update public.profiles set role = 'super_admin', display_name = 'Juan' where id = '${JUAN}';
  update public.profiles set role = 'editor', display_name = 'Camila' where id = '${CAMI}';
  update public.profiles set display_name = 'Sofía' where id = '${SOFI}';
  update public.profiles set display_name = 'Luis' where id = '${LUIS}';
`;

describe("la sala de siempre se conserva", () => {
  it("los mensajes de Juan y Camila pasan a su chat directo y quedan como contactos", async () => {
    const db = new PGlite();
    await db.exec(SUPABASE_STUB);
    for (const file of migrations.filter((f) => f < CHAT_APP)) await db.exec(read(file));
    await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated; ${USERS}`);
    const as = runner(db);
    await as(JUAN, "insert into chat_messages (body) values ('hola mi amor')");
    await as(CAMI, "insert into chat_messages (body) values ('hola 💖')");
    await as(CAMI, "select chat_presence(true)");

    for (const file of migrations.filter((f) => f >= CHAT_APP)) await db.exec(read(file));
    await db.exec("grant select, insert, update, delete on all tables in schema public to anon, authenticated");

    const inbox = await as<{ kind: string; participant_ids: string[]; unread: number }>(JUAN, "select kind, participant_ids, unread from chat_inbox()");
    // Juan no había abierto el chat desde el último de Camila; ella sí leyó todo.
    expect(inbox).toEqual([{ kind: "direct", participant_ids: expect.arrayContaining([JUAN, CAMI]), unread: 1 }]);
    expect(await as(CAMI, "select unread from chat_inbox()")).toEqual([{ unread: 0 }]);
    expect(await as(CAMI, "select count(*)::int as n from chat_messages")).toEqual([{ n: 2 }]);
    expect(await as(SOFI, "select count(*)::int as n from chat_messages")).toEqual([{ n: 0 }]);
    expect(await as(JUAN, "select status from chat_contacts")).toEqual([{ status: "accepted" }]);
    // Y siguen escribiéndose como siempre.
    const [{ c } = { c: "" }] = await as<{ c: string }>(JUAN, "select conversation_id as c from chat_inbox()");
    expect(await as(JUAN, `insert into chat_messages (conversation_id, body) values ('${c}', 'sigo aquí') returning body`))
      .toEqual([{ body: "sigo aquí" }]);
  }, 60_000);
});

describe("app de chat", () => {
  let db: PGlite;
  let as: ReturnType<typeof runner>;
  /** Chat directo de Juan y Camila. */
  let CHAT = "";

  beforeAll(async () => {
    db = new PGlite();
    await db.exec(SUPABASE_STUB);
    for (const file of migrations) await db.exec(read(file));
    await db.exec(read("../seed.sql"));
    await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated; ${USERS}`);
    as = runner(db);
  }, 60_000);

  describe("buscar personas y solicitudes", () => {
    it("busca por nombre entre quienes usan el chat, sin mostrarme a mí", async () => {
      const rows = await as<{ display_name: string; relation: string }>(JUAN, "select display_name, relation from chat_search_users('a')");
      expect(rows.map((r) => r.display_name).sort()).toEqual(["Camila", "Sofía"]);
      expect(rows.every((r) => r.relation === "none")).toBe(true);
      expect(await as(JUAN, "select display_name from chat_search_users('lu')")).toEqual([{ display_name: "Luis" }]);
      // Los comodines se buscan como texto.
      expect(await as(JUAN, "select count(*)::int as n from chat_search_users('%')")).toEqual([{ n: 0 }]);
      await expect(as(null, "select * from chat_search_users('')")).rejects.toThrow(/permission denied/);
    });

    it("sin solicitud aceptada no hay chat ni se puede abrir uno", async () => {
      await expect(as(CAMI, `select chat_open_direct('${JUAN}')`)).rejects.toThrow(/aceptarse como contactos/);
      expect(await as(CAMI, "select count(*)::int as n from chat_conversations")).toEqual([{ n: 0 }]);
      // Nadie crea contactos ni conversaciones a mano.
      await expect(as(CAMI, `insert into chat_contacts (requester_id, addressee_id, status) values ('${CAMI}', '${JUAN}', 'accepted')`))
        .rejects.toThrow(/row-level security/);
      await expect(as(CAMI, "insert into chat_conversations (kind, title) values ('group', 'x')")).rejects.toThrow(/row-level security/);
    });

    it("la solicitud le llega a la otra persona, que la ve y recibe un aviso", async () => {
      expect(await as(CAMI, `select chat_request_contact('${JUAN}', 'hola, soy yo 💖') as s`)).toEqual([{ s: "pending" }]);
      // Repetirla no crea otra.
      expect(await as(CAMI, `select chat_request_contact('${JUAN}') as s`)).toEqual([{ s: "pending" }]);
      expect(await as(JUAN, "select requester_id, status, message from chat_contacts")).toEqual([
        { requester_id: CAMI, status: "pending", message: "hola, soy yo 💖" },
      ]);
      expect(await as(SOFI, "select count(*)::int as n from chat_contacts")).toEqual([{ n: 0 }]);
      expect(await as(JUAN, "select title, link from notifications where kind = 'chat'")).toEqual([
        { title: "Camila quiere chatear contigo 👋", link: "/chat/solicitudes" },
      ]);
      expect(await as(JUAN, "select relation from chat_search_users('Camila')")).toEqual([{ relation: "incoming" }]);
      expect(await as(CAMI, "select relation from chat_search_users('Juan')")).toEqual([{ relation: "outgoing" }]);
    });

    it("sólo quien la recibe la acepta; al aceptar se abre el chat y avisa con su enlace", async () => {
      const [req] = await as<{ id: string }>(JUAN, "select id from chat_contacts");
      await expect(as(CAMI, `select chat_respond_contact('${req!.id}', true)`)).rejects.toThrow(/ya no está pendiente/);
      const [row] = await as<{ c: string }>(JUAN, `select chat_respond_contact('${req!.id}', true) as c`);
      CHAT = row!.c;
      expect(CHAT).toMatch(/^[0-9a-f-]{36}$/);
      expect(await as(CAMI, "select title, link from notifications where kind = 'chat'")).toEqual([
        { title: "Juan aceptó tu solicitud 🎉", link: `/chat/${CHAT}` },
      ]);
      expect(await as(CAMI, `select chat_open_direct('${JUAN}') as c`)).toEqual([{ c: CHAT }]);
      expect(await as(CAMI, "select relation from chat_search_users('Juan')")).toEqual([{ relation: "contact" }]);
    });

    it("rechazar borra la solicitud; si las dos se escriben a la vez, queda aceptada", async () => {
      await as(SOFI, `select chat_request_contact('${JUAN}')`);
      const [req] = await as<{ id: string }>(JUAN, `select id from chat_contacts where requester_id = '${SOFI}'`);
      expect(await as(JUAN, `select chat_respond_contact('${req!.id}', false) as c`)).toEqual([{ c: null }]);
      expect(await as(SOFI, "select count(*)::int as n from chat_contacts")).toEqual([{ n: 0 }]);
      await as(SOFI, `select chat_request_contact('${LUIS}')`);
      expect(await as(LUIS, `select chat_request_contact('${SOFI}') as s`)).toEqual([{ s: "accepted" }]);
      expect(await as(LUIS, "select count(*)::int as n from chat_inbox()")).toEqual([{ n: 1 }]);
    });
  });

  describe("conversaciones privadas", () => {
    it("sólo quienes están en el chat leen y escriben en él", async () => {
      await as(CAMI, `insert into chat_messages (conversation_id, body) values ('${CHAT}', 'te extraño')`);
      expect(await as(JUAN, "select body from chat_messages")).toEqual([{ body: "te extraño" }]);
      expect(await as(SOFI, "select count(*)::int as n from chat_messages")).toEqual([{ n: 0 }]);
      expect(await as(SOFI, "select count(*)::int as n from chat_participants")).toEqual([{ n: 2 }]); // las de su chat con Luis
      await expect(as(SOFI, `insert into chat_messages (conversation_id, body) values ('${CHAT}', 'hola')`))
        .rejects.toThrow(/row-level security/);
      await expect(as(SOFI, `select chat_mark_read('${CHAT}')`)).resolves.toBeDefined();
      expect(await as(JUAN, `select last_read_at is null as unread from chat_participants where user_id = '${JUAN}' and conversation_id = '${CHAT}'`))
        .toEqual([{ unread: true }]);
    });

    it("la bandeja cuenta lo que no he leído y leer lo pone en cero (y apaga el aviso)", async () => {
      expect(await as(JUAN, "select unread, last_message->>'body' as body from chat_inbox()"))
        .toEqual([{ unread: 1, body: "te extraño" }]);
      expect(await as(JUAN, `select count(*)::int as n from notifications where read_at is null and link = '/chat/${CHAT}'`)).toEqual([{ n: 1 }]);
      await as(JUAN, `select chat_mark_read('${CHAT}')`);
      expect(await as(JUAN, "select unread from chat_inbox()")).toEqual([{ unread: 0 }]);
      expect(await as(JUAN, `select count(*)::int as n from notifications where read_at is null and link = '/chat/${CHAT}'`)).toEqual([{ n: 0 }]);
      expect(await as(CAMI, `select last_read_at is not null as seen from chat_participants where user_id = '${JUAN}'`)).toEqual([{ seen: true }]);
    });

    it("no se puede citar un mensaje de otro chat", async () => {
      const [other] = await as<{ id: string }>(SOFI, "select conversation_id as id from chat_inbox()");
      const [m] = await as<{ id: string }>(SOFI, `insert into chat_messages (conversation_id, body) values ('${other!.id}', 'secreto') returning id`);
      await expect(as(CAMI, `insert into chat_messages (conversation_id, body, reply_to) values ('${CHAT}', 'je', '${m!.id}')`))
        .rejects.toThrow(/mensajes de este chat/);
    });

    it("«escribiendo…» sólo lo marca quien puede escribir, y se apaga al enviar", async () => {
      await as(CAMI, `select chat_typing('${CHAT}')`);
      expect(await as(JUAN, `select typing_at is not null as typing from chat_participants where user_id = '${CAMI}'`)).toEqual([{ typing: true }]);
      await as(CAMI, `insert into chat_messages (conversation_id, body) values ('${CHAT}', 'listo')`);
      expect(await as(JUAN, `select typing_at is null as quiet from chat_participants where user_id = '${CAMI}'`)).toEqual([{ quiet: true }]);
      await as(SOFI, `select chat_typing('${CHAT}')`);
      // Nadie cambia a mano los vistos ni el «escribiendo» de nadie.
      expect(await as(CAMI, `update chat_participants set last_read_at = now() + interval '1 day' returning user_id`)).toEqual([]);
    });

    it("la conexión sólo la ve quien comparte un chat con esa persona", async () => {
      await as(CAMI, "select chat_presence(false)");
      expect(await as(JUAN, `select count(*)::int as n from chat_reads where user_id = '${CAMI}'`)).toEqual([{ n: 1 }]);
      expect(await as(SOFI, `select count(*)::int as n from chat_reads where user_id = '${CAMI}'`)).toEqual([{ n: 0 }]);
    });

    it("silenciar un chat corta sus avisos; los demás siguen", async () => {
      await as(JUAN, "select mark_notifications_read()");
      await as(JUAN, `select chat_update_conversation('${CHAT}', p_muted => true, p_pinned => true)`);
      await as(CAMI, `insert into chat_messages (conversation_id, body) values ('${CHAT}', 'shh')`);
      expect(await as(JUAN, "select count(*)::int as n from notifications where read_at is null")).toEqual([{ n: 0 }]);
      expect(await as(JUAN, "select muted, pinned_at is not null as pinned from chat_inbox()")).toEqual([{ muted: true, pinned: true }]);
      await as(JUAN, `select chat_update_conversation('${CHAT}', p_muted => false)`);
      await as(CAMI, `insert into chat_messages (conversation_id, body) values ('${CHAT}', 'ya')`);
      expect(await as(JUAN, "select title, body from notifications where read_at is null")).toEqual([{ title: "Camila te escribió 💬", body: "ya" }]);
      await expect(as(SOFI, `select chat_update_conversation('${CHAT}', p_archived => true)`)).rejects.toThrow(/no existe/);
    });
  });

  describe("mensajes", () => {
    it("quien escribió edita su texto durante 15 minutos", async () => {
      const [m] = await as<{ id: string }>(CAMI, `insert into chat_messages (conversation_id, body) values ('${CHAT}', 'hloa') returning id`);
      await expect(as(JUAN, `select chat_edit_message('${m!.id}', 'otra cosa')`)).rejects.toThrow(/no se puede editar/);
      await as(CAMI, `select chat_edit_message('${m!.id}', 'hola')`);
      expect(await as(JUAN, `select body, edited_at is not null as edited from chat_messages where id = '${m!.id}'`))
        .toEqual([{ body: "hola", edited: true }]);
      await expect(as(CAMI, `select chat_edit_message('${m!.id}', '   ')`)).rejects.toThrow(/Escribe un mensaje/);
      await db.exec(`update chat_messages set created_at = now() - interval '16 minutes' where id = '${m!.id}'`);
      await expect(as(CAMI, `select chat_edit_message('${m!.id}', 'tarde')`)).rejects.toThrow(/15 minutos/);
      // Ni editando a mano.
      expect(await as(CAMI, `update chat_messages set body = 'x' where id = '${m!.id}' returning id`)).toEqual([]);
    });

    it("una reacción por persona, de la lista; se cambia y se quita", async () => {
      const [m] = await as<{ id: string }>(JUAN, `select id from chat_messages where body = 'ya'`);
      await as(JUAN, `insert into chat_reactions (message_id, emoji) values ('${m!.id}', '❤️')`);
      await as(JUAN, `insert into chat_reactions (message_id, emoji) values ('${m!.id}', '😂') on conflict (message_id, user_id) do update set emoji = excluded.emoji`);
      expect(await as(CAMI, `select user_id, emoji from chat_reactions where message_id = '${m!.id}'`)).toEqual([{ user_id: JUAN, emoji: "😂" }]);
      await expect(as(CAMI, `insert into chat_reactions (message_id, emoji) values ('${m!.id}', '<b>')`)).rejects.toThrow(/check/);
      await expect(as(SOFI, `insert into chat_reactions (message_id, emoji) values ('${m!.id}', '❤️')`)).rejects.toThrow(/row-level security/);
      expect(await as(SOFI, "select count(*)::int as n from chat_reactions")).toEqual([{ n: 0 }]);
      await as(JUAN, `delete from chat_reactions where message_id = '${m!.id}'`);
      expect(await as(CAMI, `select count(*)::int as n from chat_reactions where message_id = '${m!.id}'`)).toEqual([{ n: 0 }]);
    });

    it("borrar para mí lo esconde sólo a mí", async () => {
      const [m] = await as<{ id: string }>(CAMI, `insert into chat_messages (conversation_id, body) values ('${CHAT}', 'oops') returning id`);
      await as(JUAN, `insert into chat_hidden_messages (message_id) values ('${m!.id}')`);
      expect(await as(JUAN, `select count(*)::int as n from chat_messages where id = '${m!.id}'`)).toEqual([{ n: 0 }]);
      expect(await as(CAMI, `select count(*)::int as n from chat_messages where id = '${m!.id}'`)).toEqual([{ n: 1 }]);
      // No se esconden mensajes de chats ajenos (ni se adivina si existen).
      await expect(as(SOFI, `insert into chat_hidden_messages (message_id) values ('${m!.id}')`)).rejects.toThrow(/row-level security/);
    });

    it("borrar para todos deja el aviso, quita la foto y devuelve sus rutas", async () => {
      const ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
      const [m] = await as<{ id: string }>(CAMI, `insert into chat_messages (conversation_id, kind, image_path, thumb_path)
        values ('${CHAT}', 'image', '${CAMI}/${ID}.webp', '${CAMI}/${ID}.thumb.webp') returning id`);
      const [row] = await as<{ paths: string[] }>(CAMI, `select chat_delete_message('${m!.id}') as paths`);
      expect(row?.paths).toEqual([`${CAMI}/${ID}.webp`, `${CAMI}/${ID}.thumb.webp`]);
      expect(await as(JUAN, `select kind, body, image_path, deleted_at is not null as deleted from chat_messages where id = '${m!.id}'`))
        .toEqual([{ kind: "image", body: "", image_path: null, deleted: true }]);
      await expect(as(CAMI, `select chat_edit_message('${m!.id}', 'revivir')`)).rejects.toThrow(/no se puede editar/);
    });

    it("buscar en el chat encuentra texto de esa conversación", async () => {
      expect(await as(JUAN, `select body from chat_search_messages('${CHAT}', 'extra')`)).toEqual([{ body: "te extraño" }]);
      expect(await as(SOFI, `select count(*)::int as n from chat_search_messages('${CHAT}', 'extra')`)).toEqual([{ n: 0 }]);
    });

    it("vaciar el chat esconde lo anterior sólo a quien lo vació", async () => {
      await as(JUAN, `select chat_update_conversation('${CHAT}', p_clear => true)`);
      expect(await as(JUAN, `select count(*)::int as n from chat_messages where conversation_id = '${CHAT}'`)).toEqual([{ n: 0 }]);
      const [cami] = await as<{ n: number }>(CAMI, `select count(*)::int as n from chat_messages where conversation_id = '${CHAT}'`);
      expect(cami!.n).toBeGreaterThan(3);
    });
  });

  describe("bloquear y dejar de ser contactos", () => {
    it("al dejar de ser contactos se conserva el historial, pero ya no se escribe", async () => {
      await as(CAMI, `select chat_remove_contact('${JUAN}')`);
      await expect(as(CAMI, `insert into chat_messages (conversation_id, body) values ('${CHAT}', '¿sigues?')`))
        .rejects.toThrow(/row-level security/);
      const [cami] = await as<{ n: number }>(CAMI, `select count(*)::int as n from chat_messages where conversation_id = '${CHAT}'`);
      expect(cami!.n).toBeGreaterThan(0);
      // Se vuelven a aceptar y reaparece el mismo chat.
      await as(CAMI, `select chat_request_contact('${JUAN}')`);
      const [req] = await as<{ id: string }>(JUAN, "select id from chat_contacts where status = 'pending'");
      expect(await as(JUAN, `select chat_respond_contact('${req!.id}', true) as c`)).toEqual([{ c: CHAT }]);
    });

    it("quien bloquea desaparece de la búsqueda de la otra persona, que no puede escribirle ni pedirle nada", async () => {
      await as(SOFI, `select chat_block_user('${LUIS}')`);
      expect(await as(LUIS, "select count(*)::int as n from chat_search_users('Sof')")).toEqual([{ n: 0 }]);
      expect(await as(SOFI, "select relation from chat_search_users('Luis')")).toEqual([{ relation: "blocked" }]);
      await expect(as(LUIS, `select chat_request_contact('${SOFI}')`)).rejects.toThrow(/No puedes enviarle/);
      const [c] = await as<{ id: string }>(LUIS, "select conversation_id as id from chat_inbox()");
      await expect(as(LUIS, `insert into chat_messages (conversation_id, body) values ('${c!.id}', 'hola?')`)).rejects.toThrow(/row-level security/);
      expect(await as(LUIS, "select count(*)::int as n from chat_blocks")).toEqual([{ n: 0 }]);
      await as(SOFI, `select chat_unblock_user('${LUIS}')`);
      expect(await as(LUIS, "select relation from chat_search_users('Sof')")).toEqual([{ relation: "none" }]);
    });

    it("frena a quien manda demasiadas solicitudes", async () => {
      await db.exec(`insert into auth.users (id, email) select gen_random_uuid(), 'x' || i || '@example.com' from generate_series(1, 21) i`);
      const { rows } = await db.query<{ id: string }>("select id from auth.users where email like 'x%'");
      const calls = rows.map((r) => `select chat_request_contact('${r.id}');`).join("\n");
      await expect(as(LUIS, `do $$ begin ${calls.replaceAll("select ", "perform ")} end $$`))
        .rejects.toThrow(/Vas muy rápido/);
    });
  });
});
