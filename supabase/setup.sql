-- =============================================================================
-- Archivo generado con `npm run db:setup-sql`; no lo edites a mano.
-- Crea toda la base de datos (migraciones + contenido inicial) de una vez.
-- Pégalo completo en Supabase → SQL Editor → Run, una sola vez, en un
-- proyecto nuevo.
-- =============================================================================

-- >>> migrations/20261015000100_core_schema.sql
-- =============================================================================
-- 001 · Esquema base: perfiles, roles y permisos
-- -----------------------------------------------------------------------------
-- Modelo RBAC: cada perfil tiene un rol y cada rol un conjunto de permisos.
-- El rol super_admin tiene todos los permisos de forma implícita, así nunca
-- puede quedar bloqueado fuera de su propio panel.
-- =============================================================================


create type public.app_role as enum ('super_admin', 'editor', 'viewer');

create table public.permissions (
  key         text primary key check (key ~ '^[a-z]+\.[a-z_]+$'),
  description text not null
);

create table public.role_permissions (
  role       public.app_role not null,
  permission text not null references public.permissions (key) on delete cascade,
  primary key (role, permission)
);

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  avatar_url   text check (avatar_url is null or avatar_url ~ '^https://'),
  role         public.app_role not null default 'viewer',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'Un perfil por usuario de auth.users. El rol define sus permisos.';

-- -----------------------------------------------------------------------------
-- Utilidades
-- -----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Rol del usuario autenticado (null si no hay sesión o está desactivado).
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active;
$$;

-- ¿El usuario actual tiene el permiso indicado?
create or replace function public.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pr.role = 'super_admin'
         or exists (
           select 1 from public.role_permissions rp
           where rp.role = pr.role and rp.permission = p_permission
         )
       from public.profiles pr
      where pr.id = auth.uid() and pr.is_active),
    false
  );
$$;

-- Lista de permisos efectivos del usuario actual (la usa el front para
-- mostrar u ocultar menús; la seguridad real la imponen las políticas RLS).
create or replace function public.my_permissions()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select p.key
    from public.permissions p
    join public.profiles pr on pr.id = auth.uid() and pr.is_active
   where pr.role = 'super_admin'
      or exists (select 1 from public.role_permissions rp
                  where rp.role = pr.role and rp.permission = p.key);
$$;

-- -----------------------------------------------------------------------------
-- Alta automática de perfil al crear un usuario de Auth
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1)),
    -- Sólo el service role (función admin-users) puede fijar el rol inicial.
    case
      when (new.raw_app_meta_data ->> 'app_role') in ('editor', 'viewer', 'super_admin')
        then (new.raw_app_meta_data ->> 'app_role')::public.app_role
      else 'viewer'
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Protección contra escalada de privilegios
-- -----------------------------------------------------------------------------
-- Un usuario puede editar su nombre y avatar, pero sólo quien tenga
-- users.manage puede cambiar rol o estado. Además nunca se puede dejar el
-- sistema sin al menos un super_admin activo.
create or replace function public.guard_profile_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.role is distinct from old.role or new.is_active is distinct from old.is_active) then
    -- auth.uid() es null en el editor SQL y con la service role: se permite.
    if auth.uid() is not null and not public.has_permission('users.manage') then
      raise exception 'No tienes permiso para cambiar roles o estados' using errcode = '42501';
    end if;

    if old.role = 'super_admin' and old.is_active
       and (new.role <> 'super_admin' or not new.is_active)
       and (select count(*) from public.profiles
             where role = 'super_admin' and is_active and id <> old.id) = 0 then
      raise exception 'Debe existir al menos un super administrador activo' using errcode = '23514';
    end if;
  end if;
  new.id := old.id;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_changes();

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;

create policy "permissions: lectura para usuarios" on public.permissions
  for select to authenticated using (true);
create policy "permissions: gestión" on public.permissions
  for all to authenticated
  using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

create policy "role_permissions: lectura para usuarios" on public.role_permissions
  for select to authenticated using (true);
create policy "role_permissions: gestión" on public.role_permissions
  for all to authenticated
  using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

-- Los usuarios activos se ven entre sí (para el chat y la cajita de mensajes).
create policy "profiles: lectura entre usuarios activos" on public.profiles
  for select to authenticated
  using (public.current_app_role() is not null);
