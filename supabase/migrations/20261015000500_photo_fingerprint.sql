-- Huella SHA-256 del archivo original de cada foto. Permite que la carga
-- masiva salte las fotos que ya están en el álbum aunque tengan otro nombre.
alter table public.photos
  add column source_hash text check (source_hash is null or source_hash ~ '^[0-9a-f]{64}$');

create index photos_source_hash_idx on public.photos (source_hash) where source_hash is not null;
