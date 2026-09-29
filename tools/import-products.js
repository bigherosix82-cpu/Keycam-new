/**
 * ONE-TIME IMPORT — run this on your own computer, never on the live site.
 *
 * Reads your existing image-manifest.js and inserts every design into the
 * Supabase "products" table.
 *
 * SETUP (run once):
 *   1. npm install @supabase/supabase-js
 *   2. Get your service_role key: Supabase dashboard -> Project Settings -> API
 *      (the "service_role" secret key, NOT the anon key — this key can write
 *      to your database, so never put it in website code or commit it to git)
 *
 * RUN:
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node import-products.js
 *
 * This script only reads image-manifest.js and writes to Supabase — it does
 * not touch or modify any of your website files.
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://qysglhjqcrukdpzavdom.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  console.error("Get it from Supabase -> Project Settings -> API -> service_role key.");
  console.error("Then run: SUPABASE_SERVICE_ROLE_KEY=your_key node import-products.js");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Load the manifest the same way the website used to
global.window = {};
require('../image-manifest.js');
const images = global.window.KEYCAM_IMPORTED_IMAGES || [];

console.log(`Found ${images.length} entries in image-manifest.js`);

// De-dupe by id (safety net — should already be clean after your manual cleanup)
const seen = new Set();
const rows = [];
for (const img of images) {
  if (seen.has(img.id)) continue;
  seen.add(img.id);
  rows.push({
    id: img.id,
    name: img.name,
    image: img.image,
    thumbnail: img.thumbnail,
    collection: img.collection,
    folder: img.folder,
    series: img.series || null,
    series_name: img.seriesName || null
  });
}

console.log(`${rows.length} unique products after de-dupe`);

async function run() {
  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('products').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Batch ${i}-${i + batch.length} failed:`, error.message);
      process.exit(1);
    }
    console.log(`Inserted ${i + batch.length} / ${rows.length}`);
  }
  console.log("Done! All products are now in Supabase.");
}

run();
