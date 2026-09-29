-- Run this once in the Supabase SQL Editor, AFTER
-- supabase-catalog-v2-schema.sql and supabase-catalog-admin-policies.sql.
--
-- Adds a real image gallery per catalog product, and lets a variant
-- option (e.g. Color: Black) link to one of that product's already-
-- uploaded gallery images so picking it swaps the main product photo.
--
-- catalog_products.image / .thumbnail are unchanged in meaning — they
-- stay the listing-grid cover shot. This migration just makes them
-- editable after creation (admin-side) and adds the fuller gallery
-- alongside them.

-- ============================================
-- CATALOG PRODUCT IMAGES
-- A product's full gallery. One row per image, ordered by sort_order.
-- ============================================
create table catalog_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references catalog_products(id) on delete cascade,
  url text not null,
  sort_order int default 0,
  created_at timestamptz not null default now()
);

alter table catalog_product_images enable row level security;

create policy "Public can read catalog_product_images"
  on catalog_product_images for select to anon using (true);

create policy "Authenticated can insert catalog_product_images"
  on catalog_product_images for insert to authenticated with check (true);

create policy "Authenticated can update catalog_product_images"
  on catalog_product_images for update to authenticated using (true) with check (true);

create policy "Authenticated can delete catalog_product_images"
  on catalog_product_images for delete to authenticated using (true);

-- ============================================
-- VARIANT IMAGE LINK
-- Holds a URL copied from that product's own catalog_product_images.
-- NULL = this option doesn't change the product photo.
-- ============================================
alter table catalog_variants add column image text;

-- ============================================
-- STORAGE: allow deleting uploaded files
-- (insert/update policies for the keycam-images bucket already exist
-- from supabase-collections-and-storage.sql — this adds delete, needed
-- so the admin can remove a gallery image's file, not just its row.)
-- ============================================
create policy "Authenticated can delete stored images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'keycam-images');
