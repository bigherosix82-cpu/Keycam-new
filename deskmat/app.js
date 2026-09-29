/* =========================
   STORE SETTINGS
   Defaults below are used only until loadStoreSettings() fetches the
   live values from Supabase (see loadStoreSettings + KEYCAM_READY below).
   Edit maintenance mode / discount from the admin panel's Editing tab
   instead of here.
========================= */
const KEYCAM_STORE = {
  maintenanceMode: true,
  maintenanceDiscount: 0.20,
  normalOrderDuration: "1-2 days",
  maintenanceOrderDuration: "10 days",
  glassOrderDuration: "10 days"
};
/**
 * KeyCam Dark Mode
 * Adds a theme toggle button to the header and manages dark/light mode preferences.
 * Ensure the dark mode styles are defined in your CSS (provided below).
 */

// --- 1. CREATE THE TOGGLE BUTTON ---



// --- 2. THEME MANAGEMENT FUNCTIONS ---

function getStoredTheme() {
    return localStorage.getItem('keycam-theme') || 'dark'; // Default to dark
}

function setStoredTheme(theme) {
    localStorage.setItem('keycam-theme', theme);
}

function applyTheme(theme, toggleBtn) {
    const isDark = theme === 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    // Update the toggle button icon
    if (toggleBtn) {
        toggleBtn.innerHTML = isDark ? '☀️' : '🌙';
        toggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    // Dispatch a custom event so other scripts can react if needed
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
}

function toggleTheme(toggleBtn) {
    const currentTheme = document.documentElement.getAttribute('data-theme') || getStoredTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme, toggleBtn);
    setStoredTheme(newTheme);
}

// --- 3. INITIALIZE DARK MODE ---

function initDarkMode() {
    const toggleBtn = createThemeToggle();
    if (!toggleBtn) {
        // Fallback: still apply stored theme even if button can't be created
        const storedTheme = getStoredTheme();
        document.documentElement.setAttribute('data-theme', storedTheme);
        return;
    }

    // Apply stored theme on load
    const storedTheme = getStoredTheme();
    applyTheme(storedTheme, toggleBtn);

    // Add click listener to toggle button
    toggleBtn.addEventListener('click', () => {
        toggleTheme(toggleBtn);
    });

    // Optional: Listen for system preference changes (only if user hasn't set a preference)
    // This is a more advanced feature; you can uncomment if desired.
    /*
    const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    darkModeMediaQuery.addEventListener('change', (e) => {
        // Only change if the user hasn't manually set a theme in localStorage
        if (!localStorage.getItem('keycam-theme')) {
            const newTheme = e.matches ? 'dark' : 'light';
            applyTheme(newTheme, toggleBtn);
        }
    });
    */
}

// --- 4. RUN THE INITIALIZATION ---

// Wait for the DOM to be fully loaded before running
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDarkMode);
} else {
    initDarkMode();
}

const KEYCAM = {
  telegram: "Key_Cam",
  location: "https://maps.app.goo.gl/SFp44sTmpm52HC5i7",
  social: {
    telegram: "https://t.me/Key_Cam",
    facebook: "https://www.facebook.com/share/1EyHBrqsXP/",
    instagram: "https://www.instagram.com/key_camm?igsh=bWVjeWd6bWFvZHB4",
    tiktok: "https://www.tiktok.com/@keycamm?_r=1&_t=ZS-98MRrdf6b"
  },
  collections: [],
  homeCollections: [],
  typeInfo: {
    mousepad: {
      title: "Mouse Pads",
      eyebrow: "EVERYDAY MOUSE PAD",
      desc: "Our regular desk mats are available in 3MM and 5MM thicknesses, with sizes shown by dimensions only.",
      detail: "Soft, everyday desk mats for work, gaming and clean setups.",
      specs: "3MM / 5MM",
      sizes: "1000 × 500 · 900 × 400 · 800 × 400 · 800 × 300 · 600 × 300 · 450 × 400 · 300 × 250 mm",
      range: "$8.50 – $22"
    },
    fps: {
      title: "FPS Mouse Pads",
      eyebrow: "FPS MOUSE PAD",
      desc: "A thicker, control-focused 5MM option for FPS setups. The current catalog supports 450 × 400 mm.",
      detail: "Built around a stable 5MM feel and control-focused play.",
      specs: "5MM",
      sizes: "450 × 400 · 360 × 320 mm",
      range: "$8.50 – $15"
    },
    glass: {
      title: "Glass Mouse Pads",
      eyebrow: "GLASS MOUSE PAD",
      desc: "A premium 3MM glass surface available in 360 × 320 mm and 490 × 420 mm.",
      detail: "A clean, precise glass surface for a premium setup.",
      specs: "3MM GLASS",
      sizes: "360 × 320 · 490 × 420 mm",
      range: "$18 – $24"
    }
  },
  products: []
};

/* =========================
   CATALOG LOADER
   Fetches products + pricing from Supabase and builds KEYCAM.products
   in the exact same shape the rest of the site already expects.
   window.KEYCAM_READY resolves once this is done — pages that render
   products wait on it before touching KEYCAM.products.
========================= */
function buildPricingMatrix(rows, type){
  const matrix = {};
  rows.filter(r => r.type === type).forEach(r => {
    if(!matrix[r.thickness]) matrix[r.thickness] = {};
    matrix[r.thickness][r.size_label] = [Number(r.price), r.size_label];
  });
  return matrix;
}

