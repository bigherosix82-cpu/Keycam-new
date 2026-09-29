/* =========================
   CATALOG CLIENT (Keyboard / Accessories / Mouse)
   Separate from app.js / KEYCAM.products (Deskmat) on purpose —
   reads catalog_products + catalog_variants instead of products + pricing.
   Exposes window.CATALOG and window.CATALOG_READY (a promise).

   Also owns the "Pchum Ben Festival" discount for this catalog only —
   window.CATALOG_DISCOUNT — loaded from store_settings alongside the
   products themselves. Completely separate from Deskmat's own
   maintenance-mode discount (store_settings.maintenance_mode /
   maintenance_discount), which lives in shared/catalog-cart.js's
   ensureStoreSettings() and only ever applies to mousepad/fps items.
========================= */

window.CATALOG = {
  products: [] // each: {id, category, subtype, name, image, thumbnail,
               //         collection, theme, profile, basePrice, discountPercent,
               //         specs, description,
               //         images: [{url, thumbUrl, sortOrder}],
               //         variantGroups: [{name, options:[{label, price, image, sortOrder}]}]}
};

// Populated by loadDiscountSettings() before CATALOG_READY resolves.
// active: is the festival sale actually live right now (switch on AND,
//         if a schedule window is set, "now" falls inside it).
// percent: the default % used by any product without its own override.
// label: shown on the homepage banner / order drawer.
window.CATALOG_DISCOUNT = { active: false, percent: 20, label: "Pchum Ben Festival Sale", startsAt: null, endsAt: null };

function money2(n){ return `$${Number(n).toFixed(2).replace(/\.00$/, "")}`; }

function groupVariants(rows){
  const groups = {};
  rows.forEach(r => {
    if(!groups[r.group_name]) groups[r.group_name] = [];
    groups[r.group_name].push({
      label: r.option_label,
      price: r.price === null || r.price === undefined ? null : Number(r.price),
      image: r.image || null,
      inStock: r.in_stock !== false,
      sortOrder: r.sort_order || 0
    });
  });
  return Object.keys(groups).map(name => ({
    name,
    options: groups[name].sort((a,b)=>a.sortOrder-b.sortOrder)
  }));
}

