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

-- >>> migrations/20261020000200_chat_media.sql
-- =============================================================================
-- 009 · Fotos y stickers en el chat
-- =============================================================================

create type public.chat_kind as enum ('text', 'image', 'sticker');

-- Las fotos viven en el bucket privado chat-media, en una carpeta por persona
-- (<user_id>/<id>.webp y su miniatura <user_id>/<id>.thumb.webp).
alter table public.chat_messages
  add column kind public.chat_kind not null default 'text',
  add column image_path text
    check (image_path is null or image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'),
  add column thumb_path text
    check (thumb_path is null or thumb_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.thumb\.(webp|jpg|png)$'),
  add column image_width integer check (image_width is null or image_width between 1 and 10000),
  add column image_height integer check (image_height is null or image_height between 1 and 10000),
  -- Id de un sticker del catálogo de la app.
  add column sticker text check (sticker is null or sticker ~ '^[a-z0-9-]{1,40}$');

-- El texto deja de ser obligatorio: una foto puede ir sin pie y un sticker
-- no lleva texto. Cada tipo exige lo suyo.
alter table public.chat_messages drop constraint chat_messages_body_check;
alter table public.chat_messages
  add constraint chat_messages_body_length check (char_length(body) <= 2000),
  add constraint chat_messages_content check (
    (kind = 'text' and char_length(btrim(body)) >= 1 and image_path is null and sticker is null)
    or (kind = 'image' and image_path is not null and thumb_path is not null and sticker is null)
    or (kind = 'sticker' and sticker is not null and image_path is null and char_length(btrim(body)) = 0)
  );
alter table public.chat_messages alter column body set default '';

-- Una foto sólo puede apuntar a la carpeta de quien la envía.
drop policy "chat: escribir" on public.chat_messages;
create policy "chat: escribir" on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.has_permission('chat.use')
    and (image_path is null or (
      split_part(image_path, '/', 1) = auth.uid()::text
      and split_part(thumb_path, '/', 1) = auth.uid()::text
    ))
  );

-- El aviso dice «te mandó una foto» o «un sticker» en vez de un texto vacío.
create or replace function public.notify_new_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  preview text;
begin
  select display_name into sender_name from public.profiles where id = new.sender_id;
  preview := case new.kind
    when 'image' then '📷 Foto' || coalesce(nullif(': ' || btrim(new.body), ': '), '')
    when 'sticker' then '✨ Sticker'
    else new.body
  end;
  -- Evita inundar de avisos: sólo se notifica si el destinatario no tiene ya
  -- un aviso de chat sin leer.
  insert into public.notifications (user_id, kind, title, body, link)
  select p.id, 'chat', coalesce(sender_name, 'Alguien') || ' te escribió 💬', left(preview, 140), '/chat'
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

-- -----------------------------------------------------------------------------
-- Bucket privado de fotos del chat: sólo imágenes de hasta 5 MB, servidas con
-- URLs firmadas. Lo ve quien usa el chat; cada persona sube y borra sólo en
-- su carpeta.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "chat-media: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-media' and public.has_permission('chat.use'));
create policy "chat-media: subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.has_permission('chat.use')
    and split_part(name, '/', 1) = auth.uid()::text
  );
create policy "chat-media: borrar de mi carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-media' and split_part(name, '/', 1) = auth.uid()::text);

-- >>> migrations/20261020000300_personal_colors.sql
-- =============================================================================
-- 010 · Colores por persona
-- =============================================================================
-- Cada persona elige su paleta sin cambiarle los colores a nadie más. Los
-- colores de site_settings.theme quedan como los de la página pública: los
-- ve quien entra sin cuenta y quien no eligió los suyos. Sólo theme.manage
-- (el super administrador) los cambia.

