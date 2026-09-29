-- Run this once in the Supabase SQL Editor.
-- Adds two independent features to the existing `products` table
-- (Deskmat only — does not touch catalog_products/catalog_variants).

-- 1) Focal point for the fit-finder preview crop.
--    Percent coordinates (0-100) marking the "important" part of the
--    design (e.g. where a character sits). Defaults to 50/50, which is
--    identical to today's hardcoded center-crop behavior, so existing
--    products render exactly as before until an admin sets a focal
--    point for them.
alter table products add column if not exists focal_x numeric not null default 50;
alter table products add column if not exists focal_y numeric not null default 50;

-- 2) Ready-to-ship stock flag, independent of the customizable
--    Design-Your-Own flow. Defaults to false for every existing row.
alter table products add column if not exists in_stock_ready boolean not null default false;