// Resolve a customized product's "built from" links (catalog_product_components)
// into lightweight references to the actual component products. Needs the full
// products-by-id map, so this runs as a second pass after every product's base
// record has been built (a component product may not have been mapped yet
// otherwise).
function resolveComponents(rows, productsById){
  return rows
    .slice()
    .sort((a,b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map(r => {
      const comp = productsById[r.component_product_id];
      if(!comp) return null; // linked product missing/archived — skip quietly
      return {
        id: comp.id,
        name: comp.name,
        thumbnail: comp.thumbnail || comp.image,
        subtype: comp.subtype,
        roleLabel: r.role_label || comp.subtype
      };
    })
    .filter(Boolean);
}

// Loads the festival discount switch/percent/schedule from store_settings
// (same singleton row Deskmat's maintenance settings live on, id = 1, but
// its own festival_discount_* columns). Safe to fail quietly — if the
// migration hasn't been run yet, the catalog just shows normal prices.
async function loadDiscountSettings(){
  window.CATALOG_DISCOUNT = { active: false, percent: 20, label: "Pchum Ben Festival Sale", startsAt: null, endsAt: null };
  if(!window.KEYCAM_SUPABASE) return;
  try{
    const { data, error } = await window.KEYCAM_SUPABASE
      .from('store_settings')
      .select('festival_discount_mode, festival_discount_percent, festival_discount_label, festival_discount_starts_at, festival_discount_ends_at')
      .eq('id', 1)
      .maybeSingle();
    if(error){ console.error("Failed to load festival discount settings:", error); return; }
    if(!data) return;

    const switchOn = !!data.festival_discount_mode;
    const startsAt = data.festival_discount_starts_at ? new Date(data.festival_discount_starts_at) : null;
    const endsAt = data.festival_discount_ends_at ? new Date(data.festival_discount_ends_at) : null;
    const now = new Date();
    const withinWindow = (!startsAt || now >= startsAt) && (!endsAt || now <= endsAt);

    window.CATALOG_DISCOUNT = {
      active: switchOn && withinWindow,
      percent: data.festival_discount_percent != null ? Number(data.festival_discount_percent) : 20,
      label: data.festival_discount_label || "Pchum Ben Festival Sale",
      startsAt,
      endsAt
    };
  }catch(e){
    console.error("festival discount settings fetch failed:", e);
  }
}

async function loadCatalog(){
  if(!window.KEYCAM_SUPABASE){
    console.error("Supabase client not available — catalog cannot load.");
    return;
  }

  // Kick this off alongside the product queries below — it's an
  // independent read of the same settings row, no need to wait on it.
  const discountPromise = loadDiscountSettings();

  // Storefront reads go through the *_public views (everything except
  // stock_qty — see tools/migration-catalog-stock.sql). Admin still
  // reads/writes the real catalog_products / catalog_variants tables
  // directly, so this swap only affects what customers can ever see.
  const { data: products, error: prodErr } = await window.KEYCAM_SUPABASE
    .from('catalog_products_public')
    .select('*')
    .eq('archived', false)
    .order('sort_order');
  if(prodErr){ console.error("Failed to load catalog_products:", prodErr); return; }

  const { data: variants, error: varErr } = await window.KEYCAM_SUPABASE
    .from('catalog_variants_public')
    .select('*');
  if(varErr) console.error("Failed to load catalog_variants:", varErr);

  const { data: images, error: imgErr } = await window.KEYCAM_SUPABASE
    .from('catalog_product_images')
    .select('*')
    .order('sort_order');
  if(imgErr) console.error("Failed to load catalog_product_images:", imgErr);

  // "Built from" links for customized products (e.g. a customized keyboard
  // built from a barebone + switch + keycap). Safe to fail quietly — the
  // table may not exist yet on first deploy, and products just render
  // without a components section until it does.
  let componentRows = [];
  try{
    const { data: components, error: compErr } = await window.KEYCAM_SUPABASE
      .from('catalog_product_components')
      .select('*');
    if(compErr) console.error("Failed to load catalog_product_components:", compErr);
    else componentRows = components || [];
  }catch(e){
    console.error("catalog_product_components fetch failed:", e);
  }

  window.CATALOG.products = (products || []).map(p => {
    const ownVariantRows = (variants || []).filter(v => v.product_id === p.id);
    const ownImages = (images || [])
      .filter(im => im.product_id === p.id)
      .map(im => ({ url: im.url, thumbUrl: im.thumb_url || im.url, sortOrder: im.sort_order || 0 }));
    return {
      id: p.id,
      category: p.category,
      subtype: p.subtype,
      name: p.name,
      image: p.image,
      thumbnail: p.thumbnail || p.image,
      collection: p.collection,
      theme: p.theme || null,
      profile: p.profile || null,
      basePrice: p.base_price === null || p.base_price === undefined ? null : Number(p.base_price),
      // Pchum Ben festival discount override for this product, 0-100.
      // null = use the site-wide festival_discount_percent while the
      // festival mode is active. 0 = never discount this product.
      discountPercent: p.discount_percent === null || p.discount_percent === undefined ? null : Number(p.discount_percent),
      specs: p.specs,
      description: p.description,
      shippingInfo: p.shipping_info,
      paymentInfo: p.payment_info,
      images: ownImages.length ? ownImages : (p.image ? [{ url: p.image, thumbUrl: p.thumbnail || p.image, sortOrder: 0 }] : []),
      variantGroups: groupVariants(ownVariantRows),
      components: [] // filled in below, once every product is mapped
    };
  });

  // Second pass: resolve component links now that every product (including
  // the barebones/switches/keycaps being pointed to) exists in the map.
  const productsById = {};
  window.CATALOG.products.forEach(p => { productsById[p.id] = p; });
  window.CATALOG.products.forEach(p => {
    const ownComponentRows = componentRows.filter(r => r.product_id === p.id);
    p.components = resolveComponents(ownComponentRows, productsById);
  });

  await discountPromise;
}

// Resolve the price for a given set of chosen options (one label per group).
// selections: { "Color": "Black", "Quantity": "35pcs" }
// Returns the ORIGINAL (pre-festival-discount) unit price — see
// catalogFinalPrice() below for the price that should actually be shown/charged.
function catalogPrice(product, selections){
  selections = selections || {};
  let price = product.basePrice;
  (product.variantGroups || []).forEach(g => {
    const chosen = selections[g.name];
    const opt = g.options.find(o => o.label === chosen) || g.options[0];
    if(opt && opt.price !== null && opt.price !== undefined) price = opt.price;
  });
  return price;
}

function catalogPriceValues(product){
  const prices = [];
  if(product.basePrice !== null && product.basePrice !== undefined) prices.push(product.basePrice);
  (product.variantGroups || []).forEach(g => {
    g.options.forEach(o => {
      prices.push(o.price !== null && o.price !== undefined ? o.price : product.basePrice);
    });
  });
  return prices.filter(p => p !== null && p !== undefined);
}

function formatPriceRange(values){
  if(!values.length) return "—";
  const min = Math.min(...values), max = Math.max(...values);
  return min === max ? money2(min) : `${money2(min)} – ${money2(max)}`;
}

// Original (pre-discount) price range shown for a product across its
// base price + every variant option.
function catalogPriceRange(product){
  return formatPriceRange(catalogPriceValues(product));
}

/* =========================
   PCHUM BEN FESTIVAL DISCOUNT
   Global on/off + default % come from window.CATALOG_DISCOUNT (loaded
   from store_settings). Each product can override the % it gets via
   product.discountPercent — null means "use the site-wide default",
   a number (including 0) always wins over the default.
========================= */

function catalogDiscountPercentFor(product){
  if(!window.CATALOG_DISCOUNT || !window.CATALOG_DISCOUNT.active) return 0;
  const override = product && product.discountPercent;
  const pct = (override === null || override === undefined) ? window.CATALOG_DISCOUNT.percent : override;
  const n = Number(pct);
  if(!n || n <= 0) return 0;
  return Math.min(100, n);
}

function applyCatalogDiscount(price, product){
  if(price === null || price === undefined) return price;
  const pct = catalogDiscountPercentFor(product);
  if(!pct) return price;
  return Math.round(price * (1 - pct / 100) * 100) / 100;
}

// The price that should actually be displayed as "the" price and charged
// when adding to the cart — original price with the festival discount
// (if any) applied.
function catalogFinalPrice(product, selections){
  return applyCatalogDiscount(catalogPrice(product, selections), product);
}

// Discounted version of catalogPriceRange, for card grids.
function catalogPriceRangeDiscounted(product){
  const values = catalogPriceValues(product).map(v => applyCatalogDiscount(v, product));
  return formatPriceRange(values);
}

// HTML price range for card grids — plain text when no discount applies
// to this product, original price (struck through) + sale price when one
// does. Safe to drop straight into innerHTML.
function catalogPriceRangeHTML(product){
  const pct = catalogDiscountPercentFor(product);
  if(!pct) return catalogPriceRange(product);
  return `<span class="catalog-price-was">${catalogPriceRange(product)}</span> <span class="catalog-price-now">${catalogPriceRangeDiscounted(product)}</span>`;
}

// Small "-20%" ribbon HTML for a product thumbnail, or "" if this product
// isn't discounted right now.
function catalogDiscountBadgeHTML(product){
  const pct = catalogDiscountPercentFor(product);
  if(!pct) return "";
  const rounded = Number.isInteger(pct) ? pct : Math.round(pct * 10) / 10;
  return `<span class="catalog-discount-badge">-${rounded}%</span>`;
}

window.CATALOG_READY = loadCatalog();
