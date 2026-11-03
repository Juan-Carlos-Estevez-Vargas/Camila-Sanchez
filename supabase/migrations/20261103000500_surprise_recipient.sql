-- =============================================================================
-- 016 · Cada sorpresa es para una sola persona
-- -----------------------------------------------------------------------------
-- Antes una sorpresa le salía a todo el que abría la página, incluida quien
-- la creó (y quien tuviera el permiso de sorpresas podía verlas todas en el
-- panel, así que ya no era sorpresa). Ahora:
--
--   * Al crearla se elige para quién es (`recipient_id`), que debe ser otra
--     persona activa: nunca quien la crea.
--   * Sólo esa persona la ve al abrir la página, y sólo a ella le llega el
--     aviso.
--   * En el panel cada quien ve, edita y borra únicamente las sorpresas que
--     creó; las que le prepararon a ella no aparecen ahí.
--
-- Las sorpresas creadas antes de este cambio no tienen destinatario: se
-- siguen mostrando a quienes inician sesión, menos a quien la creó.
-- =============================================================================

alter table public.interruptions
  add column recipient_id uuid references auth.users (id) on delete cascade;

-- Nadie se manda una sorpresa a sí mismo (también para quien edite la fila).
alter table public.interruptions
  add constraint interruptions_not_self
  check (recipient_id is null or created_by is null or recipient_id <> created_by);

create index interruptions_recipient_idx on public.interruptions (recipient_id);
create index interruptions_created_by_idx on public.interruptions (created_by);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
drop policy if exists "interruptions: lectura" on public.interruptions;
drop policy if exists "interruptions: gestión" on public.interruptions;

-- La destinataria la ve mientras esté activa; quien la creó, siempre (en su
-- panel). Sin sesión no se ve ninguna sorpresa.
create policy "interruptions: lectura" on public.interruptions
  for select to authenticated
  using (
    (created_by = auth.uid() and public.has_permission('interruptions.manage'))
    or (is_active
        and starts_at <= now() and (ends_at is null or ends_at > now())
        and public.can_view_site()
        and (recipient_id = auth.uid()
             or (recipient_id is null and created_by is distinct from auth.uid())))
  );

-- Sólo se crean, cambian y borran las propias, y siempre para otra persona
-- activa. `created_by` lo pone el trigger interruptions_stamp_author antes de
-- que se compruebe esta política.
create policy "interruptions: gestión" on public.interruptions
  for all to authenticated
  using (public.has_permission('interruptions.manage') and created_by = auth.uid())
  with check (
    public.has_permission('interruptions.manage')
    and created_by = auth.uid()
    and recipient_id is not null
    and recipient_id <> auth.uid()
    and exists (select 1 from public.profiles p where p.id = recipient_id and p.is_active)
  );

-- -----------------------------------------------------------------------------
-- Aviso: sólo a la destinataria (o, en las antiguas, a todos menos a quien
-- la creó).
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
     and (new.recipient_id is null or p.id = new.recipient_id)
     and p.is_active
     and (p.role = 'super_admin' or exists (
           select 1 from public.role_permissions rp
            where rp.role = p.role and rp.permission = 'site.view'));
  return new;
end;
$$;
