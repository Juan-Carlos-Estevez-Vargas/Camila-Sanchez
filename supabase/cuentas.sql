-- =============================================================================
-- Da los roles a Juan y a Camila y abre la página al público.
--
-- 1. Crea las dos cuentas en Supabase → Authentication → Users → Add user
--    (con "Auto Confirm User" marcado y la contraseña que cada uno quiera).
-- 2. Cambia los dos correos de abajo, pega todo en el SQL Editor y dale Run.
--
-- Se puede ejecutar varias veces sin problema. Los correos van sólo en el
-- editor de Supabase: no los guardes en este archivo (el repositorio es público).
-- =============================================================================
do $$
declare
  juan_email   constant text := 'CORREO_DE_JUAN';
  camila_email constant text := 'CORREO_DE_CAMILA';
  -- true: cualquiera con el enlace ve la página; false: sólo quien tenga cuenta.
  sitio_publico constant boolean := true;
begin
  update public.profiles
     set role = 'super_admin', display_name = 'Juan', is_active = true
   where id = (select id from auth.users where lower(email) = lower(juan_email));
  if not found then
    raise exception 'No encontré la cuenta de Juan (%). ¿La creaste en Authentication → Users?', juan_email;
  end if;

  update public.profiles
     set role = 'editor', display_name = 'Camila', is_active = true
   where id = (select id from auth.users where lower(email) = lower(camila_email));
  if not found then
    raise exception 'No encontré la cuenta de Camila (%). ¿La creaste en Authentication → Users?', camila_email;
  end if;

  update public.site_settings set is_public = sitio_publico where id = 1;
end
$$;

select p.display_name, p.role, u.email
  from public.profiles p join auth.users u on u.id = p.id
 order by p.role;
