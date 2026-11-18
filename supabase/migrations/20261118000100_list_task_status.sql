-- =============================================================================
-- 027 · Las tareas de las listas tienen estado
-- -----------------------------------------------------------------------------
-- Cada tarea (y subtarea) pasa por tres estados, que salen de dos fechas:
--   - pendiente:    started_at y done_at vacíos,
--   - en progreso:  started_at con fecha y done_at vacío,
--   - hecha:        done_at con fecha.
-- Al terminarla se guarda la fecha límite que tenía en ese momento
-- (done_due_on). Así se sabe si se hizo a tiempo o con cuántos días de
-- retraso, aunque después alguien cambie o quite la fecha.
-- Las fechas las pone la base (no el navegador), igual que done_at.
-- =============================================================================

alter table public.todo_items
  add column started_at timestamptz,
  add column started_by uuid references auth.users (id) on delete set null,
  add column done_due_on date;

-- Las tareas que ya estaban hechas: su fecha límite actual es la mejor pista.
update public.todo_items set done_due_on = due_on where done_at is not null and due_on is not null;

create or replace function public.guard_todo_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_parent record;
begin
  if tg_op = 'UPDATE' then
    if new.list_id is distinct from old.list_id or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'Una tarea no se puede mover a otra lista' using errcode = '42501';
    end if;
  end if;
  if new.parent_id is not null and (tg_op = 'INSERT' or new.parent_id is distinct from old.parent_id) then
    select list_id, parent_id into v_parent from public.todo_items where id = new.parent_id;
    if not found or v_parent.list_id <> new.list_id then
      raise exception 'La subtarea debe ser de la misma lista' using errcode = '23514';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'Una subtarea no puede tener subtareas' using errcode = '23514';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.todo_items where parent_id = new.id) then
      raise exception 'Una tarea con subtareas no puede volverse subtarea' using errcode = '23514';
    end if;
  end if;
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id)
     and not exists (select 1 from public.todo_list_members
                      where list_id = new.list_id and user_id = new.assignee_id) then
    raise exception 'Sólo se puede asignar a alguien de la lista' using errcode = '23514';
  end if;
  -- Quién y cuándo la empezó lo pone la base, no el navegador.
  if new.started_at is null then
    new.started_by := null;
  elsif tg_op = 'INSERT' or old.started_at is null then
    new.started_at := now();
    new.started_by := auth.uid();
  else
    new.started_at := old.started_at;
    new.started_by := old.started_by;
  end if;
  -- Igual al terminarla, y se guarda la fecha límite de ese momento.
  if new.done_at is null then
    new.done_by := null;
    new.done_due_on := null;
  elsif tg_op = 'INSERT' or old.done_at is null then
    new.done_at := now();
    new.done_by := auth.uid();
    new.done_due_on := new.due_on;
  else
    new.done_at := old.done_at;
    new.done_by := old.done_by;
    new.done_due_on := old.done_due_on;
  end if;
  if tg_op = 'UPDATE' then
    new.updated_at := now();
  end if;
  return new;
end;
$$;

-- Avisos: además de «agregó» y «terminó», «empezó» (sólo tareas, no subtareas).
create or replace function public.notify_todo_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is null and tg_op = 'INSERT' then
    perform public.notify_list_members(new.list_id, '➕ ' || new.title);
  elsif new.parent_id is null and tg_op = 'UPDATE' and new.done_at is not null and old.done_at is null then
    perform public.notify_list_members(new.list_id, '✅ ' || new.title);
  elsif new.parent_id is null and tg_op = 'UPDATE' and new.done_at is null
        and new.started_at is not null and old.started_at is null then
    perform public.notify_list_members(new.list_id, '⏳ ' || new.title);
  end if;
  if new.assignee_id is not null and new.assignee_id is distinct from auth.uid()
     and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform public.notify_list_members(new.list_id, '👉 Te asignó: ' || new.title, new.assignee_id);
  end if;
  return new;
end;
$$;
