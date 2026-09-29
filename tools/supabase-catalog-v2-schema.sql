-- Run this once in the Supabase SQL Editor.
-- Creates the catalog for Keyboard / Accessories / Mouse.
-- Completely separate from the existing `products` + `pricing` tables,
-- which stay exactly as-is and keep powering Deskmat.

-- ============================================
-- CATALOG PRODUCTS
-- One row per sellable item: a barebone, a switch listing,
-- a keycap set, an artisan piece/pack, a cable, a mouse, etc.
-- ============================================
create table catalog_products (
  id uuid primary key default gen_random_uuid(),

  category text not null check (category in ('keyboard','accessories','mouse')),
  -- keyboard: prebuild | customized | barebone | switch | keycap | artisan
  -- accessories: cable | tool | stand | cleaner | wristrest
  -- mouse: null (flat category, no subtype needed)
  subtype text,

  name text not null,
  image text,
  thumbnail text,
  collection text,       -- optional grouping/brand, e.g. "Gateron", "Naruto Series"

  base_price numeric,    -- the product's own price. Leave NULL if every
                          -- variant option below sets its own price instead
                          -- (e.g. switches sold by quantity tier).

  specs text,             -- short line, e.g. "75% Layout · Hotswap · Aluminum case"
                           -- or "Cherry profile · PBT"
  description text,

  sort_order int default 0,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table catalog_products enable row level security;
create policy "Public can read catalog_products"
  on catalog_products for select to anon using (true);

-- ============================================
-- CATALOG VARIANTS
-- Zero or more per product. A group_name groups related options
-- together on the product page (e.g. all "Color" options render
-- as one picker). If price is NULL, the option inherits the
-- product's base_price — used for variants that don't change price
-- (Color, Character in a pack). Set price explicitly when the
-- option DOES change price (Quantity tiers for switches).
-- ============================================
create table catalog_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references catalog_products(id) on delete cascade,

  group_name text not null,     -- 'Color' | 'Quantity' | 'Character' | ...
  option_label text not null,   -- 'Black' | '35pcs' | 'Naruto' | ...
  price numeric,                -- NULL = inherit base_price

  sort_order int default 0
);

alter table catalog_variants enable row level security;
create policy "Public can read catalog_variants"
  on catalog_variants for select to anon using (true);


-- ============================================
-- EXAMPLE SEED ROWS — one of each pattern, for testing.
-- Delete or edit these once you're adding real products via SQL/admin.
-- ============================================

-- Barebone: unique price per product, Color variant doesn't change price
insert into catalog_products (id, category, subtype, name, base_price, specs)
values ('11111111-1111-1111-1111-111111111111', 'keyboard', 'barebone',
        'KC75 Barebone', 89.00, '75% Layout · Hotswap · Aluminum case');
insert into catalog_variants (product_id, group_name, option_label, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 'Color', 'Black', 1),
  ('11111111-1111-1111-1111-111111111111', 'Color', 'White', 2),
  ('11111111-1111-1111-1111-111111111111', 'Color', 'Navy', 3);

-- Switch sold by amount: no base_price, each Quantity tier is priced
insert into catalog_products (id, category, subtype, name, collection, specs)
values ('22222222-2222-2222-2222-222222222222', 'keyboard', 'switch',
        'Gateron Yellow', 'Gateron', 'Linear · 50g actuation');
insert into catalog_variants (product_id, group_name, option_label, price, sort_order) values
  ('22222222-2222-2222-2222-222222222222', 'Quantity', '10pcs', 4.00, 1),
  ('22222222-2222-2222-2222-222222222222', 'Quantity', '35pcs', 12.00, 2),
  ('22222222-2222-2222-2222-222222222222', 'Quantity', '70pcs', 22.00, 3),
  ('22222222-2222-2222-2222-222222222222', 'Quantity', '90pcs', 27.00, 4),
  ('22222222-2222-2222-2222-222222222222', 'Quantity', '110pcs', 32.00, 5);

-- Switch sold as a fixed box: unique price, no variants at all
insert into catalog_products (id, category, subtype, name, collection, base_price, specs)
values ('33333333-3333-3333-3333-333333333333', 'keyboard', 'switch',
        'Akko CS Radiant Red (Box of 45)', 'Akko', 15.00, 'Linear · 43g actuation');

-- Keycap: always a full set, price is specific to the profile/material, no variant picker
insert into catalog_products (id, category, subtype, name, base_price, specs)
values ('44444444-4444-4444-4444-444444444444', 'keyboard', 'keycap',
        'GMK-style Full Set', 42.00, 'Cherry profile · PBT · Full 108-key set');

-- Artisan, single unique piece: no variants
insert into catalog_products (id, category, subtype, name, base_price)
values ('55555555-5555-5555-5555-555555555555', 'keyboard', 'artisan',
        'Sakura Artisan Keycap', 25.00);

-- Artisan pack: Character variant, some characters priced higher (chase piece)
insert into catalog_products (id, category, subtype, name, collection, base_price)
values ('66666666-6666-6666-6666-666666666666', 'keyboard', 'artisan',
        'Naruto Artisan Pack', 'Naruto Series', 18.00);
insert into catalog_variants (product_id, group_name, option_label, price, sort_order) values
  ('66666666-6666-6666-6666-666666666666', 'Character', 'Naruto', null, 1),
  ('66666666-6666-6666-6666-666666666666', 'Character', 'Sasuke', null, 2),
  ('66666666-6666-6666-6666-666666666666', 'Character', 'Kakashi', 22.00, 3), -- chase piece, costs more
  ('66666666-6666-6666-6666-666666666666', 'Character', 'Itachi', null, 4);

-- Cable: unique price, Color doesn't change price
insert into catalog_products (id, category, subtype, name, base_price, specs)
values ('77777777-7777-7777-7777-777777777777', 'accessories', 'cable',
        'Coiled USB-C Cable', 14.00, '1.8m · Aviator connector');
insert into catalog_variants (product_id, group_name, option_label, sort_order) values
  ('77777777-7777-7777-7777-777777777777', 'Color', 'Black', 1),
  ('77777777-7777-7777-7777-777777777777', 'Color', 'White', 2),
  ('77777777-7777-7777-7777-777777777777', 'Color', 'Pink', 3);