create policy "profiles: editar el propio" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());
create policy "profiles: gestión" on public.profiles
  for update to authenticated
  using (public.has_permission('users.manage'))
  with check (public.has_permission('users.manage'));

grant execute on function public.has_permission(text) to anon, authenticated;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.current_app_role() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Catálogo de permisos y asignación por defecto
-- -----------------------------------------------------------------------------

insert into public.permissions (key, description) values
  ('site.view',            'Ver el sitio cuando es privado'),
  ('content.edit',         'Editar textos, tarjetas, hitos y animaciones de secciones'),
  ('photos.manage',        'Subir, mover, editar y borrar fotos'),
  ('dates.manage',         'Gestionar fechas importantes y contadores'),
  ('interruptions.manage', 'Crear interrupciones (sorpresas emergentes)'),
  ('notes.send',           'Enviar notitas a la cajita de mensajes'),
  ('chat.use',             'Usar el chat'),
  ('sections.manage',      'Crear, ordenar y ocultar secciones'),
  ('theme.manage',         'Cambiar colores, tipografías, efectos y animaciones'),
  ('settings.manage',      'Configuración general del sitio'),
  ('users.manage',         'Gestionar usuarios, roles y permisos'),
  ('audit.view',           'Ver el registro de auditoría');

insert into public.role_permissions (role, permission) values
  ('editor', 'site.view'),
  ('editor', 'content.edit'),
  ('editor', 'photos.manage'),
  ('editor', 'dates.manage'),
  ('editor', 'interruptions.manage'),
  ('editor', 'notes.send'),
  ('editor', 'chat.use'),
  ('viewer', 'site.view'),
  ('viewer', 'notes.send'),
  ('viewer', 'chat.use');

-- >>> migrations/20261015000200_content.sql
-- =============================================================================
-- 002 · Contenido del sitio: configuración, secciones, fotos, hitos, fechas
-- e interrupciones
-- =============================================================================

create table public.site_settings (
  id                 smallint primary key default 1 check (id = 1),
  site_title         text not null default 'Para el amor de mi vida' check (char_length(site_title) <= 120),
  site_subtitle      text not null default '' check (char_length(site_subtitle) <= 300),
  relationship_start date,
  is_public          boolean not null default false,
  music_url          text check (music_url is null or music_url ~ '^https://'),
  -- Tokens de diseño: { "primary": "#b0305a", "accent": "...", "fontDisplay": "...", ... }
  theme              jsonb not null default '{}'::jsonb check (jsonb_typeof(theme) = 'object'),
  -- Efectos globales: { "floating": { "enabled": true, "emojis": [...], "density": 18 }, ... }
  effects            jsonb not null default '{}'::jsonb check (jsonb_typeof(effects) = 'object'),
  updated_at         timestamptz not null default now(),
  updated_by         uuid references auth.users (id) on delete set null default auth.uid()
);

insert into public.site_settings (id) values (1);

-- ¿Puede el visitante actual ver el contenido del sitio?
create or replace function public.can_view_site()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_public from public.site_settings where id = 1), false)
      or public.has_permission('site.view');
$$;

grant execute on function public.can_view_site() to anon, authenticated;

create type public.section_kind as enum (
  'hero', 'love_notes', 'together_counter', 'countdowns', 'milestones',
  'gallery', 'letter', 'text', 'quote'
);

create type public.section_animation as enum (
  'none', 'fade-up', 'zoom-in', 'slide-left', 'slide-right', 'float', 'heartbeat'
);

