-- =============================================================================
-- 004 · Auditoría y Realtime
-- =============================================================================

create table public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name  text not null,
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_table_idx on public.audit_log (table_name, created_at desc);

-- Registra quién cambió qué. Los mensajes privados (notas y chat) no se
-- auditan a propósito: su contenido es sólo de la pareja.
create or replace function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
begin
  insert into public.audit_log (actor_id, action, table_name, record_id, old_data, new_data)
  values (
    auth.uid(),
    tg_op,
    tg_table_name,
    coalesce(rec ->> 'id', rec ->> 'role'),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'role_permissions', 'site_settings', 'sections', 'photos',
    'milestones', 'important_dates', 'interruptions'
  ] loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_row()', t || '_audit', t);
  end loop;
end;
$$;

alter table public.audit_log enable row level security;

create policy "audit_log: lectura" on public.audit_log
  for select to authenticated using (public.has_permission('audit.view'));

-- Realtime: la página se actualiza en vivo cuando alguien edita contenido y
-- los mensajes llegan al instante. RLS también se aplica a Realtime.
alter publication supabase_realtime add table
  public.site_settings,
  public.sections,
  public.photos,
  public.milestones,
  public.important_dates,
  public.interruptions,
  public.notes,
  public.chat_messages,
  public.notifications;
