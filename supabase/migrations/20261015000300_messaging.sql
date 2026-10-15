-- =============================================================================
-- 003 · Cajita de mensajes, chat, notificaciones y suscripciones push
-- =============================================================================

create type public.note_kind as enum ('love', 'apology', 'note', 'surprise', 'reminder');

-- Notitas privadas de una persona a otra.
create table public.notes (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  recipient_id  uuid not null references auth.users (id) on delete cascade,
  kind          public.note_kind not null default 'note',
  title         text not null default '' check (char_length(title) <= 160),
  body          text not null check (char_length(body) between 1 and 4000),
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  constraint notes_not_self check (sender_id <> recipient_id)
);

create index notes_recipient_idx on public.notes (recipient_id, created_at desc);
create index notes_sender_idx on public.notes (sender_id, created_at desc);

-- Chat compartido de la pareja (una sola sala).
create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  sender_id   uuid not null references auth.users (id) on delete cascade default auth.uid(),
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index chat_messages_created_idx on public.chat_messages (created_at desc);

create table public.chat_reads (
  user_id       uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  last_read_at  timestamptz not null default now()
);

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('note', 'chat', 'system')),
  title       text not null,
  body        text not null default '',
  link        text check (link is null or link ~ '^/'),
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  endpoint    text not null unique check (endpoint ~ '^https://'),
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Reglas de negocio
-- -----------------------------------------------------------------------------

-- El destinatario sólo puede marcar la nota como leída, nada más.
create or replace function public.guard_note_update()
returns trigger
language plpgsql
as $$
begin
  if (new.sender_id, new.recipient_id, new.kind, new.title, new.body, new.created_at)
     is distinct from
     (old.sender_id, old.recipient_id, old.kind, old.title, old.body, old.created_at) then
    raise exception 'Una notita enviada no se puede modificar' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notes_guard before update on public.notes
  for each row execute function public.guard_note_update();

-- Las notificaciones las crea la base de datos, nunca el cliente: así nadie
-- puede fabricar avisos falsos para otro usuario.
create or replace function public.notify_new_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  select display_name into sender_name from public.profiles where id = new.sender_id;
  insert into public.notifications (user_id, kind, title, body, link)
  values (
    new.recipient_id,
    'note',
    case new.kind
      when 'apology'  then coalesce(sender_name, 'Alguien') || ' te pide perdón 🥺'
      when 'love'     then coalesce(sender_name, 'Alguien') || ' te mandó amor 💌'
      when 'surprise' then coalesce(sender_name, 'Alguien') || ' te dejó una sorpresa 🎁'
      else coalesce(sender_name, 'Alguien') || ' te dejó una notita ✉️'
    end,
    left(coalesce(nullif(new.title, ''), new.body), 140),
    '/mensajes'
  );
  return new;
end;
$$;

create trigger notes_notify after insert on public.notes
  for each row execute function public.notify_new_note();

create or replace function public.notify_new_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
begin
  select display_name into sender_name from public.profiles where id = new.sender_id;
  -- Evita inundar de avisos: sólo se notifica si el destinatario no tiene ya
  -- un aviso de chat sin leer.
  insert into public.notifications (user_id, kind, title, body, link)
  select p.id, 'chat', coalesce(sender_name, 'Alguien') || ' te escribió 💬', left(new.body, 140), '/chat'
    from public.profiles p
   where p.id <> new.sender_id
     and p.is_active
     and (p.role = 'super_admin' or exists (
           select 1 from public.role_permissions rp
            where rp.role = p.role and rp.permission = 'chat.use'))
     and not exists (
           select 1 from public.notifications n
            where n.user_id = p.id and n.kind = 'chat' and n.read_at is null);
  return new;
end;
$$;

create trigger chat_messages_notify after insert on public.chat_messages
  for each row execute function public.notify_new_chat_message();

-- Marca como leídas todas las notificaciones de un tipo (o todas).
create or replace function public.mark_notifications_read(p_kind text default null)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null
     and (p_kind is null or kind = p_kind);
$$;

grant execute on function public.mark_notifications_read(text) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.notes enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "notes: ver las propias" on public.notes
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());
create policy "notes: enviar" on public.notes
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.has_permission('notes.send')
    and exists (select 1 from public.profiles p where p.id = recipient_id and p.is_active)
  );
create policy "notes: marcar leída" on public.notes
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());
create policy "notes: borrar enviadas o recibidas" on public.notes
  for delete to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

create policy "chat: leer" on public.chat_messages
  for select to authenticated using (public.has_permission('chat.use'));
create policy "chat: escribir" on public.chat_messages
  for insert to authenticated
  with check (sender_id = auth.uid() and public.has_permission('chat.use'));
create policy "chat: borrar los propios" on public.chat_messages
  for delete to authenticated using (sender_id = auth.uid());

create policy "chat_reads: propios" on public.chat_reads
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications: ver las propias" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "notifications: marcar leídas" on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
create policy "notifications: borrar las propias" on public.notifications
  for delete to authenticated using (user_id = auth.uid());

create policy "push_subscriptions: propias" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
