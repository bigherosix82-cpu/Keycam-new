-- Run this once in Supabase SQL Editor.
-- Adds the two columns your Collection Manager (reorder + archive) needs.

alter table collections
  add column if not exists sort_order integer not null default 0,
  add column if not exists archived boolean not null default false;

-- Optional: seed sort_order to match your current alphabetical order,
-- so collections don't all start at 0 and jumble on first load.
-- Safe to skip if you're fine setting the order manually in the admin page.
with ordered as (
  select id, row_number() over (order by name) as rn
  from collections
)
update collections
set sort_order = ordered.rn
from ordered
where collections.id = ordered.id;
