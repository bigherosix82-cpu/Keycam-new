/* =========================
   ADMIN — CREATE ORDER
   For orders you take on Telegram: pick products, set qty, give a
   discount on each item and/or on the whole order, add a delivery
   fee, then save it as a normal order and open the invoice.

   Shared by admin-catalog.html and deskmat/admin.html. It injects its
   own modal + styles, so the pages only need the script tag and a
   button that calls:

     KeycamCreateOrder.open({ onSaved: (orderRow, openInvoice) => {...} })

   Needs tools/migration-orders-delivery-discount.sql to be run once in
   Supabase (adds delivery_fee + order discount columns and lets the
   logged-in admin insert orders).
========================= */
(function(){
  'use strict';

  /* ---------- money helpers ---------- */
  const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const money = n => '$' + r2(n).toFixed(2);
  const esc = s => (s == null ? '' : String(s)).replace(/[&<>"']/g, c => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));

  // Discount in dollars, given a base amount and either a flat $ value or a %.
  // Never below 0 and never more than the base itself.
  function discountAmount(base, type, value){
    const v = Math.max(0, num(value));
    const raw = type === 'percent' ? base * Math.min(v, 100) / 100 : v;
    return r2(Math.min(Math.max(raw, 0), Math.max(base, 0)));
  }

  function calcLine(l){
    const qty = Math.max(0, Math.floor(num(l.qty)));
    const gross = r2(qty * Math.max(0, num(l.price)));
    const disc = discountAmount(gross, l.discType, l.discValue);
    return { qty, gross, disc, net: r2(gross - disc) };
  }

  // total = sum of lines (after line discounts) − order discount + delivery fee
  function calcOrder(s){
    const lines = s.lines.map(calcLine);
    const subtotal = r2(lines.reduce((a, x) => a + x.net, 0));
    const orderDisc = discountAmount(subtotal, s.orderDiscType, s.orderDiscValue);
    const delivery = Math.max(0, r2(num(s.delivery)));
    const total = r2(subtotal - orderDisc + delivery);
    return { lines, subtotal, orderDisc, delivery, total };
  }

  // Same item shape the website checkout saves (name, variantSummary,
  // price, qty, originalPrice) plus the exact line discount, so the
  // existing invoice code can show Rate / Discount / Amount per line.
  function buildItems(s){
    return s.lines.map(l => {
      const c = calcLine(l);
      const unit = Math.max(0, num(l.price));
      // When editing, keep whatever else the original item carried (type, size,
      // image, …) but drop the old discount fields — they're rebuilt just below.
      const item = Object.assign({}, l.extra || {});
      ['originalPrice', 'lineDiscount', 'lineDiscountType', 'lineDiscountValue'].forEach(k => { delete item[k]; });
      Object.assign(item, {
        name: l.name.trim(),
        variantSummary: (l.detail || '').trim() || null,
        price: c.qty ? Math.round((c.net / c.qty) * 10000) / 10000 : unit,
        qty: c.qty
      });
      if(c.disc > 0){
        item.originalPrice = unit;
        item.lineDiscount = c.disc;
        item.lineDiscountType = l.discType === 'percent' ? 'percent' : 'flat';
        item.lineDiscountValue = num(l.discValue);
      }
      return item;
    });
  }

  /* ---------- state ---------- */
  let state = null;
  let opts = {};
  let built = false;
  let searchToken = 0;
  let searchTimer = null;
  let saving = false;

  function freshState(){
    return {
      name: '', phone: '', status: 'pending',
      lines: [],
      orderDiscType: 'flat', orderDiscValue: '',
      delivery: '',
      paidMode: 'unpaid', paidValue: '', // 'unpaid' | 'full' | 'amount'
      editId: null                       // set when editing a saved order
    };
  }

  function blankLine(){
    return {
      name: '', detail: '', qty: 1, price: '',
      discType: 'flat', discValue: '',
      groups: null,        // variant groups when picked from the catalog
      base: null,          // catalog base_price
      sel: {},             // chosen option per group
      priceTouched: false, // true once the price is typed by hand
      extra: null,           // original item (when editing) so other fields survive
      hint: '', hintKind: '' // note shown under the name after "Fill items from text"
    };
  }

  /* ---------- DOM + styles ---------- */
  const CSS = `
  .co-backdrop{ display:none; position:fixed; inset:0; background:rgba(4,8,10,.72); z-index:1000; padding:24px; overflow-y:auto; }
  .co-backdrop.open{ display:flex; }
  .co-modal{ background:var(--surface); border:1px solid var(--line); border-radius:10px; width:100%; max-width:900px; margin:auto; display:flex; flex-direction:column; color:var(--ink); }
  .co-top{ display:flex; align-items:center; justify-content:space-between; padding:14px 18px; border-bottom:1px solid var(--line); font:600 15px var(--disp); }
  .co-modal .admin-btn.secondary, .co-picker .admin-btn.secondary{ background:transparent; border:1px solid var(--line); color:var(--ink); }
  .co-modal .admin-btn.secondary:hover, .co-picker .admin-btn.secondary:hover{ border-color:var(--ink-dim); filter:none; }
  .co-body{ padding:18px; display:flex; flex-direction:column; gap:16px; }
  .co-foot{ display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; padding:14px 18px; border-top:1px solid var(--line); }
  .co-foot-btns{ display:flex; gap:8px; flex-wrap:wrap; margin-left:auto; }
  .co-err{ color:var(--red); font:500 12px var(--sans); min-height:16px; flex:1 1 240px; }
  .co-h{ font:600 13px var(--disp); color:var(--ink); margin:0 0 8px; }
  .co-grid2{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .co-f{ display:flex; flex-direction:column; gap:4px; font:500 11px var(--sans); color:var(--ink-dim); min-width:0; }
  .co-in, .co-f input, .co-f select, .co-line input, .co-line select, .co-picker input, .co-trow input, .co-trow select{
    background:#0b1113; border:1px solid var(--line); color:var(--ink);
    padding:8px 10px; font:500 13px var(--sans); border-radius:5px; width:100%; min-width:0;
  }
  .co-in:focus, .co-f input:focus, .co-f select:focus, .co-line input:focus, .co-line select:focus, .co-picker input:focus, .co-trow input:focus, .co-trow select:focus{ outline:none; border-color:var(--blue); }
  .co-line input[type="number"], .co-f input[type="number"], .co-trow input[type="number"]{ font-family:var(--mono); }
  .co-picker{ position:relative; display:flex; gap:8px; flex-wrap:wrap; }
  .co-picker input{ flex:1 1 260px; }
  .co-results{ display:none; position:absolute; left:0; top:calc(100% + 4px); width:min(560px, 100%); z-index:5; background:var(--surface-3); border:1px solid var(--line); border-radius:7px; padding:4px; box-shadow:0 10px 28px rgba(0,0,0,.45); max-height:320px; overflow-y:auto; }
  .co-results.open{ display:block; }
  .co-namewrap{ position:relative; min-width:0; }
  .co-suggest{ display:none; position:absolute; left:0; right:0; top:calc(100% + 4px); z-index:6; background:var(--surface-3); border:1px solid var(--line); border-radius:7px; padding:4px; box-shadow:0 10px 28px rgba(0,0,0,.45); max-height:280px; overflow-y:auto; }
  .co-suggest.open{ display:block; }
  .co-sug-head{ padding:6px 10px 4px; font:600 10px var(--mono); letter-spacing:.04em; text-transform:uppercase; color:var(--ink-faint); }
  .co-sug{ display:block; width:100%; text-align:left; background:transparent; border:none; color:var(--ink); padding:8px 10px; border-radius:5px; cursor:pointer; font:500 13px var(--sans); }
  .co-sug:hover, .co-sug.active{ background:var(--surface-2); outline:none; }
  .co-sug small{ display:block; margin-top:2px; color:var(--ink-dim); font-size:11px; }
  .co-result{ display:flex; justify-content:space-between; gap:12px; width:100%; text-align:left; background:transparent; border:none; color:var(--ink); padding:8px 10px; border-radius:5px; cursor:pointer; font:500 13px var(--sans); }
  .co-result:hover, .co-result:focus{ background:var(--surface-2); outline:none; }
  .co-result small{ color:var(--ink-dim); font-size:11px; display:block; margin-top:2px; }
  .co-result .co-rprice{ font-family:var(--mono); color:var(--ink-dim); white-space:nowrap; }
  .co-note{ padding:8px 10px; color:var(--ink-dim); font:500 12px var(--sans); }
  .co-lines{ display:flex; flex-direction:column; gap:10px; }
  .co-empty{ border:1px dashed var(--line); border-radius:8px; padding:18px; color:var(--ink-dim); font:500 13px var(--sans); text-align:center; }
  .co-line{ display:grid; grid-template-columns:minmax(0,1fr) 72px 104px 158px 92px 30px; gap:10px; align-items:start; padding:12px; background:var(--surface-2); border:1px solid var(--line); border-radius:8px; }
  .co-l-name{ display:flex; flex-direction:column; gap:6px; min-width:0; }
  .co-variants{ display:flex; gap:6px; flex-wrap:wrap; }
  .co-variants select{ flex:1 1 130px; padding:6px 8px; font-size:12px; }
  .co-inline{ display:flex; gap:6px; }
  .co-inline select{ width:58px; flex:0 0 58px; padding-left:6px; padding-right:4px; }
  .co-money{ font:600 13px var(--mono); padding:9px 0; text-align:right; }
  .co-x{ background:transparent; border:1px solid var(--line); color:var(--ink-dim); border-radius:5px; width:30px; height:34px; margin-top:15px; cursor:pointer; font-size:16px; line-height:1; }
  .co-x:hover{ border-color:var(--red); color:var(--red); }
  .co-bottom{ display:grid; grid-template-columns:1fr minmax(280px, 340px); gap:20px; align-items:start; }
  .co-totals{ display:flex; flex-direction:column; gap:10px; background:var(--surface-2); border:1px solid var(--line); border-radius:8px; padding:14px; }
  .co-trow{ display:flex; align-items:center; justify-content:space-between; gap:10px; font:500 13px var(--sans); color:var(--ink-dim); }
  .co-trow b{ font:600 13px var(--mono); color:var(--ink); }
  .co-trow .co-inline{ width:170px; }
  .co-trow .co-inline input{ text-align:right; }
  .co-trow.co-grand{ border-top:1px solid var(--line); padding-top:10px; color:var(--ink); font:600 14px var(--disp); }
  .co-trow.co-grand b{ font-size:17px; color:var(--blue); }
  .co-edit-note{ border:1px solid var(--line); border-left:3px solid var(--blue); background:var(--surface-2); border-radius:6px; padding:9px 12px; font:500 12px var(--sans); color:var(--ink-dim); }
  .co-edit-note.warn{ border-left-color:#e0a94a; color:#e0a94a; }
  .co-edit-note[hidden]{ display:none; }
  .co-trow .co-paidwrap{ display:flex; gap:6px; width:230px; }
  .co-trow .co-paidwrap select{ flex:1 1 110px; }
  .co-trow .co-paidwrap input{ flex:1 1 80px; text-align:right; }
  .co-paste{ border:1px dashed var(--line); border-radius:8px; padding:10px 12px; }
  .co-paste summary{ cursor:pointer; font:600 13px var(--disp); color:var(--ink); }
  .co-paste-body{ display:flex; flex-direction:column; gap:8px; margin-top:10px; }
  .co-paste textarea{ background:#0b1113; border:1px solid var(--line); color:var(--ink); padding:8px 10px; font:500 13px var(--sans); border-radius:5px; width:100%; min-height:120px; resize:vertical; }
  .co-paste textarea:focus{ outline:none; border-color:var(--blue); }
  .co-paste-row{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
  .co-paste-note{ font:500 12px var(--sans); color:var(--ink-dim); flex:1 1 240px; }
  .co-hint{ font:500 11px var(--sans); color:var(--ink-dim); }
  .co-hint.ok{ color:#5fd08a; }
  .co-hint.warn{ color:#e0a94a; }
  @media (max-width: 760px){
    .co-backdrop{ padding:10px; }
    .co-grid2{ grid-template-columns:1fr; }
    .co-line{ grid-template-columns:1fr 1fr; }
    .co-l-name{ grid-column:1 / -1; }
    .co-l-disc{ grid-column:1 / -1; }
    .co-x{ margin-top:0; justify-self:end; align-self:end; }
    .co-bottom{ grid-template-columns:1fr; }
  }
  `;

  const HTML = `
  <div class="co-modal" role="dialog" aria-modal="true" aria-labelledby="coTitle">
    <div class="co-top">
      <span id="coTitle">Create order</span>
      <button class="admin-btn secondary" id="coClose" type="button">Close</button>
    </div>
    <div class="co-body">
      <div class="co-edit-note" id="coEditNote" hidden></div>
      <div class="co-grid2">
        <div class="co-namewrap">
          <label class="co-f">Customer name
            <input id="coName" type="text" placeholder="Name on Telegram or full name" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="coSuggest">
          </label>
          <div class="co-suggest" id="coSuggest" role="listbox"></div>
        </div>
        <label class="co-f">Phone
          <input id="coPhone" type="text" placeholder="Optional" autocomplete="off">
        </label>
      </div>

      <div>
        <p class="co-h">Items</p>
        <div class="co-picker">
          <input id="coSearch" type="text" placeholder="Search catalog products by name" autocomplete="off" aria-label="Search catalog products">
          <button class="admin-btn secondary" id="coAddCustom" type="button">Add custom item</button>
          <div class="co-results" id="coResults"></div>
        </div>
      </div>

      <details class="co-paste" id="coPasteBox">
        <summary>Paste Telegram order</summary>
        <div class="co-paste-body">
          <textarea id="coPaste" placeholder="Paste the order text here, one item per line, e.g.&#10;Keycap Kamen rider 37$&#10;Mouse pad 2.5$&#10;Delivery 1.5$" aria-label="Pasted Telegram order"></textarea>
          <div class="co-paste-row">
            <button class="admin-btn secondary" id="coPasteGo" type="button">Fill items from text</button>
            <span class="co-paste-note" id="coPasteNote"></span>
          </div>
        </div>
      </details>

      <div class="co-lines" id="coLines"></div>

      <div class="co-bottom">
        <label class="co-f" style="max-width:220px;">Order status
          <select id="coStatus">
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <div class="co-totals">
          <div class="co-trow"><span>Subtotal</span><b id="coSub">$0.00</b></div>
          <div class="co-trow">
            <span>Order discount</span>
            <div class="co-inline">
              <input id="coODVal" type="number" min="0" step="0.01" placeholder="0" aria-label="Order discount value">
              <select id="coODType" aria-label="Order discount type"><option value="flat">$</option><option value="percent">%</option></select>
            </div>
          </div>
          <div class="co-trow"><span>Discount amount</span><b id="coODAmt">-$0.00</b></div>
          <div class="co-trow">
            <span>Delivery fee</span>
            <div class="co-inline"><input id="coDelivery" type="number" min="0" step="0.01" placeholder="0.00" aria-label="Delivery fee"></div>
          </div>
          <div class="co-trow co-grand"><span>Total</span><b id="coTotal">$0.00</b></div>
          <div class="co-trow">
            <span>Paid</span>
            <div class="co-paidwrap">
              <select id="coPaidMode" aria-label="Payment received">
                <option value="unpaid">Not paid</option>
                <option value="full">Paid in full</option>
                <option value="amount">Enter amount</option>
              </select>
              <input id="coPaidVal" type="number" min="0" step="0.01" placeholder="0.00" aria-label="Amount paid" style="display:none;">
            </div>
          </div>
          <div class="co-trow"><span>Balance due</span><b id="coBalance">$0.00</b></div>
        </div>
      </div>
    </div>
    <div class="co-foot">
      <span class="co-err" id="coErr" role="alert"></span>
      <div class="co-foot-btns">
        <button class="admin-btn secondary" id="coSave" type="button">Save order</button>
        <button class="admin-btn" id="coSaveInvoice" type="button">Save and open invoice</button>
      </div>
    </div>
  </div>`;

  let root = null;
  const $ = sel => root.querySelector(sel);

  function build(){
    if(built) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    root = document.createElement('div');
    root.className = 'co-backdrop';
    root.innerHTML = HTML;
    document.body.appendChild(root);
    built = true;

    $('#coClose').addEventListener('click', tryClose);
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape' && root.classList.contains('open')) tryClose();
    });

    $('#coName').addEventListener('input', e => { state.name = e.target.value; renderSuggest(); });
    $('#coName').addEventListener('focus', renderSuggest);
    $('#coName').addEventListener('keydown', onNameKey);
    $('#coSuggest').addEventListener('mousedown', e => e.preventDefault()); // keep focus in the input
    $('#coSuggest').addEventListener('click', e => {
      const b = e.target.closest('[data-sug]');
      if(b) pickCustomer(suggestItems[Number(b.dataset.sug)]);
    });
    document.addEventListener('click', e => {
      if(root && !e.target.closest('.co-namewrap')) hideSuggest();
    });
    $('#coPhone').addEventListener('input', e => { state.phone = e.target.value; });
    $('#coStatus').addEventListener('change', e => { state.status = e.target.value; });
    $('#coPaidMode').addEventListener('change', e => {
      state.paidMode = e.target.value;
      if(state.paidMode === 'full' || (state.paidMode === 'amount' && num(state.paidValue) > 0)) autoConfirm();
      updateTotals();
    });
    $('#coPaidVal').addEventListener('input', e => {
      state.paidValue = e.target.value;
      if(num(state.paidValue) > 0) autoConfirm();
      updateTotals();
    });
    $('#coODVal').addEventListener('input', e => { state.orderDiscValue = e.target.value; updateTotals(); });
    $('#coODType').addEventListener('change', e => { state.orderDiscType = e.target.value; updateTotals(); });
    $('#coDelivery').addEventListener('input', e => { state.delivery = e.target.value; updateTotals(); });

    $('#coAddCustom').addEventListener('click', () => {
      state.lines.push(blankLine());
      renderLines();
      const last = root.querySelector('.co-line:last-child [data-f="name"]');
      if(last) last.focus();
    });

    $('#coPasteGo').addEventListener('click', fillFromText);

    // Catalog search
    const search = $('#coSearch');
    search.addEventListener('input', () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runSearch(search.value), 250);
    });
    search.addEventListener('focus', () => { if(search.value.trim().length >= 2) runSearch(search.value); });
    document.addEventListener('click', e => {
      if(!root.contains(e.target) || !e.target.closest('.co-picker')) closeResults();
    });

    // Line editing (delegated so typing never re-renders and loses focus)
    const linesEl = $('#coLines');
    linesEl.addEventListener('input', e => {
      const row = e.target.closest('.co-line');
      const f = e.target.dataset.f;
      if(!row || !f || e.target.dataset.g) return;
      const line = state.lines[Number(row.dataset.i)];
      line[f] = e.target.value;
      if(f === 'price') line.priceTouched = true;
      if(f === 'name' && line.hint){ line.hint = ''; const h = row.querySelector('.co-hint'); if(h) h.remove(); }
      updateTotals();
    });
    linesEl.addEventListener('change', e => {
      const row = e.target.closest('.co-line');
      if(!row) return;
      const line = state.lines[Number(row.dataset.i)];
      if(e.target.dataset.g){
        line.sel[e.target.dataset.g] = e.target.value;
        applyVariants(line);
        renderLines();
      }else if(e.target.dataset.f === 'discType'){
        line.discType = e.target.value;
        updateTotals();
      }
    });
    linesEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-remove]');
      if(!btn) return;
      const row = btn.closest('.co-line');
      state.lines.splice(Number(row.dataset.i), 1);
      renderLines();
    });

    $('#coSave').addEventListener('click', () => save(false));
    $('#coSaveInvoice').addEventListener('click', () => save(true));
  }

  /* ---------- catalog search ---------- */
  function closeResults(){ $('#coResults').classList.remove('open'); }

  async function runSearch(raw){
    const box = $('#coResults');
    const q = (raw || '').replace(/[,%_()*\\]/g, '').trim();
    if(q.length < 2){ closeResults(); return; }
    const sb = window.KEYCAM_SUPABASE;
    if(!sb){ box.innerHTML = '<div class="co-note">Database connection did not load. Reload the page and try again.</div>'; box.classList.add('open'); return; }

    const token = ++searchToken;
    box.innerHTML = '<div class="co-note">Searching…</div>';
    box.classList.add('open');

    const { data, error } = await sb
      .from('catalog_products')
      .select('id, name, category, subtype, base_price, catalog_variants(group_name, option_label, price, sort_order)')
      .eq('archived', false)
      .ilike('name', `%${q}%`)
      .order('name')
      .limit(8);

    if(token !== searchToken) return; // a newer search replaced this one
    if(error){
      box.innerHTML = `<div class="co-note">Search failed: ${esc(error.message)}</div>`;
      return;
    }
    if(!data.length){
      box.innerHTML = '<div class="co-note">No catalog match. Use “Add custom item” for anything not listed.</div>';
      return;
    }
    box._results = data;
    box.innerHTML = data.map((p, i) => {
      const prices = [];
      if(p.base_price != null) prices.push(Number(p.base_price));
      (p.catalog_variants || []).forEach(v => { if(v.price != null) prices.push(Number(v.price)); });
      const from = prices.length ? 'from ' + money(Math.min(...prices)) : 'no price set';
      const meta = [p.category, p.subtype].filter(Boolean).join(' · ');
      return `<button type="button" class="co-result" data-pick="${i}">
        <span>${esc(p.name)}<small>${esc(meta)}</small></span>
        <span class="co-rprice">${from}</span>
      </button>`;
    }).join('');
    box.querySelectorAll('[data-pick]').forEach(btn => {
      btn.addEventListener('click', () => {
        addCatalogLine(box._results[Number(btn.dataset.pick)]);
        $('#coSearch').value = '';
        closeResults();
      });
    });
  }

  function addCatalogLine(p){
    const line = blankLine();
    line.name = p.name;
    line.base = p.base_price != null ? Number(p.base_price) : null;

    // Group variants (Color, Quantity, …) the same way the storefront does.
    const groups = [];
    (p.catalog_variants || [])
      .slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .forEach(v => {
        let g = groups.find(x => x.name === v.group_name);
        if(!g){ g = { name: v.group_name, options: [] }; groups.push(g); }
        g.options.push({ label: v.option_label, price: v.price != null ? Number(v.price) : null });
      });
    line.groups = groups.length ? groups : null;
    applyVariants(line);
    state.lines.push(line);
    renderLines();
  }

  // Fill the detail text and (unless typed by hand) the unit price
  // from the chosen variant options.
  function applyVariants(line){
    if(!line.groups){ return; }
    const chosen = [];
    line.groups.forEach(g => {
      const label = line.sel[g.name];
      const opt = g.options.find(o => o.label === label);
      if(opt) chosen.push({ group: g.name, opt });
    });
    line.detail = chosen.map(c => `${c.group}: ${c.opt.label}`).join(' · ');
    if(!line.priceTouched){
      const priced = chosen.find(c => c.opt.price != null);
      const p = priced ? priced.opt.price : line.base;
      line.price = p != null ? p : '';
    }
  }

