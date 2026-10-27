-- =============================================================================
-- 014 · Refuerzo de seguridad (OWASP Top 10 y API Security Top 10)
-- -----------------------------------------------------------------------------
-- Nada de esto cambia cómo se usa la app; cierra rendijas:
--   * A01 · Los avisos sólo se pueden marcar como leídos (nadie reescribe el
--     texto o el enlace de un aviso) y su enlace siempre es una ruta interna.
--   * A01 · El autor de una foto o sorpresa lo pone la base, no el navegador.
--   * A01 · Las funciones internas no las puede llamar quien no tiene sesión.
--   * A10 · Los avisos al celular sólo se mandan a los servicios de push
--     reales (Google, Mozilla, Apple, Microsoft), nunca a otra dirección.
--   * API4 · Límite de velocidad para el chat, las notitas, las listas y las
--     invitaciones: un script no puede inundar la base ni los celulares.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Avisos: el dueño sólo cambia read_at, y el enlace es siempre interno
-- -----------------------------------------------------------------------------

-- Las funciones de la base (security definer, que corren como su dueño)
-- sí actualizan el aviso de chat o de lista con el último mensaje.
create or replace function public.guard_notification_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (new.id, new.user_id, new.kind, new.title, new.body, new.link, new.created_at)
         is distinct from
         (old.id, old.user_id, old.kind, old.title, old.body, old.link, old.created_at) then
    raise exception 'Un aviso sólo se puede marcar como leído' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger notifications_guard before update on public.notifications
  for each row execute function public.guard_notification_update();

-- "/chat" sí; "//otro-sitio.com", "/\otro-sitio.com" o con saltos de línea no.
update public.notifications
   set link = '/'
 where link is not null
   and not ((link = '/' or link ~ '^/[^/\\]') and link !~ '[[:cntrl:]]');

alter table public.notifications drop constraint notifications_link_check;
alter table public.notifications
  add constraint notifications_link_check check (
    link is null or ((link = '/' or link ~ '^/[^/\\]') and link !~ '[[:cntrl:]]' and char_length(link) <= 300)
  );

-- Una notita enviada tampoco puede cambiar de id.
create or replace function public.guard_note_update()
returns trigger
language plpgsql
as $$
begin
  if (new.id, new.sender_id, new.recipient_id, new.kind, new.title, new.body, new.created_at)
     is distinct from
     (old.id, old.sender_id, old.recipient_id, old.kind, old.title, old.body, old.created_at) then
    raise exception 'Una notita enviada no se puede modificar' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Autoría: la pone la base con la sesión, no lo que mande el navegador
-- -----------------------------------------------------------------------------
create or replace function public.stamp_created_by()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

create trigger photos_stamp_author before insert on public.photos
  for each row execute function public.stamp_created_by();
create trigger interruptions_stamp_author before insert on public.interruptions
  for each row execute function public.stamp_created_by();

-- -----------------------------------------------------------------------------
-- Funciones: sin sesión sólo se pueden usar las que necesita la página
-- pública (has_permission, can_view_site, current_app_role)
-- -----------------------------------------------------------------------------
revoke execute on function public.my_permissions() from public, anon;
revoke execute on function public.mark_notifications_read(text) from public, anon;
revoke execute on function public.is_list_member(uuid) from public, anon;
revoke execute on function public.is_list_owner(uuid) from public, anon;
revoke execute on function public.todo_item_list(uuid) from public, anon;
revoke execute on function public.is_list_folder_member(text) from public, anon;
revoke execute on function public.is_valid_theme_colors(jsonb) from anon;
grant execute on function public.my_permissions() to authenticated;
grant execute on function public.mark_notifications_read(text) to authenticated;
grant execute on function public.is_list_member(uuid) to authenticated;
grant execute on function public.is_list_owner(uuid) to authenticated;
grant execute on function public.todo_item_list(uuid) to authenticated;
grant execute on function public.is_list_folder_member(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Almacenamiento
-- -----------------------------------------------------------------------------

-- Una cuenta desactivada ya no sube fotos de perfil.
drop policy "avatars: subir a mi carpeta" on storage.objects;
create policy "avatars: subir a mi carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and public.current_app_role() is not null
    and split_part(name, '/', 1) = auth.uid()::text
  );

