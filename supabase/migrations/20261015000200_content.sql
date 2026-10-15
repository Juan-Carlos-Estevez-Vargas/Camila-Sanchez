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
