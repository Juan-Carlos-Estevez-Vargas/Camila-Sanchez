-- =============================================================================
-- 008 · Chat tipo WhatsApp: responder citando, última conexión y visto
-- =============================================================================

-- Un mensaje puede responder a otro. Si el original se borra, la respuesta
-- se queda sin cita en vez de desaparecer.
alter table public.chat_messages
  add column reply_to uuid references public.chat_messages (id) on delete set null;

create index chat_messages_reply_idx on public.chat_messages (reply_to) where reply_to is not null;

-- chat_reads pasa a guardar, por persona, cuándo estuvo conectada por última
-- vez y hasta qué momento leyó el chat (null: todavía no lo ha abierto).
alter table public.chat_reads
  add column last_seen_at timestamptz not null default now();
alter table public.chat_reads
  alter column last_read_at drop not null,
  alter column last_read_at drop default;

-- Quien usa el chat ve la conexión y los vistos de los demás. Nadie escribe
-- la fila directamente: sólo con chat_presence(), que usa auth.uid(), así
-- nadie puede marcar como visto en nombre de otra persona.
drop policy "chat_reads: propios" on public.chat_reads;
create policy "chat_reads: ver" on public.chat_reads
  for select to authenticated using (public.has_permission('chat.use'));

create or replace function public.chat_presence(p_read boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if auth.uid() is null or not public.has_permission('chat.use') then
    raise exception 'No tienes permiso para usar el chat' using errcode = '42501';
  end if;
  insert into public.chat_reads (user_id, last_seen_at, last_read_at)
  values (auth.uid(), v_now, case when p_read then v_now end)
  on conflict (user_id) do update
     set last_seen_at = v_now,
         last_read_at = case when p_read then v_now else public.chat_reads.last_read_at end;
end;
$$;

revoke execute on function public.chat_presence(boolean) from public, anon;
grant execute on function public.chat_presence(boolean) to authenticated;

-- Los vistos y la conexión llegan en vivo.
alter publication supabase_realtime add table public.chat_reads;
