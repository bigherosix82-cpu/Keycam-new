/* =========================
   RESIN COLLECTION BUILDER
   One page per collection (collection.html?c=<id>). Tabs pick the
   profile, row chips pick the Cherry row, and every design keeps its own
   quantity per row.

   Cart: one line per design + row, keyed
   "resin|group|row|design". repairResinPricing() in shared/catalog-cart.js
   still groups by profile, so all Cherry rows count together for the 4+
   price no matter how the order was split.
========================= */

(function(){
  "use strict";

  let PRICES = window.RESIN_PRICES || {};
  let COLLECTIONS = window.RESIN_COLLECTIONS || [];
  const GROUP_ORDER = ["cherry", "sa", "space"];
  const ROWS = { cherry: ["R1", "R2", "R3", "R4"], sa: ["R1"], space: [""] };
  const ROLE_ORDER = ["Duelist", "Initiator", "Controller", "Sentinel"];
  // The ability icons briefly shipped as four role collections; keep old
  // links working by pointing them at the single collection.
  const RETIRED_COLLECTIONS = {
    "val-duelists": "valorant-abilities",
    "val-initiators": "valorant-abilities",
    "val-controllers": "valorant-abilities",
    "val-sentinels": "valorant-abilities"
  };
  const CUSTOM_ID = "custom";
  const CUSTOM_NAME = "Your own logo";

  let requested = "";
  let collection = COLLECTIONS.find(c => c.id === requested) || null;

  let activeGroup = "cherry";
  const rowByGroup = { cherry: "R1", sa: "R1", space: "" };
  const state = { cherry: {}, sa: {}, space: {} }; // state[group][row][designId]
  let search = "";
  let activeRole = "";

  const el = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
  const money = n => "$" + Number(n).toFixed(2);
  const price = n => {
    const v = Number(n);
    return "$" + (Number.isInteger(v) ? String(v) : v.toFixed(2));
  };

  /* ---------- helpers ---------- */

  function rowState(group, row){
    if(!state[group][row]) state[group][row] = {};
    return state[group][row];
  }

  function qty(group, row, id){
    return (state[group][row] && state[group][row][id]) || 0;
  }

  function rowQty(group, row){
    return Object.values(state[group][row] || {}).reduce((a, n) => a + n, 0);
  }

  function groupQty(group){
    return ROWS[group].reduce((a, row) => a + rowQty(group, row), 0);
  }

  function designQty(group, id){
    return ROWS[group].reduce((a, row) => a + qty(group, row, id), 0);
  }

  function unitPrice(group){
    const p = PRICES[group];
    if(!p) return 0;
    const count = groupQty(group);
    const useTier = p.min != null && count >= p.min;
    return Number(useTier ? p.tier : p.single);
  }

  function activeRow(){
    return rowByGroup[activeGroup] || ROWS[activeGroup][0];
  }

  function allDesigns(){
    const ready = (collection && Array.isArray(collection.designs) ? collection.designs : [])
      .map(d => ({ ...d, custom: false }));
    const custom = { id: CUSTOM_ID, name: CUSTOM_NAME, custom: true, tile: "light" };
    if(collection && collection.customOnly) return [custom];
    return ready.concat([custom]);
  }

  function designName(id){
    const d = allDesigns().find(x => x.id === id);
    return d ? d.name : id;
  }

  /* ---------- page header ---------- */

  function renderHead(){
    if(!collection) return;

    document.title = `${collection.name} — Resin Keycaps · KeyCam`;

    const crumb = el("resinCrumbName");
    if(crumb) crumb.textContent = collection.customOnly ? "Your own logo" : collection.name;

    const kicker = el("resinCollectionKicker");
    if(kicker){
      const meta = [collection.group, collection.region].filter(Boolean).join(" · ");
      kicker.textContent = (meta || "COLLECTION").toUpperCase();
    }

    const title = el("resinCollectionTitle");
    if(title) title.textContent = collection.name;

    const blurb = el("resinCollectionBlurb");
    if(blurb) blurb.textContent = collection.blurb || "";

    const facts = el("resinCollectionFacts");
    if(facts){
      const count = collection.customOnly
        ? "Any team or game"
        : `${(collection.designs || []).length} designs ready`;
      facts.innerHTML = [
        count,
        "Made to order · 2–3 days",
        "Cherry R1–R4 · SA R1 · Space bar",
        "4+ keys of a profile cost less"
      ].map(t => `<span class="resin-fact">${esc(t)}</span>`).join("");
    }

    const note = el("resinCustomNote");
    if(note) note.hidden = !collection.customOnly;

    if(collection.customOnly){
      const searchEl = el("resinSearch");
      if(searchEl) searchEl.hidden = true;
      const grid = el("resinGrid");
      if(grid) grid.classList.add("is-single");
    }
  }

  /* ---------- compact price bar ---------- */

  function renderPriceBar(){
    const box = el("resinPriceBar");
    if(!box) return;

    const parts = GROUP_ORDER.map(g => {
      const p = PRICES[g];
      if(!p) return "";
      if(p.min == null){
        return `<span><b>${esc(p.short)}</b> ${price(p.single)} fixed</span>`;
      }
      return `<span><b>${esc(p.short)}</b> ${price(p.single)} → <i>${price(p.tier)}</i> at ${p.min}+</span>`;
    }).filter(Boolean);

    box.innerHTML = parts.join('<span class="resin-pricebar-sep" aria-hidden="true">·</span>');
  }

  /* ---------- tabs ---------- */

  function renderTabs(){
    const box = el("resinTabs");
    if(!box) return;
    box.innerHTML = GROUP_ORDER.map(g => {
      const p = PRICES[g];
      if(!p) return "";
      const on = g === activeGroup;
      return `<button class="resin-tab${on ? " is-active" : ""}" type="button" data-profile="${g}" aria-pressed="${on}">${p.label}</button>`;
    }).join("");
  }

  /* ---------- row chips ---------- */

  function renderRows(){
    const box = el("resinRows");
    const chips = el("resinRowChips");
    if(!box || !chips) return;

    // Only Cherry has a real choice of rows; SA is R1 only and the space
    // bar has no row at all.
    box.hidden = activeGroup !== "cherry";

    const row = activeRow();
    chips.innerHTML = ROWS.cherry.map(r => {
      const on = r === row;
      const n = rowQty("cherry", r);
      return `<button class="resin-row-chip${on ? " is-active" : ""}" type="button" data-row="${r}" aria-pressed="${on}">${r}<b>${n || 0}</b></button>`;
    }).join("");
  }

  /* ---------- role chips ---------- */

  function roleCounts(designs){
    const counts = {};
    designs.forEach(d => {
      if(!d.custom && d.role) counts[d.role] = (counts[d.role] || 0) + 1;
    });
    return ROLE_ORDER.filter(r => counts[r]).map(r => ({ role: r, count: counts[r] }));
  }

  function renderRoles(){
    const box = el("resinRoles");
    const chips = el("resinRoleChips");
    if(!box || !chips) return;

    const roles = collection && !collection.customOnly ? roleCounts(collection.designs || []) : [];
    box.hidden = roles.length === 0;
    if(!roles.length) return;

    if(activeRole && !roles.some(r => r.role === activeRole)) activeRole = "";

    const total = roles.reduce((n, r) => n + r.count, 0);
    const items = [{ role: "", label: "All abilities", count: total }].concat(
      roles.map(r => ({ role: r.role, label: r.role, count: r.count }))
    );

    chips.innerHTML = items.map(it => {
      const on = it.role === activeRole;
      return `<button class="resin-row-chip${on ? " is-active" : ""}" type="button" data-role="${esc(it.role)}" aria-pressed="${on}">${esc(it.label)}<b>${it.count}</b></button>`;
    }).join("");
  }

  /* ---------- logo grid ---------- */

  function setButton(id){
    const full = ROWS.cherry.every(r => qty("cherry", r, id) > 0);
    return `<button class="resin-set" type="button" data-set="${id}"${full ? " disabled" : ""} title="Add one key in each Cherry row">${full ? "R1–R4 set" : "Set R1–R4"}</button>`;
  }

  function renderGrid(){
    const grid = el("resinGrid");
    if(!grid) return;

    if(!collection){
      grid.innerHTML = `<div class="resin-empty">Collection not found. <a href="index.html#collections">See all collections</a>.</div>`;
      return;
    }

    const q = search.trim().toLowerCase();
    const row = activeRow();
    const designs = allDesigns();
    // Ability collections get a fixed 4-across grid (one agent kit per row).
    grid.classList.toggle("is-agent-grid", roleCounts(designs).length > 0);
    // Role filter hides the "your own logo" card so each row stays exactly one
    // agent's four abilities.
    const scoped = activeRole ? designs.filter(d => !d.custom && d.role === activeRole) : designs;
    const visible = scoped.filter(d => !q || d.name.toLowerCase().includes(q));

    const count = el("resinCount");
    if(count){
      if(collection.customOnly){
        count.textContent = "Pick a profile and row, then add your keys";
      }else if(q){
        count.textContent = `${visible.length} of ${scoped.length} designs`;
      }else if(activeRole){
        count.textContent = `${scoped.length} ${activeRole.toLowerCase()} abilities`;
      }else{
        count.textContent = `${designs.length - 1} designs + your own logo`;
      }
    }

    if(!visible.length){
      grid.innerHTML = `<div class="resin-empty">No designs match “${esc(search.trim())}”.</div>`;
      return;
    }

    grid.innerHTML = visible.map(d => {
      const n = qty(activeGroup, row, d.id);
      const other = activeGroup === "cherry" ? designQty("cherry", d.id) - n : 0;
      const art = d.custom
        ? `<span class="resin-logo-art"><span class="plus">+</span><span class="hint">Send your file on Telegram</span></span>`
        : `<span class="resin-logo-art resin-tile-${d.tile || "light"}"><img src="${d.image || `logos/${d.id}.webp`}" alt="${esc(d.name)} logo" loading="lazy"></span>`;

      const rowLabel = row ? ` (${row})` : "";

      return `<article class="resin-logo${d.custom ? " resin-logo-custom" : ""}${n ? " is-picked" : ""}" data-id="${d.id}">
        <button class="resin-logo-hit" type="button" data-pick="${d.id}" aria-label="Add ${esc(d.name)}${rowLabel}">
          ${art}
          <span class="resin-logo-name">${esc(d.name)}</span>
        </button>
        <span class="resin-qty-chip" aria-hidden="true">${n}</span>
        ${other > 0 ? `<span class="resin-other-row" title="${other} ${other === 1 ? "key" : "keys"} in other rows">+${other}</span>` : ""}
        <div class="resin-stepper">
          <button type="button" data-minus="${d.id}" aria-label="Remove one ${esc(d.name)}${rowLabel}">−</button>
          <span class="q">${n || 1}</span>
          <button type="button" data-plus="${d.id}" aria-label="Add one ${esc(d.name)}${rowLabel}">+</button>
        </div>
        ${activeGroup === "cherry" ? setButton(d.id) : ""}
      </article>`;
    }).join("");
  }

  /* ---------- in-place card update ---------- */

  function updateCard(id){
    const grid = el("resinGrid");
    const card = grid && grid.querySelector(`[data-id="${id}"]`);
    if(!card) return;

    const n = qty(activeGroup, activeRow(), id);
    card.classList.toggle("is-picked", n > 0);

    const chip = card.querySelector(".resin-qty-chip");
    if(chip) chip.textContent = n;

    const q = card.querySelector(".resin-stepper .q");
    if(q) q.textContent = n || 1;

    const other = activeGroup === "cherry" ? designQty("cherry", id) - n : 0;
    let badge = card.querySelector(".resin-other-row");
    if(other > 0){
      if(!badge){
        badge = document.createElement("span");
        badge.className = "resin-other-row";
        card.appendChild(badge);
      }
      badge.textContent = `+${other}`;
      badge.title = `${other} ${other === 1 ? "key" : "keys"} in other rows`;
    }else if(badge){
      badge.remove();
    }

    const setBtn = card.querySelector(".resin-set");
    if(setBtn){
      const full = ROWS.cherry.every(r => qty("cherry", r, id) > 0);
      setBtn.disabled = full;
      setBtn.textContent = full ? "R1–R4 set" : "Set R1–R4";
    }
  }

  function setQty(group, row, id, next){
    const value = Math.max(0, Math.min(99, next));
    if(value > 0) rowState(group, row)[id] = value;
    else if(state[group][row]) delete state[group][row][id];

    updateCard(id);
    renderRows();
    renderSummary();
  }

  function addFullSet(id){
    ROWS.cherry.forEach(row => {
      if(!qty("cherry", row, id)) rowState("cherry", row)[id] = 1;
    });
    activeGroup = "cherry";
    renderTabs();
    renderRows();
    renderGrid();
    renderSummary();
  }

  function clearAll(){
    state.cherry = {};
    state.sa = {};
    state.space = {};
    renderRows();
    renderGrid();
    renderSummary();
  }

  /* ---------- sticky summary ---------- */

  function renderSummary(){
    const groups = GROUP_ORDER.filter(g => PRICES[g]);
    const totalKeys = groups.reduce((a, g) => a + groupQty(g), 0);
    const total = groups.reduce((a, g) => a + groupQty(g) * unitPrice(g), 0);

    const qtyEl = el("resinSummaryQty");
    const unitEl = el("resinSummaryUnit");
    const totalEl = el("resinSummaryTotal");
    const hintEl = el("resinSummaryHint");
    const breakdownEl = el("resinSummaryBreakdown");
    const addBtn = el("resinAdd");
    const clearBtn = el("resinClear");

    el("resinSummary")?.classList.toggle("has-items", totalKeys > 0);

    if(qtyEl) qtyEl.textContent = `${totalKeys} ${totalKeys === 1 ? "key" : "keys"}`;

    if(unitEl){
      if(!totalKeys){
        unitEl.textContent = "Pick a design to start";
      }else{
        unitEl.textContent = groups
          .filter(g => groupQty(g) > 0)
          .map(g => `${groupQty(g)} ${PRICES[g].short}`)
          .join(" · ");
      }
    }

    if(totalEl) totalEl.textContent = money(total);

    if(addBtn){
      addBtn.disabled = totalKeys === 0;
      addBtn.textContent = totalKeys
        ? `Add ${totalKeys} ${totalKeys === 1 ? "key" : "keys"} to order`
        : "Add to order";
    }
    if(clearBtn) clearBtn.hidden = totalKeys === 0;

    if(breakdownEl){
      breakdownEl.innerHTML = groups
        .filter(g => groupQty(g) > 0)
        .map(g => {
          const n = groupQty(g);
          const rows = g === "cherry"
            ? ROWS.cherry.filter(r => rowQty(g, r) > 0)
                .map(r => `${r} ×${rowQty(g, r)}`)
                .join(" · ")
            : "";
          return `<span><b>${esc(PRICES[g].short)}</b> ${n} ${n === 1 ? "key" : "keys"} at ${money(unitPrice(g))}${rows ? ` · <em>${rows}</em>` : ""}</span>`;
        })
        .join("");
    }

    if(hintEl){
      const hints = groups
        .filter(g => PRICES[g].min != null && groupQty(g) > 0 && groupQty(g) < PRICES[g].min)
        .map(g => {
          const more = PRICES[g].min - groupQty(g);
          return `Add ${more} more ${PRICES[g].short} ${more === 1 ? "key" : "keys"} for ${price(PRICES[g].tier)} each.`;
        });
      hintEl.textContent = hints.join(" ");
    }
  }

  /* ---------- add to cart ---------- */

  function buildItems(){
    const designs = allDesigns();
    const items = [];

    GROUP_ORDER.forEach(group => {
      const p = PRICES[group];
      if(!p) return;
      const unit = unitPrice(group);

      ROWS[group].forEach(row => {
        Object.keys(state[group][row] || {}).forEach(id => {
          const n = qty(group, row, id);
          const d = designs.find(x => x.id === id);
          if(!d || !n) return;

          items.push({
            productId: `resin-${group}-${row || "space"}-${id}`,
            key: `resin|${group}|${row || "none"}|${id}`,
            name: `Resin Keycap · ${p.label}${row ? ` ${row}` : ""}`,
            variantSummary: d.custom ? "Custom logo — send file on Telegram" : d.name,
            image: d.custom ? "" : new URL(d.image || `logos/${id}.webp`, location.href).href,
            price: unit,
            qty: n,
            resin: {
              group,
              row: row || "",
              single: Number(p.single),
              tier: Number(p.tier),
              min: p.min,
              custom: !!d.custom
            }
          });
        });
      });
    });

    return items;
  }

  function addToOrder(){
    const items = buildItems();
    if(!items.length) return;

    const order = getCatalogOrder();
    items.forEach(item => {
      const found = order.find(x => x.key === item.key);
      if(found) found.qty = (Number(found.qty) || 0) + item.qty;
      else order.push(item);
    });

    // setCatalogOrder() runs repairResinPricing(), so a batch that pushes
    // a profile over 4 re-prices the earlier lines too.
    setCatalogOrder(order);
    clearAll();
    openCatalogOrder();
  }

  /* ---------- stored cart cleanup ---------- */

  function migrateStored(){
    const stored = getCatalogOrder();
    if(!stored.some(x => x && x.resin)) return;

    let changed = false;
    const merged = [];

    stored.forEach(x => {
      if(x && x.resin && typeof x.resin.row !== "string"){
        const parts = String(x.key || "").split("|");
        const group = x.resin.group;
        const row = group === "space" ? "" : "R1";
        const id = parts[2] || "";
        const p = PRICES[group];

        x.resin.row = row;
        x.key = `resin|${group}|${row || "none"}|${id}`;
        x.productId = `resin-${group}-${row || "space"}-${id}`;
        if(p) x.name = `Resin Keycap · ${p.label}${row ? ` ${row}` : ""}`;
        changed = true;
      }

      if(!x || !x.resin) { merged.push(x); return; }
      const found = merged.find(y => y && y.key === x.key);
      if(found) found.qty = (Number(found.qty) || 0) + (Number(x.qty) || 0);
      else merged.push(x);
    });

    if(changed) setCatalogOrder(merged);
  }

  /* ---------- init ---------- */

  async function init(){
    initLayout({ base: "../", active: "resin" });

    if(window.ResinStore) await window.ResinStore.ready();
    PRICES = window.RESIN_PRICES || {};
    COLLECTIONS = window.RESIN_COLLECTIONS || [];

    const params = new URLSearchParams(location.search);
    const requestedRaw = (params.get("c") || "").trim();
    requested = RETIRED_COLLECTIONS[requestedRaw] || requestedRaw;
    collection = COLLECTIONS.find(c => c.id === requested)
      || COLLECTIONS.find(c => !c.customOnly)
      || COLLECTIONS[0];

    if(!collection){
      renderGrid();
      return;
    }

    if(requestedRaw !== collection.id){
      try{ history.replaceState(null, "", `collection.html?c=${encodeURIComponent(collection.id)}`); }
      catch(e){ /* file:// preview — ignore */ }
    }

    if(!PRICES.cherry || !PRICES.sa || !PRICES.space){
      console.error("Resin prices missing — check resin/logos.js");
      return;
    }

    // Old 3-part cart keys had no row. Give them R1 (the only row we sold
    // before rows existed) so the drawer still shows a complete line.
    migrateStored();

    // Normalise prices already in the cart.
    const stored = getCatalogOrder();
    if(stored.some(x => x && x.resin)) setCatalogOrder(stored);

    renderHead();
    renderPriceBar();
    renderTabs();
    renderRows();
    renderRoles();
    renderGrid();
    renderSummary();

    el("resinTabs")?.addEventListener("click", e => {
      const btn = e.target.closest("[data-profile]");
      if(!btn || !PRICES[btn.dataset.profile]) return;
      activeGroup = btn.dataset.profile;
      renderTabs();
      renderRows();
      renderGrid();
      renderSummary();
    });

    el("resinRowChips")?.addEventListener("click", e => {
      const btn = e.target.closest("[data-row]");
      if(!btn) return;
      rowByGroup.cherry = btn.dataset.row;
      renderRows();
      renderGrid();
      renderSummary();
    });

    el("resinRoleChips")?.addEventListener("click", e => {
      const btn = e.target.closest("[data-role]");
      if(!btn) return;
      activeRole = btn.dataset.role || "";
      renderRoles();
      renderGrid();
    });

    el("resinSearch")?.addEventListener("input", e => {
      search = e.target.value;
      renderGrid();
    });

    el("resinGrid")?.addEventListener("click", e => {
      const set = e.target.closest("[data-set]");
      if(set){
        e.preventDefault();
        if(!set.disabled) addFullSet(set.dataset.set);
        return;
      }

      const pick = e.target.closest("[data-pick]");
      const plus = e.target.closest("[data-plus]");
      const minus = e.target.closest("[data-minus]");
      const id = (pick && pick.dataset.pick) || (plus && plus.dataset.plus) || (minus && minus.dataset.minus);
      if(!id) return;

      e.preventDefault();
      const current = qty(activeGroup, activeRow(), id);
      const next = minus ? current - 1 : current + 1;
      setQty(activeGroup, activeRow(), id, next);
    });

    el("resinAdd")?.addEventListener("click", addToOrder);
    el("resinClear")?.addEventListener("click", clearAll);
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  }else{
    init();
  }
})();