create table public.sections (
  id          uuid primary key default gen_random_uuid(),
  kind        public.section_kind not null,
  title       text not null default '' check (char_length(title) <= 160),
  subtitle    text not null default '' check (char_length(subtitle) <= 400),
  -- Contenido específico de cada tipo (tarjetas, párrafos, cita...).
  content     jsonb not null default '{}'::jsonb check (jsonb_typeof(content) = 'object'),
  animation   public.section_animation not null default 'fade-up',
  position    integer not null default 0,
  is_visible  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index sections_position_idx on public.sections (position);

create table public.photos (
  id            uuid primary key default gen_random_uuid(),
  -- Ruta en el bucket privado "photos" (fotos nuevas) ...
  storage_path  text unique,
  thumb_path    text,
  -- ... o URL estática (fotos heredadas de la versión original).
  external_url  text check (external_url is null or external_url ~ '^(/|https://)'),
  caption       text not null default '' check (char_length(caption) <= 500),
  taken_on      date not null default current_date,
  position      integer not null default 0,
  width         integer check (width is null or width > 0),
  height        integer check (height is null or height > 0),
  bytes         integer check (bytes is null or bytes > 0),
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint photos_has_source check (storage_path is not null or external_url is not null)
);

create index photos_taken_on_idx on public.photos (taken_on, position);

create table public.milestones (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 160),
  description  text not null default '' check (char_length(description) <= 2000),
  happened_on  date not null,
  icon         text not null default '💖' check (char_length(icon) <= 16),
  photo_id     uuid references public.photos (id) on delete set null,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index milestones_date_idx on public.milestones (happened_on, position);

create table public.important_dates (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 120),
  event_date    date not null,
  recurs_yearly boolean not null default true,
  icon          text not null default '🎉' check (char_length(icon) <= 16),
  message       text not null default '' check (char_length(message) <= 500),
  is_visible    boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create type public.interruption_style as enum ('modal', 'banner', 'confetti', 'hearts');

-- "Interrupciones": sorpresas que aparecen al abrir la página durante una
-- ventana de tiempo (p. ej. "¡Feliz mesiversario!").
create table public.interruptions (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 160),
  body        text not null default '' check (char_length(body) <= 2000),
  style       public.interruption_style not null default 'modal',
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  is_active   boolean not null default true,
  show_once   boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint interruptions_window check (ends_at is null or ends_at > starts_at)
);

