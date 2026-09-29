-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query).
-- Powers "Link & Import" in Series manager: once a series in one collection
-- is linked to another collection, a new image added to that series is
-- automatically copied into every linked collection too — no need to
-- press Import again for each new design.
-- Safe to run more than once.

create table if not exists public.series_links (
  id uuid primary key default gen_random_uuid(),
  source_collection text not null,
  series text not null,
  target_collection text not null,
  created_at timestamptz not null default now(),
  unique (source_collection, series, target_collection)
);

alter table public.series_links enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'series_links' and policyname = 'Authenticated can read series_links'
  ) then
    create policy "Authenticated can read series_links"
      on public.series_links for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'series_links' and policyname = 'Authenticated can insert series_links'
  ) then
    create policy "Authenticated can insert series_links"
      on public.series_links for insert
      to authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'series_links' and policyname = 'Authenticated can delete series_links'
  ) then
    create policy "Authenticated can delete series_links"
      on public.series_links for delete
      to authenticated
      using (true);
  end if;
end $$;