-- ¿Es un objeto sólo con colores de la paleta, cada uno en formato #rrggbb?
create or replace function public.is_valid_theme_colors(colors jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select colors is null or (
    jsonb_typeof(colors) = 'object'
    and not exists (
      select 1 from jsonb_each(colors) e
       where e.key <> all (array['primary', 'primaryContrast', 'accent', 'background', 'surface', 'text', 'muted'])
          or jsonb_typeof(e.value) <> 'string'
          or (e.value #>> '{}') !~ '^#[0-9a-fA-F]{6}$'
    )
  );
$$;

alter table public.profiles
  add column theme_colors jsonb
    constraint profiles_theme_colors_valid check (public.is_valid_theme_colors(theme_colors));

-- Los colores de cada persona sólo los cambia ella misma.
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
  if new.theme_colors is distinct from old.theme_colors
     and auth.uid() is not null and auth.uid() <> old.id then
    raise exception 'Sólo cada persona puede cambiar sus colores' using errcode = '42501';
  end if;
  new.id := old.id;
  new.created_at := old.created_at;
  return new;
end;
$$;

-- La paleta de la página ya no se cambia desde el panel de contenido.
delete from public.permissions where key = 'theme.palette';

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

drop policy "site_settings: edición" on public.site_settings;
create policy "site_settings: edición" on public.site_settings
  for update to authenticated
  using (public.has_permission('settings.manage') or public.has_permission('theme.manage'))
  with check (public.has_permission('settings.manage') or public.has_permission('theme.manage'));

-- Quien entra sin cuenta ve la paleta «Rosa vino».
update public.site_settings
   set theme = theme || '{"primary": "#b0305a", "primaryContrast": "#ffffff", "accent": "#e8a33d",
                          "background": "#fff8f6", "surface": "#ffffff", "text": "#2b1720", "muted": "#7a5c66"}'::jsonb;

-- >>> migrations/20261020000400_device_push.sql
-- =============================================================================
-- 011 · Avisos en la pantalla de notificaciones del celular
-- =============================================================================
-- Cada fila nueva de notifications (o un aviso de chat sin leer que se
-- actualiza con el último mensaje) llama a la Edge Function send-push, que
-- manda el Web Push a los dispositivos de esa persona.
--
-- La URL de la función y su secreto viven en Supabase Vault
-- (push_function_url y push_webhook_secret); el flujo Deploy los crea. Sin
-- ellos no se envía nada y la app sigue funcionando igual.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end;
$$;

create or replace function public.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if new.read_at is not null then
    return new;
  end if;
  -- En una actualización sólo avisa si llegó algo nuevo (no al marcar leído).
  if tg_op = 'UPDATE' and (new.title, new.body, new.created_at) is not distinct from (old.title, old.body, old.created_at) then
    return new;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object('user_id', new.user_id, 'kind', new.kind, 'title', new.title, 'body', new.body, 'link', new.link)
    ),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Un fallo del push nunca debe impedir que se guarde el aviso.
  return new;
end;
$$;

revoke execute on function public.dispatch_push() from public, anon, authenticated;

create trigger notifications_push after insert or update on public.notifications
  for each row execute function public.dispatch_push();

-- -----------------------------------------------------------------------------
-- Chat como en WhatsApp: cada mensaje avisa. Para no llenar la campana, si ya
-- hay un aviso de chat sin leer se actualiza con el último mensaje (y eso
-- también dispara el push) en vez de crear otro.
-- -----------------------------------------------------------------------------
create or replace function public.notify_new_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_preview text;
begin
  select coalesce(display_name, 'Alguien') || ' te escribió 💬' into v_title from public.profiles where id = new.sender_id;
  v_title := coalesce(v_title, 'Alguien te escribió 💬');
  v_preview := left(case new.kind
    when 'image' then '📷 Foto' || coalesce(nullif(': ' || btrim(new.body), ': '), '')
    when 'sticker' then '✨ Sticker'
    else new.body
  end, 140);

  with recipients as (
    select p.id
      from public.profiles p
     where p.id <> new.sender_id
       and p.is_active
       and (p.role = 'super_admin' or exists (
             select 1 from public.role_permissions rp
              where rp.role = p.role and rp.permission = 'chat.use'))
  ), updated as (
    update public.notifications n
       set title = v_title, body = v_preview, created_at = now()
      from recipients r
     where n.user_id = r.id and n.kind = 'chat' and n.read_at is null
    returning n.user_id
  )
  insert into public.notifications (user_id, kind, title, body, link)
  select r.id, 'chat', v_title, v_preview, '/chat'
    from recipients r
   where r.id not in (select user_id from updated);
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Sorpresas: avisa a quienes pueden ver la página cuando se publica una que
-- ya está activa. Las programadas para más adelante aparecen al entrar.
-- -----------------------------------------------------------------------------
create or replace function public.notify_new_interruption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author text;
begin
  if not new.is_active or new.starts_at > now() or (new.ends_at is not null and new.ends_at <= now()) then
    return new;
  end if;
  select display_name into v_author from public.profiles where id = new.created_by;
  insert into public.notifications (user_id, kind, title, body, link)
  select p.id, 'system', coalesce(v_author, 'Alguien') || ' te dejó una sorpresa 🎁', left(new.title, 140), '/'
    from public.profiles p
   where p.id is distinct from new.created_by
     and p.is_active
     and (p.role = 'super_admin' or exists (
           select 1 from public.role_permissions rp
            where rp.role = p.role and rp.permission = 'site.view'));
  return new;
end;
$$;

create trigger interruptions_notify after insert on public.interruptions
  for each row execute function public.notify_new_interruption();

-- -----------------------------------------------------------------------------
-- Suscripciones push: un celular pertenece a quien inició sesión por última
-- vez en él (si otra persona entra en el mismo equipo, deja de recibir los
-- avisos de la anterior).
-- -----------------------------------------------------------------------------
create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 200))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;

revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- Aviso de prueba para comprobar que llegan al celular (uno por minuto).
create or replace function public.send_test_notification()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.notifications
     where user_id = auth.uid() and kind = 'system' and link = '/cuenta'
       and created_at > now() - interval '1 minute'
  ) then
    raise exception 'Espera un minuto antes de probar otra vez' using errcode = 'P0001';
  end if;
  insert into public.notifications (user_id, kind, title, body, link)
  values (auth.uid(), 'system', 'Así te llegarán los avisos 💖', 'Si ves esto en tu celular, ya quedaron activados.', '/cuenta');
end;
$$;

revoke execute on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;

-- >>> migrations/20261021000100_todo_lists.sql
-- =============================================================================
-- 012 · Listas de cosas por hacer compartidas
-- -----------------------------------------------------------------------------
-- Quien crea una lista elige con quién la comparte (una persona o un grupo).
-- Todos los miembros agregan y marcan tareas, con subtareas, descripción,
-- materiales, fotos, fecha y responsable. Sólo los miembros ven la lista.
-- =============================================================================

insert into public.permissions (key, description) values
  ('lists.use', 'Crear listas de cosas por hacer y compartirlas')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission) values
  ('editor', 'lists.use'),
  ('viewer', 'lists.use')
on conflict do nothing;

-- Los avisos de listas tienen su propio tipo (y su contador en la cabecera).
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in ('note', 'chat', 'system', 'list'));

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------

