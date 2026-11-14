/* =========================
   UNIFIED CART (Keyboard / Accessories / Mouse / Deskmat)
   One shared localStorage key: "keycamOrder".
   Deskmat items and catalog items live in the same cart so customers
   can mix desk mats with keyboards/accessories/mice in a single order.

   Migrates any leftover "keycamCatalogOrder" into "keycamOrder" once.
   Customer name/phone stays in "keycamCustomer" (shared with Deskmat).

   Order drawer UI matches the Deskmat drawer: per-line discount, savings
   summary, and deskmat-only maintenance note.
========================= */

const UNIFIED_ORDER_KEY = "keycamOrder";
const LEGACY_CATALOG_KEY = "keycamCatalogOrder";

function getStoredCatalogCustomer(){
  try{ return JSON.parse(localStorage.getItem("keycamCustomer") || "{}"); }
  catch{ return {}; }
}
function setStoredCatalogCustomer(c){
  localStorage.setItem("keycamCustomer", JSON.stringify(c));
}

function validateCatalogOrderContact(){
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
  setStoredCatalogCustomer({ name, phone });
  return { name, phone };
}

function isDeskmatPricedItem(x){
  return !!(x && (x.type === "mousepad" || x.type === "fps" || x.type === "glass"));
}

function itemLineSummary(x){
  if(x.variantSummary) return x.variantSummary;
  const parts = [];
  if(x.type === "mousepad") parts.push("Mouse Pad");
  else if(x.type === "fps") parts.push("FPS Mouse Pad");
  else if(x.type === "glass") parts.push("Glass Mouse Pad");
  else if(x.type) parts.push(x.type);
  if(x.sizeLabel) parts.push(x.sizeLabel);
  else if(x.size) parts.push(x.size);
  if(x.thickness) parts.push(x.thickness);
  return parts.join(" · ");
}