create table public.interruption_views (
  interruption_id uuid not null references public.interruptions (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade default auth.uid(),
  seen_at         timestamptz not null default now(),
  primary key (interruption_id, user_id)
);

create trigger site_settings_touch before update on public.site_settings
  for each row execute function public.touch_updated_at();
create trigger sections_touch before update on public.sections
  for each row execute function public.touch_updated_at();
create trigger photos_touch before update on public.photos
  for each row execute function public.touch_updated_at();
create trigger milestones_touch before update on public.milestones
  for each row execute function public.touch_updated_at();
create trigger important_dates_touch before update on public.important_dates
  for each row execute function public.touch_updated_at();
create trigger interruptions_touch before update on public.interruptions
  for each row execute function public.touch_updated_at();

-- Ajustes: theme/effects sólo con theme.manage, el resto con settings.manage.
create or replace function public.guard_site_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if (new.theme is distinct from old.theme or new.effects is distinct from old.effects)
     and not public.has_permission('theme.manage') then
    raise exception 'No tienes permiso para cambiar el tema' using errcode = '42501';
  end if;
  if (new.site_title, new.site_subtitle, new.relationship_start, new.is_public, new.music_url)
     is distinct from
     (old.site_title, old.site_subtitle, old.relationship_start, old.is_public, old.music_url)
     and not public.has_permission('settings.manage') then
    raise exception 'No tienes permiso para cambiar la configuración' using errcode = '42501';
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger site_settings_guard before update on public.site_settings
  for each row execute function public.guard_site_settings();

-- Secciones: content.edit puede cambiar textos y animación; crear, borrar,
-- reordenar u ocultar requiere sections.manage.
create or replace function public.guard_section_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.has_permission('sections.manage') then
    return new;
  end if;
  if new.kind is distinct from old.kind
     or new.position is distinct from old.position
     or new.is_visible is distinct from old.is_visible then
    raise exception 'Sólo quien gestiona secciones puede moverlas u ocultarlas' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger sections_guard before update on public.sections
  for each row execute function public.guard_section_changes();

-- -----------------------------------------------------------------------------
-- Reordenamiento atómico (arrastrar y soltar) en una sola llamada
-- -----------------------------------------------------------------------------
create or replace function public.reorder_items(p_table text, p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  required text;
begin
  required := case p_table
    when 'sections'   then 'sections.manage'
    when 'photos'     then 'photos.manage'
    when 'milestones' then 'content.edit'
    else null
  end;
  if required is null then
    raise exception 'Tabla no permitida: %', p_table using errcode = '22023';
  end if;
  if not public.has_permission(required) then
    raise exception 'Permiso insuficiente' using errcode = '42501';
  end if;

  execute format(
    'update public.%I t set position = o.ord - 1
       from unnest($1) with ordinality as o(id, ord)
      where t.id = o.id', p_table)
  using p_ids;
end;
$$;

revoke all on function public.reorder_items(text, uuid[]) from public;
grant execute on function public.reorder_items(text, uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.site_settings enable row level security;
alter table public.sections enable row level security;
alter table public.photos enable row level security;
alter table public.milestones enable row level security;
alter table public.important_dates enable row level security;
alter table public.interruptions enable row level security;
alter table public.interruption_views enable row level security;

-- La fila de ajustes siempre es legible: el front necesita saber si el sitio
-- es público, el título y el tema para pintar la pantalla de acceso.
create policy "site_settings: lectura" on public.site_settings
  for select to anon, authenticated using (true);
create policy "site_settings: edición" on public.site_settings
  for update to authenticated
  using (public.has_permission('settings.manage') or public.has_permission('theme.manage'))
  with check (public.has_permission('settings.manage') or public.has_permission('theme.manage'));

create policy "sections: lectura" on public.sections
  for select to anon, authenticated
  using ((is_visible and public.can_view_site())
         or public.has_permission('content.edit')
         or public.has_permission('sections.manage'));
create policy "sections: crear" on public.sections
  for insert to authenticated with check (public.has_permission('sections.manage'));
create policy "sections: editar" on public.sections
  for update to authenticated
  using (public.has_permission('content.edit') or public.has_permission('sections.manage'))
  with check (public.has_permission('content.edit') or public.has_permission('sections.manage'));
create policy "sections: borrar" on public.sections
  for delete to authenticated using (public.has_permission('sections.manage'));

create policy "photos: lectura" on public.photos
  for select to anon, authenticated using (public.can_view_site());
create policy "photos: gestión" on public.photos
  for all to authenticated
  using (public.has_permission('photos.manage'))
  with check (public.has_permission('photos.manage'));

create policy "milestones: lectura" on public.milestones
  for select to anon, authenticated using (public.can_view_site());
create policy "milestones: gestión" on public.milestones
  for all to authenticated
  using (public.has_permission('content.edit'))
  with check (public.has_permission('content.edit'));

create policy "important_dates: lectura" on public.important_dates
  for select to anon, authenticated
  using ((is_visible and public.can_view_site()) or public.has_permission('dates.manage'));
create policy "important_dates: gestión" on public.important_dates
  for all to authenticated
  using (public.has_permission('dates.manage'))
  with check (public.has_permission('dates.manage'));

create policy "interruptions: lectura" on public.interruptions
  for select to anon, authenticated
  using ((is_active and public.can_view_site()
          and starts_at <= now() and (ends_at is null or ends_at > now()))
         or public.has_permission('interruptions.manage'));
create policy "interruptions: gestión" on public.interruptions
  for all to authenticated
  using (public.has_permission('interruptions.manage'))
  with check (public.has_permission('interruptions.manage'));

create policy "interruption_views: propias" on public.interruption_views
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Almacenamiento de fotos: bucket privado, sólo imágenes, máx. 5 MB.
-- Las fotos se sirven con URLs firmadas de corta duración.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/webp', 'image/jpeg', 'image/png', 'image/avif'])
on conflict (id) do nothing;

create policy "photos bucket: lectura" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'photos' and public.can_view_site());
create policy "photos bucket: subir" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and public.has_permission('photos.manage'));
create policy "photos bucket: actualizar" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and public.has_permission('photos.manage'));
create policy "photos bucket: borrar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and public.has_permission('photos.manage'));

-- >>> migrations/20261015000300_messaging.sql
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

-- >>> migrations/20261015000400_audit_realtime.sql
-- =============================================================================
-- 004 · Auditoría y Realtime
-- =============================================================================

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name  text not null,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_table_idx on public.audit_log (table_name, created_at desc);

-- Registra quién cambió qué. Los mensajes privados (notas y chat) no se
-- auditan a propósito: su contenido es sólo de la pareja.
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(rec ->> 'id', rec ->> 'role'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'role_permissions', 'site_settings', 'sections', 'photos',
    'milestones', 'important_dates', 'interruptions'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_row()', t || '_audit', t);
  end loop;
end;
$$;

alter table public.audit_log enable row level security;

create policy "audit_log: lectura" on public.audit_log
  for select to authenticated using (public.has_permission('audit.view'));

-- Realtime: la página se actualiza en vivo cuando alguien edita contenido y
-- los mensajes llegan al instante. RLS también se aplica a Realtime.
alter publication supabase_realtime add table
  public.site_settings,
  public.sections,
  public.photos,
  public.milestones,
  public.important_dates,
  public.interruptions,
  public.notes,
  public.chat_messages,
  public.notifications;

-- >>> migrations/20261015000500_photo_fingerprint.sql
-- Huella SHA-256 del archivo original de cada foto. Permite que la carga
-- masiva salte las fotos que ya están en el álbum aunque tengan otro nombre.
alter table public.photos
  add column source_hash text check (source_hash is null or source_hash ~ '^[0-9a-f]{64}$');

create index photos_source_hash_idx on public.photos (source_hash) where source_hash is not null;

-- >>> migrations/20261015000600_theme_palette.sql
-- La editora (Camila) puede elegir la paleta de colores desde su panel.
-- Sólo los colores: tipografías, bordes, modo oscuro y efectos siguen
-- requiriendo theme.manage.

insert into public.permissions (key, description) values
  ('theme.palette', 'Elegir la paleta de colores')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission) values
  ('editor', 'theme.palette')
on conflict do nothing;

create or replace function public.guard_site_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  palette_keys constant text[] := array['primary', 'primaryContrast', 'accent', 'background', 'surface', 'text', 'muted'];
  k text;
begin
  if auth.uid() is null then
    return new;
  end if;

  if (new.theme is distinct from old.theme or new.effects is distinct from old.effects)
     and not public.has_permission('theme.manage') then
    -- Sin theme.manage: sólo colores, con permiso theme.palette y en formato #rrggbb.
    if not public.has_permission('theme.palette')
       or new.effects is distinct from old.effects
       or (new.theme - palette_keys) is distinct from (old.theme - palette_keys) then
      raise exception 'No tienes permiso para cambiar el tema' using errcode = '42501';
    end if;
    foreach k in array palette_keys loop
      if new.theme ? k and (new.theme ->> k) !~ '^#[0-9a-fA-F]{6}$' then
        raise exception 'Color no válido: %', k using errcode = '22023';
      end if;
    end loop;
  end if;

  if (new.site_title, new.site_subtitle, new.relationship_start, new.is_public, new.music_url)
     is distinct from
     (old.site_title, old.site_subtitle, old.relationship_start, old.is_public, old.music_url)
     and not public.has_permission('settings.manage') then
    raise exception 'No tienes permiso para cambiar la configuración' using errcode = '42501';
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

drop policy "site_settings: edición" on public.site_settings;
create policy "site_settings: edición" on public.site_settings
  for update to authenticated
  using (public.has_permission('settings.manage') or public.has_permission('theme.manage') or public.has_permission('theme.palette'))
  with check (public.has_permission('settings.manage') or public.has_permission('theme.manage') or public.has_permission('theme.palette'));

-- >>> migrations/20261015000700_invitations.sql
-- =============================================================================
-- Invitaciones por enlace o código QR.
--
-- El super admin genera un enlace de un solo uso; quien lo abre elige su nombre,
-- correo y contraseña y su cuenta nace con el rol de la invitación. Así no hace
-- falta saber el correo de antemano.
--
-- Seguridad:
--   * En la tabla sólo se guarda el SHA-256 del token; el token aparece una sola
--     vez en el navegador de quien lo crea (y viaja en el #fragmento de la URL,
--     que no llega a los servidores ni a los registros).
--   * Caduca (máximo 30 días) y se consume de forma atómica en la Edge Function
--     redeem-invite: dos personas no pueden usar el mismo enlace.
--   * Un enlace nunca puede crear un super administrador.
-- =============================================================================

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  role        public.app_role not null default 'editor' check (role <> 'super_admin'),
  note        text not null default '' check (char_length(note) <= 80),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_by     uuid references auth.users (id) on delete set null,
  constraint invitations_expiry check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);

