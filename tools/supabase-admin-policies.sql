-- Run this once in Supabase SQL Editor.
-- Adds write permissions for logged-in users only.
-- Public/anonymous visitors keep read-only access — nothing changes for them.

create policy "Authenticated can update products"
  on products
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated can insert products"
  on products
  for insert
  to authenticated
  with check (true);

create policy "Authenticated can delete products"
  on products
  for delete
  to authenticated
  using (true);

create policy "Authenticated can update pricing"
  on pricing
  for update
  to authenticated
  using (true)
  with check (true);