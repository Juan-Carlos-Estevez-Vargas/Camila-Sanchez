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