comment on table public.invitations is 'Enlaces de invitación de un solo uso. Sólo se guarda el hash del token.';

create index invitations_pending_idx on public.invitations (expires_at) where used_at is null;

alter table public.invitations enable row level security;

-- Sólo quien gestiona usuarios ve, crea y revoca invitaciones. Nadie las
-- modifica desde el navegador: marcarlas como usadas es cosa de la función.
create policy "invitations: lectura" on public.invitations
  for select to authenticated using (public.has_permission('users.manage'));
create policy "invitations: crear" on public.invitations
  for insert to authenticated
  with check (public.has_permission('users.manage') and created_by = auth.uid() and used_at is null and used_by is null);
create policy "invitations: revocar" on public.invitations
  for delete to authenticated using (public.has_permission('users.manage'));

create trigger invitations_audit after insert or update or delete on public.invitations
  for each row execute function public.audit_row();

-- >>> migrations/20261020000100_chat_replies_presence.sql
-- =============================================================================
-- 008 · Chat tipo WhatsApp: responder citando, última conexión y visto
-- =============================================================================

-- Un mensaje puede responder a otro. Si el original se borra, la respuesta
-- se queda sin cita en vez de desaparecer.
alter table public.chat_messages
  add column reply_to uuid references public.chat_messages (id) on delete set null;

