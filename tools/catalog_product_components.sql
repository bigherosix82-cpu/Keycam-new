-- Run this once in the Supabase SQL editor to enable the
-- "Built From" links on customized keyboard product pages.

create table if not exists catalog_product_components (
  id bigint generated always as identity primary key,
  product_id text not null references catalog_products(id) on delete cascade,
  component_product_id text not null references catalog_products(id) on delete cascade,
  role_label text,      -- optional override, e.g. "Barebone" / "Switch" / "Keycap"
                          -- falls back to the component product's own subtype if blank
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Same read-only-for-anon shape as the rest of the catalog tables.
alter table catalog_product_components enable row level security;

create policy "Public read access"
  on catalog_product_components
  for select
  using (true);

-- Admin writes: adjust to match however you manage inserts/updates on
-- catalog_products / catalog_variants today (e.g. via the Supabase
-- dashboard table editor, or a service-role key from an admin tool —
-- the anon key used in supabase-client.js should NOT get insert/update
-- access here, same as it doesn't for the other catalog tables).
