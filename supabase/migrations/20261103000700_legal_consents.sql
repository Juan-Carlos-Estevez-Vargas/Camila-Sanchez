-- =============================================================================
-- 018 · Aceptación de los términos y la política de privacidad
-- -----------------------------------------------------------------------------
-- La Ley 1581 de 2012 pide poder demostrar que cada persona autorizó el
-- tratamiento de sus datos (prueba de la autorización). Cada vez que alguien
-- acepta una versión de los términos y la política queda una fila aquí:
--
--   * Sólo se registra por uno mismo (`user_id` lo pone la base con
--     auth.uid()) y nunca se edita: es un registro, no un ajuste.
--   * Cada quien ve las suyas; quien gestiona usuarios ve todas, para poder
--     responder si alguien pide la prueba.
--   * Si se borra la cuenta, se borran también.
-- =============================================================================

create table public.legal_consents (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  version     text not null check (version ~ '^\d{4}-\d{2}-\d{2}$'),
  accepted_at timestamptz not null default now(),
  user_agent  text check (user_agent is null or char_length(user_agent) <= 300),
  unique (user_id, version)
);

comment on table public.legal_consents is
  'Prueba de que cada persona aceptó una versión de los términos y la política de privacidad (Ley 1581 de 2012).';

-- Quién y cuándo los pone la base: desde el navegador no se pueden falsear.
create or replace function public.legal_consents_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.accepted_at := now();
  return new;
end;
$$;

create trigger legal_consents_stamp
  before insert on public.legal_consents
  for each row execute function public.legal_consents_stamp();

alter table public.legal_consents enable row level security;

create policy "legal_consents: ver las propias" on public.legal_consents
  for select to authenticated
  using (user_id = auth.uid() or public.has_permission('users.manage'));

create policy "legal_consents: aceptar por uno mismo" on public.legal_consents
  for insert to authenticated
  with check (user_id = auth.uid());

-- Sin políticas de update ni delete: nadie puede cambiar ni borrar una
-- aceptación desde la app (sólo desaparece al borrar la cuenta).
revoke update, delete on public.legal_consents from anon, authenticated;
