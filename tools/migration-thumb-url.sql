-- Adds a dedicated thumbnail URL for each gallery image on catalog_product_images.
-- Existing rows will have thumb_url = NULL, which the app already handles by
-- falling back to the full-res `url` (see catalog-client.js and admin-catalog.html).
-- Nothing breaks for old images — they just stay full-res until re-uploaded
-- or backfilled.

alter table catalog_product_images
  add column if not exists thumb_url text;