create index chat_messages_reply_idx on public.chat_messages (reply_to) where reply_to is not null;

-- chat_reads pasa a guardar, por persona, cuándo estuvo conectada por última
-- vez y hasta qué momento leyó el chat (null: todavía no lo ha abierto).
alter table public.chat_reads
  add column last_seen_at timestamptz not null default now();
alter table public.chat_reads
  alter column last_read_at drop not null,
  alter column last_read_at drop default;

-- Quien usa el chat ve la conexión y los vistos de los demás. Nadie escribe
-- la fila directamente: sólo con chat_presence(), que usa auth.uid(), así
-- nadie puede marcar como visto en nombre de otra persona.
drop policy "chat_reads: propios" on public.chat_reads;
create policy "chat_reads: ver" on public.chat_reads
  for select to authenticated using (public.has_permission('chat.use'));

create or replace function public.chat_presence(p_read boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if auth.uid() is null or not public.has_permission('chat.use') then
    raise exception 'No tienes permiso para usar el chat' using errcode = '42501';
  end if;
  insert into public.chat_reads (user_id, last_seen_at, last_read_at)
  values (auth.uid(), v_now, case when p_read then v_now end)
  on conflict (user_id) do update
     set last_seen_at = v_now,
         last_read_at = case when p_read then v_now else public.chat_reads.last_read_at end;
end;
$$;

revoke execute on function public.chat_presence(boolean) from public, anon;
grant execute on function public.chat_presence(boolean) to authenticated;

-- Los vistos y la conexión llegan en vivo.
alter publication supabase_realtime add table public.chat_reads;

-- >>> seed.sql
-- =============================================================================
-- Contenido inicial migrado desde la página original (legacy/).
-- Se ejecuta una sola vez después de las migraciones (el flujo Deploy lo hace
-- solo). Todo se edita luego desde los paneles: no cambies este archivo después
-- del primer despliegue, porque si cambia la CLI lo vuelve a ejecutar.
-- =============================================================================

update public.site_settings set
  site_title         = 'Para el amor de mi vida 💖',
  site_subtitle      = 'Esta página es un reflejo de lo mucho que te amo. Cada detalle está hecho para ti.',
  relationship_start = '2025-05-31',
  is_public          = false,
  -- Paleta "Rosa suave" de la versión 1; Camila puede cambiarla desde su panel.
  theme = '{
    "primary": "#c2185b",
    "primaryContrast": "#ffffff",
    "accent": "#ff4081",
    "background": "#ffe6ec",
    "surface": "#fff7f9",
    "text": "#880e4f",
    "muted": "#ad1457",
    "fontDisplay": "Fraunces",
    "fontBody": "Inter",
    "radius": 18,
    "darkMode": "light"
  }'::jsonb,
  effects = '{
    "floating": { "enabled": true, "emojis": ["❤️", "💖", "🌸", "🌷", "✨"], "density": 14 },
    "cursorHearts": false,
    "reduceOnMobile": true
  }'::jsonb
where id = 1;

