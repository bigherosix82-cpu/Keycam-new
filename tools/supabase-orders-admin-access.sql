-- Run this once in Supabase SQL Editor.
-- Right now "orders" can only be inserted into (by checkout) — nobody,
-- not even your logged-in admin account, can read them back yet.
-- This adds that.

create policy "Authenticated can read orders"
  on orders for select
  to authenticated
  using (true);

create policy "Authenticated can update orders"
  on orders for update
  to authenticated
  using (true)
  with check (true);