-- Al reemplazar una foto del álbum, sigue quedando en el álbum.
drop policy "photos bucket: actualizar" on storage.objects;
create policy "photos bucket: actualizar" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and public.has_permission('photos.manage'))
  with check (bucket_id = 'photos' and public.has_permission('photos.manage'));

-- -----------------------------------------------------------------------------
-- Suscripciones push: sólo a los servicios de push de los navegadores
-- -----------------------------------------------------------------------------
-- Si alguien registrara https://cualquier-sitio como "celular", la función
-- send-push haría peticiones a esa dirección (SSRF).
create or replace function public.is_push_endpoint(p_endpoint text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_endpoint is not null
     and char_length(p_endpoint) <= 1024
     and p_endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|([a-z0-9-]+\.)*push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
     and p_endpoint !~ '[[:space:][:cntrl:]]';
$$;

delete from public.push_subscriptions
 where not public.is_push_endpoint(endpoint)
    or p256dh !~ '^[A-Za-z0-9+/_=-]{1,200}$'
    or auth !~ '^[A-Za-z0-9+/_=-]{1,100}$';

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_service check (public.is_push_endpoint(endpoint)),
  add constraint push_subscriptions_keys_format check (
    p256dh ~ '^[A-Za-z0-9+/_=-]{1,200}$' and auth ~ '^[A-Za-z0-9+/_=-]{1,100}$'
  );

-- -----------------------------------------------------------------------------
-- Límite de velocidad (API4: consumo de recursos sin límite)
-- -----------------------------------------------------------------------------
-- enforce_rate_limit(columna_del_autor, máximo, ventana): cuenta las filas que
-- la persona de la sesión creó en la ventana y frena la siguiente si ya llegó
-- al máximo. Los límites sobran para el uso normal de la pareja.
create or replace function public.enforce_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_column text := tg_argv[0];
  v_max integer := tg_argv[1]::integer;
  v_window interval := tg_argv[2]::interval;
  v_count integer;
begin
  if auth.uid() is null then
    return new;
  end if;
  execute format(
    'select count(*) from (select 1 from public.%I where %I = $1 and created_at > now() - $2 limit $3) s',
    tg_table_name, v_column)
    into v_count
    using auth.uid(), v_window, v_max;
  if v_count >= v_max then
    raise exception 'Vas muy rápido: espera un momentito y vuelve a intentarlo' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_rate_limit() from public, anon, authenticated;

create index if not exists chat_messages_sender_idx on public.chat_messages (sender_id, created_at desc);
create index if not exists invitations_creator_idx on public.invitations (created_by, created_at desc);
create index if not exists todo_lists_owner_idx on public.todo_lists (owner_id, created_at desc);
create index if not exists todo_items_creator_idx on public.todo_items (created_by, created_at desc);
create index if not exists todo_item_images_creator_idx on public.todo_item_images (created_by, created_at desc);

create trigger chat_messages_rate_limit before insert on public.chat_messages
  for each row execute function public.enforce_rate_limit('sender_id', '30', '1 minute');
create trigger notes_rate_limit before insert on public.notes
  for each row execute function public.enforce_rate_limit('sender_id', '20', '10 minutes');
create trigger invitations_rate_limit before insert on public.invitations
  for each row execute function public.enforce_rate_limit('created_by', '20', '1 hour');
create trigger todo_lists_rate_limit before insert on public.todo_lists
  for each row execute function public.enforce_rate_limit('owner_id', '30', '1 hour');
create trigger todo_items_rate_limit before insert on public.todo_items
  for each row execute function public.enforce_rate_limit('created_by', '200', '10 minutes');
create trigger todo_item_images_rate_limit before insert on public.todo_item_images
  for each row execute function public.enforce_rate_limit('created_by', '60', '10 minutes');

-- -----------------------------------------------------------------------------
-- Auditoría: quién hizo cada acción de cuentas desde el panel (la Edge
-- Function admin-users usa la service role, así que auth.uid() sería null).
-- -----------------------------------------------------------------------------
comment on table public.audit_log is
  'Registro de cambios. table_name = ''accounts'' son acciones de cuentas hechas con admin-users (crear, desactivar, borrar, enlace de recuperación).';
