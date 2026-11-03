-- =============================================================================
-- 015 · El chat pasa a ser una app de mensajería
-- -----------------------------------------------------------------------------
--   * Contactos: para escribirle a alguien primero se le manda una solicitud;
--     el chat se abre cuando la otra persona la acepta. También se puede
--     bloquear a alguien.
--   * Conversaciones: cada pareja de contactos tiene su chat privado (y la
--     sala de siempre se conserva como una conversación más).
--   * Por persona y conversación: hasta dónde leyó, si está escribiendo, y si
--     fijó, archivó, silenció o vació el chat.
--   * Mensajes: se editan (15 min), se borran para todos o sólo para mí, y
--     llevan reacciones.
--
-- Seguridad (A01): nadie lee ni escribe en una conversación de la que no es
-- parte, nadie escribe a quien no lo aceptó o lo bloqueó, y los avisos y las
-- fotos del chat sólo llegan a quienes están en esa conversación.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------

-- Solicitud de contacto. «pending» hasta que la otra persona responde; si la
-- rechaza, la fila se borra (y quien la mandó puede volver a intentarlo, con
-- límite de velocidad). Una sola fila por pareja, sin importar quién la envió.
create table public.chat_contacts (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references auth.users (id) on delete cascade,
  addressee_id  uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  message       text not null default '' check (char_length(message) <= 200),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  constraint chat_contacts_not_self check (requester_id <> addressee_id)
);

