/**
 * Esquema mínimo que imita a Supabase (auth.uid(), auth.jwt(), auth.users,
 * auth.mfa_factors, storage, la publicación realtime, Vault y pg_net) para
 * aplicar las migraciones sobre PGlite. net.http_post sólo anota la llamada en net.calls.
 */
export const SUPABASE_STUB = `
  create role anon; create role authenticated; create role service_role; create role authenticator;
  create schema auth; create schema storage;
  create table auth.users (
    id uuid primary key, email text,
    raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}'
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb) $$;
  create type auth.factor_status as enum ('unverified', 'verified');
  create table auth.mfa_factors (
    id uuid primary key default gen_random_uuid(), user_id uuid not null,
    factor_type text not null default 'totp', status auth.factor_status not null default 'unverified'
  );
  create table storage.buckets (id text primary key, name text, public bool,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  create publication supabase_realtime;
  create schema vault; create schema net;
  create table vault.decrypted_secrets (name text primary key, decrypted_secret text);
  create table net.calls (id bigserial primary key, url text, headers jsonb, body jsonb);
  create function net.http_post(url text, body jsonb, params jsonb default '{}', headers jsonb default '{}',
    timeout_milliseconds int default 5000) returns bigint language sql as
    $$ insert into net.calls (url, headers, body) values (url, headers, body) returning id $$;
  grant usage on schema public, auth, storage to anon, authenticated;
`;
