-- Run this once in Supabase SQL Editor.

-- ============================================
-- COLLECTIONS TABLE
-- Moves your 14 collections from hardcoded site files into Supabase,
-- so new ones can be created from the admin page.
-- ============================================
create table collections (
  id text primary key,
  name text not null,
  thumbnail text
);

alter table collections enable row level security;

create policy "Public can read collections"
  on collections for select to anon using (true);

create policy "Authenticated can insert collections"
  on collections for insert to authenticated with check (true);

create policy "Authenticated can update collections"
  on collections for update to authenticated using (true) with check (true);

-- Seed with your current 14 collections (same names/order as today)
insert into collections (id, name, thumbnail) values
  ('abstract-topographic', 'Abstract & Topographic', 'topoghrapic.jpg'),
  ('anime-manga', 'Anime & Manga', 'anime.jpg'),
  ('art', 'Art', 'art.jpg'),
  ('chinese-traditional', 'Chinese Traditional', 'china.jpg'),
  ('dark-fantasy-mythology', 'Dark Fantasy & Mythology', 'dark-fantasy.jpg'),
  ('japanese-traditional', 'Japanese Traditional', 'japanese-Traditonal.jpg'),
  ('kawaii-aesthetic', 'Kawaii Aesthetic', 'cute-kawaii.jpg'),
  ('minimalist-aesthetic', 'Minimalist Aesthetic', 'minimalist.jpg'),
  ('nature-landscapes', 'Nature & Landscapes', 'nature.jpg'),
  ('retro-gaming', 'Retro & Gaming', 'retro-game.jpg'),
  ('sci-fi-cyberpunk', 'Sci-Fi & Cyberpunk', 'sci-fi-cyberpunk.jpg'),
  ('space-galaxy', 'Space & Galaxy', 'space.jpg'),
  ('synthwave-lofi', 'Synthwave & Lo-Fi', 'lofi.jpg'),
  ('vintage-aesthetic', 'Vintage', 'vintage.jpg');

-- ============================================
-- STORAGE PERMISSIONS
-- Lets your logged-in admin session upload files directly from the
-- browser (drag-and-drop), not just the local service_role script.
-- ============================================
create policy "Authenticated can upload images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'keycam-images');

create policy "Authenticated can update stored images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'keycam-images');
