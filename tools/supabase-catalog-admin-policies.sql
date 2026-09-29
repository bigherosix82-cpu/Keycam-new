-- Run this once in the Supabase SQL Editor, AFTER supabase-catalog-v2-schema.sql.
-- Adds write permissions for logged-in users only, matching the same
-- pattern already used for `products`/`pricing` (supabase-admin-policies.sql).
-- Public/anonymous visitors keep read-only access — nothing changes for them.

create policy "Authenticated can insert catalog_products"
  on catalog_products
  for insert
  to authenticated
  with check (true);

create policy "Authenticated can update catalog_products"
  on catalog_products
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated can delete catalog_products"
  on catalog_products
  for delete
  to authenticated
  using (true);

create policy "Authenticated can insert catalog_variants"
  on catalog_variants
  for insert
  to authenticated
  with check (true);

create policy "Authenticated can update catalog_variants"
  on catalog_variants
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated can delete catalog_variants"
  on catalog_variants
  for delete
  to authenticated
  using (true);
