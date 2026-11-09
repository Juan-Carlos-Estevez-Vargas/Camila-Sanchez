-- 023 · Cambiar una foto de una dedicatoria sin perder su lugar.
--
-- Quien escribió la dedicatoria puede cambiar el archivo de una foto (mal
-- cargada o de poca calidad) por otro: se actualizan path, thumb_path, width
-- y height en la misma fila, así conserva su orden. Los archivos nuevos deben
-- seguir en la carpeta de su dedicatoria; id, dedicatoria, autor y fecha de
-- creación siguen sin poder cambiarse.

drop trigger if exists dedication_photos_immutable on public.dedication_photos;
create trigger dedication_photos_immutable before update on public.dedication_photos
  for each row execute function public.guard_immutable_columns('id', 'dedication_id', 'created_by', 'created_at');

create or replace function public.guard_dedication_photo_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if split_part(new.path, '/', 1) <> new.dedication_id::text or split_part(new.thumb_path, '/', 1) <> new.dedication_id::text then
    raise exception 'El archivo debe estar en la carpeta de su dedicatoria.' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.guard_dedication_photo_update() from public, anon, authenticated;

create trigger dedication_photos_guard_update before update of path, thumb_path on public.dedication_photos
  for each row execute function public.guard_dedication_photo_update();
