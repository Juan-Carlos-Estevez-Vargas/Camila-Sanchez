-- 024 · Quién ya vio cada dedicatoria.
--
-- Cuando alguien abre una dedicatoria que no escribió, se guarda (una fila por
-- persona) cuándo la vio por primera vez y la última. Quien la escribió ve la
-- lista completa; cada persona sólo ve su propia fila. Nadie escribe la tabla
-- directo: sólo con mark_dedication_seen, que comprueba que la pueda ver.

create table public.dedication_views (
  dedication_id  uuid not null references public.dedications (id) on delete cascade,
  user_id        uuid not null references auth.users (id) on delete cascade,
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  primary key (dedication_id, user_id)
);

create index dedication_views_user_idx on public.dedication_views (user_id);

alter table public.dedication_views enable row level security;

create policy "dedication_views: ver" on public.dedication_views
  for select to authenticated
  using (user_id = auth.uid() or public.is_dedication_author(dedication_id));

create or replace function public.mark_dedication_seen(p_dedication uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.can_see_dedication(p_dedication) then
    raise exception 'Esta dedicatoria no existe o no es para ti.' using errcode = '42501';
  end if;
  -- Quien la escribió no cuenta como «la vio».
  if exists (select 1 from public.dedications d where d.id = p_dedication and d.author_id = auth.uid()) then
    return;
  end if;
  insert into public.dedication_views (dedication_id, user_id)
  values (p_dedication, auth.uid())
  on conflict (dedication_id, user_id) do update set last_seen_at = now();
end;
$$;

revoke execute on function public.mark_dedication_seen(uuid) from public, anon;
grant execute on function public.mark_dedication_seen(uuid) to authenticated;

-- Realtime: quien la escribió ve en vivo cuando la abren.
alter publication supabase_realtime add table public.dedication_views;
