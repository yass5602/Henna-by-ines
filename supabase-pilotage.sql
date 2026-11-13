-- ============================================================================
-- Henna by Inès — Pilotage (recettes, dépenses, agenda) — Supabase, offre gratuite
-- ----------------------------------------------------------------------------
-- À exécuter UNE SEULE FOIS : Supabase > SQL Editor > New query > coller > Run.
-- Nécessite que supabase-setup.sql ait déjà été exécuté (fonction est_admin()).
--
-- Contrairement au contenu du site (lisible par tous), ces données sont PRIVÉES :
-- seule l'administratrice connectée peut les lire et les modifier.
-- Seule exception : le bouton « Payer avec PayPal » de la page de commande peut
-- DÉPOSER (jamais lire) une ligne dans commandes_paypal, à confirmer ensuite.
-- ============================================================================

-- 1) Recettes et dépenses ------------------------------------------------------
create table if not exists public.mouvements (
  id           bigint generated always as identity primary key,
  jour         date          not null default current_date,
  sens         text          not null default 'recette' check (sens in ('recette', 'depense')),
  montant      numeric(10,2) not null check (montant >= 0),
  prestation   text,                       -- henné mariée, cônes, location, matériel…
  paiement     text,                       -- especes | virement | paypal | carte | cheque | autre
  note         text,
  commande_id  uuid,                       -- renseigné si créé depuis une commande PayPal
  created_at   timestamptz   not null default now()
);
create index if not exists mouvements_jour_idx on public.mouvements (jour);

-- 2) Rendez-vous (agenda) -------------------------------------------------------
create table if not exists public.rendez_vous (
  id          bigint generated always as identity primary key,
  titre       text        not null,
  debut       timestamptz not null,
  fin         timestamptz,
  journee     boolean     not null default false,
  lieu        text,
  client      text,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists rendez_vous_debut_idx on public.rendez_vous (debut);

-- 3) Clics « Payer avec PayPal » (pré-remplissage des recettes) -----------------
create table if not exists public.commandes_paypal (
  id          uuid          primary key default gen_random_uuid(),
  created_at  timestamptz   not null default now(),
  ref         text,
  client      text,
  email       text,
  telephone   text,
  resume      text,
  items       jsonb         not null default '[]'::jsonb,
  total       numeric(10,2) not null,
  statut      text          not null default 'a_confirmer' check (statut in ('a_confirmer', 'confirme', 'ignore')),
  constraint commandes_paypal_tailles check (
    total >= 0 and total <= 5000
    and jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 40
    and coalesce(char_length(ref), 0) <= 80
    and coalesce(char_length(client), 0) <= 200
    and coalesce(char_length(email), 0) <= 200
    and coalesce(char_length(telephone), 0) <= 60
    and coalesce(char_length(resume), 0) <= 2000
  )
);

-- 4) Réglages privés (adresse du Google Agenda…) --------------------------------
create table if not exists public.reglages (
  key    text primary key,
  value  text not null
);

-- 5) Sécurité --------------------------------------------------------------------
alter table public.mouvements       enable row level security;
alter table public.rendez_vous      enable row level security;
alter table public.commandes_paypal enable row level security;
alter table public.reglages         enable row level security;

-- Le public (anon) n'a AUCUN droit sur les tables privées…
revoke all on public.mouvements, public.rendez_vous, public.commandes_paypal, public.reglages from anon;
revoke all on public.mouvements, public.rendez_vous, public.commandes_paypal, public.reglages from authenticated;
-- … l'administratrice connectée a tous les droits (limités par les règles ci-dessous)…
grant select, insert, update, delete on public.mouvements, public.rendez_vous, public.commandes_paypal, public.reglages to authenticated;
grant usage, select on all sequences in schema public to authenticated;
-- … et le public peut seulement déposer un clic PayPal (jamais le relire).
grant insert on public.commandes_paypal to anon;

drop policy if exists "admin seule" on public.mouvements;
create policy "admin seule" on public.mouvements for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

drop policy if exists "admin seule" on public.rendez_vous;
create policy "admin seule" on public.rendez_vous for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

drop policy if exists "admin seule" on public.reglages;
create policy "admin seule" on public.reglages for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

drop policy if exists "admin seule" on public.commandes_paypal;
create policy "admin seule" on public.commandes_paypal for all to authenticated
  using (public.est_admin()) with check (public.est_admin());

drop policy if exists "clic paypal" on public.commandes_paypal;
create policy "clic paypal" on public.commandes_paypal for insert to anon, authenticated
  with check (statut = 'a_confirmer');
