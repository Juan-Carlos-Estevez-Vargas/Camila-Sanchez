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
