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
      const item = {
        name: l.name.trim(),
        variantSummary: (l.detail || '').trim() || null,
        price: c.qty ? Math.round((c.net / c.qty) * 10000) / 10000 : unit,
        qty: c.qty
      };
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
      delivery: ''
    };
  }

  function blankLine(){
    return {
      name: '', detail: '', qty: 1, price: '',
      discType: 'flat', discValue: '',
      groups: null,        // variant groups when picked from the catalog
      base: null,          // catalog base_price
      sel: {},             // chosen option per group
      priceTouched: false  // true once the price is typed by hand
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
      <div class="co-grid2">
        <label class="co-f">Customer name
          <input id="coName" type="text" placeholder="Name on Telegram or full name" autocomplete="off">
        </label>
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

      <div class="co-lines" id="coLines"></div>

      <div class="co-bottom">
        <label class="co-f" style="max-width:220px;">Order status
          <select id="coStatus">
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
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

    $('#coName').addEventListener('input', e => { state.name = e.target.value; });
    $('#coPhone').addEventListener('input', e => { state.phone = e.target.value; });
    $('#coStatus').addEventListener('change', e => { state.status = e.target.value; });
    $('#coODVal').addEventListener('input', e => { state.orderDiscValue = e.target.value; updateTotals(); });
    $('#coODType').addEventListener('change', e => { state.orderDiscType = e.target.value; updateTotals(); });
    $('#coDelivery').addEventListener('input', e => { state.delivery = e.target.value; updateTotals(); });

    $('#coAddCustom').addEventListener('click', () => {
      state.lines.push(blankLine());
      renderLines();
      const last = root.querySelector('.co-line:last-child [data-f="name"]');
      if(last) last.focus();
    });

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
    $('#coSub').textContent = money(c.subtotal);
    $('#coODAmt').textContent = '-' + money(c.orderDisc);
    $('#coTotal').textContent = money(c.total);
  }

  /* ---------- open / close ---------- */
  function isDirty(){
    return !!(state.name.trim() || state.phone.trim() || state.lines.length || state.delivery || state.orderDiscValue);
  }

  function tryClose(){
    if(saving) return;
    if(isDirty() && !confirm('Discard this order? Nothing has been saved.')) return;
    close();
  }

  function close(){
    root.classList.remove('open');
    closeResults();
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
    $('#coSearch').value = '';
    $('#coErr').textContent = '';
    setSaving(false);
    renderLines();
    root.classList.add('open');
    root.scrollTop = 0;
    $('#coName').focus();
  }

  function setSaving(on){
    saving = on;
    $('#coSave').disabled = on;
    $('#coSaveInvoice').disabled = on;
    $('#coSave').textContent = on ? 'Saving…' : 'Save order';
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
      order_discount_amount: c.orderDisc
    };

    setSaving(true);
    const { data, error } = await sb.from('orders').insert(payload).select().single();
    setSaving(false);

    if(error){
      let msg = 'Could not save: ' + error.message;
      if(/delivery_fee|order_discount|column/i.test(error.message) || /row-level security|policy|permission/i.test(error.message)){
        msg += ' — run tools/migration-orders-delivery-discount.sql in the Supabase SQL Editor once, then try again.';
      }
      errEl.textContent = msg;
      return;
    }

    close();
    if(typeof opts.onSaved === 'function') opts.onSaved(data, !!openInvoice);
  }

  window.KeycamCreateOrder = { open, _calc: { calcLine, calcOrder, buildItems, discountAmount } };
})();
