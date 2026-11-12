/* =========================
   KEYCAM — THERMAL RECEIPT (58 mm / 80 mm)

   Imported from the standalone "invoice-maker.html" receipt maker and
   wired to the admin order system, so an order can be printed on a
   Bluetooth / USB thermal printer without retyping anything.

   Used like:
     KeycamReceipt.open(order, { qrPath: 'deskmat/ABA_QR.jpg' });

   - Business details + per-line pricing come from shared/invoice.js
     (window.KeycamInvoice), so the receipt totals always match the PDF
     invoice: line discounts, order discount, delivery fee, paid, balance.
   - The receipt is drawn as a bitmap (1 canvas px = 1 printer dot), so
     Khmer / Chinese product names print correctly on any ESC/POS printer.
   - Printing uses Web Bluetooth or WebUSB; System print and Save PNG work
     everywhere as a fallback.

   Printer choice, paper width, darkness, footer note and shop logo are
   remembered in localStorage per browser.
========================= */
(function(){
  'use strict';

  const PREFS_KEY = 'keycam_receipt_prefs_v1';
  const LOGO_KEY = 'keycam_receipt_logo_v1';

  const DEFAULT_BUSINESS = {
    name: 'Keycam',
    address: 'Toulkork Phnom Penh Cambodia',
    phone: '0886449944',
    telegram: 'https://t.me/Keycamm'
  };

  const DEFAULTS = {
    conn: 'bt',
    paper: '384',
    dark: '165',
    slow: false,
    note: 'Thank you!',
    font: 'system'
  };

  /* Receipt fonts. All are drawn on canvas (bitmap print), so the printer
     itself does not need the font — only the phone/computer doing the
     printing does. Google-hosted families are loaded on demand.
     - Kantumruy Pro has Khmer + Latin in one font (best for KeyCam).
     - Roboto Condensed is narrow, so long product names fit on 58 mm.
     - JetBrains Mono gives the classic receipt/typewriter look.
     - Inter is neutral and very legible at small dot sizes. */
  const FONTS = {
    system: {
      label: 'System (default)',
      css: '',
      stack: '"Noto Sans Khmer","Khmer OS",system-ui,"Segoe UI","Microsoft YaHei",Arial,sans-serif',
      google: null
    },
    kantumruy: {
      label: 'Kantumruy Pro — Khmer + English',
      css: 'Kantumruy Pro',
      stack: '"Kantumruy Pro","Noto Sans Khmer","Khmer OS",system-ui,sans-serif',
      google: 'Kantumruy+Pro:wght@400;500;600;700',
      khmer: true
    },
    roboto: {
      label: 'Roboto Condensed — narrow, fits more',
      css: 'Roboto Condensed',
      stack: '"Roboto Condensed","Noto Sans Khmer","Khmer OS",Arial,sans-serif',
      google: 'Roboto+Condensed:wght@400;600;700'
    },
    inter: {
      label: 'Inter — clean and modern',
      css: 'Inter',
      stack: '"Inter","Noto Sans Khmer","Khmer OS",Arial,sans-serif',
      google: 'Inter:wght@400;600;700'
    },
    mono: {
      label: 'JetBrains Mono — receipt style',
      css: 'JetBrains Mono',
      stack: '"JetBrains Mono","Noto Sans Khmer","Khmer OS",monospace',
      google: 'JetBrains+Mono:wght@400;600;700'
    }
  };

  const fontKey = () => {
    const k = $('krFont') ? $('krFont').value : (loadPrefs().font || DEFAULTS.font);
    return FONTS[k] ? k : 'system';
  };
  const fontStack = () => (FONTS[fontKey()] || FONTS.system).stack;

  /* Load the chosen Google font (plus a Khmer fallback when needed).
     Resolves even if offline or blocked, so printing still works. */
  const fontPromises = new Map();
  function ensureFont(key){
    const f = FONTS[key] || FONTS.system;
    if(!f.google) return Promise.resolve();
    const families = [f.google];
    if(!f.khmer) families.push('Noto+Sans+Khmer:wght@400;600');
    const href = 'https://fonts.googleapis.com/css2?family=' + families.join('&family=') + '&display=swap';
    if(fontPromises.has(href)) return fontPromises.get(href);
    const p = new Promise(resolve => {
      let done = false;
      const finish = () => { if(done) return; done = true; resolve(); };
      // Never hold the receipt hostage if Google Fonts is slow/blocked.
      setTimeout(finish, 6000);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.onload = () => {
        try{
          const loads = [
            document.fonts.load('400 22px "' + f.css + '"'),
            document.fonts.load('600 22px "' + f.css + '"'),
            document.fonts.load('700 22px "' + f.css + '"')
          ];
          if(!f.khmer){
            loads.push(document.fonts.load('400 22px "Noto Sans Khmer"'));
            loads.push(document.fonts.load('600 22px "Noto Sans Khmer"'));
          }
          Promise.all(loads).then(finish).catch(finish);
        }catch(e){ finish(); }
      };
      link.onerror = finish;
      document.head.appendChild(link);
    });
    fontPromises.set(href, p);
    return p;
  }

  let state = { order: null, opts: {}, qrImg: null, qrCaption: '', logo: null };
  let busy = false;

  const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const money = n => {
    const v = Number(n) || 0;
    return (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2);
  };

  function loadPrefs(){
    try{
      return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'));
    }catch(e){
      return Object.assign({}, DEFAULTS);
    }
  }
  function savePrefs(p){
    try{ localStorage.setItem(PREFS_KEY, JSON.stringify(p)); }catch(e){}
  }

  function typeName(t){
    return t === 'mousepad' ? 'Mouse Pad' : t === 'fps' ? 'FPS Mouse Pad' : t === 'glass' ? 'Glass Mouse Pad' : (t || '');
  }

  function formatDate(iso){
    const d = new Date(iso);
    if(isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function invoiceNumberFor(order){
    if(window.KeycamInvoice && window.KeycamInvoice.invoiceNumberFor){
      return window.KeycamInvoice.invoiceNumberFor(order);
    }
    return 'INV-' + String(order.id || '').slice(0, 8).toUpperCase();
  }

  /* ---------- build the receipt model from an order ---------- */
  /* Totals math mirrors shared/invoice.js exactly. */
  function buildModel(order){
    const inv = window.KeycamInvoice || null;
    const business = Object.assign({}, DEFAULT_BUSINESS, (inv && inv.BUSINESS) || {});
    const items = Array.isArray(order.items) ? order.items : [];

    const lines = items.map(it => {
      const qty = Number(it.qty) || 0;
      const pricing = inv && inv._pricing
        ? inv._pricing(order, it)
        : { rate: Number(it.price) || 0, discountTotal: 0, amount: (Number(it.price) || 0) * qty };
      const detail = it.variantSummary || [typeName(it.type), it.size, it.thickness].filter(Boolean).join(', ');
      return {
        name: it.name || 'Item',
        detail: detail,
        qty: qty,
        rate: Number(pricing.rate) || 0,
        discount: Number(pricing.discountTotal) || 0,
        amount: Number(pricing.amount) || 0
      };
    });

    const subtotal = r2(lines.reduce((s, l) => s + l.amount, 0));
    const lineDiscountTotal = r2(lines.reduce((s, l) => s + l.discount, 0));
    const orderDiscount = Number(order.order_discount_amount) || 0;
    const deliveryFee = Number(order.delivery_fee) || 0;

    let total = subtotal - orderDiscount + deliveryFee;
    let adjustment = 0;
    if(order.total !== null && order.total !== undefined && isFinite(Number(order.total)) &&
       Math.abs(Number(order.total) - total) > 0.005){
      adjustment = total - Number(order.total); // > 0 = a discount that wasn't itemised
      total = Number(order.total);
    }

    const paid = (order.paid_amount !== null && order.paid_amount !== undefined)
      ? Number(order.paid_amount)
      : ((order.status === 'confirmed' || order.status === 'shipped') ? total : 0);
    const balance = total - paid;

    const hasLineDisc = lineDiscountTotal > 0.004;
    const hasAdjust = Math.abs(adjustment) > 0.004;
    const rows = [];
    if(hasLineDisc || orderDiscount > 0 || deliveryFee > 0 || hasAdjust){
      rows.push(['Subtotal', money(subtotal + lineDiscountTotal)]);
    }
    if(hasLineDisc) rows.push(['Item discount', '-' + money(lineDiscountTotal)]);
    if(orderDiscount > 0){
      const pct = order.order_discount_type === 'percent' ? ' (' + Number(order.order_discount_value) + '%)' : '';
      rows.push([(hasLineDisc ? 'Order discount' : 'Discount') + pct, '-' + money(orderDiscount)]);
    }
    if(adjustment > 0.004) rows.push([(hasLineDisc || orderDiscount > 0) ? 'Other discount' : 'Discount', '-' + money(adjustment)]);
    if(adjustment < -0.004) rows.push(['Adjustment', '+' + money(Math.abs(adjustment))]);
    if(deliveryFee > 0) rows.push(['Delivery fee', money(deliveryFee)]);

    return {
      business: business,
      invoiceNo: invoiceNumberFor(order),
      date: formatDate(order.created_at),
      customer: order.customer_name || '',
      phone: order.customer_phone || '',
      lines: lines,
      rows: rows,
      total: r2(total),
      paid: r2(paid),
      balance: r2(balance)
    };
  }

  /* ---------- fonts / wrapping (bitmap means any script prints) ---------- */
  const seg = window.Intl && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;
  const gseg = window.Intl && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

  function layout(x, W, model){
    // QR failure is handled outside; here we only draw.
    const b = W > 400 ? 26 : 22, m = 8;
    const fam = fontStack();
    x.fillStyle = '#000'; x.strokeStyle = '#000'; x.textBaseline = 'top';
    let y = 10;

    const f = (s, w) => { x.font = (w || 400) + ' ' + s + 'px ' + fam; };
    const lh = s => Math.round(s * 1.4);

    function wrap(t, max){
      const out = [];
      String(t).split('\n').forEach(par => {
        const units = seg ? [...seg.segment(par)].map(s => s.segment) : par.split(/(\s+)/);
        const parts = [];
        units.forEach(u => {
          if(gseg && x.measureText(u).width > max) [...gseg.segment(u)].forEach(s => parts.push(s.segment));
          else parts.push(u);
        });
        let line = '';
        parts.forEach(u => {
          const tr = line + u;
          if(x.measureText(tr).width > max && line.trim()){ out.push(line.trimEnd()); line = u.trimStart(); }
          else line = tr;
        });
        out.push(line.trimEnd());
      });
      return out;
    }

    function T(t, s, o){
      o = o || {};
      f(s, o.w);
      wrap(t, W - 2 * m).forEach(l => {
        const tw = x.measureText(l).width;
        x.fillText(l, o.a === 'c' ? (W - tw) / 2 : o.a === 'r' ? W - m - tw : m, y);
        y += lh(s);
      });
    }

    function LR(l, r, s, w){
      f(s, w);
      const rw = x.measureText(r).width;
      wrap(l, W - 2 * m - rw - 12).forEach((t, i) => {
        x.fillText(t, m, y);
        if(i === 0) x.fillText(r, W - m - rw, y);
        y += lh(s);
      });
    }

    function rule(){
      y += 3;
      x.save();
      x.setLineDash([5, 4]); x.lineWidth = 2;
      x.beginPath(); x.moveTo(m, y); x.lineTo(W - m, y); x.stroke();
      x.restore();
      y += 9;
    }

    const B = model.business;

    /* shop logo (remembered in this browser) */
    if(state.logo){
      const lw = Math.round(W * 0.6);
      const lhh = Math.round(state.logo.height * lw / state.logo.width);
      x.drawImage(state.logo, Math.round((W - lw) / 2), y, lw, lhh);
      y += lhh + 8;
    }

    if(B.name) T(B.name, b + 8, { a: 'c', w: 700 });
    if(B.address) T(B.address, b - 4, { a: 'c' });
    if(B.phone) T(B.phone, b - 4, { a: 'c' });
    rule();

    T('INVOICE', b, { w: 700 });
    T(model.invoiceNo, b - 2);
    if(model.date) T('Date: ' + model.date, b - 4);
    if(model.customer) T('Customer: ' + model.customer, b - 2);
    if(model.phone) T(model.phone, b - 4);
    rule();

    if(!model.lines.length){
      T('No items', b - 2);
    }

    model.lines.forEach(line => {
      T(line.name, b, { w: 600 });
      if(line.detail) T(line.detail, b - 4);
      LR(line.qty + ' x ' + money(line.rate), money(line.amount), b - 2);
      if(line.discount > 0.004){
        LR('  Discount', '-' + money(line.discount), b - 4);
      }
      y += 4;
    });

    rule();

    model.rows.forEach(([label, value]) => LR(label, value, b - 1));
    y += 4;
    LR('TOTAL', money(model.total), b + 8, 700);

    if(model.paid > 0.004 || Math.abs(model.balance) > 0.004){
      LR('Paid', money(model.paid), b - 2);
      LR('Balance', money(model.balance), b + 2, 700);
    }
    rule();

    /* QR: ABA payment image from the site, or a generated Telegram link */
    if(state.qrImg){
      const maxQ = W > 400 ? 260 : 200;
      const qh = Math.min(maxQ, Math.round(state.qrImg.height * (maxQ / state.qrImg.width)));
      const qw = Math.round(state.qrImg.width * (qh / state.qrImg.height));
      y += 4;
      x.drawImage(state.qrImg, Math.round((W - qw) / 2), y, qw, qh);
      y += qh + 6;
      if(state.qrCaption) T(state.qrCaption, b - 4, { a: 'c' });
    }else if(B.telegram){
      try{
        const q = qrMatrix(B.telegram), n = q.length;
        const s = Math.max(2, Math.floor(Math.min(W * 0.6, 260) / n));
        const px = n * s, ox = Math.round((W - px) / 2);
        y += 6;
        for(let r = 0; r < n; r++){
          for(let c = 0; c < n; c++) if(q[r][c]) x.fillRect(ox + c * s, y + r * s, s, s);
        }
        y += px + 8;
        T('Telegram', b - 4, { a: 'c' });
      }catch(e){ /* text too long for the offline encoder — skip the QR */ }
    }

    const note = noteValue();
    if(note){
      y += 4;
      T(note, b, { a: 'c' });
    }
    y += 16;
    return Math.ceil(y);
  }

  /* Two passes: measure height first, then draw. */
  function renderCanvas(){
    if(!state.order) return null;
    const model = buildModel(state.order);
    const W = Number(paperValue()) || 576;
    const probe = document.createElement('canvas');
    probe.width = W; probe.height = 8;
    const H = layout(probe.getContext('2d'), W, model);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    layout(x, W, model);
    return c;
  }

  /* ---------- QR encoder (byte mode, EC level M, versions 1–10) ---------- */
  /* Copied from the invoice-maker tool: works offline, no CDN needed. */
  function qrMatrix(text){
    const data = [...new TextEncoder().encode(text)];
    const ECC = [0,10,16,26,18,24,16,18,22,22,26], NB = [0,1,1,1,2,2,4,4,4,5,5];
    const raw = v => { let r = (16 * v + 128) * v + 64; if(v >= 2){ const a = Math.floor(v / 7) + 2; r -= (25 * a - 10) * a - 55; if(v >= 7) r -= 36; } return r; };
    let ver = 1, cap = 0, ccb = 8;
    for(;; ver++){
      if(ver > 10) throw new Error('too long');
      cap = Math.floor(raw(ver) / 8) - ECC[ver] * NB[ver];
      ccb = ver < 10 ? 8 : 16;
      if(4 + ccb + data.length * 8 <= cap * 8) break;
    }
    const bits = [], put = (v, n) => { for(let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
    put(4, 4); put(data.length, ccb); data.forEach(b => put(b, 8));
    put(0, Math.min(4, cap * 8 - bits.length));
    while(bits.length % 8) bits.push(0);
    for(let p = 0xEC; bits.length < cap * 8; p ^= 0xEC ^ 0x11) put(p, 8);
    const cw = [];
    for(let i = 0; i < bits.length; i += 8){ let b = 0; for(let k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; cw.push(b); }

    const mul = (x, y) => { let z = 0; for(let i = 7; i >= 0; i--){ z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z; };
    const gen = deg => { const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1; for(let i = 0; i < deg; i++){ for(let j = 0; j < deg; j++){ r[j] = mul(r[j], root); if(j + 1 < deg) r[j] ^= r[j + 1]; } root = mul(root, 2); } return r; };
    const rem = (d, g) => { const r = g.map(() => 0); for(const b of d){ const f = b ^ r.shift(); r.push(0); g.forEach((c, i) => r[i] ^= mul(c, f)); } return r; };
    const nb = NB[ver], el = ECC[ver], rc = Math.floor(raw(ver) / 8), ns = nb - rc % nb, sl = Math.floor(rc / nb), g = gen(el);
    const blocks = []; let k = 0;
    for(let i = 0; i < nb; i++){
      const len = sl - el + (i < ns ? 0 : 1), d = cw.slice(k, k + len); k += len;
      const e = rem(d, g); if(i < ns) d.push(0); blocks.push(d.concat(e));
    }
    const res = [];
    for(let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if(i !== sl - el || j >= ns) res.push(b[i]); });

    const n = ver * 4 + 17;
    const mod = Array.from({ length: n }, () => Array(n).fill(false));
    const fn = Array.from({ length: n }, () => Array(n).fill(false));
    const setF = (x, y, v) => { mod[y][x] = v; fn[y][x] = true; };
    for(let i = 0; i < n; i++){ setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => { for(let dy = -4; dy <= 4; dy++) for(let dx = -4; dx <= 4; dx++){ const xx = cx + dx, yy = cy + dy; if(xx >= 0 && xx < n && yy >= 0 && yy < n){ const d = Math.max(Math.abs(dx), Math.abs(dy)); setF(xx, yy, d !== 2 && d !== 4); } } };
    finder(3, 3); finder(n - 4, 3); finder(3, n - 4);
    if(ver > 1){
      const na = Math.floor(ver / 7) + 2, step = Math.ceil((ver * 4 + 4) / (na * 2 - 2)) * 2, pos = [6];
      for(let p = n - 7; pos.length < na; p -= step) pos.splice(1, 0, p);
      for(let i = 0; i < na; i++) for(let j = 0; j < na; j++){
        if((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
        for(let dy = -2; dy <= 2; dy++) for(let dx = -2; dx <= 2; dx++) setF(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
    /* Reserve the format-info modules so the data bits skip them. */
    function fmtXY(i){ return i <= 5 ? [8, i] : i === 6 ? [8, 7] : i === 7 ? [8, 8] : i === 8 ? [7, 8] : [14 - i, 8]; }
    for(let i = 0; i <= 8; i++){ const [fx, fy] = fmtXY(i); setF(fx, fy, false); }
    for(let i = 9; i < 15; i++) setF(14 - i, 8, false);
    for(let i = 0; i < 8; i++) setF(n - 1 - i, 8, false);
    for(let i = 8; i < 15; i++) setF(8, n - 15 + i, false);
    setF(8, n - 8, true);
    if(ver >= 7){
      let r = ver; for(let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const b = (ver << 12) | r;
      for(let i = 0; i < 18; i++){ const c = ((b >>> i) & 1) !== 0, a = n - 11 + i % 3, bb = Math.floor(i / 3); setF(a, bb, c); setF(bb, a, c); }
    }
    let bi = 0;
    for(let right = n - 1; right >= 1; right -= 2){
      if(right === 6) right = 5;
      for(let vert = 0; vert < n; vert++) for(let j = 0; j < 2; j++){
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? n - 1 - vert : vert;
        if(!fn[y][x] && bi < res.length * 8){ mod[y][x] = ((res[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
      }
    }
    const mf = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x, y) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => x * y % 2 + x * y % 3 === 0,
      (x, y) => (x * y % 2 + x * y % 3) % 2 === 0,
      (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0
    ];
    const pen = m => {
      let p = 0;
      for(let a = 0; a < n; a++) for(const dir of [0, 1]){
        let run = 1;
        for(let q = 1; q < n; q++){
          const cur = dir ? m[q][a] : m[a][q], prev = dir ? m[q - 1][a] : m[a][q - 1];
          if(cur === prev){ run++; if(run === 5) p += 3; else if(run > 5) p++; } else run = 1;
        }
      }
      for(let r = 0; r < n - 1; r++) for(let c = 0; c < n - 1; c++){ const v = m[r][c]; if(v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3; }
      return p;
    };
    /* Format info (EC level M + mask) drawn for one candidate. */
    function applyFormat(m, mask){
      let r = mask;
      for(let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((mask << 10) | r) ^ 0x5412, bit = i => ((b >>> i) & 1) !== 0;
      const put = (x, y, v) => { m[y][x] = v; };
      for(let i = 0; i <= 5; i++) put(8, i, bit(i));
      put(8, 7, bit(6)); put(8, 8, bit(7)); put(7, 8, bit(8));
      for(let i = 9; i < 15; i++) put(14 - i, 8, bit(i));
      for(let i = 0; i < 8; i++) put(n - 1 - i, 8, bit(i));
      for(let i = 8; i < 15; i++) put(8, n - 15 + i, bit(i));
      put(8, n - 8, true);
    }

    let best = null, bp = 1e9;
    for(let mask = 0; mask < 8; mask++){
      const m = mod.map(r => r.slice());
      for(let y = 0; y < n; y++) for(let x = 0; x < n; x++) if(!fn[y][x] && mf[mask](x, y)) m[y][x] = !m[y][x];
      applyFormat(m, mask);
      const p = pen(m);
      if(p < bp){ bp = p; best = m; }
    }
    return best;
  }

  /* ---------- ESC/POS raster (GS v 0), 64-row bands, then feed ---------- */
  function raster(c){
    const W = c.width, H = c.height, wb = W >> 3, th = Number(darkValue()) || 165;
    const d = c.getContext('2d').getImageData(0, 0, W, H).data;
    const bands = Math.ceil(H / 64), out = new Uint8Array(2 + bands * 8 + wb * H + 3);
    let p = 0;
    out[p++] = 0x1b; out[p++] = 0x40;
    for(let y0 = 0; y0 < H; y0 += 64){
      const h = Math.min(64, H - y0);
      out.set([0x1d, 0x76, 0x30, 0, wb & 255, wb >> 8, h & 255, h >> 8], p); p += 8;
      for(let y = y0; y < y0 + h; y++) for(let bx = 0; bx < wb; bx++){
        let v = 0;
        for(let k = 0; k < 8; k++) if(d[((y * W) + bx * 8 + k) * 4] < th) v |= 0x80 >> k;
        out[p++] = v;
      }
    }
    out[p++] = 0x1b; out[p++] = 0x64; out[p++] = 4;
    return out;
  }

  /* ---------- Bluetooth ---------- */
  const SV = [
    '000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb',
    '0000fff0-0000-1000-8000-00805f9b34fb', '0000ffe0-0000-1000-8000-00805f9b34fb',
    '0000ae30-0000-1000-8000-00805f9b34fb', '0000fee7-0000-1000-8000-00805f9b34fb',
    'e7810a71-73ae-499d-8c15-faa9aef0c3f2', '49535343-fe7d-4ae5-8fa9-9fafd205e455'
  ];
  let btDev = null, btCh = null;

  async function pickChar(g){
    const cand = [];
    for(const s of await g.getPrimaryServices()){
      if(/^0000180[01]-/.test(s.uuid)) continue;
      for(const c of await s.getCharacteristics()) if(c.properties.writeWithoutResponse || c.properties.write) cand.push(c);
    }
    const c = cand.find(c => c.properties.writeWithoutResponse) || cand[0] || null;
    if(!c) throw new Error('Connected, but no writable channel was found on this printer.');
    return c;
  }

  async function btConnect(retry){
    if(!navigator.bluetooth) throw new Error('This browser has no Bluetooth printing. Use Chrome on Android or desktop, or choose System print / Save PNG.');
    if(!btDev){
      st('Choose your printer in the list…');
      btDev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: SV });
      btDev.addEventListener('gattserverdisconnected', () => { btCh = null; });
    }
    try{
      st('Connecting…');
      const g = await btDev.gatt.connect();
      btCh = await pickChar(g);
    }catch(e){
      if(!retry){ btDev = null; btCh = null; return btConnect(true); }
      throw e;
    }
  }

  async function btSend(bytes){
    const slow = $('krSlow').checked;
    let n = slow ? 20 : 100, gap = slow ? 30 : 12;
    for(let i = 0; i < bytes.length;){
      const p = bytes.subarray(i, i + n);
      try{
        if(btCh.properties.writeWithoutResponse) await btCh.writeValueWithoutResponse(p);
        else await btCh.writeValue(p);
      }catch(e){
        // Some printers only accept 20 bytes per write. Drop to that and retry the same spot.
        if(n > 20 && btDev && btDev.gatt.connected){ n = 20; gap = 30; continue; }
        throw e;
      }
      i += p.length;
      await wait(gap);
      if(((i / n) | 0) % 25 === 0) progress(i, bytes.length);
    }
  }

  /* ---------- USB (WebUSB) ---------- */
  let usbDev = null, usbIf = null, usbReady = false;

  async function usbConnect(){
    if(!navigator.usb) throw new Error('This browser has no USB printing. Use Chrome on Android or desktop, or choose Bluetooth.');
    if(!usbDev){
      const known = await navigator.usb.getDevices();
      usbDev = known.length === 1 ? known[0] : await navigator.usb.requestDevice({ filters: [] });
      usbReady = false;
    }
    try{
      if(!usbDev.opened) await usbDev.open();
      if(usbDev.configuration === null) await usbDev.selectConfiguration(1);
      if(!usbReady){
        const list = [];
        for(const itf of usbDev.configuration.interfaces) for(const a of itf.alternates){
          const ep = a.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
          if(ep) list.push({ n: itf.interfaceNumber, alt: a.alternateSetting, ep: ep.endpointNumber, cls: a.interfaceClass });
        }
        const f = list.find(i => i.cls === 7) || list[0];
        if(!f) throw new Error('No printer output was found on this USB device. Is it the printer?');
        await usbDev.claimInterface(f.n);
        if(f.alt) await usbDev.selectAlternateInterface(f.n, f.alt);
        usbIf = f; usbReady = true;
      }
    }catch(e){
      usbDev = null; usbReady = false;
      if(e && (e.name === 'NetworkError' || e.name === 'SecurityError')){
        throw new Error('Could not take control of the USB printer. Unplug it, plug it back in, and close other apps that use it.');
      }
      throw e;
    }
  }

  async function usbSend(bytes){
    const n = 1024;
    for(let i = 0; i < bytes.length;){
      const r = await usbDev.transferOut(usbIf.ep, bytes.subarray(i, i + n));
      if(r.status !== 'ok') throw new Error('USB transfer failed (' + r.status + ').');
      i += r.bytesWritten;
      progress(i, bytes.length);
    }
  }

  if(navigator.usb) navigator.usb.addEventListener('disconnect', e => {
    if(e.device === usbDev){ usbDev = null; usbReady = false; st('USB printer unplugged.'); }
  });

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const msg = e => (e && e.message) || String(e);
  const progress = (i, n) => st('Printing… ' + Math.min(100, Math.round(i / n * 100)) + '%');

  /* ---------- modal ---------- */
  const $ = id => document.getElementById(id);
  const noteValue = () => ($('krNote') ? $('krNote').value : '').trim();
  const paperValue = () => $('krPaper') ? $('krPaper').value : DEFAULTS.paper;
  const darkValue = () => $('krDark') ? $('krDark').value : DEFAULTS.dark;
  const connValue = () => $('krConn') ? $('krConn').value : DEFAULTS.conn;

  function st(m, err){
    const el = $('krStatus');
    if(!el) return;
    el.textContent = m;
    el.classList.toggle('err', !!err);
  }

  const CSS = `
  .kr-backdrop{ display:none; position:fixed; inset:0; background:rgba(4,8,10,.78); z-index:1200; padding:24px; overflow-y:auto; }
  .kr-backdrop.open{ display:flex; }
  .kr-modal{
    background:var(--surface,#111a1e); border:1px solid var(--line,#2a3a40); border-radius:10px;
    width:100%; max-width:980px; margin:auto; display:flex; flex-direction:column;
    max-height:94vh; color:var(--ink,#edf4f5);
  }
  .kr-top{ display:flex; align-items:center; justify-content:space-between; gap:12px; padding:13px 16px; border-bottom:1px solid var(--line,#2a3a40); font:600 15px var(--disp,sans-serif); }
  .kr-body{ display:grid; grid-template-columns:minmax(0,1fr) 330px; gap:18px; padding:16px; overflow-y:auto; }
  .kr-paper{ background:#fff; border-radius:4px; padding:10px; max-width:430px; margin:0 auto; }
  .kr-paper canvas{ display:block; width:100%; height:auto; }
  .kr-side{ display:flex; flex-direction:column; gap:12px; }
  .kr-field{ display:flex; flex-direction:column; gap:5px; font:500 12px var(--sans,sans-serif); color:var(--ink-dim,#89a0a7); }
  .kr-field input[type=text]{ width:100%; font:400 14px var(--sans,sans-serif); color:var(--ink,#edf4f5); background:var(--surface-2,#172226); border:1px solid var(--line,#2a3a40); border-radius:6px; padding:8px 10px; }
  .kr-field input[type=file]{ font:400 11px var(--sans,sans-serif); color:var(--ink-dim,#89a0a7); }
  .kr-set{ border:1px solid var(--line,#2a3a40); border-radius:8px; margin:0; padding:10px 12px 12px; display:flex; flex-direction:column; gap:9px; }
  .kr-set legend{ font:600 12px var(--sans,sans-serif); color:var(--ink-dim,#89a0a7); padding:0 5px; }
  .kr-set label{ display:flex; flex-direction:column; gap:4px; font:500 12px var(--sans,sans-serif); color:var(--ink-dim,#89a0a7); }
  .kr-set select{ font:400 13px var(--sans,sans-serif); color:var(--ink,#edf4f5); background:var(--surface-2,#172226); border:1px solid var(--line,#2a3a40); border-radius:6px; padding:7px 8px; }
  .kr-set input[type=range]{ width:100%; }
  .kr-chk{ flex-direction:row !important; align-items:center; gap:7px !important; }
  .kr-chk input{ width:auto; margin:0; }
  .kr-status{ font:500 12px var(--sans,sans-serif); color:var(--ink-dim,#89a0a7); min-height:17px; }
  .kr-status.err{ color:#e05a5a; }
  .kr-actions{ display:flex; gap:8px; }
  .kr-actions > *{ flex:1; }
  .kr-actions2{ display:flex; gap:8px; }
  .kr-actions2 > *{ flex:1; }
  .kr-btn{ font:600 13px var(--sans,sans-serif); border:1px solid var(--line,#2a3a40); background:transparent; color:var(--ink,#edf4f5); padding:9px 12px; border-radius:6px; cursor:pointer; }
  .kr-btn:hover{ filter:brightness(1.15); }
  .kr-btn.primary{ background:#20c3df; border-color:#20c3df; color:#061317; }
  .kr-btn:disabled{ opacity:.55; cursor:default; }
  .kr-hint{ font:400 11px/1.5 var(--sans,sans-serif); color:var(--ink-faint,#5c7178); margin:0; }
  @media (max-width:820px){
    .kr-backdrop{ padding:10px; }
    .kr-body{ grid-template-columns:minmax(0,1fr); }
    .kr-modal{ max-height:96vh; }
  }
  @media print{
    @page{ margin:0; size:auto; }
    body.kr-printing > *{ display:none !important; }
    body.kr-printing > .kr-print-root{ display:block !important; }
    .kr-print-root img{ width:100%; display:block; }
  }
  `;

  function ensureDom(){
    if($('krBackdrop')) return;

    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.className = 'kr-backdrop';
    wrap.id = 'krBackdrop';
    wrap.innerHTML = `
      <div class="kr-modal" role="dialog" aria-modal="true" aria-labelledby="krTitle">
        <div class="kr-top">
          <span id="krTitle">Thermal receipt</span>
          <button class="kr-btn" type="button" id="krClose">Close</button>
        </div>
        <div class="kr-body">
          <div>
            <div class="kr-paper"><canvas id="krPreview"></canvas></div>
            <p class="kr-hint" style="text-align:center; margin-top:8px;">1 preview pixel = 1 printer dot. The printed receipt matches this layout.</p>
          </div>
          <div class="kr-side">
            <div class="kr-field">
              <label for="krNote">Footer message</label>
              <input id="krNote" type="text" placeholder="Thank you!">
            </div>
            <div class="kr-field">
              <label for="krLogo">Shop logo (optional)</label>
              <input id="krLogo" type="file" accept="image/*">
              <button class="kr-btn" type="button" id="krLogoRemove" style="align-self:flex-start;">Remove logo</button>
            </div>
            <fieldset class="kr-set">
              <legend>Printer</legend>
              <label>Connection
                <select id="krConn">
                  <option value="bt">Bluetooth</option>
                  <option value="usb">USB cable</option>
                </select>
              </label>
              <label>Paper width
                <select id="krPaper">
                  <option value="384">58 mm</option>
                  <option value="576">80 mm</option>
                </select>
              </label>
              <label>Print darkness
                <input id="krDark" type="range" min="100" max="220" step="5">
              </label>
              <label class="kr-chk"><input id="krSlow" type="checkbox"> Slow Bluetooth mode (if garbled or stops early)</label>
            </fieldset>
            <fieldset class="kr-set">
              <legend>Style</legend>
              <label>Receipt font
                <select id="krFont"></select>
              </label>
            </fieldset>
            <div class="kr-status" id="krStatus" role="status" aria-live="polite"></div>
            <div class="kr-actions">
              <button class="kr-btn primary" type="button" id="krPrint">Print on printer</button>
            </div>
            <div class="kr-actions2">
              <button class="kr-btn" type="button" id="krSys">System print</button>
              <button class="kr-btn" type="button" id="krPng">Save PNG</button>
            </div>
            <p class="kr-hint">Bluetooth / USB works in Chrome on Android or desktop. On iPhone, use System print or Save PNG.</p>
          </div>
        </div>
      </div>`;
    document.body.appendChild(wrap);

    const prefs = loadPrefs();
    $('krNote').value = prefs.note != null ? prefs.note : DEFAULTS.note;
    $('krConn').value = prefs.conn;
    $('krPaper').value = prefs.paper;
    $('krDark').value = prefs.dark;
    $('krSlow').checked = !!prefs.slow;
    $('krFont').innerHTML = Object.keys(FONTS).map(k =>
      `<option value="${k}">${FONTS[k].label}</option>`).join('');
    $('krFont').value = FONTS[prefs.font] ? prefs.font : DEFAULTS.font;

    const rerender = () => { saveControls(); updatePreview(); };
    $('krNote').addEventListener('input', rerender);
    $('krPaper').addEventListener('change', rerender);
    $('krDark').addEventListener('input', rerender);
    $('krConn').addEventListener('change', saveControls);
    $('krSlow').addEventListener('change', saveControls);

    // Switching font may need to download it first, so show progress and
    // only redraw once the face is ready (falls back after 6 s anyway).
    $('krFont').addEventListener('change', async () => {
      saveControls();
      const key = fontKey();
      if(FONTS[key].google){
        st('Loading font…');
        await ensureFont(key);
        st('');
      }
      updatePreview();
    });

    $('krLogo').addEventListener('change', e => {
      const f = e.target.files[0];
      if(!f) return;
      const r = new FileReader();
      r.onload = () => setLogo(r.result, true);
      r.readAsDataURL(f);
      e.target.value = '';
    });
    $('krLogoRemove').addEventListener('click', () => {
      state.logo = null;
      try{ localStorage.removeItem(LOGO_KEY); }catch(e){}
      updatePreview();
    });

    $('krClose').addEventListener('click', close);
    $('krBackdrop').addEventListener('click', e => { if(e.target.id === 'krBackdrop') close(); });
    document.addEventListener('keydown', e => {
      if(e.key === 'Escape' && $('krBackdrop') && $('krBackdrop').classList.contains('open')) close();
    });

    $('krPrint').addEventListener('click', doPrint);
    $('krSys').addEventListener('click', () => {
      const c = renderCanvas();
      if(c) systemPrint(c);
    });
    $('krPng').addEventListener('click', () => {
      const c = renderCanvas();
      if(!c) return;
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = 'receipt-' + (state.order ? invoiceNumberFor(state.order) : 'keycam') + '.png';
      a.click();
    });

    const savedLogo = (() => { try{ return localStorage.getItem(LOGO_KEY); }catch(e){ return null; } })();
    if(savedLogo) setLogo(savedLogo, false);
  }

  function saveControls(){
    savePrefs({
      conn: connValue(),
      paper: paperValue(),
      dark: darkValue(),
      slow: $('krSlow').checked,
      note: $('krNote').value,
      font: fontKey()
    });
  }

  function updatePreview(){
    const c = renderCanvas();
    const pv = $('krPreview');
    if(!c || !pv) return;
    pv.width = c.width;
    pv.height = c.height;
    pv.getContext('2d').drawImage(c, 0, 0);
  }

  function setLogo(src, store){
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, 576 / im.width);
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(im.width * s));
      c.height = Math.max(1, Math.round(im.height * s));
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(im, 0, 0, c.width, c.height);
      state.logo = c;
      if(store){
        try{ localStorage.setItem(LOGO_KEY, c.toDataURL('image/png')); }
        catch(e){ st('Logo is used now but is too large to remember for next time.', true); }
      }
      updatePreview();
    };
    im.onerror = () => st('That file could not be read as an image.', true);
    im.src = src;
  }

  function systemPrint(canvas){
    let root = document.querySelector('.kr-print-root');
    if(!root){
      root = document.createElement('div');
      root.className = 'kr-print-root';
      root.style.display = 'none';
      document.body.appendChild(root);
    }
    const img = new Image();
    img.onload = () => {
      document.body.classList.add('kr-printing');
      window.print();
    };
    img.src = canvas.toDataURL('image/png');
    root.textContent = '';
    root.appendChild(img);
    const cleanup = () => {
      document.body.classList.remove('kr-printing');
      root.textContent = '';
    };
    window.addEventListener('afterprint', cleanup, { once: true });
  }

  async function doPrint(){
    if(busy) return;
    const c = renderCanvas();
    if(!c) return;
    busy = true;
    $('krPrint').disabled = true;
    try{
      const bytes = raster(c);
      if(connValue() === 'usb'){
        await usbConnect();
        st('Printing…');
        await usbSend(bytes);
      }else{
        if(!btCh || !btDev || !btDev.gatt.connected) await btConnect();
        st('Printing…');
        await btSend(bytes);
      }
      st('Sent to printer.');
    }catch(e){
      if(e && e.name === 'NotFoundError') st('No printer chosen.');
      else st(msg(e), true);
    }finally{
      busy = false;
      $('krPrint').disabled = false;
    }
  }

  function loadQrImage(url){
    return new Promise(resolve => {
      if(!url){ resolve(null); return; }
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  async function open(order, opts){
    if(!order) return;
    ensureDom();
    state.order = order;
    state.opts = opts || {};
    state.qrImg = null;
    state.qrCaption = '';
    st('');

    if(state.opts.qrPath){
      state.qrImg = await loadQrImage(state.opts.qrPath);
      if(state.qrImg) state.qrCaption = state.opts.qrCaption || 'Scan to pay (ABA)';
    }

    // Open immediately with the fallback face, then redraw once the chosen
    // web font is ready (ensureFont resolves even offline, so no hard wait).
    $('krTitle').textContent = 'Thermal receipt — ' + invoiceNumberFor(order);
    $('krBackdrop').classList.add('open');
    document.body.style.overflow = 'hidden';
    updatePreview();

    const key = fontKey();
    const f = FONTS[key];
    let needsFont = !!(f && f.google);
    try{ if(needsFont && document.fonts.check('400 22px "' + f.css + '"')) needsFont = false; }catch(e){}
    if(needsFont){
      st('Loading font…');
      ensureFont(key).then(() => {
        if($('krBackdrop') && $('krBackdrop').classList.contains('open')){
          st('');
          updatePreview();
        }
      });
    }
  }

  function close(){
    const b = $('krBackdrop');
    if(b) b.classList.remove('open');
    document.body.style.overflow = '';
  }

  window.KeycamReceipt = {
    open,
    close,
    buildModel,
    renderCanvas,
    _qrMatrix: qrMatrix,
    _raster: raster
  };
})();
