-- Run this once in the Supabase SQL Editor.
-- Adds the "Pchum Ben Festival" discount mode for the Keyboard /
-- Accessories / Mouse catalog ONLY. Completely separate from Deskmat's
-- existing maintenance-mode discount (store_settings.maintenance_mode /
-- maintenance_discount) — that one is untouched and keeps working
-- exactly as before, for Deskmat only.

-- ============================================
-- 1) GLOBAL SWITCH — lives on the same singleton row as the Deskmat
--    maintenance settings (store_settings, id = 1), but its own columns.
--    festival_discount_mode  = manual on/off switch (admin toggle)
--    festival_discount_percent = default % applied to every catalog
--        product that doesn't have its own override (see below)
--    festival_discount_label = shown on the homepage banner / order drawer
--    festival_discount_starts_at / _ends_at = optional schedule window.
--        If set, the discount is only actually live when "now" falls
--        inside the window AND the manual switch is on — so you can
--        flip the switch on ahead of time and it won't show early, or
--        leave the switch on and let the dates turn it off automatically
--        when the festival ends. Leave both null to rely on the manual
--        switch alone.
-- ============================================
alter table public.store_settings
  add column if not exists festival_discount_mode boolean not null default false,
  add column if not exists festival_discount_percent numeric not null default 20,
  add column if not exists festival_discount_label text default 'Pchum Ben Festival Sale',
  add column if not exists festival_discount_starts_at timestamptz,
  add column if not exists festival_discount_ends_at timestamptz;

-- No new RLS policies needed — store_settings already has
-- "Public can read store settings" (select, anon) and
-- "Authenticated admins can update store settings" (update, authenticated)
-- from migration.sql, and those apply to the whole row/table, not
-- specific columns.

-- ============================================
-- 2) PER-PRODUCT OVERRIDE — catalog_products only (keyboard / accessories
--    / mouse). NULL = use the global festival_discount_percent above.
--    A number (including 0) overrides it for that one product — 0 means
--    "never discount this product even when the festival sale is on".
-- ============================================
alter table public.catalog_products
  add column if not exists discount_percent numeric;

comment on column public.catalog_products.discount_percent is
  'Pchum Ben festival discount override, 0-100. NULL = use store_settings.festival_discount_percent while the festival mode is active. 0 = never discount this product.';