function moneyFmt(n){
  if(typeof money2 === "function") return money2(n);
  return `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;
}

/* =========================
   RESIN KEYCAP PRICING
   Resin is priced per profile, not per line: 4+ Cherry keys in the cart
   means every Cherry key drops to the tier price, no matter how the
   customer split the designs or which page they edited the quantity on.
   Kept here (rather than only in resin/logos.js) so the order drawer can
   re-price correctly from any page — resin/logos.js loads only on the
   resin page. ensureStoreSettings() pulls store_settings.resin_prices on
   every catalog page, and saved cart lines keep the prices they were added
   with, so an admin price change is never reverted to these defaults.
========================= */

const RESIN_PRICE_FALLBACK = {
  cherry: { single: 3, tier: 2.5, min: 4 },
  sa:     { single: 5, tier: 4,   min: 4 },
  space:  { single: 10, tier: 10, min: null }
};

function repairResinPricing(items){
  if(!Array.isArray(items)) return items;

  let table = window.RESIN_PRICES;

  // Pages that don't load resin/logos.js still know the price each line was
  // added at. Use the first saved line per profile before falling back to
  // the hardcoded defaults.
  if(!table){
    const stored = {};
    items.forEach(x => {
      const r = x && x.resin;
      if(!r || !r.group || stored[r.group]) return;
      if(r.single == null || r.tier == null) return;
      stored[r.group] = {
        single: Number(r.single),
        tier: Number(r.tier),
        min: (r.min == null || r.min === "") ? null : Number(r.min)
      };
    });
    table = { ...RESIN_PRICE_FALLBACK, ...stored };
  }

  const counts = {};
  items.forEach(x => {
    if(!x || !x.resin || !x.resin.group) return;
    counts[x.resin.group] = (counts[x.resin.group] || 0) + (Number(x.qty) || 0);
  });

  items.forEach(x => {
    if(!x || !x.resin || !x.resin.group) return;
    const price = table[x.resin.group];
    if(!price) return;
    const count = counts[x.resin.group] || 0;
    const useTier = price.min != null && count >= price.min;
    x.price = useTier ? Number(price.tier) : Number(price.single);
    x.resin.single = Number(price.single);
    x.resin.tier = Number(price.tier);
    x.resin.min = price.min;
  });

  return items;
}

/** Load maintenance settings on catalog pages (deskmat app.js isn't loaded there). */
async function ensureStoreSettings(){
  if(window.KEYCAM_STORE && typeof window.KEYCAM_STORE.maintenanceMode === "boolean"){
    return window.KEYCAM_STORE;
  }
  window.KEYCAM_STORE = window.KEYCAM_STORE || {
    maintenanceMode: true,
    maintenanceDiscount: 0.20,
    maintenanceOrderDuration: "10 days",
    glassOrderDuration: "10 days"
  };
  if(!window.KEYCAM_SUPABASE) return window.KEYCAM_STORE;
  try{
    const { data } = await window.KEYCAM_SUPABASE
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if(data){
      window.KEYCAM_STORE.maintenanceMode = !!data.maintenance_mode;
      if(data.maintenance_discount != null){
        window.KEYCAM_STORE.maintenanceDiscount = Number(data.maintenance_discount);
      }
      // Resin pages set the merged table themselves; every other page only
      // needs the numbers for repairResinPricing().
      if(!window.RESIN_PRICES && data.resin_prices && typeof data.resin_prices === "object"){
        window.RESIN_PRICES = data.resin_prices;
      }
    }
  }catch(e){
    console.warn("store_settings load skipped:", e);
  }
  return window.KEYCAM_STORE;
}

function mapItemsForSupabase(items){
  return items.map(x => {
    if(isDeskmatPricedItem(x) || x.type){
      return {
        name: x.name,
        type: x.type || null,
        size: x.sizeLabel || x.size || null,
        thickness: x.thickness || null,
        variantSummary: x.variantSummary || null,
        price: x.price,
        originalPrice: (x.originalPrice != null && Number(x.originalPrice) > Number(x.price)) ? x.originalPrice : undefined,
        discountPercent: x.discountPercent || undefined,
        qty: x.qty
      };
    }
    return {
      name: x.name,
      variantSummary: x.variantSummary || null,
      price: x.price,
      // Present only when a Pchum Ben festival discount applied at the
      // moment this item was added — lets the invoice/order record show
      // what was actually knocked off, same idea as Deskmat's
      // maintenance_discount field below but per-line since the % can
      // differ by product.
      originalPrice: x.originalPrice != null ? x.originalPrice : undefined,
      discountPercent: x.discountPercent || undefined,
      qty: x.qty
    };
  });
}

async function saveCatalogOrderToSupabase(items, total, customer){
  if(!window.KEYCAM_SUPABASE) return;
  try{
    const store = await ensureStoreSettings();
    const hasDiscountedDeskmat = !!(store.maintenanceMode && items.some(x =>
      x.type === "mousepad" || x.type === "fps"
    ));

    const { error } = await window.KEYCAM_SUPABASE.from("orders").insert({
      items: mapItemsForSupabase(items),
      total: total,
      maintenance_mode: hasDiscountedDeskmat,
      maintenance_discount: hasDiscountedDeskmat ? store.maintenanceDiscount : null,
      customer_name: customer.name,
      customer_phone: customer.phone
    });
    if(error) console.error("Order save failed (checkout continues):", error);
  }catch(err){
    console.error("Order save failed (checkout continues):", err);
  }
}

function migrateLegacyCatalogOrder(){
  try{
    const legacyRaw = localStorage.getItem(LEGACY_CATALOG_KEY);
    if(!legacyRaw) return;
    const legacy = JSON.parse(legacyRaw);
    if(!Array.isArray(legacy) || !legacy.length){
      localStorage.removeItem(LEGACY_CATALOG_KEY);
      return;
    }
    const current = JSON.parse(localStorage.getItem(UNIFIED_ORDER_KEY) || "[]");
    const keys = new Set(current.map(x => x.key));
    legacy.forEach(item => {
      if(item && item.key && !keys.has(item.key)){
        current.push(item);
        keys.add(item.key);
      }else if(item && item.key && keys.has(item.key)){
        const existing = current.find(x => x.key === item.key);
        if(existing) existing.qty = (existing.qty || 1) + (item.qty || 1);
      }
    });
    localStorage.setItem(UNIFIED_ORDER_KEY, JSON.stringify(current));
    localStorage.removeItem(LEGACY_CATALOG_KEY);
  }catch(e){
    console.warn("Catalog order migration skipped:", e);
  }
}

function getCatalogOrder(){
  migrateLegacyCatalogOrder();
  try{ return JSON.parse(localStorage.getItem(UNIFIED_ORDER_KEY) || "[]"); }
  catch{ return []; }
}
function setCatalogOrder(o){
  repairResinPricing(o);
  localStorage.setItem(UNIFIED_ORDER_KEY, JSON.stringify(o));
  updateCatalogOrderUI();
}
function updateCatalogOrderUI(){
  const o = getCatalogOrder();
  const count = o.reduce((a,x)=>a + (Number(x.qty) || 0), 0);
  document.querySelectorAll("#orderCount").forEach(e => e.textContent = count);
}

function addToCatalogOrder(item){
  const o = getCatalogOrder();
  const found = o.find(x => x.key === item.key);
  if(found) found.qty++;
  else o.push({...item, qty: 1});
  setCatalogOrder(o);
  openCatalogOrder();
}

function openCatalogOrder(){
  document.querySelector("#orderDrawer")?.classList.add("open");
  document.querySelector("#drawerBackdrop")?.classList.add("open");
  document.body.classList.add("modal-open");
  renderCatalogOrder();
}
function closeCatalogOrder(){
  document.querySelector("#orderDrawer")?.classList.remove("open");
  document.querySelector("#drawerBackdrop")?.classList.remove("open");
  document.body.classList.remove("modal-open");
}

function lineDiscountInfo(x, store){
  // Catalog (Keyboard/Accessories/Mouse) items carry their own original
  // price at the moment they're added to the cart — the Pchum Ben
  // festival % can differ per product (site default or a per-product
  // override), so unlike Deskmat's flat maintenance rate there's no
  // single global number to reconstruct the original price from later.
  if(x.originalPrice != null && Number(x.originalPrice) > Number(x.price)){
    const savings = (Number(x.originalPrice) - Number(x.price)) * (Number(x.qty) || 1);
    return { originalPrice: Number(x.originalPrice), isDiscounted: true, savings, kind: "festival" };
  }

  // Deskmat mousepad/fps store the already-discounted price when added.
  const canDiscount = store.maintenanceMode && (x.type === "mousepad" || x.type === "fps");
  if(!canDiscount){
    return { originalPrice: x.price, isDiscounted: false, savings: 0, kind: null };
  }
  const rate = Number(store.maintenanceDiscount) || 0;
  const originalPrice = rate > 0 && rate < 1 ? x.price / (1 - rate) : x.price;
  const savings = (originalPrice - x.price) * (Number(x.qty) || 1);
  return { originalPrice, isDiscounted: true, savings, kind: "maintenance" };
}

function renderCatalogOrder(){
  const box = document.querySelector("#orderItems");
  if(!box) return;

  // Ensure settings, then paint (async-safe: first paint uses defaults, then refresh)
  const storePromise = ensureStoreSettings();

  const paint = (store) => {
    const o = getCatalogOrder();

    // Clear previous summary / note (they sit outside #orderItems)
    document.querySelector("#orderSavingsSummary")?.remove();
    document.querySelector("#orderMaintenanceNote")?.remove();
    document.querySelector("#orderFestivalNote")?.remove();

    if(!o.length){
      box.innerHTML = `<div class="empty-order"><strong>Your order is empty.</strong><span>Add items while you browse.</span></div>`;
      const totalEl = document.querySelector("#orderTotal");
      if(totalEl) totalEl.textContent = moneyFmt(0);
      return;
    }

    box.innerHTML = o.map((x, i) => {
      const image = x.image || "";
      const summary = itemLineSummary(x);
      const { originalPrice, isDiscounted, savings } = lineDiscountInfo(x, store);

      let detailHtml = "";
      if(x.variantSummary){
        detailHtml = `<span>${x.variantSummary}</span>`;
      }else if(x.type){
        const typeLabel = x.type === "mousepad" ? "Mouse Pad"
          : x.type === "fps" ? "FPS Mouse Pad"
          : x.type === "glass" ? "Glass Mouse Pad"
          : x.type;
        detailHtml = `<span>${typeLabel}</span><span>${[x.sizeLabel || x.size, x.thickness].filter(Boolean).join(" · ")}</span>`;
      }else if(summary){
        detailHtml = `<span>${summary}</span>`;
      }

      return `
      <div class="order-item">
        <div class="order-item-image">
          ${image ? `<img src="${image}" alt="${x.name}" loading="lazy">` : `<div class="order-item-image-empty">No image</div>`}
        </div>
        <div class="order-item-info">
          <div class="order-item-top">
            <strong>${x.name}</strong>
            <div style="text-align:right;">
              ${isDiscounted ? `
                <div style="font-size:11px;color:#7f8b90;text-decoration:line-through;">${moneyFmt(originalPrice)}</div>
                <b style="color:#20c3df;font-size:15px;">${moneyFmt(x.price)}</b>
              ` : `
                <b style="font-size:15px;">${moneyFmt(x.price)}</b>
              `}
            </div>
          </div>
          ${detailHtml}
          ${isDiscounted ? `
            <div style="margin-top:4px;font-size:10px;color:#7f8b90;">
              Saved ${moneyFmt(savings)} on this item
            </div>
          ` : ""}
          <div class="qty">
            <button data-i="${i}" data-q="-1" aria-label="Decrease quantity" ${x.qty<=1?'disabled style="opacity:0.3;cursor:not-allowed;"':''}>−</button>
            <input type="number" min="1" step="1" value="${x.qty}" data-i="${i}" data-qty-input="1" aria-label="Quantity" inputmode="numeric">
            <button data-i="${i}" data-q="1" aria-label="Increase quantity">+</button>
            <button class="remove" data-i="${i}" data-remove="1" aria-label="Remove item">×</button>
          </div>
        </div>
      </div>`;
    }).join("");

    let totalOriginal = 0;
    let totalDiscounted = 0;
    let totalSavings = 0;
    o.forEach(x => {
      const { originalPrice, isDiscounted } = lineDiscountInfo(x, store);
      totalOriginal += originalPrice * (Number(x.qty) || 0);
      totalDiscounted += x.price * (Number(x.qty) || 0);
      if(isDiscounted) totalSavings += (originalPrice - x.price) * (Number(x.qty) || 0);
    });

    const totalEl = document.querySelector("#orderTotal");
    if(totalEl) totalEl.textContent = moneyFmt(totalDiscounted);

    // Two independent discounts can land in the same cart: Deskmat's
    // flat maintenance discount (Mouse Pad/FPS only) and the Pchum Ben
    // festival discount (Keyboard/Accessories/Mouse catalog items,
    // percent can vary per product). Figure out which one(s) are
    // actually present so the footnote/notes below describe reality
    // instead of assuming it's always the Deskmat one.
    const lineInfos = o.map(x => lineDiscountInfo(x, store));
    const hasMaintenance = lineInfos.some(d => d.isDiscounted && d.kind === "maintenance");
    const hasFestival = lineInfos.some(d => d.isDiscounted && d.kind === "festival");
    const drawerTotal = document.querySelector(".drawer-total");

    if(totalSavings > 0 && o.length > 0){
      const summary = document.createElement("div");
      summary.id = "orderSavingsSummary";
      summary.style.cssText = `
        margin-top: 14px;
        margin-bottom: 16px;
        padding: 14px 16px;
        background: rgba(32,195,223,0.08);
        border: 1px solid rgba(32,195,223,0.15);
        border-radius: 8px;
      `;
      const footnoteBits = [];
      if(hasFestival){
        const label = (window.CATALOG_DISCOUNT && window.CATALOG_DISCOUNT.label) || "Festival sale";
        footnoteBits.push(`${label} pricing applies to the eligible Keyboard/Accessories/Mouse item(s) above`);
      }
      if(hasMaintenance){
        footnoteBits.push(`${Math.round((store.maintenanceDiscount || 0) * 100)}% off applies to Deskmat (Mouse Pad &amp; FPS) only`);
      }
      summary.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="color:#8a9a9f;font-size:12px;">Original price</span>
          <span style="color:#7f8b90;font-size:13px;text-decoration:line-through;">${moneyFmt(totalOriginal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="color:#8a9a9f;font-size:12px;">Discounted price</span>
          <span style="color:#20c3df;font-size:15px;font-weight:700;">${moneyFmt(totalDiscounted)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:8px;border-top:1px solid rgba(255,255,255,0.06);">
          <span style="color:#8a9a9f;font-size:12px;">💰 You saved</span>
          <span style="color:#4ade80;font-size:15px;font-weight:700;">${moneyFmt(totalSavings)}</span>
        </div>
        ${footnoteBits.length ? `<div style="margin-top:6px;font-size:10px;color:#7f8b90;text-align:center;">${footnoteBits.join(" · ")}</div>` : ""}
      `;
      if(drawerTotal) drawerTotal.after(summary);
    }

    if(hasFestival){
      const note = document.createElement("div");
      note.id = "orderFestivalNote";
      note.style.cssText = `
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
      note.innerHTML = `
        <div style="display:flex;align-items:flex-start;gap:8px;">
          <span style="font-size:14px;line-height:1.4;">🎉</span>
          <span style="line-height:1.45;">
            <strong style="color:#d0d8db;">${label}:</strong>
            the marked-down price on eligible items is already reflected in your total.
          </span>
        </div>
      `;
      const afterEl = document.querySelector("#orderSavingsSummary") || drawerTotal;
      if(afterEl) afterEl.after(note);
    }

    if(hasMaintenance){
      const note = document.createElement("div");
      note.id = "orderMaintenanceNote";
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
            <strong style="color:#d0d8db;">${store.maintenanceOrderDuration || "10 days"}</strong> to process.
            Keyboards and other catalog items are not affected (see each product page for stock / shipping).
          </span>
        </div>
      `;
      const afterEl = document.querySelector("#orderFestivalNote") || document.querySelector("#orderSavingsSummary") || drawerTotal;
      if(afterEl) afterEl.after(note);
    }

    box.querySelectorAll("button[data-i]").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.i);
        const o2 = getCatalogOrder();
        if(btn.dataset.remove){
          o2.splice(i, 1);
        }else{
          const d = Number(btn.dataset.q);
          o2[i].qty += d;
          if(o2[i].qty <= 0) o2.splice(i, 1);
        }
        setCatalogOrder(o2);
        renderCatalogOrder();
      });
    });

    // Typed quantity — for big orders, clicking +1 twenty times isn't
    // realistic. Commits on Enter or on leaving the field; invalid/blank
    // input just falls back to the item's current quantity instead of
    // erroring, since this is easy to mistype while adjusting.
    box.querySelectorAll("input[data-qty-input]").forEach(input => {
      const commit = () => {
        const i = Number(input.dataset.i);
        const o2 = getCatalogOrder();
        const parsed = Math.floor(Number(input.value));
        const next = Number.isFinite(parsed) && parsed >= 1 ? parsed : o2[i].qty;
        if(next === o2[i].qty){
          input.value = o2[i].qty; // re-sync display if the typed value was rejected
          return;
        }
        o2[i].qty = next;
        setCatalogOrder(o2);
        renderCatalogOrder();
      };
      input.addEventListener("change", commit);
      input.addEventListener("keydown", (e) => {
        if(e.key === "Enter"){ e.preventDefault(); input.blur(); }
      });
    });
  };

  // Paint immediately with whatever we have, then refresh if settings load
  const cached = window.KEYCAM_STORE || {
    maintenanceMode: true,
    maintenanceDiscount: 0.20,
    maintenanceOrderDuration: "10 days"
  };
  paint(cached);
  storePromise.then(store => {
    // Re-paint only if values differ from what we used
    if(store !== cached) paint(store);
  });
}

