-- Run this once in the Supabase SQL Editor.
-- Adds a real numeric stock count per product (and, separately, per
-- variant option) to the Keyboard / Accessories / Mouse catalog ONLY —
-- Deskmat's own `products` table is untouched.
--
-- This is an ADMIN-ONLY number, not a customer-facing feature: nothing
-- shows on product.html/collection.html, and nothing here gates adding
-- to cart or checkout. It exists purely so the admin table gives you a
-- real count to check/update, alongside the existing manual In Stock /
-- Out of Stock toggle on variants (which is unchanged and still what
-- actually shows on the storefront).
--
-- Both columns are nullable with no default, so every existing product
-- and variant is completely untouched until you type a number in for
-- that specific one — same "opt-in" pattern as the other catalog
-- migrations in this folder.

alter table catalog_products add column if not exists stock_qty integer;
alter table catalog_variants add column if not exists stock_qty integer;

comment on column catalog_products.stock_qty is 'Admin-only inventory count. NULL = not tracked yet. Never exposed to the storefront — see catalog_products_public view below.';
comment on column catalog_variants.stock_qty is 'Admin-only inventory count for this specific variant option. NULL = not tracked yet. Never exposed to the storefront — see catalog_variants_public view below.';

-- ============================================
-- KEEP STOCK OUT OF THE PUBLIC DATA ENTIRELY
--
-- Simply not *displaying* stock_qty on the storefront isn't enough —
-- the anon key used by shared/catalog-client.js could still read any
-- column on a publicly-readable row if someone queried the table
-- directly. So instead of relying on the app to just not render it,
-- we lock the anon role out of the base tables at the database level
-- and route all public reads through two views that never include
-- stock_qty in the first place.
--
-- admin-catalog.html is unaffected — it's a separate code path that
-- reads catalog_products / catalog_variants directly as an
-- authenticated admin, and keeps seeing every column including
-- stock_qty.
-- ============================================

-- Public-safe views: every column of the real table EXCEPT stock_qty.
-- NOTE: if you add more columns to catalog_products or catalog_variants
-- later, add them here too (or they simply won't reach the storefront).
create or replace view catalog_products_public as
select
  id, category, subtype, name, image, thumbnail, collection,
  base_price, discount_percent, specs, description, sort_order,
  archived, created_at, theme, profile, shipping_info, payment_info
from catalog_products;

create or replace view catalog_variants_public as
select
  id, product_id, group_name, option_label, price, sort_order,
  in_stock, image
from catalog_variants;

grant select on catalog_products_public to anon;
grant select on catalog_variants_public to anon;

-- Make sure admin (logged-in, "authenticated" role) can still read the
-- real tables directly, regardless of what implicitly worked before —
-- explicit is safer than relying on an inherited/default grant.
drop policy if exists "Authenticated can read catalog_products" on catalog_products;
create policy "Authenticated can read catalog_products"
  on catalog_products for select to authenticated using (true);

drop policy if exists "Authenticated can read catalog_variants" on catalog_variants;
create policy "Authenticated can read catalog_variants"
  on catalog_variants for select to authenticated using (true);

-- Lock the anon role out of the base tables — public traffic can now
-- only ever go through the *_public views above, which never include
-- stock_qty.
revoke select on catalog_products from anon;
revoke select on catalog_variants from anon;

-- The old "Public can read catalog_products/catalog_variants" policies
-- (from supabase-catalog-v2-schema.sql) are now unreachable for anon
-- since the privilege above is revoked, but drop them for clarity.
drop policy if exists "Public can read catalog_products" on catalog_products;
drop policy if exists "Public can read catalog_variants" on catalog_variants;
