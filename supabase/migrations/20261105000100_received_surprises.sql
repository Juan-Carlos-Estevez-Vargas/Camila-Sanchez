-- =============================================================================
-- 021 · Las sorpresas recibidas se quedan guardadas
-- -----------------------------------------------------------------------------
-- Hasta ahora una sorpresa sólo existía para su destinataria mientras estaba
-- dentro de su ventana (`starts_at` … `ends_at`): salía una vez al abrir la
-- página y, después de verla o cuando vencía, desaparecía para siempre. Si
-- no abría la página a tiempo, le llegaba el aviso pero nunca la encontraba.
--
-- Ahora la destinataria puede leer, en la Cajita → Recibidas, toda sorpresa
-- que ya empezó y que:
--   * sigue activa (aunque ya haya vencido o ya la haya visto), o
--   * ya vio alguna vez (aunque quien la creó la haya apagado después).
--
-- Lo que no cambia: las que aún no empiezan siguen ocultas, quien la creó
-- sigue sin poder mandársela a sí misma, y la ventana de la página principal
-- (que salga sólo mientras está vigente) la aplica la app al pedirlas.
-- =============================================================================

drop policy if exists "interruptions: lectura" on public.interruptions;

create policy "interruptions: lectura" on public.interruptions
  for select to authenticated
  using (
    (created_by = auth.uid() and public.has_permission('interruptions.manage'))
    or (starts_at <= now()
        and public.can_view_site()
        and (recipient_id = auth.uid()
             or (recipient_id is null and created_by is distinct from auth.uid()))
        and (is_active
             or exists (select 1 from public.interruption_views v
                         where v.interruption_id = interruptions.id
                           and v.user_id = auth.uid())))
  );

-- -----------------------------------------------------------------------------
-- El aviso lleva a la Cajita, donde la sorpresa siempre está (en la página
-- principal sólo sale mientras está vigente y no se ha visto). Igual que
-- antes: sólo a la destinataria (o, en las antiguas, a todos menos a quien la
-- creó).
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
  select p.id, 'system', coalesce(v_author, 'Alguien') || ' te dejó una sorpresa 🎁', left(new.title, 140), '/mensajes'
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

-- Los avisos que ya llegaron también llevan a la Cajita.
update public.notifications
   set link = '/mensajes'
 where kind = 'system' and link = '/' and title like '% te dejó una sorpresa 🎁';