create unique index chat_contacts_pair_idx
  on public.chat_contacts (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index chat_contacts_addressee_idx on public.chat_contacts (addressee_id, status);
create index chat_contacts_requester_idx on public.chat_contacts (requester_id, created_at desc);

-- Bloqueos: quien bloquea deja de recibir solicitudes y mensajes de la otra
-- persona, y ninguna de las dos aparece en las búsquedas de la otra.
create table public.chat_blocks (
  blocker_id  uuid not null references auth.users (id) on delete cascade default auth.uid(),
  blocked_id  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint chat_blocks_not_self check (blocker_id <> blocked_id)
);

create index chat_blocks_blocked_idx on public.chat_blocks (blocked_id);

create table public.chat_conversations (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null default 'direct' check (kind in ('direct', 'group')),
  title            text not null default '' check (char_length(title) <= 80),
  -- «<uuid menor>:<uuid mayor>»: un solo chat directo por pareja.
  direct_key       text unique check (direct_key is null or direct_key ~ '^[0-9a-f-]{36}:[0-9a-f-]{36}$'),
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz,
  constraint chat_conversations_direct_key check ((kind = 'direct') = (direct_key is not null))
);

create table public.chat_participants (
  conversation_id  uuid not null references public.chat_conversations (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  joined_at        timestamptz not null default now(),
  -- Hasta cuándo leyó (vistos) y cuándo tecleó por última vez («escribiendo…»).
  last_read_at     timestamptz,
  typing_at        timestamptz,
  -- Preferencias de cada quien para este chat.
  pinned_at        timestamptz,
  archived_at      timestamptz,
  muted            boolean not null default false,
  -- «Vaciar chat»: lo anterior a esta fecha ya no se le muestra.
  cleared_at       timestamptz,
  primary key (conversation_id, user_id)
);

create index chat_participants_user_idx on public.chat_participants (user_id);

alter table public.chat_messages
  add column conversation_id uuid references public.chat_conversations (id) on delete cascade,
  add column edited_at timestamptz,
  add column deleted_at timestamptz;

-- Mensajes que una persona borró sólo para sí.
create table public.chat_hidden_messages (
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  message_id  uuid not null references public.chat_messages (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, message_id)
);

create index chat_hidden_messages_message_idx on public.chat_hidden_messages (message_id);

-- Una reacción por persona y mensaje (como en WhatsApp), de una lista fija.
create table public.chat_reactions (
  message_id  uuid not null references public.chat_messages (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  emoji       text not null check (emoji in ('❤️', '😂', '😮', '😢', '🙏', '👍', '🔥', '🥰')),
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index chat_reactions_user_idx on public.chat_reactions (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- La sala de siempre pasa a ser una conversación. Entran quienes la usaron
-- (escribieron o la abrieron). Si son dos, queda como su chat directo y
-- quedan como contactos; si no, se conserva como grupo.
-- -----------------------------------------------------------------------------
do $$
declare
  v_people uuid[];
  v_conversation uuid;
begin
  if not exists (select 1 from public.chat_messages) then
    return;
  end if;
  select array_agg(distinct u order by u) into v_people
    from (
      select sender_id as u from public.chat_messages
      union
      select user_id from public.chat_reads where last_read_at is not null
    ) s
   where exists (select 1 from public.profiles p where p.id = s.u);

  if array_length(v_people, 1) = 2 then
    insert into public.chat_conversations (kind, direct_key)
    values ('direct', v_people[1]::text || ':' || v_people[2]::text)
    returning id into v_conversation;
  else
    insert into public.chat_conversations (kind, title)
    values ('group', 'Nuestro chat')
    returning id into v_conversation;
  end if;

  insert into public.chat_participants (conversation_id, user_id, last_read_at)
  select v_conversation, u, (select r.last_read_at from public.chat_reads r where r.user_id = u)
    from unnest(v_people) u;

  -- Quienes ya hablaban quedan como contactos entre sí.
  insert into public.chat_contacts (requester_id, addressee_id, status, responded_at)
  select a, b, 'accepted', now()
    from unnest(v_people) a, unnest(v_people) b
   where a < b
  on conflict do nothing;

  update public.chat_messages set conversation_id = v_conversation where conversation_id is null;
  update public.chat_conversations
     set last_message_at = (select max(created_at) from public.chat_messages where conversation_id = v_conversation)
   where id = v_conversation;
end;
$$;

alter table public.chat_messages alter column conversation_id set not null;

create index chat_messages_conversation_idx on public.chat_messages (conversation_id, created_at desc);
create index chat_messages_image_idx on public.chat_messages (image_path) where image_path is not null;
create index chat_messages_thumb_idx on public.chat_messages (thumb_path) where thumb_path is not null;

-- Un mensaje borrado para todos queda como «Se eliminó este mensaje»: sin
-- texto, foto ni sticker.
alter table public.chat_messages drop constraint chat_messages_content;
alter table public.chat_messages
  add constraint chat_messages_content check (
    (deleted_at is not null and char_length(body) = 0 and image_path is null and thumb_path is null and sticker is null)
    or (deleted_at is null and (
      (kind = 'text' and char_length(btrim(body)) >= 1 and image_path is null and sticker is null)
      or (kind = 'image' and image_path is not null and thumb_path is not null and sticker is null)
      or (kind = 'sticker' and sticker is not null and image_path is null and char_length(btrim(body)) = 0)
    ))
  );

-- -----------------------------------------------------------------------------
-- Funciones de apoyo (security definer para no recursar en RLS)
-- -----------------------------------------------------------------------------

-- ¿Esta persona (activa) puede usar el chat?
create or replace function public.user_can_chat(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pr.role = 'super_admin'
         or exists (select 1 from public.role_permissions rp where rp.role = pr.role and rp.permission = 'chat.use')
       from public.profiles pr
      where pr.id = p_user and pr.is_active),
    false
  );
$$;

create or replace function public.is_chat_participant(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_participants
     where conversation_id = p_conversation and user_id = auth.uid()
  );
$$;

-- Desde cuándo veo los mensajes de esta conversación (null: no soy parte).
create or replace function public.chat_visible_since(p_conversation uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(cleared_at, '-infinity'::timestamptz)
    from public.chat_participants
   where conversation_id = p_conversation and user_id = auth.uid();
$$;

-- ¿Alguna de las dos personas bloqueó a la otra?
create or replace function public.chat_is_blocked(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_blocks
     where (blocker_id = p_a and blocked_id = p_b) or (blocker_id = p_b and blocked_id = p_a)
  );
$$;

-- ¿Somos contactos (solicitud aceptada)?
create or replace function public.chat_are_contacts(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.chat_contacts
     where status = 'accepted'
       and least(requester_id, addressee_id) = least(p_a, p_b)
       and greatest(requester_id, addressee_id) = greatest(p_a, p_b)
  );
$$;

-- ¿Puedo escribir en esta conversación? En un chat directo hace falta que la
-- otra persona me haya aceptado, que nadie haya bloqueado a nadie y que siga
-- activa; en un grupo basta con ser parte.
create or replace function public.chat_can_send(p_conversation uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_kind text;
  v_other uuid;
begin
  if auth.uid() is null or not public.has_permission('chat.use') or not public.is_chat_participant(p_conversation) then
    return false;
  end if;
  select kind into v_kind from public.chat_conversations where id = p_conversation;
  if v_kind = 'group' then
    return true;
  end if;
  select user_id into v_other from public.chat_participants
   where conversation_id = p_conversation and user_id <> auth.uid()
   limit 1;
  return v_other is not null
     and public.user_can_chat(v_other)
     and public.chat_are_contacts(auth.uid(), v_other)
     and not public.chat_is_blocked(auth.uid(), v_other);
end;
$$;

-- ¿Comparto alguna conversación con esta persona? (para ver su conexión)
create or replace function public.chat_shares_conversation(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user = auth.uid() or exists (
    select 1
      from public.chat_participants mine
      join public.chat_participants theirs on theirs.conversation_id = mine.conversation_id
     where mine.user_id = auth.uid() and theirs.user_id = p_user
  );
$$;

-- Crea (o devuelve) el chat directo entre dos personas.
create or replace function public.chat_ensure_direct(p_a uuid, p_b uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text := least(p_a, p_b)::text || ':' || greatest(p_a, p_b)::text;
  v_id uuid;
begin
  select id into v_id from public.chat_conversations where direct_key = v_key;
  if v_id is null then
    insert into public.chat_conversations (kind, direct_key) values ('direct', v_key)
    on conflict (direct_key) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from public.chat_conversations where direct_key = v_key;
    end if;
  end if;
  insert into public.chat_participants (conversation_id, user_id)
  values (v_id, p_a), (v_id, p_b)
  on conflict do nothing;
  return v_id;
end;
$$;

revoke execute on function public.chat_ensure_direct(uuid, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Contactos: todo pasa por funciones que validan con la sesión
-- -----------------------------------------------------------------------------

-- Busca personas con quien chatear (sólo cuentas activas que usan el chat y
-- que no me bloquearon). relation: none, outgoing, incoming, contact, blocked.
create or replace function public.chat_search_users(p_query text default '')
returns table (
  id uuid, display_name text, avatar_path text, avatar_emoji text, bio text,
  relation text, contact_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_query text := left(btrim(coalesce(p_query, '')), 80);
begin
  if auth.uid() is null or not public.has_permission('chat.use') then
    raise exception 'No tienes permiso para usar el chat' using errcode = '42501';
  end if;
  -- Los comodines de LIKE se buscan como texto.
  v_query := replace(replace(replace(v_query, '\', '\\'), '%', '\%'), '_', '\_');
  return query
    select p.id, p.display_name, p.avatar_path, p.avatar_emoji, p.bio,
           case
             when exists (select 1 from public.chat_blocks b where b.blocker_id = auth.uid() and b.blocked_id = p.id) then 'blocked'
             when c.status = 'accepted' then 'contact'
             when c.requester_id = auth.uid() then 'outgoing'
             when c.id is not null then 'incoming'
             else 'none'
           end,
           c.id
      from public.profiles p
      left join public.chat_contacts c
        on least(c.requester_id, c.addressee_id) = least(p.id, auth.uid())
       and greatest(c.requester_id, c.addressee_id) = greatest(p.id, auth.uid())
     where p.id <> auth.uid()
       and public.user_can_chat(p.id)
       and not exists (select 1 from public.chat_blocks b where b.blocker_id = p.id and b.blocked_id = auth.uid())
       and (v_query = '' or p.display_name ilike '%' || v_query || '%')
     order by (c.status = 'accepted') desc nulls last, p.display_name
     limit 30;
end;
$$;

-- Manda una solicitud. Si la otra persona ya me había mandado una, se acepta
-- de una vez. Devuelve el estado: pending o accepted.
create or replace function public.chat_request_contact(p_user uuid, p_message text default '')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.chat_contacts;
begin
  if auth.uid() is null or not public.has_permission('chat.use') then
    raise exception 'No tienes permiso para usar el chat' using errcode = '42501';
  end if;
  if p_user is null or p_user = auth.uid() then
    raise exception 'No puedes enviarte una solicitud a ti' using errcode = '22023';
  end if;
  if not public.user_can_chat(p_user) then
    raise exception 'Esa persona no está disponible en el chat' using errcode = '22023';
  end if;
  if public.chat_is_blocked(auth.uid(), p_user) then
    raise exception 'No puedes enviarle una solicitud a esta persona' using errcode = '42501';
  end if;

  select * into v_existing from public.chat_contacts
   where least(requester_id, addressee_id) = least(auth.uid(), p_user)
     and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_user)
   for update;

  if v_existing.id is not null then
    if v_existing.status = 'accepted' then
      return 'accepted';
    end if;
    if v_existing.requester_id = auth.uid() then
      return 'pending';
    end if;
    -- Me la había mandado a mí: queda aceptada.
    perform public.chat_ensure_direct(auth.uid(), p_user);
    update public.chat_contacts set status = 'accepted', responded_at = now() where id = v_existing.id;
    return 'accepted';
  end if;

  insert into public.chat_contacts (requester_id, addressee_id, message)
  values (auth.uid(), p_user, left(btrim(coalesce(p_message, '')), 200));
  return 'pending';
end;
$$;

-- La persona que recibió la solicitud la acepta (abre el chat y devuelve su
-- id) o la rechaza (se borra y devuelve null).
create or replace function public.chat_respond_contact(p_contact uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contact public.chat_contacts;
  v_conversation uuid;
begin
  if auth.uid() is null or not public.has_permission('chat.use') then
    raise exception 'No tienes permiso para usar el chat' using errcode = '42501';
  end if;
  select * into v_contact from public.chat_contacts
   where id = p_contact and addressee_id = auth.uid() and status = 'pending'
   for update;
  if v_contact.id is null then
    raise exception 'Esa solicitud ya no está pendiente' using errcode = 'P0002';
  end if;
  if not p_accept then
    delete from public.chat_contacts where id = v_contact.id;
    return null;
  end if;
  if not public.user_can_chat(v_contact.requester_id) then
    raise exception 'Esa persona ya no está disponible en el chat' using errcode = '22023';
  end if;
  -- El chat se crea antes de aceptar: así el aviso ya lleva su enlace.
  v_conversation := public.chat_ensure_direct(v_contact.requester_id, auth.uid());
  update public.chat_contacts set status = 'accepted', responded_at = now() where id = v_contact.id;
  return v_conversation;
end;
$$;

-- Cancela la solicitud que mandé, o deja de ser contacto (el historial se
-- conserva, pero ya no se puede escribir hasta volver a aceptarse).
create or replace function public.chat_remove_contact(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  delete from public.chat_contacts
   where least(requester_id, addressee_id) = least(auth.uid(), p_user)
     and greatest(requester_id, addressee_id) = greatest(auth.uid(), p_user);
end;
$$;

create or replace function public.chat_block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('chat.use') then
    raise exception 'No tienes permiso para usar el chat' using errcode = '42501';
  end if;
  if p_user is null or p_user = auth.uid() then
    raise exception 'No puedes bloquearte a ti' using errcode = '22023';
  end if;
  insert into public.chat_blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  perform public.chat_remove_contact(p_user);
end;
$$;

create or replace function public.chat_unblock_user(p_user uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.chat_blocks where blocker_id = auth.uid() and blocked_id = p_user;
$$;

-- Abre el chat directo con un contacto (lo crea si hace falta).
create or replace function public.chat_open_direct(p_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('chat.use') then
    raise exception 'No tienes permiso para usar el chat' using errcode = '42501';
  end if;
  if not public.chat_are_contacts(auth.uid(), p_user) then
    raise exception 'Primero tienen que aceptarse como contactos' using errcode = '42501';
  end if;
  return public.chat_ensure_direct(auth.uid(), p_user);
end;
$$;

-- -----------------------------------------------------------------------------
-- Conversaciones: leer, escribiendo y preferencias
-- -----------------------------------------------------------------------------

create or replace function public.chat_mark_read(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('chat.use') then
    raise exception 'No tienes permiso para usar el chat' using errcode = '42501';
  end if;
  update public.chat_participants
     set last_read_at = now()
   where conversation_id = p_conversation and user_id = auth.uid()
     and (last_read_at is null or last_read_at < now());
  -- Los avisos de esta conversación quedan leídos.
  update public.notifications
     set read_at = now()
   where user_id = auth.uid() and kind = 'chat' and read_at is null
     and link = '/chat/' || p_conversation::text;
  perform public.chat_presence(false);
end;
$$;

create or replace function public.chat_typing(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.chat_can_send(p_conversation) then
    return;
  end if;
  update public.chat_participants
     set typing_at = now()
   where conversation_id = p_conversation and user_id = auth.uid()
     -- Como mucho una escritura cada 2 segundos por persona.
     and (typing_at is null or typing_at < now() - interval '2 seconds');
end;
$$;

-- Fijar, archivar, silenciar o vaciar (cada cosa es opcional: null = igual).
create or replace function public.chat_update_conversation(
  p_conversation uuid, p_pinned boolean default null, p_archived boolean default null,
  p_muted boolean default null, p_clear boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.has_permission('chat.use') then
    raise exception 'No tienes permiso para usar el chat' using errcode = '42501';
  end if;
  update public.chat_participants
     set pinned_at = case when p_pinned is null then pinned_at when p_pinned then coalesce(pinned_at, now()) end,
         archived_at = case when p_archived is null then archived_at when p_archived then coalesce(archived_at, now()) end,
         muted = coalesce(p_muted, muted),
         cleared_at = case when p_clear then now() else cleared_at end
   where conversation_id = p_conversation and user_id = auth.uid();
  if not found then
    raise exception 'Esa conversación no existe' using errcode = 'P0002';
  end if;
end;
$$;

-- Bandeja: mis conversaciones con su último mensaje y cuántos no he leído.
-- Corre con los permisos de quien llama (RLS).
create or replace function public.chat_inbox()
returns table (
  conversation_id uuid, kind text, title text, created_at timestamptz, last_message_at timestamptz,
  participant_ids uuid[], pinned_at timestamptz, archived_at timestamptz, muted boolean,
  last_read_at timestamptz, unread integer, last_message jsonb
)
language sql
stable
set search_path = public
as $$
  select c.id, c.kind, c.title, c.created_at, c.last_message_at,
         array(select p.user_id from public.chat_participants p where p.conversation_id = c.id order by p.joined_at, p.user_id),
         me.pinned_at, me.archived_at, me.muted, me.last_read_at,
         (select count(*)::int from public.chat_messages m
           where m.conversation_id = c.id and m.sender_id <> me.user_id and m.deleted_at is null
             and m.created_at > coalesce(me.last_read_at, '-infinity'::timestamptz)),
         (select to_jsonb(x) from (
            select m.id, m.sender_id, m.kind, m.body, m.sticker, m.created_at, m.deleted_at
              from public.chat_messages m
             where m.conversation_id = c.id
             order by m.created_at desc
             limit 1) x)
    from public.chat_participants me
    join public.chat_conversations c on c.id = me.conversation_id
   where me.user_id = auth.uid() and public.has_permission('chat.use');
$$;

-- -----------------------------------------------------------------------------
-- Mensajes: editar y borrar para todos
-- -----------------------------------------------------------------------------

create or replace function public.chat_edit_message(p_message uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.chat_messages;
  v_body text := btrim(coalesce(p_body, ''));
begin
  select * into v_message from public.chat_messages where id = p_message and sender_id = auth.uid() for update;
  if v_message.id is null or v_message.deleted_at is not null then
    raise exception 'Ese mensaje no se puede editar' using errcode = '42501';
  end if;
  if not public.chat_can_send(v_message.conversation_id) then
    raise exception 'No puedes escribir en este chat' using errcode = '42501';
  end if;
  if v_message.kind = 'sticker' then
    raise exception 'Un sticker no se edita' using errcode = '22023';
  end if;
  if v_message.created_at < now() - interval '15 minutes' then
    raise exception 'Sólo se puede editar durante los primeros 15 minutos' using errcode = '22023';
  end if;
  if char_length(v_body) > 2000 or (v_message.kind = 'text' and v_body = '') then
    raise exception 'Escribe un mensaje (hasta 2000 caracteres)' using errcode = '22023';
  end if;
  if v_body = v_message.body then
    return;
  end if;
  update public.chat_messages set body = v_body, edited_at = now() where id = v_message.id;
end;
$$;

-- Borra para todos: queda «Se eliminó este mensaje». Devuelve las rutas de la
-- foto (si tenía) para que la app las quite del almacenamiento.
create or replace function public.chat_delete_message(p_message uuid)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_message public.chat_messages;
begin
  select * into v_message from public.chat_messages where id = p_message and sender_id = auth.uid() for update;
  if v_message.id is null then
    raise exception 'Sólo puedes borrar tus mensajes' using errcode = '42501';
  end if;
  if v_message.deleted_at is not null then
    return array[]::text[];
  end if;
  update public.chat_messages
     set body = '', image_path = null, thumb_path = null, sticker = null, deleted_at = now()
   where id = v_message.id;
  delete from public.chat_reactions where message_id = v_message.id;
  return array_remove(array[v_message.image_path, v_message.thumb_path], null);
end;
$$;

-- Busca texto en una conversación (RLS: sólo la mía).
create or replace function public.chat_search_messages(p_conversation uuid, p_query text)
returns setof public.chat_messages
language sql
stable
set search_path = public
as $$
  select m.*
    from public.chat_messages m
   where m.conversation_id = p_conversation
     and m.deleted_at is null
     and char_length(btrim(coalesce(p_query, ''))) >= 2
     and m.body ilike '%' || replace(replace(replace(left(btrim(p_query), 80), '\', '\\'), '%', '\%'), '_', '\_') || '%'
   order by m.created_at desc
   limit 50;
$$;

-- -----------------------------------------------------------------------------
-- Disparadores
-- -----------------------------------------------------------------------------

-- La cita tiene que ser de la misma conversación.
create or replace function public.guard_chat_message_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.edited_at := null;
  new.deleted_at := null;
  if new.reply_to is not null and not exists (
    select 1 from public.chat_messages m where m.id = new.reply_to and m.conversation_id = new.conversation_id
  ) then
    raise exception 'Sólo puedes responder mensajes de este chat' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger chat_messages_guard before insert on public.chat_messages
  for each row execute function public.guard_chat_message_insert();

-- Al llegar un mensaje: sube la conversación en la bandeja y quien escribió
-- deja de aparecer «escribiendo…».
create or replace function public.chat_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_conversations set last_message_at = new.created_at where id = new.conversation_id;
  update public.chat_participants
     set typing_at = null, last_read_at = greatest(coalesce(last_read_at, new.created_at), new.created_at)
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end;
$$;

create trigger chat_messages_after after insert on public.chat_messages
  for each row execute function public.chat_after_message();

-- Avisos del chat: sólo a quienes están en la conversación y no la
-- silenciaron. Un aviso sin leer por conversación, que se actualiza con el
-- último mensaje (y eso también manda el push).
create or replace function public.notify_new_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_title text;
  v_preview text;
  v_link text := '/chat/' || new.conversation_id::text;
  v_conversation public.chat_conversations;
begin
  select coalesce(nullif(display_name, ''), 'Alguien') into v_name from public.profiles where id = new.sender_id;
  v_name := coalesce(v_name, 'Alguien');
  select * into v_conversation from public.chat_conversations where id = new.conversation_id;
  v_title := case when v_conversation.kind = 'group' and v_conversation.title <> ''
    then v_name || ' en ' || v_conversation.title || ' 💬'
    else v_name || ' te escribió 💬' end;
  v_preview := left(case new.kind
    when 'image' then '📷 Foto' || coalesce(nullif(': ' || btrim(new.body), ': '), '')
    when 'sticker' then '✨ Sticker'
    else new.body
  end, 140);

  with recipients as (
    select cp.user_id as id
      from public.chat_participants cp
     where cp.conversation_id = new.conversation_id
       and cp.user_id <> new.sender_id
       and not cp.muted
       and public.user_can_chat(cp.user_id)
       and not public.chat_is_blocked(cp.user_id, new.sender_id)
  ), updated as (
    update public.notifications n
       set title = v_title, body = v_preview, created_at = now()
      from recipients r
     where n.user_id = r.id and n.kind = 'chat' and n.read_at is null and n.link = v_link
    returning n.user_id
  )
  insert into public.notifications (user_id, kind, title, body, link)
  select r.id, 'chat', v_title, v_preview, v_link
    from recipients r
   where r.id not in (select user_id from updated);
  return new;
end;
$$;

-- Solicitudes: avisan a quien la recibe y, al aceptarse, a quien la mandó.
create or replace function public.notify_chat_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_conversation uuid;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    select coalesce(nullif(display_name, ''), 'Alguien') into v_name from public.profiles where id = new.requester_id;
    insert into public.notifications (user_id, kind, title, body, link)
    values (new.addressee_id, 'chat', coalesce(v_name, 'Alguien') || ' quiere chatear contigo 👋',
            left(coalesce(nullif(new.message, ''), 'Toca para ver la solicitud'), 140), '/chat/solicitudes');
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    select coalesce(nullif(display_name, ''), 'Alguien') into v_name from public.profiles where id = new.addressee_id;
    select id into v_conversation from public.chat_conversations
     where direct_key = least(new.requester_id, new.addressee_id)::text || ':' || greatest(new.requester_id, new.addressee_id)::text;
    insert into public.notifications (user_id, kind, title, body, link)
    values (new.requester_id, 'chat', coalesce(v_name, 'Alguien') || ' aceptó tu solicitud 🎉', 'Ya pueden chatear',
            case when v_conversation is null then '/chat' else '/chat/' || v_conversation::text end);
  end if;
  return new;
end;
$$;

create trigger chat_contacts_notify after insert or update on public.chat_contacts
  for each row execute function public.notify_chat_contact();

create trigger chat_contacts_rate_limit before insert on public.chat_contacts
  for each row execute function public.enforce_rate_limit('requester_id', '20', '1 hour');
create trigger chat_reactions_rate_limit before insert on public.chat_reactions
  for each row execute function public.enforce_rate_limit('user_id', '60', '1 minute');

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.chat_contacts enable row level security;
alter table public.chat_blocks enable row level security;
alter table public.chat_conversations enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_hidden_messages enable row level security;
alter table public.chat_reactions enable row level security;

-- Las solicitudes y los contactos sólo los ven sus dos personas; se crean y
-- cambian únicamente con las funciones de arriba.
create policy "chat_contacts: ver las mías" on public.chat_contacts
  for select to authenticated
  using (requester_id = auth.uid() or addressee_id = auth.uid());

-- Mis bloqueos (la persona bloqueada no ve nada).
create policy "chat_blocks: ver los míos" on public.chat_blocks
  for select to authenticated using (blocker_id = auth.uid());

create policy "chat_conversations: ver las mías" on public.chat_conversations
  for select to authenticated
  using (public.has_permission('chat.use') and public.is_chat_participant(id));

-- Veo a quienes comparten conversación conmigo (vistos y «escribiendo…»).
create policy "chat_participants: ver los de mis chats" on public.chat_participants
  for select to authenticated
  using (public.has_permission('chat.use') and public.is_chat_participant(conversation_id));

-- Mensajes: sólo de mis conversaciones, desde que vacié el chat y sin los que
-- borré para mí.
drop policy "chat: leer" on public.chat_messages;
create policy "chat: leer" on public.chat_messages
  for select to authenticated
  using (
    public.has_permission('chat.use')
    and created_at > public.chat_visible_since(conversation_id)
    and not exists (
      select 1 from public.chat_hidden_messages h where h.message_id = id and h.user_id = auth.uid()
    )
  );

drop policy "chat: escribir" on public.chat_messages;
create policy "chat: escribir" on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.chat_can_send(conversation_id)
    and (image_path is null or (
      split_part(image_path, '/', 1) = auth.uid()::text
      and split_part(thumb_path, '/', 1) = auth.uid()::text
    ))
  );

-- Borrar para todos es con chat_delete_message (deja el aviso en el chat).
drop policy "chat: borrar los propios" on public.chat_messages;

create policy "chat_hidden_messages: los míos" on public.chat_hidden_messages
  for select to authenticated using (user_id = auth.uid());
create policy "chat_hidden_messages: ocultar" on public.chat_hidden_messages
  for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.chat_messages m where m.id = message_id));
create policy "chat_hidden_messages: volver a mostrar" on public.chat_hidden_messages
  for delete to authenticated using (user_id = auth.uid());

create policy "chat_reactions: ver" on public.chat_reactions
  for select to authenticated
  using (exists (select 1 from public.chat_messages m where m.id = message_id));
create policy "chat_reactions: reaccionar" on public.chat_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.chat_messages m
                 where m.id = message_id and m.deleted_at is null and public.chat_can_send(m.conversation_id))
  );
create policy "chat_reactions: cambiar la mía" on public.chat_reactions
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and exists (select 1 from public.chat_messages m where m.id = message_id and m.deleted_at is null));
create policy "chat_reactions: quitar la mía" on public.chat_reactions
  for delete to authenticated using (user_id = auth.uid());

-- La conexión de alguien la ve sólo quien comparte un chat con esa persona.
drop policy "chat_reads: ver" on public.chat_reads;
create policy "chat_reads: ver" on public.chat_reads
  for select to authenticated
  using (public.has_permission('chat.use') and public.chat_shares_conversation(user_id));

-- -----------------------------------------------------------------------------
-- Fotos del chat: las ve quien está en la conversación del mensaje (o quien
-- la subió, mientras se envía).
-- -----------------------------------------------------------------------------
drop policy "chat-media: ver" on storage.objects;
create policy "chat-media: ver" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-media'
    and public.has_permission('chat.use')
    and (
      split_part(name, '/', 1) = auth.uid()::text
      or exists (select 1 from public.chat_messages m where m.image_path = name or m.thumb_path = name)
    )
  );

-- -----------------------------------------------------------------------------
-- Permisos de ejecución
-- -----------------------------------------------------------------------------
revoke execute on function public.user_can_chat(uuid) from public, anon;
revoke execute on function public.is_chat_participant(uuid) from public, anon;
revoke execute on function public.chat_visible_since(uuid) from public, anon;
revoke execute on function public.chat_is_blocked(uuid, uuid) from public, anon;
revoke execute on function public.chat_are_contacts(uuid, uuid) from public, anon;
revoke execute on function public.chat_can_send(uuid) from public, anon;
revoke execute on function public.chat_shares_conversation(uuid) from public, anon;
revoke execute on function public.chat_search_users(text) from public, anon;
revoke execute on function public.chat_request_contact(uuid, text) from public, anon;
revoke execute on function public.chat_respond_contact(uuid, boolean) from public, anon;
revoke execute on function public.chat_remove_contact(uuid) from public, anon;
revoke execute on function public.chat_block_user(uuid) from public, anon;
revoke execute on function public.chat_unblock_user(uuid) from public, anon;
revoke execute on function public.chat_open_direct(uuid) from public, anon;
revoke execute on function public.chat_mark_read(uuid) from public, anon;
revoke execute on function public.chat_typing(uuid) from public, anon;
revoke execute on function public.chat_update_conversation(uuid, boolean, boolean, boolean, boolean) from public, anon;
revoke execute on function public.chat_inbox() from public, anon;
revoke execute on function public.chat_edit_message(uuid, text) from public, anon;
revoke execute on function public.chat_delete_message(uuid) from public, anon;
revoke execute on function public.chat_search_messages(uuid, text) from public, anon;
revoke execute on function public.guard_chat_message_insert() from public, anon, authenticated;
revoke execute on function public.chat_after_message() from public, anon, authenticated;
revoke execute on function public.notify_chat_contact() from public, anon, authenticated;

grant execute on function public.user_can_chat(uuid) to authenticated;
grant execute on function public.is_chat_participant(uuid) to authenticated;
grant execute on function public.chat_visible_since(uuid) to authenticated;
grant execute on function public.chat_is_blocked(uuid, uuid) to authenticated;
grant execute on function public.chat_are_contacts(uuid, uuid) to authenticated;
grant execute on function public.chat_can_send(uuid) to authenticated;
grant execute on function public.chat_shares_conversation(uuid) to authenticated;
grant execute on function public.chat_search_users(text) to authenticated;
grant execute on function public.chat_request_contact(uuid, text) to authenticated;
grant execute on function public.chat_respond_contact(uuid, boolean) to authenticated;
grant execute on function public.chat_remove_contact(uuid) to authenticated;
grant execute on function public.chat_block_user(uuid) to authenticated;
grant execute on function public.chat_unblock_user(uuid) to authenticated;
grant execute on function public.chat_open_direct(uuid) to authenticated;
grant execute on function public.chat_mark_read(uuid) to authenticated;
grant execute on function public.chat_typing(uuid) to authenticated;
grant execute on function public.chat_update_conversation(uuid, boolean, boolean, boolean, boolean) to authenticated;
grant execute on function public.chat_inbox() to authenticated;
grant execute on function public.chat_edit_message(uuid, text) to authenticated;
grant execute on function public.chat_delete_message(uuid) to authenticated;
grant execute on function public.chat_search_messages(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- Realtime: solicitudes, vistos, «escribiendo…» y reacciones en vivo
-- (Realtime también respeta RLS).
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.chat_contacts,
  public.chat_participants,
  public.chat_reactions,
  public.chat_hidden_messages;
