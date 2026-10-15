/**
 * Esquema mínimo que imita a Supabase (auth.uid(), auth.users, storage y la
 * publicación realtime) para aplicar las migraciones sobre PGlite.
 */
export const SUPABASE_STUB = `
  create role anon; create role authenticated; create role service_role;
  create schema auth; create schema storage;
  create table auth.users (
    id uuid primary key, email text,
    raw_user_meta_data jsonb default '{}', raw_app_meta_data jsonb default '{}'
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public bool,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
  create publication supabase_realtime;
  grant usage on schema public, auth, storage to anon, authenticated;
`;
