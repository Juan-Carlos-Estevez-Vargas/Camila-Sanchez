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
