-- =============================================================================
-- 011 · Avisos en la pantalla de notificaciones del celular
-- =============================================================================
-- Cada fila nueva de notifications (o un aviso de chat sin leer que se
-- actualiza con el último mensaje) llama a la Edge Function send-push, que
-- manda el Web Push a los dispositivos de esa persona.
--
-- La URL de la función y su secreto viven en Supabase Vault
-- (push_function_url y push_webhook_secret); el flujo Deploy los crea. Sin
-- ellos no se envía nada y la app sigue funcionando igual.

do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net with schema extensions;
  end if;
end;
$$;

create or replace function public.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_secret text;
begin
  if new.read_at is not null then
    return new;
  end if;
  -- En una actualización sólo avisa si llegó algo nuevo (no al marcar leído).
  if tg_op = 'UPDATE' and (new.title, new.body, new.created_at) is not distinct from (old.title, old.body, old.created_at) then
    return new;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_function_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object(
      'type', 'INSERT',
      'record', jsonb_build_object('user_id', new.user_id, 'kind', new.kind, 'title', new.title, 'body', new.body, 'link', new.link)
    ),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  -- Un fallo del push nunca debe impedir que se guarde el aviso.
  return new;
end;
$$;

revoke execute on function public.dispatch_push() from public, anon, authenticated;

create trigger notifications_push after insert or update on public.notifications
  for each row execute function public.dispatch_push();

-- -----------------------------------------------------------------------------
-- Chat como en WhatsApp: cada mensaje avisa. Para no llenar la campana, si ya
-- hay un aviso de chat sin leer se actualiza con el último mensaje (y eso
-- también dispara el push) en vez de crear otro.
-- -----------------------------------------------------------------------------
create or replace function public.notify_new_chat_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_title text;
  v_preview text;
begin
  select coalesce(display_name, 'Alguien') || ' te escribió 💬' into v_title from public.profiles where id = new.sender_id;
  v_title := coalesce(v_title, 'Alguien te escribió 💬');
  v_preview := left(case new.kind
    when 'image' then '📷 Foto' || coalesce(nullif(': ' || btrim(new.body), ': '), '')
    when 'sticker' then '✨ Sticker'
    else new.body
  end, 140);

  with recipients as (
    select p.id
      from public.profiles p
     where p.id <> new.sender_id
       and p.is_active
       and (p.role = 'super_admin' or exists (
             select 1 from public.role_permissions rp
              where rp.role = p.role and rp.permission = 'chat.use'))
  ), updated as (
    update public.notifications n
       set title = v_title, body = v_preview, created_at = now()
      from recipients r
     where n.user_id = r.id and n.kind = 'chat' and n.read_at is null
    returning n.user_id
  )
  insert into public.notifications (user_id, kind, title, body, link)
  select r.id, 'chat', v_title, v_preview, '/chat'
    from recipients r
   where r.id not in (select user_id from updated);
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Sorpresas: avisa a quienes pueden ver la página cuando se publica una que
-- ya está activa. Las programadas para más adelante aparecen al entrar.
-- -----------------------------------------------------------------------------
create or replace function public.notify_new_interruption()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_author text;
begin
  if not new.is_active or new.starts_at > now() or (new.ends_at is not null and new.ends_at <= now()) then
    return new;
  end if;
  select display_name into v_author from public.profiles where id = new.created_by;
  insert into public.notifications (user_id, kind, title, body, link)
  select p.id, 'system', coalesce(v_author, 'Alguien') || ' te dejó una sorpresa 🎁', left(new.title, 140), '/'
    from public.profiles p
   where p.id is distinct from new.created_by
     and p.is_active
     and (p.role = 'super_admin' or exists (
           select 1 from public.role_permissions rp
            where rp.role = p.role and rp.permission = 'site.view'));
  return new;
end;
$$;

create trigger interruptions_notify after insert on public.interruptions
  for each row execute function public.notify_new_interruption();

-- -----------------------------------------------------------------------------
-- Suscripciones push: un celular pertenece a quien inició sesión por última
-- vez en él (si otra persona entra en el mismo equipo, deja de recibir los
-- avisos de la anterior).
-- -----------------------------------------------------------------------------
create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 200))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
end;
$$;

revoke execute on function public.register_push_subscription(text, text, text, text) from public, anon;
grant execute on function public.register_push_subscription(text, text, text, text) to authenticated;

-- Aviso de prueba para comprobar que llegan al celular (uno por minuto).
create or replace function public.send_test_notification()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Necesitas iniciar sesión' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.notifications
     where user_id = auth.uid() and kind = 'system' and link = '/cuenta'
       and created_at > now() - interval '1 minute'
  ) then
    raise exception 'Espera un minuto antes de probar otra vez' using errcode = 'P0001';
  end if;
  insert into public.notifications (user_id, kind, title, body, link)
  values (auth.uid(), 'system', 'Así te llegarán los avisos 💖', 'Si ves esto en tu celular, ya quedaron activados.', '/cuenta');
end;
$$;

revoke execute on function public.send_test_notification() from public, anon;
grant execute on function public.send_test_notification() to authenticated;