async function loadCatalogFromSupabase(){
  if(!window.KEYCAM_SUPABASE){
    console.error("Supabase client not available — catalog cannot load.");
    return;
  }

  const { data: pricingRows, error: pricingErr } = await window.KEYCAM_SUPABASE
    .from('pricing')
    .select('*');
  if(pricingErr) console.error("Failed to load pricing:", pricingErr);

  const { data: collectionRows, error: collectionErr } = await window.KEYCAM_SUPABASE
    .from('collections')
    .select('*')
    .eq('archived', false)
    .order('sort_order')
    .order('name');
  if(collectionErr) console.error("Failed to load collections:", collectionErr);

  // series_links: "this series, from its home collection, also shows in
  // this other collection" — a live pull, not a copy. A series linked here
  // shows up in the target collection with zero duplicate product rows;
  // missing table just means no series are linked yet.
  let seriesLinksByKey = new Map(); // "series||home_collection" -> [target_collection, ...]
  try{
    const { data: seriesLinkRows, error: seriesLinkErr } = await window.KEYCAM_SUPABASE
      .from('series_links')
      .select('source_collection, series, target_collection');
    if(seriesLinkErr) throw seriesLinkErr;
    (seriesLinkRows || []).forEach(r => {
      const key = `${r.series}||${r.source_collection}`;
      if(!seriesLinksByKey.has(key)) seriesLinksByKey.set(key, []);
      seriesLinksByKey.get(key).push(r.target_collection);
    });
  }catch(e){
    console.error("Failed to load series links:", e.message);
  }
  KEYCAM.collections = (collectionRows || []).map(c => [c.id, c.name, c.thumbnail]);
  // Home page / nav browsing lists exclude collections marked hidden_from_home.
  // The collection's own page still works normally via KEYCAM.collections above —
  // this only affects what's offered for discovery on the home page and menus.
  KEYCAM.homeCollections = (collectionRows || [])
    .filter(c => !c.hidden_from_home)
    .map(c => [c.id, c.name, c.thumbnail]);

  const regularMatrix = buildPricingMatrix(pricingRows || [], 'mousepad');
  const fpsMatrix = buildPricingMatrix(pricingRows || [], 'fps');
  const glassMatrix = buildPricingMatrix(pricingRows || [], 'glass');

  let allProducts = [];
  let from = 0;
  const PAGE = 1000;
  while(true){
    const { data, error } = await window.KEYCAM_SUPABASE
      .from('products')
      .select('*')
      .range(from, from + PAGE - 1);
    if(error){ console.error("Failed to load products:", error); break; }
    allProducts = allProducts.concat(data);
    if(data.length < PAGE) break;
    from += PAGE;
  }

  // Build one catalog entry per unique image URL.
  // Series import can create multiple DB rows that share the same image
  // (one per collection). Merging them keeps search/listings clean and
  // avoids doubling rows on the free Supabase plan for display purposes.
  const byImage = new Map();
  allProducts.forEach(row => {
    const key = (row.image || row.thumbnail || row.id || "").toString();
    if (!key) return;

    if (!byImage.has(key)) {
      byImage.set(key, {
        id: row.id,
        name: row.name,
        image: row.image,
        thumbnail: row.thumbnail,
        collections: row.collection ? [row.collection] : [],
        series: row.series || null,
        seriesName: row.series_name || null,
        focalX: (row.focal_x === null || row.focal_x === undefined) ? 50 : Number(row.focal_x),
        focalY: (row.focal_y === null || row.focal_y === undefined) ? 50 : Number(row.focal_y),
        inStockReady: !!row.in_stock_ready,
        // Fixed spec for ready-made stock items (set once at import time in
        // admin.html). Only meaningful when inStockReady is true.
        stockType: row.stock_type || null,
        stockThickness: row.stock_thickness || null,
        stockSizeLabel: row.stock_size_label || null,
        stockPrice: (row.stock_price === null || row.stock_price === undefined) ? null : Number(row.stock_price),
        desc: "KeyCam design from our curated collection.",
        color: "stock",
        regular: regularMatrix,
        types: {
          mousepad: regularMatrix,
          fps: fpsMatrix,
          glass: glassMatrix
        }
      });
    } else {
      const existing = byImage.get(key);
      if (row.collection && !existing.collections.includes(row.collection)) {
        existing.collections.push(row.collection);
      }
      // Prefer non-empty series metadata if the first row lacked it
      if (!existing.series && row.series) {
        existing.series = row.series;
        existing.seriesName = row.series_name || row.series;
      }
      // Prefer a real thumbnail if the first row was missing one
      if (!existing.thumbnail && row.thumbnail) existing.thumbnail = row.thumbnail;
      // If any merged row is flagged ready-to-ship, treat the product as such
      if (row.in_stock_ready) {
        existing.inStockReady = true;
        if (!existing.stockType && row.stock_type) existing.stockType = row.stock_type;
        if (!existing.stockThickness && row.stock_thickness) existing.stockThickness = row.stock_thickness;
        if (!existing.stockSizeLabel && row.stock_size_label) existing.stockSizeLabel = row.stock_size_label;
        if ((existing.stockPrice === null || existing.stockPrice === undefined) && row.stock_price != null) {
          existing.stockPrice = Number(row.stock_price);
        }
      }
    }
  });

  // Expand each product's collections using series_links — a series linked
  // from its home collection into another collection shows there too,
  // without needing a duplicate product row (pull, not copy).
  byImage.forEach(p => {
    if(!p.series) return;
    p.collections.slice().forEach(col => {
      const targets = seriesLinksByKey.get(`${p.series}||${col}`) || [];
      targets.forEach(t => { if(!p.collections.includes(t)) p.collections.push(t); });
    });
  });

  KEYCAM.products = [...byImage.values()];
}

