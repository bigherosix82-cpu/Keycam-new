/**
 * IMAGE MIGRATION + ONGOING IMPORT — run this on your own computer, never on the live site.
 *
 * What it does:
 *   1. Reads image-manifest.js (must be up to date — run generate-image-manifest.ps1 first)
 *   2. Checks Supabase for which product IDs already exist
 *   3. Uploads only the NEW image + thumbnail files into your Supabase Storage bucket
 *   4. Adds those new rows to the "products" table
 *
 * Editing existing products (name/collection) now happens through admin.html —
 * this script only ever needs to handle brand-new designs.
 *
 * SETUP (run once):
 *   1. npm install @supabase/supabase-js
 *   2. In Supabase dashboard: Storage -> New bucket -> name it "keycam-images",
 *      toggle "Public bucket" ON, create it.
 *   3. Get your service_role key: Project Settings -> API -> service_role secret key
 *
 * RUN (from your web folder, where assets/ and image-manifest.js live):
 *   set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
 *   node tools/upload-and-sync.js
 *
 * Force a full re-check of every product (rare — e.g. you replaced an image's
 * file without changing its filename/ID):
 *   node tools/upload-and-sync.js --all
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = "https://qysglhjqcrukdpzavdom.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "keycam-images";

if (!SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable.");
  console.error("Get it from Supabase -> Project Settings -> API -> service_role key.");
  console.error("Then run: set SUPABASE_SERVICE_ROLE_KEY=your_key");
  console.error("Then run: node tools/upload-and-sync.js");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CONTENT_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

// Load the manifest (must live one folder above this script, in your web root)
global.window = {};
require('../image-manifest.js');
const images = global.window.KEYCAM_IMPORTED_IMAGES || [];

console.log(`Found ${images.length} entries in image-manifest.js`);

// De-dupe by id (safety net)
const seen = new Set();
const items = [];
for (const img of images) {
  if (seen.has(img.id)) continue;
  seen.add(img.id);
  items.push(img);
}
console.log(`${items.length} unique products to sync`);

const webRoot = path.join(__dirname, '..');

function sanitizeStoragePath(relativePath) {
  return relativePath
    .split('/')
    .map(segment => segment
      .replace(/[^\x00-\x7F]/g, '')   // strip non-ASCII characters (e.g. Cyrillic) — Storage keys must be ASCII
      .replace(/-{2,}/g, '-')          // collapse dashes left behind by the strip
      .replace(/^[-\s]+|[-\s]+$/g, '') // trim stray leading/trailing dashes or spaces
    )
    .join('/');
}

async function uploadFile(localRelativePath) {
  if (!localRelativePath) return null;
  const localPath = path.join(webRoot, localRelativePath);
  if (!fs.existsSync(localPath)) {
    console.warn(`  WARNING: file not found locally, skipping: ${localRelativePath}`);
    return null;
  }
  const storagePath = sanitizeStoragePath(localRelativePath.replace(/^assets\//, ''));
  const fileBuffer = fs.readFileSync(localPath);

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType: contentTypeFor(localPath),
      upsert: true
    });

  if (error) {
    console.error(`  ERROR uploading ${localRelativePath}:`, error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data.publicUrl;
}

// Find out which product IDs already exist in Supabase, so we only
// upload/sync what's actually new — not the whole library every time.
async function getExistingIds(){
  const ids = new Set();
  let from = 0;
  const PAGE = 1000;
  while(true){
    const { data, error } = await supabase
      .from('products')
      .select('id')
      .range(from, from + PAGE - 1);
    if(error){
      console.error("Failed to check existing products:", error.message);
      break;
    }
    data.forEach(row => ids.add(row.id));
    if(data.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

async function run() {
  const forceAll = process.argv.includes('--all');
  const existingIds = forceAll ? new Set() : await getExistingIds();

  const toProcess = items.filter(img => !existingIds.has(img.id));

  if(!forceAll){
    console.log(`${existingIds.size} products already in Supabase — skipping those.`);
  }
  console.log(`${toProcess.length} new product(s) to upload and sync.`);

  if(toProcess.length === 0){
    console.log("Nothing new to do. (Run with --all to force a full re-sync of everything.)");
    return;
  }

  const rows = [];
  let done = 0;

  for (const img of toProcess) {
    const imageUrl = await uploadFile(img.image);
    const thumbnailUrl = await uploadFile(img.thumbnail);

    rows.push({
      id: img.id,
      name: img.name,
      image: imageUrl || img.image,           // fall back to old path if upload failed
      thumbnail: thumbnailUrl || img.thumbnail,
      collection: img.collection,
      folder: img.folder,
      series: img.series || null,
      series_name: img.seriesName || null
    });

    done++;
    if (done % 25 === 0 || done === toProcess.length) {
      console.log(`Uploaded ${done} / ${toProcess.length}`);
    }
  }

  console.log("Uploads complete. Now syncing the products table...");

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const { error } = await supabase.from('products').upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error(`Batch ${i}-${i + batch.length} failed:`, error.message);
      process.exit(1);
    }
    console.log(`Synced ${i + batch.length} / ${rows.length} products`);
  }

  console.log("Done! New images are in Supabase Storage, and the products table is up to date.");
}

run();