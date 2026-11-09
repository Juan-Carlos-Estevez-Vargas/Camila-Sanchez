-- 025 · Verificación en dos pasos (opcional, cada persona decide).
--
-- Quien la activa en Mi cuenta (app de autenticación, TOTP de Supabase Auth)
-- entra con su contraseña o su enlace y después escribe el código de 6 dígitos
-- de la app. Hasta escribirlo su sesión es de nivel «aal1» y la base de datos
-- no le entrega nada, aunque alguien tenga su contraseña:
--
--   1. mfa_ok(): sin sesión, con el código ya escrito (aal2) o sin la
--      verificación activada → sí. Con la verificación activada y sin el
--      código → no.
--   2. Una política RESTRICTIVA en cada tabla con RLS (lecturas, escrituras y
--      Realtime) y en storage.objects (fotos y archivos).
--   3. check_request(): PostgREST la ejecuta antes de cada petición, así que
--      también corta las funciones (rpc) security definer, que no pasan por RLS.
--
-- Quien no la activa no nota nada. Las tablas nuevas deben llevar la misma
-- política (una prueba lo comprueba: supabase/tests/two-step.test.ts).

create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is null
      or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
         where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;

revoke execute on function public.mfa_ok() from public;
grant execute on function public.mfa_ok() to anon, authenticated;

-- 2. Política restrictiva: se suma (con AND) a las que ya tiene cada tabla.
-- Va sin subconsulta («(select …)»): con una, Postgres ve recursión en las
-- políticas que se consultan entre sí (chat_messages ↔ chat_hidden_messages).
do $$
declare
  t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format(
      'create policy "dos pasos: falta el código" on public.%I as restrictive for all to authenticated
         using (public.mfa_ok()) with check (public.mfa_ok())',
      t.relname
    );
  end loop;
end;
$$;

create policy "dos pasos: falta el código" on storage.objects
  as restrictive for all to authenticated
  using (public.mfa_ok()) with check (public.mfa_ok());

-- 3. Antes de cada petición a la API (tablas y rpc).
create or replace function public.check_request()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.mfa_ok() then
    raise exception 'Falta el código de la verificación en dos pasos.'
      using errcode = '42501', hint = 'mfa_required';
  end if;
end;
$$;

revoke execute on function public.check_request() from public;
grant execute on function public.check_request() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'public.check_request';
notify pgrst, 'reload config';

-- Quién la tiene activada (sólo para quien gestiona cuentas: muestra una
-- marca en Usuarios y el botón para quitarla si alguien perdió el celular).
create or replace function public.two_step_users()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select distinct f.user_id
    from auth.mfa_factors f
   where f.status = 'verified' and public.has_permission('users.manage');
$$;

revoke execute on function public.two_step_users() from public, anon;
grant execute on function public.two_step_users() to authenticated;
