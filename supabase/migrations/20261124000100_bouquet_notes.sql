-- =============================================================================
-- 031 · El ramo de flores de cada fecha especial: sus notitas
-- =============================================================================
--
-- En cada fecha especial (cumpleaños, aniversario, San Valentín…) a la
-- destinataria le sale un ramo de flores con una notita: una invitación con
-- el lugar y la hora («te espero en…»). Si el lugar y el mensaje vivieran en
-- site_settings, cualquiera sin cuenta podría leerlos antes de tiempo (esa
-- fila es pública para pintar la pantalla de acceso), así que van aquí:
--
--   • Sólo las leen las cuentas con sesión (nunca un anónimo).
--   • Sólo las cambia quien tiene theme.manage (el mismo de Apariencia).
--   • Cada cambio queda en la auditoría, como el resto del contenido.
--
-- Encendido, para quién es y la firma siguen en
-- site_settings.effects.specialDays.bouquet: no revelan nada de la sorpresa.
--
-- Cuándo la abre ella no se guarda aquí: va en la actividad (migración 030)
-- como la página «/ramo/<fecha>/<auto|boton>», sección «ramo».

create table public.bouquet_notes (
  -- El id de la fecha especial (domain/specialDays.ts): una nota por fecha.
  id          text primary key check (id in (
                'birthday', 'anniversary', 'valentine', 'friendship', 'halloween', 'christmas', 'newYear'
              )),
  place       text not null default '' check (char_length(place) <= 80),
  time_text   text not null default '' check (char_length(time_text) <= 40),
  message     text not null default '' check (char_length(message) <= 600),
  updated_by  uuid references auth.users (id) on delete set null default auth.uid(),
  updated_at  timestamptz not null default now()
);

create trigger bouquet_notes_touch before update on public.bouquet_notes
  for each row execute function public.touch_updated_at();

create trigger bouquet_notes_audit after insert or update or delete on public.bouquet_notes
  for each row execute function public.audit_row();

alter table public.bouquet_notes enable row level security;

-- Sin política para anon: un anónimo no lee ninguna fila (recibe una lista vacía).
create policy "bouquet_notes: lectura" on public.bouquet_notes
  for select to authenticated using (true);

create policy "bouquet_notes: gestión" on public.bouquet_notes
  for all to authenticated
  using (public.has_permission('theme.manage'))
  with check (public.has_permission('theme.manage'));

-- Verificación en dos pasos (027): tabla nueva, misma política restrictiva.
create policy "dos pasos: falta el código" on public.bouquet_notes
  as restrictive for all to authenticated
  using (public.mfa_ok()) with check (public.mfa_ok());
