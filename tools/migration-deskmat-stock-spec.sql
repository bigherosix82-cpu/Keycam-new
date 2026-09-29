-- Run this once in the Supabase SQL Editor.
-- Adds a fixed type/size/thickness/price spec to stock (ready-to-ship)
-- desk mats, set once by the admin at import time in the new
-- "Import Stock Mousepad" screen. A stock item is a single already-made
-- product — unlike the Design-Your-Own flow, it has no selectable
-- size/thickness range, just one spec and one price.
--
-- These columns are only populated when in_stock_ready = true
-- (see migration-deskmat-focal-stock.sql for that column). They are
-- independent of collection/series, which stock products keep exactly
-- like any other product.

alter table products add column if not exists stock_type text;
alter table products add column if not exists stock_thickness text;
alter table products add column if not exists stock_size_label text;
alter table products add column if not exists stock_price numeric;