/* ---------- paid amount ---------- */
  function paidNow(c){
    if(state.paidMode === 'full') return c.total;
    if(state.paidMode === 'amount') return Math.max(0, r2(num(state.paidValue)));
    return 0;
  }
  // Same rule as the order cards: taking a payment confirms a pending order.
  function autoConfirm(){
    if(state.status === 'pending'){
      state.status = 'confirmed';
      $('#coStatus').value = 'confirmed';
    }
  }

  /* ---------- edit an existing order ---------- */
  const DEFAULT_MAINTENANCE_DISCOUNT = 0.20;

  function lineFromItem(order, it){
    const l = blankLine();
    const qty = Math.max(1, Math.floor(num(it.qty)) || 1);
    const finalPrice = Math.max(0, num(it.price));
    const typeName = t => t === 'mousepad' ? 'Mouse Pad' : t === 'fps' ? 'FPS Mouse Pad' : t === 'glass' ? 'Glass Mouse Pad' : (t || '');
    l.name = it.name || '';
    l.qty = qty;
    l.detail = it.variantSummary || [typeName(it.type), it.size, it.thickness].filter(Boolean).join(', ');
    l.extra = JSON.parse(JSON.stringify(it));
    l.priceTouched = true;

    // Work out the price before discount + the discount in dollars, the same
    // three ways the invoice does.
    let orig = null, disc = 0, fromCreateOrder = false;
    if(it.lineDiscount != null && it.originalPrice != null){
      orig = num(it.originalPrice); disc = num(it.lineDiscount); fromCreateOrder = true;
    }else if(it.originalPrice != null && num(it.originalPrice) > finalPrice){
      orig = num(it.originalPrice); disc = r2(orig * qty - finalPrice * qty);
    }else if(order.maintenance_mode && (it.type === 'mousepad' || it.type === 'fps')){
      const rate = order.maintenance_discount != null ? num(order.maintenance_discount) : DEFAULT_MAINTENANCE_DISCOUNT;
      if(rate > 0 && rate < 1){
        orig = r2(finalPrice / (1 - rate)); disc = r2(orig * qty - finalPrice * qty);
      }
    }

    if(orig != null && disc > 0.004){
      l.price = orig;
      if(fromCreateOrder && it.lineDiscountType === 'percent'){
        l.discType = 'percent'; l.discValue = num(it.lineDiscountValue);
      }else if(fromCreateOrder){
        l.discType = 'flat'; l.discValue = disc;           // a fixed $ amount you typed: stays fixed
      }else{
        // shop-wide/festival discounts are per unit, so keep them as a % — changing the qty keeps the discount right
        l.discType = 'percent'; l.discValue = Math.round(disc / (orig * qty) * 100 * 1e6) / 1e6;
      }
    }else{
      l.price = finalPrice;
    }
    return l;
  }

  function loadOrderIntoState(order){
    state.editId = order.id;
    state.name = order.customer_name || '';
    state.phone = order.customer_phone || '';
    state.status = order.status || 'pending';
    state.lines = (Array.isArray(order.items) ? order.items : []).map(it => lineFromItem(order, it));
    const odAmt = num(order.order_discount_amount);
    state.orderDiscType = order.order_discount_type === 'percent' ? 'percent' : 'flat';
    state.orderDiscValue = odAmt > 0 ? String(order.order_discount_type ? num(order.order_discount_value) : odAmt) : '';
    state.delivery = num(order.delivery_fee) > 0 ? String(num(order.delivery_fee)) : '';
    const total = num(order.total);
    let paid;
    if(order.paid_amount != null) paid = num(order.paid_amount);
    else paid = (order.status === 'confirmed' || order.status === 'shipped') ? total : 0;
    if(paid > 0.004){ state.paidMode = 'amount'; state.paidValue = String(r2(paid)); }
    else { state.paidMode = 'unpaid'; state.paidValue = ''; }
  }

  function showEditNote(order){
    const el = $('#coEditNote');
    if(!order){ el.hidden = true; el.textContent = ''; el.classList.remove('warn'); return; }
    const inv = window.KeycamInvoice ? window.KeycamInvoice.invoiceNumberFor(order) : '';
    const c = calcOrder(state);
    const saved = num(order.total);
    let msg = `Editing this order${inv ? ' (' + inv + ')' : ''}. Saving updates the same order, so the invoice number stays the same.`;
    let warn = false;
    if(Math.abs(c.total - saved) > 0.005){
      msg += ` Note: the saved total was ${money(saved)} but these items add up to ${money(c.total)} — saving will use ${money(c.total)}.`;
      warn = true;
    }
    el.textContent = msg;
    el.classList.toggle('warn', warn);
    el.hidden = false;
  }

  /* ---------- paste a Telegram order ---------- */
  // Reads lines like "Switch 2box 12$ x2", "Free stand x3", "Delivery 1.5$",
  // "Total 93$". Quantities (x2) are ignored on purpose — every item comes in
  // as qty 1 and is changed by hand. "Delivery" fills the delivery fee and
  // "Total" is only reported back, never turned into an item.
  function parseOrderText(text){
    const items = [];
    let delivery = null, total = null;
    String(text || '').split(/\r?\n/).forEach(raw => {
      let s = raw.replace(/[\u200b\u200c\u200d\ufeff]/g, '').trim();
      if(!s) return;
      s = s.replace(/^[-•*·]+\s*/, '').replace(/^\d+[.)]\s+/, '');

      let price = null;
      const pm = s.match(/(\d+(?:[.,]\d+)?)\s*\$|\$\s*(\d+(?:[.,]\d+)?)|(\d+(?:[.,]\d+)?)\s*(?:usd|dollars?)\b/i);
      if(pm){
        price = parseFloat((pm[1] || pm[2] || pm[3]).replace(',', '.'));
        s = s.slice(0, pm.index) + ' ' + s.slice(pm.index + pm[0].length);
      }
      // quantities like "x2", "x 2", "2x" are dropped
      s = s.replace(/(^|\s)[x×]\s*\d+(?=\s|$)/gi, ' ').replace(/(^|\s)\d+\s*[x×](?=\s|$)/gi, ' ');
      s = s.replace(/\s+/g, ' ').replace(/[\s\-–:=,.]+$/, '').trim();
      if(!/\p{L}/u.test(s)) return;

      const key = normName(s);
      if(/^(delivery|deliver|shipping|ship)\b/.test(key)){ if(price != null) delivery = price; return; }
      if(/^(to+t+a+l+s?|grand total|sum)\b/.test(key)){ if(price != null) total = price; return; }

      const free = /^free\b/.test(key);
      items.push({ text: s, price: free && price == null ? 0 : price, free });
    });
    return { items, delivery, total };
  }

  function tokenize(s){
    return normName(s).replace(/(\d)([a-z])/g, '$1 $2').replace(/([a-z])(\d)/g, '$1 $2').split(' ').filter(Boolean);
  }
  function tokenMatch(a, b){
    if(a === b) return true;
    const min = Math.min(a.length, b.length);
    if(min >= 3 && (a.startsWith(b) || b.startsWith(a))) return true;
    const allow = typoAllowance(Math.max(a.length, b.length));
    return allow > 0 && editDistance(a, b, allow) <= allow;
  }

  // Best catalog product for one pasted line. Every word of the line should
  // be found in the product name (or its variant options); among those, the
  // product whose name is closest to the line wins.
  function matchLine(item, products){
    let lt = tokenize(item.text);
    if(item.free && lt.length > 1) lt = lt.filter(t => t !== 'free');
    if(!lt.length) return null;
    const scored = [];
    products.forEach(p => {
      const nameTok = p._nameTok || (p._nameTok = tokenize(p.name));
      const varTok = p._varTok || (p._varTok = [].concat(...(p.catalog_variants || []).map(v => tokenize(v.option_label))));
      const pool = nameTok.concat(varTok);
      const hitsName = lt.filter(t => nameTok.some(x => tokenMatch(t, x)));
      if(!hitsName.some(t => /\p{L}/u.test(t))) return; // need a real word from the name, not just a number
      const covered = lt.filter(t => pool.some(x => tokenMatch(t, x))).length / lt.length;
      if(covered < 0.6) return;
      const nameCov = nameTok.filter(x => lt.some(t => tokenMatch(t, x))).length / (nameTok.length || 1);
      // the price you typed is a strong hint: it breaks ties like "Mouse" vs "Mouse Pad"
      const prices = [p.base_price].concat((p.catalog_variants || []).map(v => v.price))
        .filter(x => x != null).map(Number);
      const priceHit = item.price != null && item.price > 0 && prices.some(x => Math.abs(x - item.price) < 0.005);
      scored.push({ p, score: covered * 0.7 + nameCov * 0.3 + (priceHit ? 0.15 : 0), covered, nameCov, priceHit });
    });
    if(!scored.length) return null;
    scored.sort((a, b) => b.score - a.score || a.p.name.length - b.p.name.length);
    const best = scored[0];
    const runner = scored[1];
    const sure = best.covered === 1 && (best.priceHit || best.nameCov >= 0.67) && !(runner && runner.score > best.score - 0.1);
    return { product: best.p, sure, lt };
  }

  function lineFromParsed(item, m){
    let line = blankLine();
    if(!m){
      line.name = item.text;
      if(item.price != null){ line.price = item.price; line.priceTouched = true; }
      line.hint = 'No catalog match — kept as typed';
      line.hintKind = 'warn';
      return line;
    }
    const p = m.product;
    line.name = p.name;
    line.base = p.base_price != null ? Number(p.base_price) : null;
    const groups = [];
    (p.catalog_variants || []).slice()
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .forEach(v => {
        let g = groups.find(x => x.name === v.group_name);
        if(!g){ g = { name: v.group_name, options: [] }; groups.push(g); }
        g.options.push({ label: v.option_label, price: v.price != null ? Number(v.price) : null });
      });
    line.groups = groups.length ? groups : null;
    // pre-select a variant when its label is spelled out in the pasted line
    (line.groups || []).forEach(g => {
      const hits = g.options.filter(o => {
        const ot = tokenize(o.label);
        return ot.length && ot.every(t => m.lt.some(x => tokenMatch(t, x)));
      });
      if(hits.length === 1) line.sel[g.name] = hits[0].label;
    });
    applyVariants(line);
    if(item.price != null){ line.price = item.price; line.priceTouched = true; } // keep the price you quoted
    line.hint = m.sure ? 'Matched catalog product' : 'Closest catalog match — check it';
    line.hintKind = m.sure ? 'ok' : 'warn';
    return line;
  }

  let catalogCache = null;
  async function loadCatalogForMatch(){
    if(catalogCache) return catalogCache;
    const sb = window.KEYCAM_SUPABASE;
    if(!sb) throw new Error('Database connection did not load. Reload the page and try again.');
    const all = [];
    for(let from = 0; ; from += 1000){
      const { data, error } = await sb
        .from('catalog_products')
        .select('id, name, category, subtype, base_price, catalog_variants(group_name, option_label, price, sort_order)')
        .eq('archived', false)
        .order('name')
        .range(from, from + 999);
      if(error) throw error;
      all.push(...(data || []));
      if(!data || data.length < 1000) break;
    }
    catalogCache = all;
    return all;
  }

  async function fillFromText(){
    const note = $('#coPasteNote');
    const btn = $('#coPasteGo');
    const parsed = parseOrderText($('#coPaste').value);
    if(!parsed.items.length && parsed.delivery == null){
      note.textContent = 'No product lines found. Put one item per line, like “Mouse pad 2.5$”.';
      return;
    }
    btn.disabled = true;
    note.textContent = 'Finding products…';
    let products = [];
    try{
      products = await loadCatalogForMatch();
    }catch(err){
      note.textContent = 'Could not load the catalog (' + (err.message || err) + '). Items will be added as typed.';
    }
    let matched = 0;
    parsed.items.forEach(it => {
      const m = products.length ? matchLine(it, products) : null;
      if(m) matched++;
      state.lines.push(lineFromParsed(it, m));
    });
    if(parsed.delivery != null){
      state.delivery = String(parsed.delivery);
      $('#coDelivery').value = state.delivery;
    }
    renderLines();
    const bits = [];
    if(parsed.items.length) bits.push(`Added ${parsed.items.length} item${parsed.items.length === 1 ? '' : 's'} (${matched} matched the catalog, qty 1 each)`);
    if(parsed.delivery != null) bits.push(`delivery fee ${money(parsed.delivery)}`);
    if(parsed.total != null) bits.push(`your text total was ${money(parsed.total)} — set quantities, then compare with Total below`);
    note.textContent = bits.join('. ') + '.';
    $('#coPaste').value = '';
    btn.disabled = false;
  }

  /* ---------- rendering ---------- */
  function lineHTML(l, i){
    const variants = l.groups
      ? `<div class="co-variants">${l.groups.map(g => `
          <select data-g="${esc(g.name)}" aria-label="${esc(g.name)}">
            <option value="">${esc(g.name)}…</option>
            ${g.options.map(o => `<option value="${esc(o.label)}" ${l.sel[g.name] === o.label ? 'selected' : ''}>${esc(o.label)}${o.price != null ? ' — ' + money(o.price) : ''}</option>`).join('')}
          </select>`).join('')}</div>`
      : `<input data-f="detail" type="text" placeholder="Details, e.g. Black · 75% layout (optional)" value="${esc(l.detail)}" aria-label="Item details">`;
    return `
    <div class="co-line" data-i="${i}">
      <div class="co-l-name">
        <input data-f="name" type="text" placeholder="Item name" value="${esc(l.name)}" aria-label="Item name">
        ${variants}
        ${l.hint ? `<div class="co-hint ${esc(l.hintKind)}">${esc(l.hint)}</div>` : ''}
      </div>
      <label class="co-f">Qty
        <input data-f="qty" type="number" min="1" step="1" value="${esc(l.qty)}">
      </label>
      <label class="co-f">Unit price
        <input data-f="price" type="number" min="0" step="0.01" value="${esc(l.price)}" placeholder="0.00">
      </label>
      <div class="co-f co-l-disc">Discount on this item
        <div class="co-inline">
          <input data-f="discValue" type="number" min="0" step="0.01" value="${esc(l.discValue)}" placeholder="0" aria-label="Item discount value">
          <select data-f="discType" aria-label="Item discount type">
            <option value="flat" ${l.discType === 'flat' ? 'selected' : ''}>$</option>
            <option value="percent" ${l.discType === 'percent' ? 'selected' : ''}>%</option>
          </select>
        </div>
      </div>
      <div class="co-f">Line total
        <div class="co-money" data-lt>$0.00</div>
      </div>
      <button class="co-x" type="button" data-remove aria-label="Remove item">×</button>
    </div>`;
  }

  function renderLines(){
    const el = $('#coLines');
    el.innerHTML = state.lines.length
      ? state.lines.map(lineHTML).join('')
      : '<div class="co-empty">No items yet. Search the catalog above or add a custom item.</div>';
    updateTotals();
  }

  function updateTotals(){
    const c = calcOrder(state);
    root.querySelectorAll('.co-line').forEach((row, i) => {
      const cell = row.querySelector('[data-lt]');
      if(cell && c.lines[i]) cell.textContent = money(c.lines[i].net);
    });
    $('#coPaidVal').style.display = state.paidMode === 'amount' ? '' : 'none';
    $('#coBalance').textContent = money(c.total - paidNow(c));
    $('#coSub').textContent = money(c.subtotal);
    $('#coODAmt').textContent = '-' + money(c.orderDisc);
    $('#coTotal').textContent = money(c.total);
  }

  /* ---------- past-customer suggestions ----------
     Typing in "Customer name" offers people who ordered before (from the
     orders table, both stores), matched even with typos, so the same
     customer isn't saved twice under slightly different spellings. */
  let customers = [];      // [{ name, phone, norm, tokens, digits, count, last }]
  let suggestItems = [];
  let suggestActive = -1;

  // lowercase, drop Latin accents and punctuation; keeps Khmer and other scripts intact
  function normName(s){
    return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').normalize('NFC')
      .toLowerCase().replace(/[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }

  // edit distance (insert / delete / replace / swap two neighbours), gives up above `max`
  function editDistance(a, b, max){
    if(Math.abs(a.length - b.length) > max) return max + 1;
    const m = a.length, n = b.length;
    let prev2 = null;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for(let i = 1; i <= m; i++){
      const cur = [i];
      let rowMin = i;
      for(let j = 1; j <= n; j++){
        let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if(prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
        cur[j] = v;
        if(v < rowMin) rowMin = v;
      }
      if(rowMin > max) return max + 1;
      prev2 = prev;
      prev = cur;
    }
    return prev[n];
  }
  const typoAllowance = len => len <= 3 ? 0 : len <= 6 ? 1 : 2;

  function scoreCustomer(q, qTokens, c){
    const n = c.norm;
    if(n === q) return 100;
    if(n.startsWith(q)) return 90;
    if(n.includes(q)) return 75;
    // every word typed must match some word of the name (prefix or small typo)
    let allExact = true, allMatch = true;
    for(const qt of qTokens){
      let best = 0;
      for(const nt of c.tokens){
        if(nt === qt || nt.startsWith(qt)){ best = 2; break; }
        if(qt.length >= 3){
          const allow = typoAllowance(Math.max(qt.length, nt.length));
          if(allow && editDistance(qt, nt, allow) <= allow) best = Math.max(best, 1);
        }
      }
      if(!best){ allMatch = false; break; }
      if(best < 2) allExact = false;
    }
    if(allMatch) return allExact ? 60 : 50;
    const allow = typoAllowance(Math.min(q.length, n.length));
    if(allow && editDistance(q, n, allow) <= allow) return 55;
    return 0;
  }

  function groupCustomers(rows){ // rows arrive newest first
    const map = new Map();
    rows.forEach(r => {
      const name = (r.customer_name || '').trim();
      const norm = normName(name);
      if(!norm) return;
      const phone = (r.customer_phone || '').trim();
      const digits = phone.replace(/\D/g, '');
      const key = norm + '|' + digits;
      let c = map.get(key);
      if(!c){
        c = { name, phone, norm, tokens: norm.split(' '), digits, count: 0, last: r.created_at };
        map.set(key, c);
      }
      c.count++;
    });
    // an order saved without a phone folds into the newest same-name entry that has one
    const list = [...map.values()];
    const withPhone = new Map();
    list.forEach(c => { if(c.digits && !withPhone.has(c.norm)) withPhone.set(c.norm, c); });
    return list.filter(c => {
      if(c.digits) return true;
      const target = withPhone.get(c.norm);
      if(target){ target.count += c.count; return false; }
      return true;
    });
  }

  async function loadCustomers(){
    const sb = window.KEYCAM_SUPABASE;
    if(!sb) return;
    try{
      const { data, error } = await sb.from('orders')
        .select('customer_name, customer_phone, created_at')
        .order('created_at', { ascending: false })
        .limit(2000);
      if(error || !data) return;
      customers = groupCustomers(data);
      if(root.classList.contains('open') && document.activeElement === $('#coName')) renderSuggest();
    }catch(e){ console.warn('Could not load past customers', e); }
  }

  function hideSuggest(){
    if(!root) return;
    const box = $('#coSuggest');
    box.classList.remove('open');
    box.innerHTML = '';
    suggestItems = [];
    suggestActive = -1;
    $('#coName').setAttribute('aria-expanded', 'false');
  }

  function renderSuggest(){
    const box = $('#coSuggest');
    const q = normName($('#coName').value);
    if(q.length < 2 || !customers.length){ hideSuggest(); return; }
    const qTokens = q.split(' ');
    const found = customers
      .map(c => ({ c, score: scoreCustomer(q, qTokens, c) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || b.c.count - a.c.count || String(b.c.last).localeCompare(String(a.c.last)))
      .slice(0, 5)
      .map(x => x.c);
    // already picked (or typed in full) and nothing else similar: no need to nag
    if(found.length === 1 && found[0].norm === q){
      const typed = $('#coPhone').value.replace(/\D/g, '');
      if(!found[0].digits || typed === found[0].digits){ hideSuggest(); return; }
    }
    if(!found.length){ hideSuggest(); return; }
    suggestItems = found;
    suggestActive = -1;
    box.innerHTML = '<div class="co-sug-head">Past customers</div>' + found.map((c, i) => {
      const when = c.last ? new Date(c.last) : null;
      const last = when && !isNaN(when) ? ' · last ' + when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
      const meta = (c.phone ? esc(c.phone) : 'no phone saved') + ' · ' + c.count + (c.count === 1 ? ' order' : ' orders') + last;
      return `<button type="button" class="co-sug" role="option" data-sug="${i}">${esc(c.name)}<small>${meta}</small></button>`;
    }).join('');
    box.classList.add('open');
    $('#coName').setAttribute('aria-expanded', 'true');
  }

  function setActiveSuggest(i){
    suggestActive = i;
    root.querySelectorAll('.co-sug').forEach((el, k) => {
      el.classList.toggle('active', k === i);
      if(k === i) el.scrollIntoView({ block: 'nearest' });
    });
  }

  function onNameKey(e){
    const open = $('#coSuggest').classList.contains('open');
    if(!open) return;
    if(e.key === 'ArrowDown'){ e.preventDefault(); setActiveSuggest((suggestActive + 1) % suggestItems.length); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); setActiveSuggest((suggestActive - 1 + suggestItems.length) % suggestItems.length); }
    else if(e.key === 'Enter' && suggestActive >= 0){ e.preventDefault(); pickCustomer(suggestItems[suggestActive]); }
    else if(e.key === 'Escape'){ e.stopPropagation(); hideSuggest(); } // close the list, not the whole popup
    else if(e.key === 'Tab'){ hideSuggest(); }
  }

  function pickCustomer(c){
    if(!c) return;
    state.name = c.name;
    $('#coName').value = c.name;
    if(c.phone && !$('#coPhone').value.trim()){ // never overwrite a phone already typed
      state.phone = c.phone;
      $('#coPhone').value = c.phone;
    }
    hideSuggest();
    $('#coSearch').focus();
  }

  /* ---------- open / close ---------- */
  function isDirty(){
    return !!(state.name.trim() || state.phone.trim() || state.lines.length || state.delivery || state.orderDiscValue);
  }

  function tryClose(){
    if(saving) return;
    const msg = state.editId ? 'Close without saving your changes?' : 'Discard this order? Nothing has been saved.';
    if(isDirty() && !confirm(msg)) return;
    close();
  }

  function close(){
    root.classList.remove('open');
    closeResults();
    hideSuggest();
  }

  function open(o){
    build();
    opts = o || {};
    state = freshState();
    $('#coName').value = '';
    $('#coPhone').value = '';
    $('#coStatus').value = 'pending';
    $('#coODVal').value = '';
    $('#coODType').value = 'flat';
    $('#coDelivery').value = '';
    $('#coPaidMode').value = 'unpaid';
    $('#coPaidVal').value = '';
    $('#coSearch').value = '';
    $('#coPaste').value = '';
    $('#coPasteNote').textContent = '';
    catalogCache = null; // reload so products added since last time can match
    $('#coErr').textContent = '';
    setSaving(false);
    hideSuggest();
    loadCustomers(); // refresh in the background so brand-new customers show up too

    const editing = opts.order || null;
    if(editing){
      loadOrderIntoState(editing);
      $('#coName').value = state.name;
      $('#coPhone').value = state.phone;
      $('#coStatus').value = state.status;
      $('#coODVal').value = state.orderDiscValue;
      $('#coODType').value = state.orderDiscType;
      $('#coDelivery').value = state.delivery;
      $('#coPaidMode').value = state.paidMode;
      $('#coPaidVal').value = state.paidValue;
    }
    $('#coTitle').textContent = editing ? 'Edit order' : 'Create order';
    $('#coSave').textContent = editing ? 'Save changes' : 'Save order';
    renderLines();
    showEditNote(editing);
    root.classList.add('open');
    root.scrollTop = 0;
    $('#coName').focus();
  }

  function setSaving(on){
    saving = on;
    $('#coSave').disabled = on;
    $('#coSaveInvoice').disabled = on;
    $('#coSave').textContent = on ? 'Saving…' : (state && state.editId ? 'Save changes' : 'Save order');
  }

  /* ---------- save ---------- */
  function validate(){
    if(!state.name.trim()) return 'Enter the customer’s name.';
    if(!state.lines.length) return 'Add at least one item.';
    for(let i = 0; i < state.lines.length; i++){
      const l = state.lines[i];
      const n = i + 1;
      if(!l.name.trim()) return `Item ${n} needs a name.`;
      if(Math.floor(num(l.qty)) < 1) return `Item ${n} needs a quantity of 1 or more.`;
      if(l.price === '' || num(l.price) < 0) return `Item ${n} needs a unit price.`;
    }
    if(state.paidMode === 'amount' && num(state.paidValue) < 0) return 'Paid amount can’t be negative.';
    if(state.paidMode === 'amount' && num(state.paidValue) > calcOrder(state).total + 0.005) return 'Paid amount is more than the order total.';
    return '';
  }

  async function save(openInvoice){
    if(saving) return;
    const errEl = $('#coErr');
    errEl.textContent = '';
    const problem = validate();
    if(problem){ errEl.textContent = problem; return; }

    const sb = window.KEYCAM_SUPABASE;
    if(!sb){ errEl.textContent = 'Database connection did not load. Reload the page and try again.'; return; }

    const c = calcOrder(state);
    const payload = {
      items: buildItems(state),
      total: c.total,
      customer_name: state.name.trim(),
      customer_phone: state.phone.trim(),
      status: state.status,
      delivery_fee: c.delivery,
      order_discount_type: c.orderDisc > 0 ? (state.orderDiscType === 'percent' ? 'percent' : 'flat') : null,
      order_discount_value: c.orderDisc > 0 ? num(state.orderDiscValue) : 0,
      order_discount_amount: c.orderDisc,
      paid_amount: paidNow(c)
    };

    setSaving(true);
    const { data, error } = state.editId
      ? await sb.from('orders').update(payload).eq('id', state.editId).select().single()
      : await sb.from('orders').insert(payload).select().single();
    setSaving(false);

    if(error){
      let msg = 'Could not save: ' + error.message;
      if(/delivery_fee|order_discount|paid_amount|column/i.test(error.message) || /row-level security|policy|permission/i.test(error.message)){
        msg += ' — run tools/migration-orders-delivery-discount.sql (and tools/migration.sql for the paid column) in the Supabase SQL Editor once, then try again.';
      }
      errEl.textContent = msg;
      return;
    }

    close();
    if(typeof opts.onSaved === 'function') opts.onSaved(data, !!openInvoice);
  }

  window.KeycamCreateOrder = { open, _calc: { calcLine, calcOrder, buildItems, discountAmount }, _paste: { parseOrderText, matchLine, tokenize } };
})();
