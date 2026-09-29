-- Run this once in the Supabase SQL editor (Project → SQL Editor → New query)

-- 1) Track partial payments / deposits on each order
alter table public.orders
  add column if not exists paid_amount numeric not null default 0;

-- 2) Single-row settings table for maintenance mode (admin-editable, no code edits)
create table if not exists public.store_settings (
  id int primary key default 1,
  maintenance_mode boolean not null default true,
  maintenance_discount numeric not null default 0.20,
  constraint store_settings_singleton check (id = 1)
);

insert into public.store_settings (id, maintenance_mode, maintenance_discount)
values (1, true, 0.20)
on conflict (id) do nothing;

-- RLS: storefront (anon) needs to read settings; only admins should write.
-- Adjust roles/policies below to match how your other tables (e.g. `pricing`, `collections`) are set up.
alter table public.store_settings enable row level security;

create policy "Public can read store settings"
  on public.store_settings for select
  using (true);

create policy "Authenticated admins can update store settings"
  on public.store_settings for update
  to authenticated
  using (true)
  with check (true);
