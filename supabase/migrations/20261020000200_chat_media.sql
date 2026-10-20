-- =============================================================================
-- 009 · Fotos y stickers en el chat
-- =============================================================================

create type public.chat_kind as enum ('text', 'image', 'sticker');

-- Las fotos viven en el bucket privado chat-media, en una carpeta por persona
-- (<user_id>/<id>.webp y su miniatura <user_id>/<id>.thumb.webp).
alter table public.chat_messages
  add column kind public.chat_kind not null default 'text',
  add column image_path text
    check (image_path is null or image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg|png)$'),
  add column thumb_path text
    check (thumb_path is null or thumb_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.thumb\.(webp|jpg|png)$'),
  add column image_width integer check (image_width is null or image_width between 1 and 10000),
  add column image_height integer check (image_height is null or image_height between 1 and 10000),
  -- Id de un sticker del catálogo de la app.
  add column sticker text check (sticker is null or sticker ~ '^[a-z0-9-]{1,40}$');

-- El texto deja de ser obligatorio: una foto puede ir sin pie y un sticker
-- no lleva texto. Cada tipo exige lo suyo.
alter table public.chat_messages drop constraint chat_messages_body_check;
alter table public.chat_messages
  add constraint chat_messages_body_length check (char_length(body) <= 2000),
  add constraint chat_messages_content check (
    (kind = 'text' and char_length(btrim(body)) >= 1 and image_path is null and sticker is null)
    or (kind = 'image' and image_path is not null and thumb_path is not null and sticker is null)
    or (kind = 'sticker' and sticker is not null and image_path is null and char_length(btrim(body)) = 0)
  );
alter table public.chat_messages alter column body set default '';

-- Una foto sólo puede apuntar a la carpeta de quien la envía.
drop policy "chat: escribir" on public.chat_messages;
create policy "chat: escribir" on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.has_permission('chat.use')
    and (image_path is null or (
      split_part(image_path, '/', 1) = auth.uid()::text
      and split_part(thumb_path, '/', 1) = auth.uid()::text
    ))
  );

-- El aviso dice «te mandó una foto» o «un sticker» en vez de un texto vacío.
create or replace function public.notify_new_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  preview text;
begin
  select display_name into sender_name from public.profiles where id = new.sender_id;
  preview := case new.kind
    when 'image' then '📷 Foto' || coalesce(nullif(': ' || btrim(new.body), ': '), '')
    when 'sticker' then '✨ Sticker'
    else new.body
  end;
  -- Evita inundar de avisos: sólo se notifica si el destinatario no tiene ya
  -- un aviso de chat sin leer.
  insert into public.notifications (user_id, kind, title, body, link)
  select p.id, 'chat', coalesce(sender_name, 'Alguien') || ' te escribió 💬', left(preview, 140), '/chat'
    from public.profiles p
   where p.id <> new.sender_id
     and p.is_active
     and (p.role = 'super_admin' or exists (
           select 1 from public.role_permissions rp
            where rp.role = p.role and rp.permission = 'chat.use'))
     and not exists (
           select 1 from public.notifications n
            where n.user_id = p.id and n.kind = 'chat' and n.read_at is null);
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Bucket privado de fotos del chat: sólo imágenes de hasta 5 MB, servidas con
-- URLs firmadas. Lo ve quien usa el chat; cada persona sube y borra sólo en
-- su carpeta.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-media', 'chat-media', false, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "chat-media: ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'chat-media' and public.has_permission('chat.use'));
create policy "chat-media: subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and public.has_permission('chat.use')
    and split_part(name, '/', 1) = auth.uid()::text
  );
create policy "chat-media: borrar de mi carpeta" on storage.objects
  for delete to authenticated
  using (bucket_id = 'chat-media' and split_part(name, '/', 1) = auth.uid()::text);
