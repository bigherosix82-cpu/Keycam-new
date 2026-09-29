-- Run once in Supabase SQL Editor.
-- Theme + Profile as product-level fields (filter only, not buy variants).

alter table catalog_products add column if not exists theme text;
alter table catalog_products add column if not exists profile text;

comment on column catalog_products.theme is 'Filter tag: Anime, Minimalist, Myth, etc. Used for prebuild/customized/keycap.';
comment on column catalog_products.profile is 'Keycap profile filter: Cherry, OEM, MDA.';
