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
