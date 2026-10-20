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
