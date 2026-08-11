-- ============================================================
--  SETUP SUPABASE — Portfolio Matteo Masia
--  Esegui questo script nel SQL Editor di Supabase (una volta).
-- ============================================================

-- 1) TABELLA PROGETTI
create table if not exists public.progetti (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null default 'Branding',
  slug          text,
  img           text,                              -- copertina (una delle immagini in media)
  media         jsonb not null default '[]'::jsonb, -- [{ url, path, type: 'image'|'video' }]
  instagram_url text,
  description   text,
  display_order int  not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists progetti_slug_idx on public.progetti(slug);

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

-- 5) TABELLA MESSAGGI
create table if not exists public.messaggi (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  email       text not null,
  oggetto     text,
  messaggio   text not null,
  letto       boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.messaggi enable row level security;

--    Invio messaggi dal form pubblico
drop policy if exists "Invio pubblico messaggi" on public.messaggi;
create policy "Invio pubblico messaggi"
  on public.messaggi for insert
  to anon, authenticated
  with check (true);

--    Lettura messaggi solo per utenti autenticati
drop policy if exists "Lettura admin messaggi" on public.messaggi;
create policy "Lettura admin messaggi"
  on public.messaggi for select
  to authenticated
  using (true);

--    Gestione messaggi (lettura, aggiornamento, cancellazione) solo per admin
drop policy if exists "Gestione admin messaggi" on public.messaggi;
create policy "Gestione admin messaggi"
  on public.messaggi for update, delete
  to authenticated
  using (true)
  with check (true);

-- 6) TABELLA SERVIZI (card "Competenze" in home, gestite da admin)
create table if not exists public.servizi (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  img           text,     -- anteprima card
  img_path      text,     -- path storage (per cleanup all'eliminazione/sostituzione)
  cta_label     text,
  cta_link      text,
  display_order int  not null default 0,
  created_at    timestamptz not null default now()
);

alter table public.servizi enable row level security;

drop policy if exists "Lettura pubblica servizi" on public.servizi;
create policy "Lettura pubblica servizi"
  on public.servizi for select
  to anon, authenticated
  using (true);

drop policy if exists "Scrittura admin servizi" on public.servizi;
create policy "Scrittura admin servizi"
  on public.servizi for all
  to authenticated
  using (true)
  with check (true);

-- 7) STORAGE BUCKET PER LE IMMAGINI
insert into storage.buckets (id, name, public)
values ('progetti', 'progetti', true)
on conflict (id) do nothing;

-- 8) POLICY STORAGE
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