async function loadStoreSettings(){
  if(!window.KEYCAM_SUPABASE) return;
  const { data, error } = await window.KEYCAM_SUPABASE
    .from('store_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if(error){ console.error("Failed to load store settings — using in-file defaults:", error); return; }
  if(data){
    KEYCAM_STORE.maintenanceMode = !!data.maintenance_mode;
    if(data.maintenance_discount !== null && data.maintenance_discount !== undefined){
      KEYCAM_STORE.maintenanceDiscount = Number(data.maintenance_discount);
    }
  }
}

window.KEYCAM_READY = loadStoreSettings().then(loadCatalogFromSupabase).then(() => {
  applyMaintenanceNotice();
  applyMaintenanceToSizeGuide();
  renderCollectionNav();
  renderCollectionGrid();
});

function typeName(t){return t==="mousepad"?"Mouse Pad":t==="fps"?"FPS Mouse Pad":"Glass Mouse Pad"}
function collectionName(id){return KEYCAM.collections.find(x=>x[0]===id)?.[1]||id}
function money(n){return `$${Number(n).toFixed(2).replace(/\.00$/,"")}`}
function effectivePrice(type, price){
  const n=Number(price);
  if(KEYCAM_STORE.maintenanceMode && (type==="mousepad" || type==="fps")){
    return Math.round(n * (1 - KEYCAM_STORE.maintenanceDiscount) * 100) / 100;
  }
  return n;
}
function orderDuration(type){
  if(type==="glass") return KEYCAM_STORE.glassOrderDuration;
  return KEYCAM_STORE.maintenanceMode ? KEYCAM_STORE.maintenanceOrderDuration : KEYCAM_STORE.normalOrderDuration;
}
function priceRange(type){
  const products=KEYCAM.products||[];
  const sample=products[0];
  if(!sample) return KEYCAM.typeInfo[type]?.range || "—";
  const variants=getTypeVariants(sample,type);
  const prices=[];
  Object.values(variants||{}).forEach(group=>Object.values(group||{}).forEach(v=>prices.push(effectivePrice(type,v[0]))));
  if(!prices.length) return KEYCAM.typeInfo[type]?.range || "—";
  const min=Math.min(...prices), max=Math.max(...prices);
  return min===max ? money(min) : `${money(min)} – ${money(max)}`;
}
function maintenanceDiscountText(type, price){
  if(KEYCAM_STORE.maintenanceMode && (type==="mousepad" || type==="fps")){
    return `<s class="price-old">${money(price)}</s><span class="price-new">${money(effectivePrice(type,price))}</span>`;
  }
  return money(price);
}
function applyMaintenanceNotice(){
  const existing = document.querySelector('#maintenanceNotice');
  if(existing) existing.remove();
  if(!KEYCAM_STORE.maintenanceMode) return;

  const header = document.querySelector('.site-header');
  if(!header) return;

  const notice = document.createElement('div');
  notice.id = 'maintenanceNotice';
  notice.className = 'maintenance-banner';
  
  notice.innerHTML = `
    <div class="maintenance-container">
      <div class="maintenance-title">Machine under maintenance</div>
      <div class="maintenance-detail">${Math.round(KEYCAM_STORE.maintenanceDiscount * 100)}% off on Regular and FPS MousePad, Order Process Delay to ${KEYCAM_STORE.maintenanceOrderDuration}</div>
    </div>
  `;
  
  header.insertAdjacentElement('afterend', notice);
}
function applyMaintenanceToSizeGuide(){
  const table=document.querySelector('#catalogAvailability');
  if(!table) return;
  table.querySelectorAll('[data-price]').forEach(el=>{
    const type=el.dataset.type;
    const raw=Number(el.dataset.price);
    el.innerHTML=maintenanceDiscountText(type,raw);
  });
  document.querySelectorAll('[data-order-duration]').forEach(el=>{
    el.textContent=orderDuration(el.dataset.orderDuration);
  });
  document.querySelectorAll('[data-current-price]').forEach(el=>{
    const type=el.dataset.type;
    const raw=Number(el.dataset.price);
    el.innerHTML=maintenanceDiscountText(type,raw);
  });
  const mode=document.querySelector('#maintenanceStatus');
  if(mode) mode.textContent=KEYCAM_STORE.maintenanceMode ? `Maintenance mode ON · temporary ${Math.round(KEYCAM_STORE.maintenanceDiscount * 100)}% discount for Mouse Pad and FPS Mouse Pad` : `Normal production mode · original prices and ${KEYCAM_STORE.normalOrderDuration} order time`;
}

function migrateLegacyCatalogIntoDeskmatOrder(){
  try{
    const legacyRaw = localStorage.getItem("keycamCatalogOrder");
    if(!legacyRaw) return;
    const legacy = JSON.parse(legacyRaw);
    if(!Array.isArray(legacy) || !legacy.length){
      localStorage.removeItem("keycamCatalogOrder");
      return;
    }
    const current = JSON.parse(localStorage.getItem("keycamOrder") || "[]");
    const keys = new Set(current.map(x => x.key));
    legacy.forEach(item => {
      if(!item || !item.key) return;
      if(!keys.has(item.key)){
        current.push(item);
        keys.add(item.key);
      }else{
        const existing = current.find(x => x.key === item.key);
        if(existing) existing.qty = (existing.qty || 1) + (item.qty || 1);
      }
    });
    localStorage.setItem("keycamOrder", JSON.stringify(current));
    localStorage.removeItem("keycamCatalogOrder");
  }catch(e){ console.warn("Order migration skipped:", e); }
}
function getOrder(){
  migrateLegacyCatalogIntoDeskmatOrder();
  try{return JSON.parse(localStorage.getItem("keycamOrder")||"[]")}catch{return[]}
}
function setOrder(o){localStorage.setItem("keycamOrder",JSON.stringify(o));updateOrderUI()}
function updateOrderUI(){const o=getOrder(),count=o.reduce((a,x)=>a+(Number(x.qty)||0),0);document.querySelectorAll("#orderCount").forEach(e=>e.textContent=count)}
function addToOrder(item){
  const o=getOrder();
  const key=item.key || `${item.productId}|${item.type}|${item.thickness}|${item.size}`;
  let image = item.image || "";
  if(!image && window.KEYCAM?.products){
    const p = KEYCAM.products.find(pr => pr.id === item.productId);
    image = p?.thumbnail || p?.image || "";
  }
  const found=o.find(x=>x.key===key);
  if(found){
    found.qty++;
    if(!found.image && image) found.image = image;
  } else {
    o.push({...item, key, image: image || "", qty:1});
  }
  setOrder(o);
  openOrder();
}
function openOrder(){document.querySelector("#orderDrawer")?.classList.add("open");document.querySelector("#drawerBackdrop")?.classList.add("open");document.body.classList.add("modal-open");ensureOrderContactForm();renderOrder()}
function closeOrder(){document.querySelector("#orderDrawer")?.classList.remove("open");document.querySelector("#drawerBackdrop")?.classList.remove("open");document.body.classList.remove("modal-open")}
function renderOrder(){
  const box = document.querySelector("#orderItems");
  if(!box) return;

  const o = getOrder();

  if(!o.length){
    box.innerHTML = `
      <div class="empty-order">
        <strong>Your order is empty.</strong>
        <span>Add designs while you browse.</span>
      </div>
    `;
    
    // Remove any existing savings summary
    const existingSummary = document.querySelector('#orderSavingsSummary');
    if (existingSummary) existingSummary.remove();
    
  } else {
    box.innerHTML = o.map((x, i) => {

      const product = (window.KEYCAM?.products || []).find(p => p.id === x.productId);
      const image = x.image || product?.thumbnail || product?.image || "";

      // Deskmat mousepad/fps can show maintenance discount; catalog items
      // instead carry their own originalPrice when a Pchum Ben festival
      // discount was applied at add-to-cart time. Check festival first so
      // a catalog item's real discount isn't hidden on Deskmat pages.
      const isDeskmatPriced = !!(x.type && (x.type === 'mousepad' || x.type === 'fps' || x.type === 'glass'));
      let originalPrice = x.price;
      let isDiscounted = false;

      if (x.originalPrice != null && Number(x.originalPrice) > Number(x.price)) {
        originalPrice = Number(x.originalPrice);
        isDiscounted = true;
      } else if (isDeskmatPriced && KEYCAM_STORE.maintenanceMode && x.type !== 'glass') {
        originalPrice = x.price / (1 - KEYCAM_STORE.maintenanceDiscount);
        isDiscounted = true;
      }

      const savings = isDiscounted ? (originalPrice - x.price) * x.qty : 0;

      let detailHtml = "";
      if (x.variantSummary) {
        detailHtml = `<span>${x.variantSummary}</span>`;
      } else if (x.type) {
        detailHtml = `<span>${typeName(x.type)}</span><span>${[x.sizeLabel || x.size, x.thickness].filter(Boolean).join(" · ")}</span>`;
      }

      return `
        <div class="order-item">

          <div class="order-item-image">
            ${
              image
                ? `<img src="${image}" alt="${x.name}" loading="lazy">`
                : `<div class="order-item-image-empty">No image</div>`
            }
          </div>

          <div class="order-item-info">
            <div class="order-item-top">
              <strong>${x.name}</strong>
              <div style="text-align:right;">
                ${isDiscounted ? `
                  <div style="font-size:11px;color:#7f8b90;text-decoration:line-through;">${money(originalPrice)}</div>
                  <b style="color:#20c3df;font-size:15px;">${money(x.price)}</b>
                ` : `
                  <b style="font-size:15px;">${money(x.price)}</b>
                `}
              </div>
            </div>

            ${detailHtml}

            ${isDiscounted ? `
              <div style="margin-top:4px;font-size:10px;color:#7f8b90;">
                Saved ${money(savings)} on this item
              </div>
            ` : ''}

                        <div class="qty">
              <button
                data-i="${i}"
                data-q="-1"
                aria-label="Decrease quantity"
                ${x.qty <= 1 ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}
              >−</button>

              <input type="number" min="1" step="1" value="${x.qty}" data-i="${i}" data-qty-input="1" aria-label="Quantity" inputmode="numeric">

              <button
                data-i="${i}"
                data-q="1"
                aria-label="Increase quantity"
              >+</button>

              <button
                class="remove"
                data-i="${i}"
                aria-label="Remove item"
              >×</button>
            </div>
            </div>
          </div>

        </div>
      `;
    }).join("");
  }

  // Calculate totals
  let totalOriginal = 0;
  let totalDiscounted = 0;
  let totalSavings = 0;
  
  let hasFestivalItem = false;
  o.forEach(x => {
    let originalPrice = x.price;
    let isDiscounted = false;

    // Catalog items carry their own originalPrice when a festival discount
    // applied; only fall back to the flat deskmat maintenance rate for
    // mousepad/fps, which never set originalPrice themselves.
    if (x.originalPrice != null && Number(x.originalPrice) > Number(x.price)) {
      originalPrice = Number(x.originalPrice);
      isDiscounted = true;
      hasFestivalItem = true;
    } else if (KEYCAM_STORE.maintenanceMode && (x.type === 'mousepad' || x.type === 'fps')) {
      originalPrice = x.price / (1 - KEYCAM_STORE.maintenanceDiscount);
      isDiscounted = true;
    }

    totalOriginal += originalPrice * x.qty;
    totalDiscounted += x.price * x.qty;
    if (isDiscounted) {
      totalSavings += (originalPrice - x.price) * x.qty;
    }
  });

  const totalEl = document.querySelector("#orderTotal");
  if(totalEl){
    totalEl.textContent = money(totalDiscounted);
  }

  // Remove existing maintenance note, festival note, and savings summary
  const existingNote = document.querySelector('#orderMaintenanceNote');
  if (existingNote) existingNote.remove();

  const existingFestivalNote = document.querySelector('#orderFestivalNote');
  if (existingFestivalNote) existingFestivalNote.remove();

  const existingSummary = document.querySelector('#orderSavingsSummary');
  if (existingSummary) existingSummary.remove();

  // Two independent discounts can land in the same cart here too: the
  // Deskmat maintenance discount (Mouse Pad/FPS) and a catalog item's
  // Pchum Ben festival discount (carried via x.originalPrice). Figure out
  // which are actually present so the summary/footnote/notes describe
  // reality instead of only ever talking about the Deskmat discount.
  const hasDiscountedDeskmat = KEYCAM_STORE.maintenanceMode && o.some(x => x.type === 'mousepad' || x.type === 'fps');
  const showSummary = (hasDiscountedDeskmat || hasFestivalItem) && o.length > 0;

  if (showSummary) {
    // Get the drawer total container
    const drawerTotal = document.querySelector('.drawer-total');
    
    // Add savings summary (shows original price vs discounted price)
    if (totalSavings > 0) {
      const footnoteBits = [];
      if (hasFestivalItem) {
        const label = (window.CATALOG_DISCOUNT && window.CATALOG_DISCOUNT.label) || "Festival sale";
        footnoteBits.push(`${label} pricing applies to the eligible Keyboard/Accessories/Mouse item(s) above`);
      }
      if (hasDiscountedDeskmat) {
        footnoteBits.push(`${KEYCAM_STORE.maintenanceDiscount * 100}% off applies to Deskmat (Mouse Pad &amp; FPS) only`);
      }

      const summary = document.createElement('div');
      summary.id = 'orderSavingsSummary';
      summary.style.cssText = `
        margin-top: 14px;
        margin-bottom: 16px;
        padding: 14px 16px;
        background: rgba(32,195,223,0.08);
        border: 1px solid rgba(32,195,223,0.15);
        border-radius: 8px;
      `;
      summary.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="color:#8a9a9f;font-size:12px;">Original price</span>
          <span style="color:#7f8b90;font-size:13px;text-decoration:line-through;">${money(totalOriginal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="color:#8a9a9f;font-size:12px;">Discounted price</span>
          <span style="color:#20c3df;font-size:15px;font-weight:700;">${money(totalDiscounted)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
          <span style="color:#8a9a9f;font-size:12px;">💰 You saved</span>
          <span style="color:#4ade80;font-size:15px;font-weight:700;">${money(totalSavings)}</span>
        </div>
        ${footnoteBits.length ? `<div style="margin-top:6px;font-size:10px;color:#7f8b90;text-align:center;">${footnoteBits.join(" · ")}</div>` : ""}
      `;
      
      if (drawerTotal) {
        drawerTotal.after(summary);
      }
    }

    // Festival note - only when a catalog item actually carries the discount
    if (hasFestivalItem) {
      const festivalNote = document.createElement('div');
      festivalNote.id = 'orderFestivalNote';
      festivalNote.style.cssText = `
        margin-top: 0;
        margin-bottom: 16px;
        padding: 10px 16px;
        background: rgba(224,71,90,0.08);
        border-left: 3px solid #e0475a;
        border-radius: 4px;
        font-size: 12px;
        color: #b0c4c8;
        line-height: 1.5;
      `;
      const label = (window.CATALOG_DISCOUNT && window.CATALOG_DISCOUNT.label) || "Pchum Ben Festival Sale";
      festivalNote.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="font-size:14px;line-height:1.4;">🎉</span>
          <span style="line-height:1.45;">
            <strong style="color:#d0d8db;">${label}:</strong>
            the marked-down price on eligible items is already reflected in your total.
          </span>
        </div>
      `;
      const summaryEl = document.querySelector('#orderSavingsSummary');
      const drawerTotal2 = document.querySelector('.drawer-total');
      if (summaryEl) summaryEl.after(festivalNote);
      else if (drawerTotal2) drawerTotal2.after(festivalNote);
    }

    // Add maintenance note - only if order has a discounted deskmat item
    if (hasDiscountedDeskmat) {
      const note = document.createElement('div');
      note.id = 'orderMaintenanceNote';
      note.style.cssText = `
        margin-top: 0;
        margin-bottom: 16px;
        padding: 10px 16px;
        background: rgba(32,195,223,0.06);
        border-left: 3px solid #20c3df;
        border-radius: 4px;
        font-size: 12px;
        color: #b0c4c8;
        line-height: 1.5;
      `;
      note.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="font-size:14px;line-height:1.4;">🔧</span>
          <span style="line-height:1.45;">
            <strong style="color:#d0d8db;">Deskmat only:</strong>
            machine maintenance — Mouse Pad &amp; FPS orders take about
            <strong style="color:#d0d8db;">${KEYCAM_STORE.maintenanceOrderDuration}</strong> to process.
            Keyboards and other catalog items are not affected (see each product page for stock / shipping).
          </span>
        </div>
      `;
      
      // Insert after festival note if present, else savings summary, else total
      const festivalEl = document.querySelector('#orderFestivalNote');
      const summaryEl = document.querySelector('#orderSavingsSummary');
      const drawerTotal = document.querySelector('.drawer-total');
      
      if (festivalEl) {
        festivalEl.after(note);
      } else if (summaryEl) {
        summaryEl.after(note);
      } else if (drawerTotal) {
        drawerTotal.after(note);
      }
    }
  }
}

/* =========================
   CUSTOMER CONTACT (name + phone)
   Injected once into the order drawer, above the total.
   Persisted to localStorage so returning visitors don't retype it.
========================= */
function getStoredCustomer(){try{return JSON.parse(localStorage.getItem("keycamCustomer")||"{}")}catch{return{}}}
function setStoredCustomer(c){localStorage.setItem("keycamCustomer",JSON.stringify(c))}

function ensureOrderContactForm(){
  if(document.querySelector("#orderContact")) return;
  const total = document.querySelector(".drawer-total");
  if(!total) return;

  const saved = getStoredCustomer();
  const wrap = document.createElement("div");
  wrap.className = "order-contact";
  wrap.id = "orderContact";
  wrap.innerHTML = `
    <label>Full name
      <input type="text" id="orderName" placeholder="Your name" autocomplete="name" value="${saved.name ? saved.name.replace(/"/g,'&quot;') : ''}">
    </label>
    <label>Phone number
      <input type="tel" id="orderPhone" placeholder="e.g. 012 345 678" autocomplete="tel" value="${saved.phone ? saved.phone.replace(/"/g,'&quot;') : ''}">
    </label>
    <p class="order-contact-error" id="orderContactError" style="display:none;">Please enter your name and phone number.</p>
  `;
  total.before(wrap);
}

function validateOrderContact(){
  const nameEl = document.querySelector("#orderName");
  const phoneEl = document.querySelector("#orderPhone");
  const errEl = document.querySelector("#orderContactError");
  const name = nameEl?.value.trim() || "";
  const phone = phoneEl?.value.trim() || "";

  nameEl?.classList.toggle("field-error", !name);
  phoneEl?.classList.toggle("field-error", !phone);

  if(!name || !phone){
    if(errEl) errEl.style.display = "block";
    (!name ? nameEl : phoneEl)?.focus();
    return null;
  }
  if(errEl) errEl.style.display = "none";
  setStoredCustomer({ name, phone });
  return { name, phone };
}

async function saveOrderToSupabase(o, total, customer){
  if(!window.KEYCAM_SUPABASE) return;
  try{
    const hasDiscountedDeskmat = !!(KEYCAM_STORE.maintenanceMode && o.some(x => x.type === "mousepad" || x.type === "fps"));
    const { error } = await window.KEYCAM_SUPABASE.from('orders').insert({
      items: o.map(x => ({
        name: x.name,
        type: x.type || null,
        size: x.sizeLabel || x.size || null,
        thickness: x.thickness || null,
        variantSummary: x.variantSummary || null,
        price: x.price,
        // Keep the pre-discount price/percent when a festival discount applied,
        // so the invoice can show how much was knocked off.
        originalPrice: (x.originalPrice != null && Number(x.originalPrice) > Number(x.price)) ? x.originalPrice : undefined,
        discountPercent: x.discountPercent || undefined,
        qty: x.qty
      })),
      total: total,
      maintenance_mode: hasDiscountedDeskmat,
      // Captured at order time so invoices can reconstruct the original price/discount
      // even if the maintenance discount % is changed later in admin.
      maintenance_discount: hasDiscountedDeskmat ? KEYCAM_STORE.maintenanceDiscount : null,
      customer_name: customer.name,
      customer_phone: customer.phone
    });
    if(error) console.error("Order save failed (checkout continues):", error);
  }catch(err){
    console.error("Order save failed (checkout continues):", err);
  }
}

async function telegramOrder(){
  const o=getOrder();
  if(!o.length)return;

  const customer = validateOrderContact();
  if(!customer) return; // missing name/phone — stop and show inline error, don't leave the page

  const total=o.reduce((a,x)=>a+x.price*x.qty,0);
  const lines=o.map((x,i)=>{
    let detail = "";
    if(x.variantSummary){
      detail = x.variantSummary;
    }else if(x.type){
      detail = [typeName(x.type), x.sizeLabel || x.size, x.thickness].filter(Boolean).join(" · ");
    }
    return `${i+1}. ${x.name}${detail ? `\n   ${detail}` : ""}\n   ${money(x.price)} × ${x.qty} = ${money(x.price*x.qty)}`;
  }).join("\n\n");
  
  // Add maintenance note if active (only when cart has deskmat mousepad/fps)
  let maintenanceNote = '';
  if (KEYCAM_STORE.maintenanceMode) {
    const hasDiscounted = o.some(x => x.type === 'mousepad' || x.type === 'fps');
    const hasGlass = o.some(x => x.type === 'glass');
    if (hasDiscounted) {
      maintenanceNote = `\n\n⚠️ Deskmat only: ${KEYCAM_STORE.maintenanceDiscount * 100}% off Mouse Pad & FPS. Processing ~${KEYCAM_STORE.maintenanceOrderDuration}. Keyboards / catalog items are not affected.`;
    } else if (hasGlass) {
      maintenanceNote = `\n\nℹ️ Glass orders are not affected by maintenance. Processing takes ${KEYCAM_STORE.glassOrderDuration}.`;
    }
  }

  // Save to Supabase first — best effort, never blocks the Telegram handoff
  await saveOrderToSupabase(o, total, customer);

  const text=`Hi KeyCam! 👋\n\nName: ${customer.name}\nPhone: ${customer.phone}\n\nI'd like to order:\n\n${lines}\n\nTotal: ${money(total)}${maintenanceNote}\n\nPlease confirm availability and delivery.`;
  location.href=`https://t.me/${KEYCAM.telegram}?text=${encodeURIComponent(text)}`;
}
function closeMegaMenus(){document.querySelectorAll(".mega.open").forEach(x=>x.classList.remove("open"))}
function setupGlobal(){
  applyMaintenanceNotice();
  applyMaintenanceToSizeGuide();
  updateOrderUI();
  document.querySelector("#orderOpen")?.addEventListener("click",openOrder);
  document.querySelector("#footerOrder")?.addEventListener("click",e=>{e.preventDefault();openOrder()});
  document.querySelector("#orderClose")?.addEventListener("click",closeOrder);
  document.querySelector("#drawerBackdrop")?.addEventListener("click",closeOrder);
  document.querySelector("#telegramOrder")?.addEventListener("click",telegramOrder);
  document.querySelector("#clearOrder")?.addEventListener("click",()=>{setOrder([]);renderOrder()});
  document.querySelector("#orderItems")?.addEventListener("click",e=>{const i=e.target.dataset.i;if(i===undefined)return;const o=getOrder();if(e.target.dataset.q){o[i].qty+=Number(e.target.dataset.q);if(o[i].qty<=0)o.splice(i,1);setOrder(o);renderOrder()}if(e.target.classList.contains("remove")){o.splice(Number(i),1);setOrder(o);renderOrder()}});
  // Typed quantity — same reasoning as the catalog cart: for big orders,
  // clicking +1 repeatedly isn't realistic. Commits on change (Enter/blur);
  // invalid or blank input falls back to the item's current quantity.
  document.querySelector("#orderItems")?.addEventListener("change",e=>{
    if(!e.target.matches('input[data-qty-input]')) return;
    const i = Number(e.target.dataset.i);
    const o = getOrder();
    const parsed = Math.floor(Number(e.target.value));
    const next = Number.isFinite(parsed) && parsed >= 1 ? parsed : o[i].qty;
    if(next === o[i].qty){ e.target.value = o[i].qty; return; }
    o[i].qty = next;
    setOrder(o);
    renderOrder();
  });
  document.querySelector("#orderItems")?.addEventListener("keydown",e=>{
    if(e.target.matches('input[data-qty-input]') && e.key === "Enter"){ e.preventDefault(); e.target.blur(); }
  });
  document.querySelector("#searchOpen")?.addEventListener("click",()=>document.querySelector("#searchPanel")?.classList.add("open"));
  document.querySelector("#searchClose")?.addEventListener("click",()=>document.querySelector("#searchPanel")?.classList.remove("open"));
  document.querySelector("#searchInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.value.trim())location.href=`collection.html?q=${encodeURIComponent(e.target.value.trim())}`});
  document.querySelector("#menuOpen")?.addEventListener("click",()=>document.querySelector("#mobileMenu")?.classList.add("open"));
  document.querySelector("#mobileClose")?.addEventListener("click",()=>document.querySelector("#mobileMenu")?.classList.remove("open"));
  document.querySelectorAll(".mobile-expand").forEach(b=>b.addEventListener("click",()=>document.querySelector("#"+b.dataset.target)?.classList.toggle("open")));
  const mc=document.querySelector("#mobileCollections"),mp=document.querySelector("#mobileProducts");
  renderCollectionNav();
  if(mp)mp.innerHTML=`<a href="collection.html?type=mousepad">Mouse Pads</a><a href="collection.html?type=fps">FPS Mouse Pads</a><a href="collection.html?type=glass">Glass Mouse Pads</a>`;
  document.querySelector("#mobileBest")?.addEventListener("click",()=>document.querySelector("#mobileMenu")?.classList.remove("open"));
}

/* =========================
   HERO IMAGE CAROUSEL
   2 images now; add more slides/dots later without changing the core logic.
========================= */
function setupHeroCarousel(){
  const carousel = document.querySelector("#heroCarousel");
  if(!carousel) return;

  const slides = [...carousel.querySelectorAll(".hero-slide")];
  const dotsWrap = carousel.querySelector(".hero-carousel-dots");
  const prev = carousel.querySelector(".hero-carousel-prev");
  const next = carousel.querySelector(".hero-carousel-next");

  if(slides.length < 2 || !dotsWrap) return;

  const dots = slides.map((_, i) => {
    const dot = document.createElement("button");
    dot.className = "hero-dot";
    dot.type = "button";
    dot.setAttribute("aria-label", `Show featured design ${i + 1}`);
    dot.addEventListener("click", () => {
      showSlide(i);
      startAutoSlide();
    });
    dotsWrap.appendChild(dot);
    return dot;
  });

  let current = 0;
  let timer = null;

  function showSlide(index){
    current = (index + slides.length) % slides.length;

    slides.forEach((slide, i) => {
      slide.classList.toggle("active", i === current);
    });

    dots.forEach((dot, i) => {
      const active = i === current;
      dot.classList.toggle("active", active);
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
  }

  function startAutoSlide(){
    clearInterval(timer);
    timer = setInterval(() => {
      showSlide(current + 1);
    }, 3000);
  }

  function goNext(){
    showSlide(current + 1);
    startAutoSlide();
  }

  function goPrev(){
    showSlide(current - 1);
    startAutoSlide();
  }

  next?.addEventListener("click", goNext);
  prev?.addEventListener("click", goPrev);

  showSlide(0);
  startAutoSlide();
}

setupGlobal();
setupHeroCarousel();

function productVisual(p){
  const image = p.thumbnail || p.image;
  const stockBadge = p.inStockReady ? `<span class="pc-badge">Stock Mousepad</span>` : '';

  if(image){
    return `<div class="product-art product-image-art">
      ${stockBadge}
      <img src="${image}" alt="${p.name}" loading="lazy">
    </div>`;
  }

  return `<div class="product-art art-${p.color}">
    ${stockBadge}
    <span>${p.id.toUpperCase()}</span>
    <strong>${p.name}</strong>
    <small>3 TYPES · ORIGINAL DESIGN</small>
    <i></i><i></i><i></i>
  </div>`;
}
function getTypeVariants(p,type="mousepad"){return p.types?.[type]||p.regular}
function cardVariant(p,type="mousepad"){const variants=getTypeVariants(p,type);const ths=Object.keys(variants);const th=ths[0];const sizes=Object.keys(variants[th]);const preferred=type==="mousepad"?"900 × 400 mm":sizes[0];const size=variants[th][preferred]?preferred:sizes[0];const [price,dim]=variants[th][size];return {th,size,price,dim}}
function productCard(p,type="mousepad"){
  const v=cardVariant(p,type);
  return `<a class="product-card" href="product.html?id=${p.id}">${productVisual(p)}<div class="pc-foot"><span>Mouse Pad · FPS · Glass</span><span>View &amp; configure →</span></div></a>`
}           
function renderCollectionGrid(){
  const collectionGrid = document.querySelector("#collectionGrid");
  if (!collectionGrid) return;

  const FEATURED = ["anime-manga", "kawaii-aesthetic", "minimalist-aesthetic"];

  const featured = KEYCAM.homeCollections.filter(c => FEATURED.includes(c[0]));
  const regular = KEYCAM.homeCollections.filter(c => !FEATURED.includes(c[0]));

  featured.sort((a, b) => FEATURED.indexOf(a[0]) - FEATURED.indexOf(b[0]));

  function renderCard(c, isFeatured, index) {
    const id = c[0];
    const name = c[1];
    const thumb = c[2] || "placeholder.jpg";
    const thumbUrl = /^https?:\/\//.test(thumb) ? thumb : `assets/thumbnail/${thumb}`;
    const num = String(index + 1).padStart(2, "0");
    const featuredClass = isFeatured ? "featured" : "";
    return `
      <a class="collection-card ${featuredClass}" href="collection.html?c=${id}" style="background-image: url('${thumbUrl}');">
        <span class="collection-number">${num}</span>
        <h3>${name}</h3>
        <small>Explore designs →</small>
      </a>
    `;
  }

  let html = featured.map((c, i) => renderCard(c, true, i)).join("");
  html += regular.map((c, i) => renderCard(c, false, i + featured.length)).join("");

  collectionGrid.innerHTML = html;
}

function renderCollectionNav(){
  const mc = document.querySelector("#mobileCollections");
  if(mc) mc.innerHTML = KEYCAM.homeCollections.map(x=>`<a href="collection.html?c=${x[0]}">${x[1]}</a>`).join("");

  const col1 = document.querySelector("#megaCol1");
  const col2 = document.querySelector("#megaCol2");
  if(col1 && col2){
    const cols = KEYCAM.homeCollections;
    const mid = Math.ceil(cols.length / 2);
    const link = c => `<a href="collection.html?c=${c[0]}">${c[1]}</a>`;
    col1.innerHTML = `<span class="mega-title">COLLECTIONS</span><a href="collection.html?c=all">All Collections</a>` + cols.slice(0, mid).map(link).join("");
    col2.innerHTML = `<span class="mega-title">&nbsp;</span>` + cols.slice(mid).map(link).join("");
  }
}
const megaCol=document.querySelector(".nav-menu[href='#collections']"),megaProd=document.querySelector(".nav-menu[href='#products']"),cm=document.querySelector("#collectionsMenu"),pm=document.querySelector("#productsMenu");
megaCol?.addEventListener("click",e=>{e.preventDefault();cm?.classList.toggle("open");pm?.classList.remove("open")});megaProd?.addEventListener("click",e=>{e.preventDefault();pm?.classList.toggle("open");cm?.classList.remove("open")});document.addEventListener("click",e=>{if(!e.target.closest(".site-header"))closeMegaMenus()});
window.renderProductCard=productCard;window.productVisual=productVisual;window.collectionName=collectionName;window.typeName=typeName;window.money=money;window.effectivePrice=effectivePrice;window.orderDuration=orderDuration;window.priceRange=priceRange;window.KEYCAM_STORE=KEYCAM_STORE;window.addToOrder=addToOrder;window.getOrder=getOrder;window.getTypeVariants=getTypeVariants;window.cardVariant=cardVariant;

/* =========================
   IMAGE COPY DETERRENTS
   Blocks the easy ways of saving a photo: the right-click / long-press menu,
   dragging the image out of the page, and image selection. This is only a
   deterrent — screenshots and dev tools still work, so a watermark is the
   real protection. (Same snippet lives in shared/layout.js and deskmat/app.js
   because Deskmat and the catalog pages load different shared scripts.)
========================= */
(function(){
  if(window.__kcImageGuard) return;
  window.__kcImageGuard = true;

  const style = document.createElement("style");
  style.textContent =
    "img{-webkit-user-drag:none;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;}" +
    // Card photos sit inside a link that handles the click, so the photo itself
    // doesn't need to receive pointer events (nothing left to long-press/save).
    ".product-card{-webkit-touch-callout:none;}.product-card img{pointer-events:none;}";
  document.head.appendChild(style);

  const onImage = e => e.target && e.target.closest && e.target.closest("img");
  document.addEventListener("contextmenu", e => { if(onImage(e)) e.preventDefault(); });
  document.addEventListener("dragstart",   e => { if(onImage(e)) e.preventDefault(); });
})();
