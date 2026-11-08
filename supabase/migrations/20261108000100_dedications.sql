-- =============================================================================
-- 022 · Dedicatorias con fotos y canciones (y la playlist que se arma sola)
-- -----------------------------------------------------------------------------
-- Una dedicatoria es un mensaje de una persona para otra (o para todas) con
-- fotos y canciones. Las canciones pueden ser enlaces de YouTube o Spotify
-- (se reproducen dentro de la app), otros enlaces (se abren aparte) o
-- archivos de audio subidos. Todas las canciones que una persona puede ver
-- forman su playlist; la app la arma, la reproduce y la exporta.
--
-- Quién ve qué: quien la escribió, a quien va dirigida y, si es «para todos»,
-- cualquiera que use dedicatorias. Sólo quien la escribió la cambia o la borra.
-- =============================================================================

insert into public.permissions (key, description) values
  ('dedications.use', 'Escribir dedicatorias con fotos y canciones y escuchar la playlist')
on conflict (key) do nothing;

insert into public.role_permissions (role, permission) values
  ('editor', 'dedications.use'),
  ('viewer', 'dedications.use')
on conflict do nothing;

-- Los avisos de dedicatorias tienen su propio tipo (y su contador en la cabecera).
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check check (kind in ('note', 'chat', 'system', 'list', 'dedication'));

-- -----------------------------------------------------------------------------
-- Tablas
-- -----------------------------------------------------------------------------

create table public.dedications (
  id            uuid primary key default gen_random_uuid(),
  author_id     uuid not null references auth.users (id) on delete cascade default auth.uid(),
  -- null = para todas las personas que usan dedicatorias.
  recipient_id  uuid references auth.users (id) on delete set null,
  title         text not null check (char_length(btrim(title)) between 1 and 120),
  message       text not null default '' check (char_length(message) <= 8000),
  emoji         text not null default '💌' check (char_length(emoji) between 1 and 16),
  dedicated_on  date not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint dedications_not_to_self check (recipient_id is distinct from author_id)
);

create index dedications_author_idx on public.dedications (author_id, created_at desc);
create index dedications_recipient_idx on public.dedications (recipient_id);