insert into public.sections (kind, title, subtitle, content, animation, position) values
  ('hero', 'Para el amor de mi vida 💖',
   'Esta página es un reflejo de lo mucho que te amo. Cada detalle está hecho para ti.',
   '{}', 'fade-up', 0),
  ('together_counter', 'Tiempo juntos', 'Y contando, cada segundo a tu lado', '{}', 'zoom-in', 1),
  ('countdowns', 'Fechas que esperamos', 'Lo que falta para nuestros días especiales', '{}', 'fade-up', 2),
  ('love_notes', 'Mensajes del corazón', '', '{
    "cards": [
      { "icon": "☀️", "title": "Cuando pienso en ti...", "body": "Mi día se ilumina solo con recordar tu sonrisa. Eres mi razón para sonreír cada mañana." },
      { "icon": "💗", "title": "Lo que más amo de ti", "body": "Tu forma de ver la vida, tu bondad, y cómo haces que todo sea mejor con tu presencia." },
      { "icon": "🤞", "title": "Promesas", "body": "Prometo estar a tu lado en cada paso, celebrar tus logros y secar tus lágrimas." }
    ]
  }', 'fade-up', 3),
  ('milestones', 'Nuestra historia', 'Los momentos que nos hicieron nosotros', '{}', 'slide-left', 4),
  ('gallery', 'Nuestra historia en fotos', 'Elige un año y un mes para revivir nuestros recuerdos', '{}', 'fade-up', 5),
  ('letter', 'Mi carta para ti', '', '{
    "greeting": "Mi amor...",
    "paragraphs": [
      "Quiero recordarte que eres el mejor regalo que la vida me ha dado. Cada día a tu lado es una bendición y quiero renovar mis promesas de amor eterno."
    ],
    "wishes": [
      "❤️ Que cada Navidad la pasemos juntos",
      "✨ Que nuestros sueños se hagan realidad",
      "🎁 Que nuestro amor siga creciendo",
      "🌟 Que creemos tradiciones juntos"
    ],
    "signature": "Con todo mi amor, tu novio",
    "surprise": {
      "button": "Abrir regalo sorpresa",
      "title": "¡Sorpresa!",
      "text": "Mi regalo más grande para ti es mi amor eterno. Prometo amarte, cuidarte y hacerte feliz cada día de mi vida."
    }
  }', 'zoom-in', 6);

insert into public.milestones (title, description, happened_on, icon, position) values
  ('Primera cita', 'Recuerdo cada detalle de ese día. Cómo me hacías reír, cómo brillaban tus ojos. Desde entonces, supe que cada momento contigo sería especial.', '2025-05-10', '🌟', 0),
  ('El día que te pedí ser mi novia', 'Con mucho nerviosismo, te pedí poder compartir una vida contigo.', '2025-05-30', '💍', 1),
  ('Primer beso', 'Tuve miedo, nervios, y una emoción que no puedo describir. Pero cuando tus labios tocaron los míos, todo cobró sentido.', '2025-05-31', '💋', 2),
  ('Tus primeras flores', 'Cómo olvidar la emoción que sentía al esperar tu reacción.', '2025-06-09', '💐', 3),
  ('Nuestro primer viaje', 'Caminar de tu mano por calles nuevas, descubrir sabores, paisajes y miradas. Fue un nuevo inicio para nosotros.', '2025-06-28', '🏙️', 4),
  ('Todo lo que nos falta por explorar', 'Apenas estamos empezando. Nos esperan ciudades, sueños, retos, abrazos y atardeceres.', '2026-12-31', '🌈', 5);

insert into public.important_dates (title, event_date, recurs_yearly, icon, message, is_visible) values
  ('Nuestro aniversario', '2025-05-31', true, '💞', 'Un año más eligiéndonos', true),
  ('Navidad juntos', '2025-12-24', true, '🎄', 'Que cada Navidad la pasemos juntos', true),
  -- Ajusta la fecha real desde el panel y hazla visible.
  ('Tu cumpleaños', '2025-01-01', true, '🎂', 'El día en que el mundo se volvió más bonito', false);

