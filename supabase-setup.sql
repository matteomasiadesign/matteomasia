-- ============================================================
--  SETUP SUPABASE — Portfolio Matteo Masia
--  Esegui questo script nel SQL Editor di Supabase (una volta).
-- ============================================================

-- 1) TABELLA PROGETTI
create table if not exists public.progetti (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null default 'Branding',
  img           text,
  instagram_url text,
  description   text,
  display_order int  not null default 0,
  created_at    timestamptz not null default now()
);

-- 2) ABILITA ROW LEVEL SECURITY
alter table public.progetti enable row level security;

-- 3) POLICY DI LETTURA PUBBLICA
--    Chiunque (sito pubblico) può leggere i progetti.
drop policy if exists "Lettura pubblica progetti" on public.progetti;
create policy "Lettura pubblica progetti"
  on public.progetti for select
  to anon, authenticated
  using (true);

-- 4) POLICY DI SCRITTURA SOLO PER ADMIN
--    Solo gli utenti autenticati possono inserire/modificare/eliminare.
--    Per restringere a UN SOLO admin, sostituisci `true` con:
--    (auth.uid() = 'IL-TUO-UUID-UTENTE'::uuid)
drop policy if exists "Scrittura admin progetti" on public.progetti;
create policy "Scrittura admin progetti"
  on public.progetti for all
  to authenticated
  using (true)
  with check (true);

-- 5) STORAGE BUCKET PER LE IMMAGINI
insert into storage.buckets (id, name, public)
values ('progetti', 'progetti', true)
on conflict (id) do nothing;

-- 6) POLICY STORAGE
--    Lettura pubblica delle immagini.
drop policy if exists "Immagini pubbliche" on storage.objects;
create policy "Immagini pubbliche"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'progetti');

--    Upload / update / delete solo per utenti autenticati.
drop policy if exists "Upload immagini admin" on storage.objects;
create policy "Upload immagini admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'progetti');

drop policy if exists "Update immagini admin" on storage.objects;
create policy "Update immagini admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'progetti');

drop policy if exists "Delete immagini admin" on storage.objects;
create policy "Delete immagini admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'progetti');

-- ============================================================
--  CREA L'UTENTE ADMIN
--  Vai su Authentication > Users > Add user (email + password).
--  Userai quelle credenziali per accedere alla pagina /admin.
-- ============================================================