function catalogTelegramMessage(customer){
  const o = getCatalogOrder();
  if(!o.length) return "Hi KeyCam, I'd like to order:\n(no items yet)";
  const lines = o.map((x, i) => {
    const summary = itemLineSummary(x);
    return `${i + 1}. ${x.name}${summary ? `\n   ${summary}` : ""}\n   ${moneyFmt(x.price)} × ${x.qty} = ${moneyFmt(x.price * x.qty)}`;
  });
  const total = o.reduce((a,x)=>a + x.price*x.qty, 0);
  const contact = customer ? `Name: ${customer.name}\nPhone: ${customer.phone}\n\n` : "";

  const store = window.KEYCAM_STORE || {};
  let maintenanceNote = "";
  if(store.maintenanceMode && o.some(x => x.type === "mousepad" || x.type === "fps")){
    maintenanceNote = `\n\n⚠️ Deskmat only: ${Math.round((store.maintenanceDiscount || 0) * 100)}% off Mouse Pad & FPS. Processing ~${store.maintenanceOrderDuration || "10 days"}. Keyboards / catalog items are not affected.`;
  }

  let festivalNote = "";
  if(o.some(x => x.originalPrice != null && Number(x.originalPrice) > Number(x.price))){
    const label = (window.CATALOG_DISCOUNT && window.CATALOG_DISCOUNT.label) || "Pchum Ben Festival Sale";
    festivalNote = `\n\n🎉 ${label}: discounted prices above are already applied.`;
  }

  // Resin is made to order and a customer's own logo never reaches the
  // website — the file comes through this chat, so the message asks for it.
  let resinNote = "";
  const resinItems = o.filter(x => x && x.resin);
  if(resinItems.length){
    resinNote = `\n\n🧪 Resin keycaps are made to order — ready in 2–3 days.`;
    if(resinItems.some(x => x.resin.custom)){
      resinNote += `\n📎 Your own logo: please attach the file in this chat (PNG with transparent background, 1000px or larger).`;
    }
  }

  return `Hi KeyCam! 👋\n\n${contact}I'd like to order:\n\n${lines.join("\n\n")}\n\nTotal: ${moneyFmt(total)}${festivalNote}${resinNote}${maintenanceNote}\n\nPlease confirm availability and delivery.`;
}

