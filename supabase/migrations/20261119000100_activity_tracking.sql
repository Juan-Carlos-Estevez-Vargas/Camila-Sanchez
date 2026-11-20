-- =============================================================================
-- 030 · Seguimiento de actividad (sólo para el administrador)
-- =============================================================================
--
-- Deja ver, desde el panel de Auditoría, cuándo entra cada persona, qué
-- secciones mira, cuánto tiempo y desde qué dispositivo. Pensado para que Juan
-- (super admin) pueda hacerle seguimiento a Camila dentro de su propia app.
--
-- Qué se guarda y qué NO:
--   • Sí: inicio de cada visita, última vez a la vista, tipo de dispositivo
--     (celular/tablet/computador), sistema y navegador, las rutas que abre
--     (sin identificadores: "/listas/:id", el chat siempre como "/chat") y los
--     segundos con la app a la vista.
--   • No: el contenido de los mensajes privados, lo que escribe (keystrokes),
--     la dirección IP ni la ubicación. El chat se registra sólo como "/chat",
--     nunca con quién habla ni qué conversación abre.
--
-- A nadie se le muestra ningún aviso dentro de la app: el seguimiento es
-- silencioso y sólo lo ve quien tiene el permiso audit.view.

create table public.activity_sessions (
  id              uuid primary key,
  user_id         uuid not null references auth.users (id) on delete cascade,
  started_at      timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  device          jsonb not null default '{}'::jsonb,
  active_seconds  integer not null default 0 check (active_seconds >= 0),
  pages           integer not null default 0 check (pages >= 0)
);

create index activity_sessions_user_idx on public.activity_sessions (user_id, started_at desc);
create index activity_sessions_started_idx on public.activity_sessions (started_at desc);

create table public.activity_page_views (
  id          uuid primary key,
  session_id  uuid not null references public.activity_sessions (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  path        text not null,
  section     text not null,
  started_at  timestamptz not null default now(),
  seconds     integer not null default 0 check (seconds >= 0)
);

create index activity_page_views_session_idx on public.activity_page_views (session_id);
create index activity_page_views_user_idx on public.activity_page_views (user_id, started_at desc);

alter table public.activity_sessions enable row level security;
alter table public.activity_page_views enable row level security;

-- Sólo quien puede ver la auditoría lee la actividad. Nadie la escribe
-- directamente: se hace con activity_track (security definer), que siempre usa
-- la cuenta de quien tiene la sesión, así nadie registra actividad por otro.
create policy "activity_sessions: lectura" on public.activity_sessions
  for select to authenticated using (public.has_permission('audit.view'));

create policy "activity_page_views: lectura" on public.activity_page_views
  for select to authenticated using (public.has_permission('audit.view'));

-- Verificación en dos pasos (migración 027/two_step): quien la activó no recibe
-- nada hasta escribir el código. Estas tablas son nuevas, así que llevan la
-- misma política restrictiva que las demás.
create policy "dos pasos: falta el código" on public.activity_sessions
  as restrictive for all to authenticated
  using (public.mfa_ok()) with check (public.mfa_ok());

create policy "dos pasos: falta el código" on public.activity_page_views
  as restrictive for all to authenticated
  using (public.mfa_ok()) with check (public.mfa_ok());

-- Cuánto tiempo se guarda la actividad (días); lo más viejo se borra solo.
create or replace function public.activity_retention_days()
returns integer language sql immutable as $$ select 180 $$;

/**
 * Registra un latido de actividad: crea o actualiza la visita y la página que
 * la persona tiene a la vista ahora mismo. La llama la propia app cada ~30 s.
 *
 *   p_session  identificador de la visita (lo genera el navegador)
 *   p_view     identificador de la página abierta (uno por navegación)
 *   p_device   {kind, os, browser, installed}
 *   p_path     ruta ya limpia (sin IDs); el chat llega como "/chat"
 *   p_section  sección de la app a la que pertenece la ruta
 *   p_delta    segundos a la vista desde el latido anterior (se recorta)
 */
create or replace function public.activity_track(
  p_session uuid,
  p_view uuid,
  p_device jsonb,
  p_path text,
  p_section text,
  p_delta integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  -- Nunca más de 2 min por latido ni rutas/valores enormes (defensa de entrada).
  v_delta integer := least(greatest(coalesce(p_delta, 0), 0), 120);
  v_path text := left(coalesce(p_path, '/'), 120);
  v_section text := left(coalesce(p_section, 'otra'), 20);
  v_new_session boolean;
  v_new_view boolean;
begin
  if v_uid is null then
    raise exception 'Hay que iniciar sesión.' using errcode = '42501';
  end if;

  insert into public.activity_sessions (id, user_id, device, active_seconds, pages)
  values (p_session, v_uid, coalesce(p_device, '{}'::jsonb), v_delta, 0)
  on conflict (id) do update
    set last_seen_at = now(),
        active_seconds = public.activity_sessions.active_seconds + v_delta,
        -- El dispositivo puede llegar vacío en latidos posteriores: se conserva.
        device = case when p_device is null or p_device = '{}'::jsonb
                   then public.activity_sessions.device else p_device end
    where public.activity_sessions.user_id = v_uid
  returning (xmax = 0) into v_new_session;

  if v_new_session is null then
    -- La visita existe pero es de otra persona: no se toca.
    return;
  end if;

  insert into public.activity_page_views (id, session_id, user_id, path, section, seconds)
  values (p_view, p_session, v_uid, v_path, v_section, v_delta)
  on conflict (id) do update
    set seconds = least(public.activity_page_views.seconds + v_delta, 6 * 60 * 60)
    where public.activity_page_views.user_id = v_uid
  returning (xmax = 0) into v_new_view;

  if v_new_view then
    update public.activity_sessions set pages = pages + 1 where id = p_session;
  end if;

  -- Limpieza oportunista: al empezar una visita nueva, borra lo más viejo.
  if v_new_session then
    delete from public.activity_sessions
      where started_at < now() - make_interval(days => public.activity_retention_days());
  end if;
end;
$$;

revoke execute on function public.activity_track(uuid, uuid, jsonb, text, text, integer) from public, anon;
grant execute on function public.activity_track(uuid, uuid, jsonb, text, text, integer) to authenticated;

-- Realtime: el panel del administrador se actualiza en vivo mientras ella usa la app.
alter publication supabase_realtime add table
  public.activity_sessions,
  public.activity_page_views;
