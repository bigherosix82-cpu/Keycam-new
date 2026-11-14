-- ============================================================
--  KeyCam · Resin keycaps — Supabase schema
--  Run this once in Supabase → SQL Editor.
--  After it succeeds, open admin-catalog.html → Resin tab and click
--  "Import bundled logos" to seed the 5 collections and 52 designs.
-- ============================================================

create table if not exists public.resin_collections (
  id          text primary key,
  name        text not null,
  short       text,
  region      text,
  group_name  text default 'Esports',
  blurb       text default '',
  custom_only boolean not null default false,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.resin_designs (
  id            text primary key,
  collection_id text not null references public.resin_collections(id)
                  on delete cascade on update cascade,
  name          text not null,
  image_url     text,
  tile          text not null default 'light' check (tile in ('light', 'dark')),
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create index if not exists resin_designs_collection_idx
  on public.resin_designs (collection_id, sort_order);

-- Prices live on the existing store_settings singleton row (id = 1).
alter table public.store_settings
  add column if not exists resin_prices jsonb;

alter table public.resin_collections enable row level security;
alter table public.resin_designs    enable row level security;

-- Anyone can read the storefront data; only signed-in admins can change it.
drop policy if exists "Resin collections are public" on public.resin_collections;
create policy "Resin collections are public"
  on public.resin_collections for select
  using (true);

drop policy if exists "Admins manage resin collections" on public.resin_collections;
create policy "Admins manage resin collections"
  on public.resin_collections for all
  to authenticated
  using (true) with check (true);

drop policy if exists "Resin designs are public" on public.resin_designs;
create policy "Resin designs are public"
  on public.resin_designs for select
  using (true);

drop policy if exists "Admins manage resin designs" on public.resin_designs;
create policy "Admins manage resin designs"
  on public.resin_designs for all
  to authenticated
  using (true) with check (true);

grant select on public.resin_collections, public.resin_designs to anon, authenticated;
grant insert, update, delete on public.resin_collections, public.resin_designs to authenticated;

-- Supabase grants these to anon by default; RLS already blocks writes, this
-- makes the intent explicit: the public key can only read.
revoke insert, update, delete, truncate, references, trigger
  on public.resin_collections, public.resin_designs from anon;
revoke truncate, references, trigger
  on public.resin_collections, public.resin_designs from authenticated;

-- store_settings holds the resin prices. The storefront only reads it; prices
-- are written from the signed-in admin. RLS already blocks anon writes, but
-- revoke the privileges too so the API refuses outright instead of returning
-- a misleading 204 for zero rows.
revoke insert, update, delete, truncate, references, trigger
  on public.store_settings from anon;
revoke truncate, references, trigger
  on public.store_settings from authenticated;
