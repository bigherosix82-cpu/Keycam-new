-- Run this once in the Supabase SQL Editor.
-- Adds two more free-text fields per product, alongside the existing
-- `description` column. All three are shown as bullet-point sections
-- under "Add to Order" on the product page — one line of text here =
-- one bullet there. Leave either blank and its section just won't show.

alter table catalog_products add column shipping_info text;
alter table catalog_products add column payment_info text;