-- Fotos: en el bucket privado dedication-media, en la carpeta de la
-- dedicatoria: <dedication_id>/<id>.webp y su miniatura <id>.thumb.webp.
create table public.dedication_photos (
  id             uuid primary key default gen_random_uuid(),
  dedication_id  uuid not null references public.dedications (id) on delete cascade,
  path           text not null check (path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'),
  thumb_path     text not null check (thumb_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.thumb\.(webp|jpg|png)$'),
  width          integer check (width is null or width between 1 and 10000),
  height         integer check (height is null or height between 1 and 10000),
  position       double precision not null default extract(epoch from clock_timestamp()),
  created_by     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now()
);

create index dedication_photos_dedication_idx on public.dedication_photos (dedication_id, position);
create index dedication_photos_creator_idx on public.dedication_photos (created_by, created_at desc);

-- Canciones. source dice cómo suena:
--   youtube / spotify → url de ese servicio (se incrusta su reproductor)
--   link              → cualquier otro enlace https (se abre aparte)
--   audio             → archivo subido: audio_path en la carpeta de la dedicatoria
create table public.dedication_songs (
  id             uuid primary key default gen_random_uuid(),
  dedication_id  uuid not null references public.dedications (id) on delete cascade,
  title          text not null check (char_length(btrim(title)) between 1 and 200),
  artist         text not null default '' check (char_length(artist) <= 200),
  note           text not null default '' check (char_length(note) <= 500),
  source         text not null check (source in ('youtube', 'spotify', 'link', 'audio')),
  url            text check (url is null or (char_length(url) <= 500 and url ~ '^https://[^\s/@]+\.[^\s]*$' and url !~ '[[:cntrl:]]')),
  audio_path     text check (audio_path is null or audio_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(mp3|m4a|aac|ogg|opus|wav|webm|flac)$'),
  position       double precision not null default extract(epoch from clock_timestamp()),
  created_by     uuid references auth.users (id) on delete set null default auth.uid(),
  created_at     timestamptz not null default now(),
  constraint dedication_songs_source check (
    case source
      when 'audio'   then audio_path is not null and url is null
      when 'youtube' then audio_path is null and url ~ '^https://(www\.|m\.|music\.)?(youtube\.com|youtu\.be)/'
      when 'spotify' then audio_path is null and url ~ '^https://open\.spotify\.com/'
      else audio_path is null and url is not null
    end
  )
);

create index dedication_songs_dedication_idx on public.dedication_songs (dedication_id, position);
create index dedication_songs_creator_idx on public.dedication_songs (created_by, created_at desc);

-- -----------------------------------------------------------------------------
-- Funciones de acceso (security definer para no recursar en RLS)
-- -----------------------------------------------------------------------------

-- ¿Quien tiene la sesión puede ver la dedicatoria?
create or replace function public.can_see_dedication(p_dedication uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('dedications.use')
     and exists (select 1 from public.dedications d
                  where d.id = p_dedication
                    and (d.author_id = auth.uid() or d.recipient_id = auth.uid() or d.recipient_id is null));
$$;

-- ¿Quien tiene la sesión la escribió (y puede usar dedicatorias)?
create or replace function public.is_dedication_author(p_dedication uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission('dedications.use')
     and exists (select 1 from public.dedications d where d.id = p_dedication and d.author_id = auth.uid());
$$;

-- Para el almacenamiento: la carpeta (primer tramo de la ruta) es una dedicatoria.
create or replace function public.dedication_folder(p_name text)
returns uuid
language sql
immutable
as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
  end;
$$;

revoke execute on function public.can_see_dedication(uuid) from public, anon;
revoke execute on function public.is_dedication_author(uuid) from public, anon;
revoke execute on function public.dedication_folder(text) from public, anon;
grant execute on function public.can_see_dedication(uuid) to authenticated;
grant execute on function public.is_dedication_author(uuid) to authenticated;
grant execute on function public.dedication_folder(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Reglas de negocio
-- -----------------------------------------------------------------------------

-- La persona elegida tiene que poder recibir dedicatorias; la autora la pone la base.
create or replace function public.guard_dedication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and auth.uid() is not null then
    new.author_id := auth.uid();
  end if;
  if new.recipient_id is not null
     and (tg_op = 'INSERT' or new.recipient_id is distinct from old.recipient_id) then
    if new.recipient_id = new.author_id then
      raise exception 'Elige a otra persona (o «Para todos»).' using errcode = '23514';
    end if;
    if not public.user_has_permission(new.recipient_id, 'dedications.use') then
      raise exception 'Esa persona no puede recibir dedicatorias.' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger dedications_guard before insert or update on public.dedications
  for each row execute function public.guard_dedication();
create trigger dedications_immutable before update on public.dedications
  for each row execute function public.guard_immutable_columns('id', 'author_id', 'created_at');
create trigger dedications_rate_limit before insert on public.dedications
  for each row execute function public.enforce_rate_limit('author_id', '30', '1 hour');

-- Aviso a quien va dirigida (o a todos menos a quien la escribió) al crearla
-- y cuando se le dedica a otra persona.
create or replace function public.notify_dedication()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author text;
  v_title text;
  v_body text;
begin
  if tg_op = 'UPDATE' and new.recipient_id is not distinct from old.recipient_id then
    return new;
  end if;
  select coalesce(display_name, 'Alguien') into v_author from public.profiles where id = new.author_id;
  v_title := left(coalesce(v_author, 'Alguien') || ' te dedicó algo ' || new.emoji, 160);
  v_body := left(new.title, 140);
  insert into public.notifications (user_id, kind, title, body, link)
  select p.id, 'dedication', v_title, v_body, '/dedicatorias/' || new.id
    from public.profiles p
   where p.id is distinct from new.author_id
     and (new.recipient_id is null or p.id = new.recipient_id)
     and (tg_op = 'INSERT' or new.recipient_id is not null)
     and public.user_has_permission(p.id, 'dedications.use');
  return new;
end;
$$;

revoke execute on function public.notify_dedication() from public, anon, authenticated;

create trigger dedications_notify after insert or update on public.dedications
  for each row execute function public.notify_dedication();

-- Fotos: en la carpeta de su dedicatoria y hasta 12.
create or replace function public.guard_dedication_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if split_part(new.path, '/', 1) <> new.dedication_id::text or split_part(new.thumb_path, '/', 1) <> new.dedication_id::text then
    raise exception 'El archivo debe estar en la carpeta de su dedicatoria.' using errcode = '42501';
  end if;
  if (select count(*) from public.dedication_photos where dedication_id = new.dedication_id) >= 12 then
    raise exception 'Máximo 12 fotos por dedicatoria.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger dedication_photos_guard before insert on public.dedication_photos
  for each row execute function public.guard_dedication_photo();
create trigger dedication_photos_stamp_author before insert on public.dedication_photos
  for each row execute function public.stamp_created_by();
create trigger dedication_photos_immutable before update on public.dedication_photos
  for each row execute function public.guard_immutable_columns('id', 'dedication_id', 'path', 'thumb_path', 'created_by', 'created_at');
create trigger dedication_photos_rate_limit before insert on public.dedication_photos
  for each row execute function public.enforce_rate_limit('created_by', '60', '10 minutes');

-- Canciones: el audio en la carpeta de su dedicatoria y hasta 50.
create or replace function public.guard_dedication_song()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.audio_path is not null and split_part(new.audio_path, '/', 1) <> new.dedication_id::text then
    raise exception 'El archivo debe estar en la carpeta de su dedicatoria.' using errcode = '42501';
  end if;
  if (select count(*) from public.dedication_songs where dedication_id = new.dedication_id) >= 50 then
    raise exception 'Máximo 50 canciones por dedicatoria.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger dedication_songs_guard before insert on public.dedication_songs
  for each row execute function public.guard_dedication_song();
create trigger dedication_songs_stamp_author before insert on public.dedication_songs
  for each row execute function public.stamp_created_by();
-- El tipo y el archivo no cambian (el archivo quedaría huérfano); el título, el
-- artista, la nota, el orden y el enlace sí.
create trigger dedication_songs_immutable before update on public.dedication_songs
  for each row execute function public.guard_immutable_columns('id', 'dedication_id', 'source', 'audio_path', 'created_by', 'created_at');
create trigger dedication_songs_rate_limit before insert on public.dedication_songs
  for each row execute function public.enforce_rate_limit('created_by', '300', '10 minutes');

-- Reordenar las canciones de una dedicatoria en una sola llamada.
create or replace function public.reorder_dedication_songs(p_dedication uuid, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_dedication_author(p_dedication) then
    raise exception 'Sólo quien escribió la dedicatoria puede cambiarla.' using errcode = '42501';
  end if;
  update public.dedication_songs s
     set position = o.ord
    from unnest(p_ids) with ordinality as o(id, ord)
   where s.id = o.id and s.dedication_id = p_dedication;
end;
$$;

revoke execute on function public.reorder_dedication_songs(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_dedication_songs(uuid, uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.dedications enable row level security;
alter table public.dedication_photos enable row level security;
alter table public.dedication_songs enable row level security;

create policy "dedications: ver" on public.dedications
  for select to authenticated
  using (
    public.has_permission('dedications.use')
    and (author_id = auth.uid() or recipient_id = auth.uid() or recipient_id is null)
  );
create policy "dedications: escribir" on public.dedications
  for insert to authenticated
  with check (public.has_permission('dedications.use') and author_id = auth.uid());
create policy "dedications: cambiar las mías" on public.dedications
  for update to authenticated
  using (public.has_permission('dedications.use') and author_id = auth.uid())
  with check (public.has_permission('dedications.use') and author_id = auth.uid());
create policy "dedications: borrar las mías" on public.dedications
  for delete to authenticated
  using (public.has_permission('dedications.use') and author_id = auth.uid());

create policy "dedication_photos: ver" on public.dedication_photos
  for select to authenticated using (public.can_see_dedication(dedication_id));
create policy "dedication_photos: agregar" on public.dedication_photos
  for insert to authenticated with check (public.is_dedication_author(dedication_id));
create policy "dedication_photos: cambiar" on public.dedication_photos
  for update to authenticated
  using (public.is_dedication_author(dedication_id))
  with check (public.is_dedication_author(dedication_id));
create policy "dedication_photos: borrar" on public.dedication_photos
  for delete to authenticated using (public.is_dedication_author(dedication_id));

create policy "dedication_songs: ver" on public.dedication_songs
  for select to authenticated using (public.can_see_dedication(dedication_id));
create policy "dedication_songs: agregar" on public.dedication_songs
  for insert to authenticated with check (public.is_dedication_author(dedication_id));
create policy "dedication_songs: cambiar" on public.dedication_songs
  for update to authenticated
  using (public.is_dedication_author(dedication_id))
  with check (public.is_dedication_author(dedication_id));
create policy "dedication_songs: borrar" on public.dedication_songs
  for delete to authenticated using (public.is_dedication_author(dedication_id));

-- -----------------------------------------------------------------------------
-- Bucket privado de fotos y audios: imágenes y audio de hasta 20 MB. Lo ve
-- quien puede ver la dedicatoria de la carpeta; sube y borra quien la escribió.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dedication-media', 'dedication-media', false, 20971520,
  array['image/webp', 'image/jpeg', 'image/png',
        'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/flac']
)
on conflict (id) do nothing;

create policy "dedication-media: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'dedication-media' and public.can_see_dedication(public.dedication_folder(name)));
create policy "dedication-media: subir" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'dedication-media' and public.is_dedication_author(public.dedication_folder(name)));
create policy "dedication-media: borrar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'dedication-media' and public.is_dedication_author(public.dedication_folder(name)));

-- Realtime: la página y la playlist se actualizan en vivo.
alter publication supabase_realtime add table
  public.dedications,
  public.dedication_photos,
  public.dedication_songs;
