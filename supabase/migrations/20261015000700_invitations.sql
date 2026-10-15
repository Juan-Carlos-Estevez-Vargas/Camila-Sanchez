-- =============================================================================
-- Invitaciones por enlace o código QR.
--
-- El super admin genera un enlace de un solo uso; quien lo abre elige su nombre,
-- correo y contraseña y su cuenta nace con el rol de la invitación. Así no hace
-- falta saber el correo de antemano.
--
-- Seguridad:
--   * En la tabla sólo se guarda el SHA-256 del token; el token aparece una sola
--     vez en el navegador de quien lo crea (y viaja en el #fragmento de la URL,
--     que no llega a los servidores ni a los registros).
--   * Caduca (máximo 30 días) y se consume de forma atómica en la Edge Function
--     redeem-invite: dos personas no pueden usar el mismo enlace.
--   * Un enlace nunca puede crear un super administrador.
-- =============================================================================

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  role        public.app_role not null default 'editor' check (role <> 'super_admin'),
  note        text not null default '' check (char_length(note) <= 80),
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_by     uuid references auth.users (id) on delete set null,
  constraint invitations_expiry check (expires_at > created_at and expires_at <= created_at + interval '30 days')
);

comment on table public.invitations is 'Enlaces de invitación de un solo uso. Sólo se guarda el hash del token.';

create index invitations_pending_idx on public.invitations (expires_at) where used_at is null;

alter table public.invitations enable row level security;

-- Sólo quien gestiona usuarios ve, crea y revoca invitaciones. Nadie las
-- modifica desde el navegador: marcarlas como usadas es cosa de la función.
create policy "invitations: lectura" on public.invitations
  for select to authenticated using (public.has_permission('users.manage'));
create policy "invitations: crear" on public.invitations
  for insert to authenticated
  with check (public.has_permission('users.manage') and created_by = auth.uid() and used_at is null and used_by is null);
create policy "invitations: revocar" on public.invitations
  for delete to authenticated using (public.has_permission('users.manage'));

create trigger invitations_audit after insert or update or delete on public.invitations
  for each row execute function public.audit_row();
