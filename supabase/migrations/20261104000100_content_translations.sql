-- =============================================================================
-- 019 · Contenido en varios idiomas
-- -----------------------------------------------------------------------------
-- La interfaz ya está en español, inglés y portugués, pero lo que se escribe
-- en el panel (título de la página, secciones, carta, hitos, fechas) sólo
-- existía en español. Cada fila guarda ahora sus traducciones en
-- `translations`, con la misma forma que el original:
--
--   { "en": { "title": "For the love of my life" }, "pt": { "title": "…" } }
--
-- Lo que falte se muestra en español. Las políticas de RLS no cambian: quien
-- puede editar una fila puede editar sus traducciones.
-- =============================================================================

alter table public.site_settings
  add column translations jsonb not null default '{}'::jsonb;
alter table public.sections
  add column translations jsonb not null default '{}'::jsonb;
alter table public.milestones
  add column translations jsonb not null default '{}'::jsonb;
alter table public.important_dates
  add column translations jsonb not null default '{}'::jsonb;

-- Siempre un objeto y de tamaño razonable (las traducciones viajan a la página).
alter table public.site_settings
  add constraint site_settings_translations_shape
  check (jsonb_typeof(translations) = 'object' and octet_length(translations::text) <= 60000);
alter table public.sections
  add constraint sections_translations_shape
  check (jsonb_typeof(translations) = 'object' and octet_length(translations::text) <= 60000);
alter table public.milestones
  add constraint milestones_translations_shape
  check (jsonb_typeof(translations) = 'object' and octet_length(translations::text) <= 60000);
alter table public.important_dates
  add constraint important_dates_translations_shape
  check (jsonb_typeof(translations) = 'object' and octet_length(translations::text) <= 60000);

-- Las traducciones del título y el subtítulo cuentan como configuración: quien
-- sólo puede cambiar el tema tampoco puede cambiarlas.
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

  if (new.site_title, new.site_subtitle, new.relationship_start, new.is_public, new.music_url, new.translations)
     is distinct from
     (old.site_title, old.site_subtitle, old.relationship_start, old.is_public, old.music_url, old.translations)
     and not public.has_permission('settings.manage') then
    raise exception 'No tienes permiso para cambiar la configuración' using errcode = '42501';
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;