function prefillCatalogOrderContact(){
  const saved = getStoredCatalogCustomer();
  const nameEl = document.querySelector("#orderName");
  const phoneEl = document.querySelector("#orderPhone");
  if(nameEl && saved.name) nameEl.value = saved.name;
  if(phoneEl && saved.phone) phoneEl.value = saved.phone;
}

function wireCatalogCartEvents(){
  document.querySelectorAll("#orderOpen").forEach(b => b.addEventListener("click", openCatalogOrder));
  document.querySelector("#footerOrder")?.addEventListener("click", e => { e.preventDefault(); openCatalogOrder(); });
  document.querySelector("#orderClose")?.addEventListener("click", closeCatalogOrder);
  document.querySelector("#drawerBackdrop")?.addEventListener("click", closeCatalogOrder);
  document.querySelector("#clearOrder")?.addEventListener("click", () => { setCatalogOrder([]); renderCatalogOrder(); });
  document.querySelector("#telegramOrder")?.addEventListener("click", async () => {
    const o = getCatalogOrder();
    if(!o.length) return;

    const customer = validateCatalogOrderContact();
    if(!customer) return;

    const total = o.reduce((a,x)=>a + x.price*x.qty, 0);

    await saveCatalogOrderToSupabase(o, total, customer);

    const msg = encodeURIComponent(catalogTelegramMessage(customer));
    window.open(`https://t.me/Key_Cam?text=${msg}`, "_blank");
  });
  prefillCatalogOrderContact();
  updateCatalogOrderUI();
  ensureStoreSettings();
}
