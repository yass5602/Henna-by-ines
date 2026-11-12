-- ============================================================================
-- Henna by Inès — mise en place de l'espace administrateur (Supabase, offre gratuite)
-- ----------------------------------------------------------------------------
-- À exécuter UNE SEULE FOIS : Supabase > SQL Editor > New query > coller > Run.
--
-- ⚠️ AVANT de lancer : remplacez  ADMIN_EMAIL_ICI  (3e ligne de la fonction
--    est_admin, plus bas) par l'adresse e-mail de l'administratrice, la même que
--    celle du compte créé dans Authentication > Users.
--    Seule cette adresse pourra modifier le site ; tout le monde peut le LIRE.
-- ============================================================================

-- 1) Qui est administratrice ? (un seul endroit à modifier)
create or replace function public.est_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'email', '') = lower('ADMIN_EMAIL_ICI');
$$;

-- 2) Tables --------------------------------------------------------------------

-- Textes, prix et photos du site : une ligne = une modification.
--   text.hero.2           -> texte
--   img.accueil-bandeau   -> adresse d'une photo
--   product.cone-10.price -> prix, product.cone-10.label -> nom
create table if not exists public.site_content (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- Articles de la page Location.
create table if not exists public.rentals (
  id          text primary key,
  name        text not null,
  note        text,
  price       numeric,                         -- vide = « Sur devis »
  cat         text not null default 'fleurs',  -- fleurs | mariee | assises | reception
  photos      jsonb not null default '[]'::jsonb,
  position    integer not null default 0,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- Photos de la galerie « Nos réalisations » de l'accueil.
create table if not exists public.gallery (
  id          bigint generated always as identity primary key,
  src         text not null,
  caption     text,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- 3) Sécurité : lecture pour tous, écriture réservée à l'administratrice ----------
alter table public.site_content enable row level security;
alter table public.rentals      enable row level security;
alter table public.gallery      enable row level security;

-- Droits d'accès aux tables (au cas où « Automatically expose new tables » est désactivé dans Supabase).
grant select on public.site_content, public.rentals, public.gallery to anon, authenticated;
grant insert, update, delete on public.site_content, public.rentals, public.gallery to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists "lecture publique"  on public.site_content;
drop policy if exists "ecriture admin"     on public.site_content;
create policy "lecture publique" on public.site_content for select using (true);
create policy "ecriture admin"   on public.site_content for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

drop policy if exists "lecture publique"  on public.rentals;
drop policy if exists "ecriture admin"     on public.rentals;
create policy "lecture publique" on public.rentals for select using (true);
create policy "ecriture admin"   on public.rentals for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

drop policy if exists "lecture publique"  on public.gallery;
drop policy if exists "ecriture admin"     on public.gallery;
create policy "lecture publique" on public.gallery for select using (true);
create policy "ecriture admin"   on public.gallery for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

-- 4) Stockage des photos (bucket public en lecture) ---------------------------------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

drop policy if exists "media lecture"            on storage.objects;
drop policy if exists "media ajout admin"        on storage.objects;
drop policy if exists "media modification admin" on storage.objects;
drop policy if exists "media suppression admin"  on storage.objects;

-- Lecture : indispensable, l'envoi d'une photo « écrase si elle existe » et Supabase exige alors le droit de lecture.
create policy "media lecture" on storage.objects for select using (bucket_id = 'media');
create policy "media ajout admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.est_admin());
create policy "media modification admin" on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.est_admin());
create policy "media suppression admin" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.est_admin());
