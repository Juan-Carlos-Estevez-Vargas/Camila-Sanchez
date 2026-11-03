-- =============================================================================
-- 017 · Revisión de seguridad (lista de verificación de docs/SEGURIDAD_OWASP.md)
-- -----------------------------------------------------------------------------
-- Cierra las rendijas que quedaban al repasar la lista punto por punto:
--   * Bloquear manipulación de campos: quién creó una fila y cuándo ya no se
--     pueden reescribir con un UPDATE (fotos, sorpresas, reacciones).
--   * Rate limiting: las sorpresas mandan un aviso al celular, así que también
--     tienen límite (20 por hora por persona).
--   * Rate limiting y protección contra bots en las Edge Functions: contador
--     por clave (IP anonimizada o persona) que sólo usa la service role.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Columnas que no cambian nunca después de crear la fila
-- -----------------------------------------------------------------------------
-- guard_immutable_columns('col1', 'col2', …): si alguien desde el navegador
-- (roles authenticated o anon) intenta cambiar una de esas columnas, se
-- rechaza. Las funciones de la base y la service role sí pueden (p. ej. el
-- "on delete set null" de created_by cuando se borra una cuenta).
create or replace function public.guard_immutable_columns()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_old jsonb := to_jsonb(old);
  v_new jsonb := to_jsonb(new);
  v_column text;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  foreach v_column in array tg_argv loop
    if v_new -> v_column is distinct from v_old -> v_column then
      raise exception 'El campo % no se puede cambiar', v_column using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$$;

revoke execute on function public.guard_immutable_columns() from public, anon, authenticated;

create trigger photos_immutable before update on public.photos
  for each row execute function public.guard_immutable_columns('id', 'created_by', 'created_at');
create trigger interruptions_immutable before update on public.interruptions
  for each row execute function public.guard_immutable_columns('id', 'created_by', 'created_at');
-- Una reacción no se puede "mover" a otro mensaje ni pasar a otra persona.
create trigger chat_reactions_immutable before update on public.chat_reactions
  for each row execute function public.guard_immutable_columns('message_id', 'user_id', 'created_at');

-- -----------------------------------------------------------------------------
-- Límite de velocidad para las sorpresas (cada una avisa al celular)
-- -----------------------------------------------------------------------------
create trigger interruptions_rate_limit before insert on public.interruptions
  for each row execute function public.enforce_rate_limit('created_by', '20', '1 hour');

-- -----------------------------------------------------------------------------
-- Límite de velocidad para las Edge Functions
-- -----------------------------------------------------------------------------
-- redeem-invite no pide sesión (quien la usa aún no tiene cuenta): sin límite,
-- un bot podría llamarla sin parar. La función cuenta las llamadas por una
-- clave (el SHA-256 de la IP con un secreto, nunca la IP en claro) y frena a
-- quien pase del máximo en la ventana.
create table public.edge_rate_limits (
  key         text not null check (char_length(key) between 1 and 200),
  hit_at      timestamptz not null default now()
);

create index edge_rate_limits_key_idx on public.edge_rate_limits (key, hit_at desc);

-- Sin políticas: desde el navegador no se lee ni se escribe nada.
alter table public.edge_rate_limits enable row level security;
revoke all on public.edge_rate_limits from anon, authenticated;

comment on table public.edge_rate_limits is
  'Llamadas recientes a las Edge Functions por clave (IP anonimizada o persona), para el límite de velocidad.';

-- Devuelve true si la llamada entra en el límite (y la anota) o false si ya
-- se pasó. Borra de paso lo que tiene más de un día.
create or replace function public.hit_edge_rate_limit(p_key text, p_max integer, p_window interval)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_key is null or p_max < 1 or p_window <= interval '0' or p_window > interval '1 day' then
    raise exception 'Límite no válido' using errcode = '22023';
  end if;
  -- Dos llamadas a la vez con la misma clave no se cuelan entre las dos.
  perform pg_advisory_xact_lock(hashtext('edge_rate_limit:' || p_key));
  delete from public.edge_rate_limits where hit_at < now() - interval '1 day';
  select count(*) into v_count
    from (select 1 from public.edge_rate_limits
           where key = p_key and hit_at > now() - p_window limit p_max) s;
  if v_count >= p_max then
    return false;
  end if;
  insert into public.edge_rate_limits (key) values (p_key);
  return true;
end;
$$;

revoke execute on function public.hit_edge_rate_limit(text, integer, interval) from public, anon, authenticated;
grant execute on function public.hit_edge_rate_limit(text, integer, interval) to service_role;