create table public.todo_lists (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  description  text not null default '' check (char_length(description) <= 2000),
  emoji        text not null default '📝' check (char_length(emoji) between 1 and 16),
  due_on       date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.todo_list_members (
  list_id   uuid not null references public.todo_lists (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  added_by  uuid references auth.users (id) on delete set null default auth.uid(),
  added_at  timestamptz not null default now(),
  primary key (list_id, user_id)
);

create index todo_list_members_user_idx on public.todo_list_members (user_id);

-- Tareas y subtareas (una subtarea es una tarea con parent_id, de un solo nivel).
create table public.todo_items (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.todo_lists (id) on delete cascade,
  parent_id    uuid references public.todo_items (id) on delete cascade,
  title        text not null check (char_length(btrim(title)) between 1 and 300),
  description  text not null default '' check (char_length(description) <= 4000),
  due_on       date,
  assignee_id  uuid references auth.users (id) on delete set null,
  done_at      timestamptz,
  done_by      uuid references auth.users (id) on delete set null,
  position     double precision not null default extract(epoch from clock_timestamp()),
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint todo_items_not_own_parent check (parent_id is distinct from id)
);

create index todo_items_list_idx on public.todo_items (list_id, position);
create index todo_items_parent_idx on public.todo_items (parent_id);

-- Materiales de una tarea: qué hace falta y si ya se tiene.
create table public.todo_materials (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.todo_items (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 120),
  quantity    text not null default '' check (char_length(quantity) <= 40),
  is_ready    boolean not null default false,
  position    double precision not null default extract(epoch from clock_timestamp()),
  created_at  timestamptz not null default now()
);

create index todo_materials_item_idx on public.todo_materials (item_id, position);

-- Fotos de una tarea. Viven en el bucket privado list-media, en la carpeta
-- de la lista: <list_id>/<id>.webp y su miniatura <list_id>/<id>.thumb.webp.
create table public.todo_item_images (
  id          uuid primary key default gen_random_uuid(),
  item_id     uuid not null references public.todo_items (id) on delete cascade,
  list_id     uuid not null references public.todo_lists (id) on delete cascade,
  path        text not null check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'),
  thumb_path  text not null check (thumb_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.thumb\.(webp|jpg|png)$'),
  width       integer check (width is null or width between 1 and 10000),
  height      integer check (height is null or height between 1 and 10000),
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create index todo_item_images_item_idx on public.todo_item_images (item_id, created_at);

-- -----------------------------------------------------------------------------
-- Funciones de acceso (security definer para no recursar en RLS)
-- -----------------------------------------------------------------------------

-- ¿Una persona concreta (no la de la sesión) tiene un permiso?
create or replace function public.user_has_permission(p_user uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pr.role = 'super_admin'
         or exists (select 1 from public.role_permissions rp
                     where rp.role = pr.role and rp.permission = p_permission)
       from public.profiles pr
      where pr.id = p_user and pr.is_active),
    false
  );
$$;

-- ¿Quien tiene la sesión es miembro de la lista (y puede usar listas)?
create or replace function public.is_list_member(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('lists.use')
     and exists (select 1 from public.todo_list_members m
                  where m.list_id = p_list and m.user_id = auth.uid());
$$;

create or replace function public.is_list_owner(p_list uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('lists.use')
     and exists (select 1 from public.todo_lists l where l.id = p_list and l.owner_id = auth.uid());
$$;

create or replace function public.todo_item_list(p_item uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select list_id from public.todo_items where id = p_item;
$$;

-- Para el almacenamiento: ¿la carpeta (primer tramo de la ruta) es una lista mía?
create or replace function public.is_list_folder_member(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_list_member(split_part(p_name, '/', 1)::uuid)
    else false
  end;
$$;

revoke execute on function public.user_has_permission(uuid, text) from public, anon;
grant execute on function public.user_has_permission(uuid, text) to authenticated;
grant execute on function public.is_list_member(uuid) to authenticated;
grant execute on function public.is_list_owner(uuid) to authenticated;
grant execute on function public.todo_item_list(uuid) to authenticated;
grant execute on function public.is_list_folder_member(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Avisos: a los demás miembros de la lista
-- -----------------------------------------------------------------------------

-- Igual que el chat: si alguien ya tiene un aviso sin leer de esa lista, se
-- actualiza con lo último que pasó (y vuelve a sonar) en vez de sumar otro.
create or replace function public.notify_list_members(p_list uuid, p_body text, p_only uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_link text := '/listas/' || p_list;
begin
  select coalesce((select display_name from public.profiles where id = auth.uid()), 'Alguien')
         || ' · ' || l.emoji || ' ' || l.title
    into v_title
    from public.todo_lists l where l.id = p_list;
  if v_title is null then
    return;
  end if;
  v_title := left(v_title, 160);
  with recipients as (
    select m.user_id as id
      from public.todo_list_members m
     where m.list_id = p_list
       and m.user_id is distinct from auth.uid()
       and (p_only is null or m.user_id = p_only)
       and public.user_has_permission(m.user_id, 'lists.use')
  ), updated as (
    update public.notifications n
       set title = v_title, body = left(p_body, 140), created_at = now()
      from recipients r
     where n.user_id = r.id and n.kind = 'list' and n.link = v_link and n.read_at is null
    returning n.user_id
  )
  insert into public.notifications (user_id, kind, title, body, link)
  select r.id, 'list', v_title, left(p_body, 140), v_link
    from recipients r
   where r.id not in (select user_id from updated);
end;
$$;

revoke execute on function public.notify_list_members(uuid, text, uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Reglas de negocio
-- -----------------------------------------------------------------------------

create or replace function public.guard_todo_list()
returns trigger
language plpgsql
as $$
begin
  if new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
    raise exception 'La dueña o dueño de la lista no se puede cambiar' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger todo_lists_guard before update on public.todo_lists
  for each row execute function public.guard_todo_list();

-- Quien crea la lista siempre es miembro.
create or replace function public.add_list_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.todo_list_members (list_id, user_id, added_by)
  values (new.id, new.owner_id, new.owner_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger todo_lists_owner after insert on public.todo_lists
  for each row execute function public.add_list_owner();

-- Al sumar a alguien le llega un aviso propio (no se mezcla con los de tareas).
create or replace function public.notify_list_member_added()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_list record;
  v_adder text;
begin
  if new.user_id = auth.uid() or auth.uid() is null then
    return new;
  end if;
  select title, emoji, description into v_list from public.todo_lists where id = new.list_id;
  select display_name into v_adder from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, kind, title, body, link)
  values (
    new.user_id, 'list',
    left(coalesce(v_adder, 'Alguien') || ' te sumó a la lista ' || v_list.emoji || ' ' || v_list.title, 160),
    left(coalesce(nullif(btrim(v_list.description), ''), 'Ábrela para ver qué hay por hacer.'), 140),
    '/listas/' || new.list_id || '?nueva=1'
  );
  return new;
end;
$$;

create trigger todo_list_members_notify after insert on public.todo_list_members
  for each row execute function public.notify_list_member_added();

create or replace function public.guard_todo_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent record;
begin
  if tg_op = 'UPDATE' then
    if new.list_id is distinct from old.list_id or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Una tarea no se puede mover a otra lista' using errcode = '42501';
    end if;
  end if;
  if new.parent_id is not null and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
    select list_id, parent_id into v_parent from public.todo_items where id = new.parent_id;
    if not found or v_parent.list_id <> new.list_id then
      raise exception 'La subtarea debe ser de la misma lista' using errcode = '23514';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'Una subtarea no puede tener subtareas' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.todo_items where parent_id = new.id) then
      raise exception 'Una tarea con subtareas no puede volverse subtarea' using errcode = '23514';
    end if;
  end if;
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and not exists (select 1 from public.todo_list_members
                      where list_id = new.list_id and user_id = new.assignee_id) then
    raise exception 'Sólo se puede asignar a alguien de la lista' using errcode = '23514';
  end if;
  -- Quién y cuándo la terminó lo pone la base, no el navegador.
  if new.done_at is null then
    new.done_by := null;
  elsif tg_op = 'INSERT' or old.done_at is null then
    new.done_at := now();
    new.done_by := auth.uid();
  else
    new.done_at := old.done_at;
    new.done_by := old.done_by;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger todo_items_guard before insert or update on public.todo_items
  for each row execute function public.guard_todo_item();

create or replace function public.notify_todo_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is null and tg_op = 'INSERT' then
    perform public.notify_list_members(new.list_id, '➕ ' || new.title);
  elsif new.parent_id is null and tg_op = 'UPDATE' and new.done_at is not null and old.done_at is null then
    perform public.notify_list_members(new.list_id, '✅ ' || new.title);
  end if;
  if new.assignee_id is not null and new.assignee_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform public.notify_list_members(new.list_id, '👉 Te asignó: ' || new.title, new.assignee_id);
  end if;
  return new;
end;
$$;

create trigger todo_items_notify after insert or update on public.todo_items
  for each row execute function public.notify_todo_item();

create or replace function public.guard_todo_material()
returns trigger
language plpgsql
as $$
begin
  if new.item_id is distinct from old.item_id or new.created_at is distinct from old.created_at then
    raise exception 'Un material no se puede mover a otra tarea' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger todo_materials_guard before update on public.todo_materials
  for each row execute function public.guard_todo_material();

-- La foto queda en la carpeta de la lista de su tarea, y hasta 12 por tarea.
create or replace function public.guard_todo_image()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.list_id := (select list_id from public.todo_items where id = new.item_id);
  if split_part(new.path, '/', 1) <> new.list_id::text or split_part(new.thumb_path, '/', 1) <> new.list_id::text then
    raise exception 'La foto debe estar en la carpeta de su lista' using errcode = '42501';
  end if;
  if (select count(*) from public.todo_item_images where item_id = new.item_id) >= 12 then
    raise exception 'Máximo 12 fotos por tarea' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger todo_item_images_guard before insert on public.todo_item_images
  for each row execute function public.guard_todo_image();

-- Crea una lista y suma a las personas elegidas, todo de una vez.
create or replace function public.create_todo_list(
  p_title text, p_description text default '', p_emoji text default '📝',
  p_due_on date default null, p_member_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_member uuid;
begin
  if auth.uid() is null or not public.has_permission('lists.use') then
    raise exception 'No tienes permiso para crear listas' using errcode = '42501';
  end if;
  insert into public.todo_lists (owner_id, title, description, emoji, due_on)
  values (auth.uid(), btrim(p_title), coalesce(p_description, ''), coalesce(nullif(p_emoji, ''), '📝'), p_due_on)
  returning id into v_id;
  foreach v_member in array coalesce(p_member_ids, '{}') loop
    if v_member = auth.uid() then
      continue;
    end if;
    if not public.user_has_permission(v_member, 'lists.use') then
      raise exception 'Una de las personas elegidas no puede usar listas' using errcode = '42501';
    end if;
    insert into public.todo_list_members (list_id, user_id, added_by)
    values (v_id, v_member, auth.uid())
    on conflict do nothing;
  end loop;
  return v_id;
end;
$$;

revoke execute on function public.create_todo_list(text, text, text, date, uuid[]) from public, anon;
grant execute on function public.create_todo_list(text, text, text, date, uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.todo_lists enable row level security;
alter table public.todo_list_members enable row level security;
alter table public.todo_items enable row level security;
alter table public.todo_materials enable row level security;
alter table public.todo_item_images enable row level security;

-- Las listas se crean con create_todo_list (no hay política de insert).
create policy "todo_lists: ver las mías" on public.todo_lists
  for select to authenticated using (public.is_list_member(id));
create policy "todo_lists: editar si soy miembro" on public.todo_lists
  for update to authenticated
  using (public.is_list_member(id))
  with check (public.is_list_member(id));
create policy "todo_lists: borrar si es mía" on public.todo_lists
  for delete to authenticated using (public.is_list_owner(id));

create policy "todo_list_members: ver los de mis listas" on public.todo_list_members
  for select to authenticated using (public.is_list_member(list_id));
-- Cualquier miembro puede sumar a alguien más que también use listas.
create policy "todo_list_members: sumar" on public.todo_list_members
  for insert to authenticated
  with check (
    public.is_list_member(list_id)
    and added_by = auth.uid()
    and public.user_has_permission(user_id, 'lists.use')
  );
-- Cada quien puede salirse; quien la creó puede sacar a los demás. Nadie saca
-- a quien la creó (para eso se borra la lista).
create policy "todo_list_members: salir o sacar" on public.todo_list_members
  for delete to authenticated
  using (
    public.is_list_member(list_id)
    and not exists (select 1 from public.todo_lists l where l.id = list_id and l.owner_id = user_id)
    and (user_id = auth.uid() or public.is_list_owner(list_id))
  );

create policy "todo_items: ver" on public.todo_items
  for select to authenticated using (public.is_list_member(list_id));
create policy "todo_items: agregar" on public.todo_items
  for insert to authenticated
  with check (public.is_list_member(list_id) and created_by = auth.uid());
create policy "todo_items: editar" on public.todo_items
  for update to authenticated
  using (public.is_list_member(list_id))
  with check (public.is_list_member(list_id));
create policy "todo_items: borrar" on public.todo_items
  for delete to authenticated using (public.is_list_member(list_id));

create policy "todo_materials: miembros" on public.todo_materials
  for all to authenticated
  using (public.is_list_member(public.todo_item_list(item_id)))
  with check (public.is_list_member(public.todo_item_list(item_id)));

create policy "todo_item_images: ver" on public.todo_item_images
  for select to authenticated using (public.is_list_member(list_id));
create policy "todo_item_images: agregar" on public.todo_item_images
  for insert to authenticated
  with check (public.is_list_member(public.todo_item_list(item_id)) and created_by = auth.uid());
create policy "todo_item_images: borrar" on public.todo_item_images
  for delete to authenticated using (public.is_list_member(list_id));

-- -----------------------------------------------------------------------------
-- Bucket privado de fotos de listas: sólo imágenes de hasta 5 MB. Lo ven,
-- suben y borran los miembros de la lista dueña de la carpeta.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('list-media', 'list-media', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "list-media: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'list-media' and public.is_list_folder_member(name));
create policy "list-media: subir" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'list-media' and public.is_list_folder_member(name));
create policy "list-media: borrar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'list-media' and public.is_list_folder_member(name));

-- Realtime: las listas se actualizan en vivo para todos sus miembros.
alter publication supabase_realtime add table
  public.todo_lists,
  public.todo_list_members,
  public.todo_items,
  public.todo_materials,
  public.todo_item_images;

-- >>> migrations/20261021000200_profile_details.sql
-- =============================================================================
-- 013 · Perfil de cada persona: foto o icono, frase y cumpleaños
-- -----------------------------------------------------------------------------
-- Cada quien edita su propio perfil. La foto vive en el bucket privado
-- avatars, en la carpeta de la persona (<user_id>/<id>.webp), y la ven sólo
-- quienes tienen sesión.
-- =============================================================================

alter table public.profiles
  add column avatar_path text
    check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'),
  add column avatar_emoji text
    check (avatar_emoji is null or char_length(avatar_emoji) between 1 and 16),
  add column bio text not null default '' check (char_length(bio) <= 160),
  add column birthday date,
  add constraint profiles_avatar_own_folder
    check (avatar_path is null or split_part(avatar_path, '/', 1) = id::text);

-- Igual que antes, más: la foto, el icono, la frase y el cumpleaños sólo los
-- cambia su dueña o dueño (ni siquiera el super administrador).
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
  if new.theme_colors is distinct from old.theme_colors
     and auth.uid() is not null and auth.uid() <> old.id then
    raise exception 'Sólo cada persona puede cambiar sus colores' using errcode = '42501';
  end if;
  if (new.avatar_path, new.avatar_emoji, new.bio, new.birthday)
     is distinct from (old.avatar_path, old.avatar_emoji, old.bio, old.birthday)
     and auth.uid() is not null and auth.uid() <> old.id then
    raise exception 'Sólo cada persona puede cambiar su foto y su perfil' using errcode = '42501';
  end if;
  new.id := old.id;
  new.created_at := old.created_at;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Bucket privado de fotos de perfil: imágenes de hasta 2 MB. Las ve quien
-- tiene sesión; cada persona sube y borra sólo en su carpeta.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "avatars: ver con sesión" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and public.current_app_role() is not null);
create policy "avatars: subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);
create policy "avatars: borrar de mi carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

-- >>> migrations/20261027000100_owasp_hardening.sql
-- =============================================================================
-- 014 · Refuerzo de seguridad (OWASP Top 10 y API Security Top 10)
-- -----------------------------------------------------------------------------
-- Nada de esto cambia cómo se usa la app; cierra rendijas:
--   * A01 · Los avisos sólo se pueden marcar como leídos (nadie reescribe el
--     texto o el enlace de un aviso) y su enlace siempre es una ruta interna.
--   * A01 · El autor de una foto o sorpresa lo pone la base, no el navegador.
--   * A01 · Las funciones internas no las puede llamar quien no tiene sesión.
--   * A10 · Los avisos al celular sólo se mandan a los servicios de push
--     reales (Google, Mozilla, Apple, Microsoft), nunca a otra dirección.
--   * API4 · Límite de velocidad para el chat, las notitas, las listas y las
--     invitaciones: un script no puede inundar la base ni los celulares.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Avisos: el dueño sólo cambia read_at, y el enlace es siempre interno
-- -----------------------------------------------------------------------------

-- Las funciones de la base (security definer, que corren como su dueño)
-- sí actualizan el aviso de chat o de lista con el último mensaje.
create or replace function public.guard_notification_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.id, new.user_id, new.kind, new.title, new.body, new.link, new.created_at)
         is distinct from
         (old.id, old.user_id, old.kind, old.title, old.body, old.link, old.created_at) then
    raise exception 'Un aviso sólo se puede marcar como leído' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notifications_guard before update on public.notifications
  for each row execute function public.guard_notification_update();

-- "/chat" sí; "//otro-sitio.com", "/\otro-sitio.com" o con saltos de línea no.
update public.notifications
   set link = '/'
 where link is not null
   and not ((link = '/' or link ~ '^/[^/\\]') and link !~ '[[:cntrl:]]');

alter table public.notifications drop constraint notifications_link_check;
alter table public.notifications
  add constraint notifications_link_check check (
    link is null or ((link = '/' or link ~ '^/[^/\\]') and link !~ '[[:cntrl:]]' and char_length(link) <= 300)
  );

-- Una notita enviada tampoco puede cambiar de id.
create or replace function public.guard_note_update()
returns trigger
language plpgsql
as $$
begin
  if (new.id, new.sender_id, new.recipient_id, new.kind, new.title, new.body, new.created_at)
     is distinct from
     (old.id, old.sender_id, old.recipient_id, old.kind, old.title, old.body, old.created_at) then
    raise exception 'Una notita enviada no se puede modificar' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Autoría: la pone la base con la sesión, no lo que mande el navegador
-- -----------------------------------------------------------------------------
create or replace function public.stamp_created_by()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger photos_stamp_author before insert on public.photos
  for each row execute function public.stamp_created_by();
create trigger interruptions_stamp_author before insert on public.interruptions
  for each row execute function public.stamp_created_by();

-- -----------------------------------------------------------------------------
-- Funciones: sin sesión sólo se pueden usar las que necesita la página
-- pública (has_permission, can_view_site, current_app_role)
-- -----------------------------------------------------------------------------
revoke execute on function public.my_permissions() from public, anon;
revoke execute on function public.mark_notifications_read(text) from public, anon;
revoke execute on function public.is_list_member(uuid) from public, anon;
revoke execute on function public.is_list_owner(uuid) from public, anon;
revoke execute on function public.todo_item_list(uuid) from public, anon;
revoke execute on function public.is_list_folder_member(text) from public, anon;
revoke execute on function public.is_valid_theme_colors(jsonb) from anon;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.mark_notifications_read(text) to authenticated;
grant execute on function public.is_list_member(uuid) to authenticated;
grant execute on function public.is_list_owner(uuid) to authenticated;
grant execute on function public.todo_item_list(uuid) to authenticated;
grant execute on function public.is_list_folder_member(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Almacenamiento
-- -----------------------------------------------------------------------------

-- Una cuenta desactivada ya no sube fotos de perfil.
drop policy "avatars: subir a mi carpeta" on storage.objects;
create policy "avatars: subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.current_app_role() is not null
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Al reemplazar una foto del álbum, sigue quedando en el álbum.
drop policy "photos bucket: actualizar" on storage.objects;
create policy "photos bucket: actualizar" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and public.has_permission('photos.manage'))
  with check (bucket_id = 'photos' and public.has_permission('photos.manage'));

-- -----------------------------------------------------------------------------
-- Suscripciones push: sólo a los servicios de push de los navegadores
-- -----------------------------------------------------------------------------
-- Si alguien registrara https://cualquier-sitio como "celular", la función
-- send-push haría peticiones a esa dirección (SSRF).
create or replace function public.is_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_endpoint is not null
     and char_length(p_endpoint) <= 1024
     and p_endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
     and p_endpoint !~ '[[:space:][:cntrl:]]';
$$;

delete from public.push_subscriptions
 where not public.is_push_endpoint(endpoint)
    or p256dh !~ '^[A-Za-z0-9+/_=-]{1,200}$'
    or auth !~ '^[A-Za-z0-9+/_=-]{1,100}$';

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_service check (public.is_push_endpoint(endpoint)),
  add constraint push_subscriptions_keys_format check (
    p256dh ~ '^[A-Za-z0-9+/_=-]{1,200}$' and auth ~ '^[A-Za-z0-9+/_=-]{1,100}$'
  );

-- -----------------------------------------------------------------------------
-- Límite de velocidad (API4: consumo de recursos sin límite)
-- -----------------------------------------------------------------------------
-- enforce_rate_limit(columna_del_autor, máximo, ventana): cuenta las filas que
-- la persona de la sesión creó en la ventana y frena la siguiente si ya llegó
-- al máximo. Los límites sobran para el uso normal de la pareja.
create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_column text := tg_argv[0];
  v_max integer := tg_argv[1]::integer;
  v_window interval := tg_argv[2]::interval;
  v_count integer;
begin
  if auth.uid() is null then
    return new;
  end if;
  execute format(
    'select count(*) from (select 1 from public.%I where %I = $1 and created_at > now() - $2 limit $3) s',
    tg_table_name, v_column)
    into v_count
    using auth.uid(), v_window, v_max;
  if v_count >= v_max then
    raise exception 'Vas muy rápido: espera un momentito y vuelve a intentarlo' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_rate_limit() from public, anon, authenticated;

create index if not exists chat_messages_sender_idx on public.chat_messages (sender_id, created_at desc);
create index if not exists invitations_creator_idx on public.invitations (created_by, created_at desc);
create index if not exists todo_lists_owner_idx on public.todo_lists (owner_id, created_at desc);
create index if not exists todo_items_creator_idx on public.todo_items (created_by, created_at desc);
create index if not exists todo_item_images_creator_idx on public.todo_item_images (created_by, created_at desc);

create trigger chat_messages_rate_limit before insert on public.chat_messages
  for each row execute function public.enforce_rate_limit('sender_id', '30', '1 minute');
create trigger notes_rate_limit before insert on public.notes
  for each row execute function public.enforce_rate_limit('sender_id', '20', '10 minutes');
create trigger invitations_rate_limit before insert on public.invitations
  for each row execute function public.enforce_rate_limit('created_by', '20', '1 hour');
create trigger todo_lists_rate_limit before insert on public.todo_lists
  for each row execute function public.enforce_rate_limit('owner_id', '30', '1 hour');
create trigger todo_items_rate_limit before insert on public.todo_items
  for each row execute function public.enforce_rate_limit('created_by', '200', '10 minutes');
create trigger todo_item_images_rate_limit before insert on public.todo_item_images
  for each row execute function public.enforce_rate_limit('created_by', '60', '10 minutes');

-- -----------------------------------------------------------------------------
-- Auditoría: quién hizo cada acción de cuentas desde el panel (la Edge
-- Function admin-users usa la service role, así que auth.uid() sería null).
-- -----------------------------------------------------------------------------
comment on table public.audit_log is
  'Registro de cambios. table_name = ''accounts'' son acciones de cuentas hechas con admin-users (crear, desactivar, borrar, enlace de recuperación).';

-- >>> migrations/20261103000100_chat_app.sql
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

-- >>> migrations/20261103000500_surprise_recipient.sql
-- =============================================================================
-- 016 · Cada sorpresa es para una sola persona
-- -----------------------------------------------------------------------------
-- Antes una sorpresa le salía a todo el que abría la página, incluida quien
-- la creó (y quien tuviera el permiso de sorpresas podía verlas todas en el
-- panel, así que ya no era sorpresa). Ahora:
--
--   * Al crearla se elige para quién es (`recipient_id`), que debe ser otra
--     persona activa: nunca quien la crea.
--   * Sólo esa persona la ve al abrir la página, y sólo a ella le llega el
--     aviso.
--   * En el panel cada quien ve, edita y borra únicamente las sorpresas que
--     creó; las que le prepararon a ella no aparecen ahí.
--
-- Las sorpresas creadas antes de este cambio no tienen destinatario: se
-- siguen mostrando a quienes inician sesión, menos a quien la creó.
-- =============================================================================

alter table public.interruptions
  add column recipient_id uuid references auth.users (id) on delete cascade;

-- Nadie se manda una sorpresa a sí mismo (también para quien edite la fila).
alter table public.interruptions
  add constraint interruptions_not_self
  check (recipient_id is null or created_by is null or recipient_id <> created_by);

create index interruptions_recipient_idx on public.interruptions (recipient_id);
create index interruptions_created_by_idx on public.interruptions (created_by);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
drop policy if exists "interruptions: lectura" on public.interruptions;
drop policy if exists "interruptions: gestión" on public.interruptions;

-- La destinataria la ve mientras esté activa; quien la creó, siempre (en su
-- panel). Sin sesión no se ve ninguna sorpresa.
create policy "interruptions: lectura" on public.interruptions
  for select to authenticated
  using (
    (created_by = auth.uid() and public.has_permission('interruptions.manage'))
    or (is_active
        and starts_at <= now() and (ends_at is null or ends_at > now())
        and public.can_view_site()
        and (recipient_id = auth.uid()
             or (recipient_id is null and created_by is distinct from auth.uid())))
  );

-- Sólo se crean, cambian y borran las propias, y siempre para otra persona
-- activa. `created_by` lo pone el trigger interruptions_stamp_author antes de
-- que se compruebe esta política.
create policy "interruptions: gestión" on public.interruptions
  for all to authenticated
  using (public.has_permission('interruptions.manage') and created_by = auth.uid())
  with check (
    public.has_permission('interruptions.manage')
    and created_by = auth.uid()
    and recipient_id is not null
    and recipient_id <> auth.uid()
    and exists (select 1 from public.profiles p where p.id = recipient_id and p.is_active)
  );

-- -----------------------------------------------------------------------------
-- Aviso: sólo a la destinataria (o, en las antiguas, a todos menos a quien
-- la creó).
-- -----------------------------------------------------------------------------
create or replace function public.notify_new_interruption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author text;
begin
  if not new.is_active or new.starts_at > now() or (new.ends_at is not null and new.ends_at <= now()) then
    return new;
  end if;
  select display_name into v_author from public.profiles where id = new.created_by;
  insert into public.notifications (user_id, kind, title, body, link)
  select p.id, 'system', coalesce(v_author, 'Alguien') || ' te dejó una sorpresa 🎁', left(new.title, 140), '/'
    from public.profiles p
   where p.id is distinct from new.created_by
     and (new.recipient_id is null or p.id = new.recipient_id)
     and p.is_active
     and (p.role = 'super_admin' or exists (
           select 1 from public.role_permissions rp
            where rp.role = p.role and rp.permission = 'site.view'));
  return new;
end;
$$;

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
