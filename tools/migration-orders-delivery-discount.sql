-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- Powers the admin "Create order" feature and the delivery fee input in Orders:
--   1) delivery fee + order-level discount columns on orders
--   2) lets the logged-in admin insert orders (checkout on the site keeps working as before)
-- Safe to run more than once.

-- 1) Columns
alter table public.orders
  add column if not exists delivery_fee numeric not null default 0,
  add column if not exists order_discount_type text,              -- 'flat' or 'percent' (null = no order discount)
  add column if not exists order_discount_value numeric not null default 0,   -- what was typed: 5 for "5%" or "$5"
  add column if not exists order_discount_amount numeric not null default 0;  -- the discount in dollars

-- 2) Allow the logged-in admin to create orders
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
      and policyname = 'Authenticated can insert orders'
  ) then
    create policy "Authenticated can insert orders"
      on public.orders for insert
      to authenticated
      with check (true);
  end if;
end $$;
