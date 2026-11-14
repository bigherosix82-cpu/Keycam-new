/* =========================
   RESIN HUB
   The landing page lists collections; the builder lives on
   collection.html?c=<id>. Values come from resin/store.js (Supabase), which
   falls back to resin/logos.js, so the hub and the builder can never disagree.
========================= */

(function(){
  "use strict";

  let PRICES = {};
  let COLLECTIONS = [];
  let COMING_SOON = [];

  const el = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  const price = n => {
    const v = Number(n);
    return "$" + (Number.isInteger(v) ? String(v) : v.toFixed(2));
  };

  /* ---------- price cards ---------- */

  function renderPrices(){
    const box = el("resinPrices");
    if(!box) return;

    const cards = [
      { group: "cherry", kicker: "CHERRY PROFILE", title: "R1, R2, R3, R4", note: "Same price for every row. All Cherry rows count together for 4+." },
      { group: "sa",     kicker: "SA PROFILE",     title: "R1 only",         note: "R2, R3 and R4 are not available." },
      { group: "space",  kicker: "SPACE BAR",      title: "Cherry space bar", note: "Logo optional. Fixed price." }
    ];

    box.innerHTML = cards.map(c => {
      const p = PRICES[c.group];
      if(!p) return "";
      const cells = p.min != null
        ? `<div class="resin-price-cell"><span>1 key</span><b>${price(p.single)}</b></div>
           <div class="resin-price-cell is-tier"><span>${p.min}+ keys</span><b>${price(p.tier)}</b></div>`
        : `<div class="resin-price-cell"><span>Each space bar</span><b>${price(p.single)}</b></div>`;
      return `<article class="resin-price ${c.group}">
        <div class="resin-price-kicker${c.group === "space" ? " neutral" : ""}">${c.kicker}</div>
        <h3 class="resin-price-title">${c.title}</h3>
        <p class="resin-price-note">${c.note}</p>
        <div class="resin-price-row">${cells}</div>
      </article>`;
    }).join("");
  }

  /* ---------- collection cards ---------- */

  function collectionCard(c){
    const designs = Array.isArray(c.designs) ? c.designs : [];
    let art;

    if(c.customOnly){
      art = `<div class="resin-collection-art is-custom" aria-hidden="true">
        <span class="resin-collection-plus">+</span>
        <span class="resin-collection-hint">PNG or JPG · send on Telegram</span>
      </div>`;
    }else{
      const preview = designs.slice(0, 4).map(d =>
        `<span class="resin-collection-tile resin-tile-${d.tile || "light"}"><img src="${d.image || `logos/${d.id}.webp`}" alt="" loading="lazy"></span>`
      ).join("");
      const extra = designs.length - Math.min(designs.length, 4);
      art = `<div class="resin-collection-art" aria-hidden="true">${preview}${
        extra > 0 ? `<span class="resin-collection-more">+${extra}</span>` : ""
      }</div>`;
    }

    const meta = [c.group, c.region].filter(Boolean).join(" · ");
    const count = c.customOnly
      ? "Any team, any game"
      : `${designs.length} ${designs.length === 1 ? "design" : "designs"}`;

    return `<a class="resin-collection-card${c.customOnly ? " is-custom" : ""}" href="collection.html?c=${encodeURIComponent(c.id)}">
      ${art}
      <span class="resin-collection-body">
        <span class="resin-collection-group">${esc(meta.toUpperCase())}</span>
        <span class="resin-collection-name">${esc(c.name)}</span>
        <span class="resin-collection-count">${esc(count)}</span>
        <span class="resin-collection-link">${c.customOnly ? "Send your logo" : "Shop the collection"} →</span>
      </span>
    </a>`;
  }

  function renderCollections(){
    const box = el("resinCollections");
    if(!box) return;
    box.innerHTML = COLLECTIONS.map(collectionCard).join("");
  }

  function renderComingSoon(){
    const box = el("resinComingSoon");
    if(!box) return;
    box.innerHTML = COMING_SOON.map(name => `<span class="resin-soon-chip">${esc(name)}</span>`).join("");
  }

  /* ---------- init ---------- */

  async function init(){
    initLayout({ base: "../", active: "resin" });

    if(window.ResinStore) await window.ResinStore.ready();
    PRICES = window.RESIN_PRICES || {};
    COLLECTIONS = window.RESIN_COLLECTIONS || [];
    COMING_SOON = window.RESIN_COMING_SOON || [];

    // Prices may have changed since a cart line was saved. Re-run the
    // shared repair so the drawer matches the page.
    const stored = getCatalogOrder();
    if(stored.some(x => x && x.resin)) setCatalogOrder(stored);

    renderPrices();
    renderCollections();
    renderComingSoon();
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})();
