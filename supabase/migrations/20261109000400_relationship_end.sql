-- 026 · Fin de la relación.
--
-- relationship_end guarda el día en que terminó la relación. Con fecha:
--   - el contador de «tiempo juntos» se queda quieto en ese día en vez de
--     seguir sumando,
--   - la portada dice «del … al …» en vez de «juntos desde …»,
--   - el aniversario deja de celebrarse (tema del día y cuenta regresiva),
--   - las fechas importantes marcadas only_together («sólo mientras estemos
--     juntos») se ocultan de las cuentas regresivas,
--   - el subtítulo del contador («Y contando…») se oculta.
-- No se borra nada: fotos, dedicatorias, chat y listas siguen igual. Se puede
-- quitar la fecha desde Configuración y todo vuelve a como estaba.

alter table public.site_settings
  add column relationship_end date,
  add constraint site_settings_relationship_end_check
    check (relationship_end is null or relationship_start is null or relationship_end >= relationship_start);

-- La relación terminó el 31 de octubre de 2026. Sólo se pone si ya hay fecha
-- de inicio (en una base nueva el seed la pone después y queda sin fin).
update public.site_settings
   set relationship_end = '2026-10-31'
 where id = 1
   and relationship_end is null
   and relationship_start is not null
   and relationship_start <= '2026-10-31';

-- Fechas que sólo tienen sentido mientras siguen juntos. Se marcan el
-- aniversario (se repite el mismo día en que empezó todo) y las que dicen
-- «juntos» en el título, como «Navidad juntos». Se cambia en Panel → Fechas.
alter table public.important_dates
  add column only_together boolean not null default false;

update public.important_dates d
   set only_together = true
  from public.site_settings s
 where s.id = 1
   and d.recurs_yearly
   and (d.title ilike '%juntos%'
        or (s.relationship_start is not null
            and to_char(d.event_date, 'MM-DD') = to_char(s.relationship_start, 'MM-DD')));

-- Cambiar la fecha de fin pide el mismo permiso que la de inicio.
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

  if (new.site_title, new.site_subtitle, new.relationship_start, new.relationship_end, new.is_public, new.music_url, new.translations)
     is distinct from
     (old.site_title, old.site_subtitle, old.relationship_start, old.relationship_end, old.is_public, old.music_url, old.translations)
     and not public.has_permission('settings.manage') then
    raise exception 'No tienes permiso para cambiar la configuración' using errcode = '42501';
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;
