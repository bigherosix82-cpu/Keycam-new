-- Run this whole file once in Supabase SQL Editor.
-- Creates the products + pricing tables and locks them read-only for the public site.

-- ============================================
-- PRODUCTS (the ~1451 designs)
-- ============================================
create table products (
  id text primary key,
  name text not null,
  image text not null,
  thumbnail text,
  collection text not null,
  folder text,
  series text,
  series_name text
);

alter table products enable row level security;

create policy "Public can read products"
  on products
  for select
  to anon
  using (true);

-- ============================================
-- PRICING (type + thickness + size -> price)
-- Same global matrix used for every product today.
-- ============================================
create table pricing (
  type text not null,
  thickness text not null,
  size_label text not null,
  price numeric not null,
  primary key (type, thickness, size_label)
);

alter table pricing enable row level security;

create policy "Public can read pricing"
  on pricing
  for select
  to anon
  using (true);

-- Seed pricing with your current matrix (from app.js) --
insert into pricing (type, thickness, size_label, price) values
  ('mousepad','3MM','900 × 400 mm',12),
  ('mousepad','3MM','800 × 400 mm',11),
  ('mousepad','3MM','800 × 300 mm',9.5),
  ('mousepad','3MM','600 × 300 mm',8.5),
  ('mousepad','3MM','300 × 250 mm',4.5),
  ('mousepad','5MM','1000 × 500 mm',22),
  ('mousepad','5MM','900 × 400 mm',16),
  ('mousepad','5MM','800 × 400 mm',14.5),
  ('mousepad','5MM','800 × 300 mm',13),
  ('mousepad','5MM','450 × 400 mm',9.5),
  ('mousepad','5MM','300 × 250 mm',7.5),
  ('fps','5MM','450 × 400 mm',10),
  ('fps','5MM','360 × 320 mm',8.5),
  ('fps','5MM','900 × 400 mm',15),
  ('glass','3MM','360 × 320 mm',18),
  ('glass','3MM','490 × 420 mm',24);