-- Fotos de la versión original, servidas como archivos estáticos.
insert into public.photos (external_url, caption, taken_on, position) values
  ('/assets/img/2025/mayo1.jpeg', 'Aquí, aún no éramos novios pero el verte trabajar me alegraba mucho el alma', '2025-05-10', 0),
  ('/assets/img/2025/mayo2.jpeg', 'Cómo olvidar el día en que con mucho nerviosismo, te pedí poder compartir una vida contigo y ser novios', '2025-05-30', 1),
  ('/assets/img/2025/junio1.jpeg', 'Tus primeras flores, cómo olvidar la emoción que sentía al esperar tu reacción', '2025-06-09', 0),
  ('/assets/img/2025/junio2.jpeg', 'Mi primer fondo de pantalla alusivo a tí', '2025-06-10', 1),
  ('/assets/img/2025/junio3.jpeg', 'Lo hermosa que te ves enamorada de mí', '2025-06-16', 2),
  ('/assets/img/2025/junio4.jpeg', 'Dedicarle el cielo a mi cielo, es y será siempre un detalle desde lo profundo de mi corazón', '2025-06-18', 3),
  ('/assets/img/2025/junio5.jpeg', 'Lo hermoso de este momento no tiene comparación', '2025-06-21', 4),
  ('/assets/img/2025/junio6.jpeg', 'Amo tus ocurrencias', '2025-06-23', 5),
  ('/assets/img/2025/junio7.jpeg', 'El que se meta conmigo ya sabe, lleva bala jajajaja', '2025-06-25', 6),
  ('/assets/img/2025/junio8.jpeg', 'Imposible olvidar nuestro primer viaje, todas las aventuras vividas y lo felices que fuimos', '2025-06-28', 7),
  ('/assets/img/2025/julio1.jpeg', 'Un paseito inolvidable, muchas aventuras, mucho amor y sobre todo un amor muy lindo', '2025-07-04', 0),
  ('/assets/img/2025/julio2.jpeg', 'Desbordados de amor, amaba recogerte y que me recibieras con una sonrisa, un beso, un te amo y una pizza', '2025-07-08', 1),
  ('/assets/img/2025/julio3.jpeg', 'Salidita a cenar, bailar y amarnos mucho mucho', '2025-07-13', 2),
  ('/assets/img/2025/julio4.jpeg', 'Sesión de fotos en el parque con el primo', '2025-07-15', 3),
  ('/assets/img/2025/julio5.jpeg', 'Salidita de novios, sesión de fotos y amor que se desborda', '2025-07-22', 4),
  ('/assets/img/2025/julio6.jpeg', 'La dueña de las carreteras y dueña de mi corazón', '2025-07-22', 5),
  ('/assets/img/2025/julio7.jpeg', 'No tengo palabras para describir lo orgulloso que me sentia en ese momento de que fueras mi novia', '2025-07-25', 6),
  ('/assets/img/2025/julio8.jpeg', '¿Recuerdas esa hamburguesa?', '2025-07-25', 7),
  ('/assets/img/2025/agosto1.jpeg', 'Ámame toda la vida', '2025-08-11', 0),
  ('/assets/img/2025/agosto2.jpeg', 'Visitandote en el trabajo de tu mamá', '2025-08-15', 1),
  ('/assets/img/2025/agosto3.jpeg', 'Felicidad en el cumple de ''Chofi''', '2025-08-18', 2),
  ('/assets/img/2025/agosto4.jpeg', 'Simplemente divinos', '2025-08-18', 3),
  ('/assets/img/2025/agosto5.jpeg', 'Visita al cementerio', '2025-08-22', 4),
  ('/assets/img/2025/agosto6.jpeg', 'Increíble momento', '2025-08-24', 5),
  ('/assets/img/2025/agosto7.jpeg', 'Me encanta hacerte feliz', '2025-08-29', 6),
  ('/assets/img/2025/agosto8.jpeg', 'Día de picnic', '2025-08-30', 7),
  -- Estas cuatro estaban en la primera versión sin fecha (julio de 2025):
  -- ajusta la fecha real desde el panel.
  ('/assets/img/CitaPostres.jpeg', 'Nuestra cita de postres, dulces momentos compartidos', '2025-07-01', 10),
  ('/assets/img/CitaPostres2.jpeg', 'Risas y postres, la combinación perfecta contigo', '2025-07-01', 11),
  ('/assets/img/Flores.jpeg', 'Las flores que te regalé, tan hermosas como tú', '2025-07-01', 12),
  ('/assets/img/PalosTiros.jpeg', 'Aventuras y juegos, contigo todo es divertido', '2025-07-01', 13);
