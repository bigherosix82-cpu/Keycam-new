/* =========================
   KEYCAM — INVOICE (PDF)
   One copy of the invoice builder, shared by admin-catalog.html and
   deskmat/admin.html (before, each page had its own copy and they drifted).

   Needs jsPDF loaded first. Used like:
     const built = await KeycamInvoice.build(order, { qrPath: 'deskmat/ABA_QR.jpg' });
     // built = { doc, invoiceNo }  or  null if jsPDF did not load

   Business / bank details live in BUSINESS below — change them here only.

   Khmer text (customer name, product names) can't be drawn by jsPDF's built-in
   font, so any line that contains Khmer is drawn by the browser onto a small
   image and placed on the PDF. Everything else stays real selectable text.
========================= */
(function(){
  'use strict';

  const BUSINESS = {
    name: 'Keycam',
    address: 'Toulkork Phnom Penh Cambodia',
    phone: '0886449944',
    telegram: 'https://t.me/Keycamm',
    payableTo: 'Khouch Jing',
    accountNo: '001 192 298',
    paymentMethod: 'ABA'
  };

  const DEFAULT_MAINTENANCE_DISCOUNT = 0.20; // fallback for orders placed before maintenance_discount was captured

  const TERMS = [
    'No returnable to cash after purchase.',
    '1 year warranty on a new product.',
    'If there are any technical issues within 7 days, you can exchange for the new one.',
    'Warranty void on electric shock, seal broken, misuse, or modification.'
  ];

  const KHMER = /[\u1780-\u17FF\u19E0-\u19FF]/;
  const KHMER_FONTS = '"Khmer OS Battambang","Noto Sans Khmer","Khmer UI","Leelawadee UI","Khmer Sangam MN",sans-serif';

  function typeName(t){
    return t === 'mousepad' ? 'Mouse Pad' : t === 'fps' ? 'FPS Mouse Pad' : t === 'glass' ? 'Glass Mouse Pad' : (t || '');
  }

  function formatDate(iso){
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  function invoiceNumberFor(order){
    const d = new Date(order.created_at);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const shortId = (order.id || '').replace(/-/g, '').slice(0, 6).toUpperCase();
    return `INV-${y}${m}${day}-${shortId}`;
  }

  function loadImageAsDataURL(url){
    return new Promise((resolve) => {
      if(!url || typeof Image === 'undefined'){ resolve(null); return; }
      const img = new Image();
      img.onload = () => {
        try{
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          resolve({ dataUrl: canvas.toDataURL('image/jpeg'), w: img.naturalWidth, h: img.naturalHeight });
        }catch(e){
          resolve(null); // e.g. blocked by CORS/tainted canvas — invoice still works, just without the QR
        }
      };
      img.onerror = () => resolve(null); // file not found — invoice falls back to text-only payment details
      img.src = url;
    });
  }

  /* ---------- per-line pricing (unchanged logic) ---------- */
  function reconstructLinePricing(order, it){
    const qty = Number(it.qty) || 0;
    const finalPrice = Number(it.price) || 0; // what's actually stored — already discounted, if a discount applied

    // Orders made/edited with "Create order" store the exact per-item discount in dollars.
    if(it.lineDiscount != null && it.originalPrice != null){
      const originalPrice = Number(it.originalPrice);
      const discountTotal = Number(it.lineDiscount) || 0;
      const amount = Math.round((originalPrice * qty - discountTotal) * 100) / 100;
      return { rate: originalPrice, discountTotal, amount };
    }

    // Catalog checkout captures the pre-discount price directly on the item.
    if(it.originalPrice != null && Number(it.originalPrice) > finalPrice){
      const originalPrice = Number(it.originalPrice);
      const amount = finalPrice * qty;
      const discountTotal = Math.round((originalPrice * qty - amount) * 100) / 100;
      return { rate: originalPrice, discountTotal, amount };
    }

    // Older Deskmat-style sitewide maintenance-mode discount.
    const discountEligible = order.maintenance_mode && (it.type === 'mousepad' || it.type === 'fps');
    if(!discountEligible){
      return { rate: finalPrice, discountTotal: 0, amount: finalPrice * qty };
    }

    const rate = order.maintenance_discount != null
      ? Number(order.maintenance_discount)
      : DEFAULT_MAINTENANCE_DISCOUNT;
    const originalPrice = rate < 1 ? finalPrice / (1 - rate) : finalPrice;
    const roundedOriginal = Math.round(originalPrice * 100) / 100;
    const amount = finalPrice * qty;
    const discountTotal = Math.round((roundedOriginal * qty - amount) * 100) / 100;
    return { rate: roundedOriginal, discountTotal, amount };
  }

  /* ---------- text helpers (Khmer-safe) ---------- */
  let measureCtx;
  function canvasCtx(){
    if(measureCtx !== undefined) return measureCtx;
    try{ measureCtx = (typeof document !== 'undefined' && document.createElement('canvas').getContext('2d')) || null; }
    catch(e){ measureCtx = null; }
    return measureCtx;
  }
  const hasKhmer = s => KHMER.test(String(s == null ? '' : s));
  const SCALE = 4; // canvas pixels per PDF point, keeps Khmer sharp

  function makeText(doc){
    const useCanvas = s => hasKhmer(s) && !!canvasCtx();

    function width(s, size, bold){
      s = String(s);
      if(useCanvas(s)){
        const g = canvasCtx();
        g.font = `${bold ? 'bold ' : ''}${size * SCALE}px ${KHMER_FONTS}`;
        return g.measureText(s).width / SCALE;
      }
      doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
      return doc.getTextWidth(s);
    }

    // Returns an array of lines that each fit in maxW.
    function wrap(s, maxW, size, bold){
      s = String(s == null ? '' : s);
      if(!s) return [];
      if(!useCanvas(s)){
        doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
        return doc.splitTextToSize(s, maxW);
      }
      const lines = [];
      let cur = '';
      s.split(/\s+/).forEach(word => {
        const tryLine = cur ? cur + ' ' + word : word;
        if(width(tryLine, size, bold) <= maxW){ cur = tryLine; return; }
        if(cur) lines.push(cur);
        cur = '';
        if(width(word, size, bold) <= maxW){ cur = word; return; }
        // a single very long word: break it by characters
        Array.from(word).forEach(ch => {
          if(width(cur + ch, size, bold) <= maxW) cur += ch;
          else { if(cur) lines.push(cur); cur = ch; }
        });
      });
      if(cur) lines.push(cur);
      return lines;
    }

    // gray: 0 = black, 90 = dark gray, 255 = white
    function put(s, x, y, o){
      o = o || {};
      s = String(s == null ? '' : s);
      if(!s) return;
      const size = o.size || 10, gray = o.gray == null ? 0 : o.gray, align = o.align || 'left';
      if(useCanvas(s)){
        const w = width(s, size, o.bold);
        const hPt = size * 1.8, base = size * 1.3;
        const c = document.createElement('canvas');
        c.width = Math.ceil((w + 2) * SCALE);
        c.height = Math.ceil(hPt * SCALE);
        const g = c.getContext('2d');
        g.font = `${o.bold ? 'bold ' : ''}${size * SCALE}px ${KHMER_FONTS}`;
        g.fillStyle = `rgb(${gray},${gray},${gray})`;
        g.textBaseline = 'alphabetic';
        g.fillText(s, SCALE, base * SCALE);
        const ix = align === 'right' ? x - w - 1 : align === 'center' ? x - w / 2 - 1 : x - 1;
        doc.addImage(c.toDataURL('image/png'), 'PNG', ix, y - base, c.width / SCALE, c.height / SCALE);
        return;
      }
      doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(gray);
      doc.text(s, x, y, { align });
    }
    return { width, wrap, put };
  }

  /* ---------- the invoice ---------- */
  async function build(order, opts){
    opts = opts || {};
    if(!window.jspdf || !window.jspdf.jsPDF) return null;

    const qr = await loadImageAsDataURL(opts.qrPath);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const T = makeText(doc);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 40;
    const rightX = pageW - margin;
    const bottomLimit = pageH - 40;
    let y = 50;

    // --- Header: business info (left) / INVOICE title (right) ---
    T.put(BUSINESS.name, margin, y, { size: 20, bold: true });
    T.put(BUSINESS.address, margin, y + 16, { size: 9, gray: 90 });
    T.put(BUSINESS.phone, margin, y + 28, { size: 9, gray: 90 });
    T.put(BUSINESS.telegram, margin, y + 40, { size: 9, gray: 90 });

    T.put('INVOICE', rightX, y, { size: 22, bold: true, align: 'right' });
    const invoiceNo = invoiceNumberFor(order);
    T.put('Invoice No.:', rightX - 104, y + 20, { size: 9, gray: 90, align: 'right' });
    T.put(invoiceNo, rightX, y + 20, { size: 9, align: 'right' });
    T.put('Date:', rightX - 104, y + 33, { size: 9, gray: 90, align: 'right' });
    T.put(formatDate(order.created_at), rightX, y + 33, { size: 9, align: 'right' });

    y += 60;
    doc.setDrawColor(0); doc.setLineWidth(2);
    doc.line(margin, y, rightX, y);
    y += 26;

    // --- Bill To ---
    T.put('Bill To', margin, y, { size: 10, bold: true });
    const nameLines = T.wrap(order.customer_name || '—', rightX - margin - 220, 11, false);
    nameLines.forEach((ln, i) => T.put(ln, margin, y + 16 + i * 14, { size: 11 }));
    let billH = 16 + nameLines.length * 14;
    if(order.customer_phone){
      T.put(order.customer_phone, margin, y + billH, { size: 9, gray: 90 });
      billH += 14;
    }
    y += Math.max(50, billH + 14);

    // --- Items table ---
    const items = Array.isArray(order.items) ? order.items : [];
    const col = { no: margin, product: margin + 30, qty: rightX - 210, rate: rightX - 150, disc: rightX - 85, amt: rightX };
    const productW = col.qty - 34 - col.product; // room for the name before the Qty column

    function tableHeader(yy){
      doc.setFillColor(0, 0, 0);
      doc.rect(margin, yy, rightX - margin, 22, 'F');
      T.put('No.', col.no + 4, yy + 15, { size: 9, bold: true, gray: 255 });
      T.put('Product', col.product, yy + 15, { size: 9, bold: true, gray: 255 });
      T.put('Qty', col.qty, yy + 15, { size: 9, bold: true, gray: 255, align: 'right' });
      T.put('Rate', col.rate, yy + 15, { size: 9, bold: true, gray: 255, align: 'right' });
      T.put('Discount', col.disc, yy + 15, { size: 9, bold: true, gray: 255, align: 'right' });
      T.put('Amount', col.amt, yy + 15, { size: 9, bold: true, gray: 255, align: 'right' });
      return yy + 22;
    }

    y = tableHeader(y);

    let subtotal = 0;
    let lineDiscountTotal = 0;
    items.forEach((it, i) => {
      const qty = Number(it.qty) || 0;
      const { rate, discountTotal: discount, amount } = reconstructLinePricing(order, it);
      subtotal += amount;
      lineDiscountTotal += Number(discount) || 0;

      // Catalog-checkout items carry a variantSummary instead of type/size/thickness.
      const subtitle = it.variantSummary || [typeName(it.type), it.size, it.thickness].filter(Boolean).join(', ');
      const nLines = T.wrap(it.name || '', productW, 10, true);
      const sLines = T.wrap(subtitle, productW, 8.5, false);
      const rowH = Math.max(30, 8 + Math.max(1, nLines.length) * 12 + sLines.length * 11 + 5);

      if(y + rowH > bottomLimit){
        doc.addPage();
        y = 50;
        y = tableHeader(y);
      }

      T.put(String(i + 1), col.no + 4, y + 13, { size: 10, bold: true });
      nLines.forEach((ln, k) => T.put(ln, col.product, y + 13 + k * 12, { size: 10, bold: true }));
      const subY = y + 13 + Math.max(0, nLines.length - 1) * 12 + 12;
      sLines.forEach((ln, k) => T.put(ln, col.product, subY + k * 11, { size: 8.5, gray: 90 }));
      T.put(String(qty), col.qty, y + 13, { size: 10, align: 'right' });
      T.put(rate.toFixed(2), col.rate, y + 13, { size: 10, align: 'right' });
      T.put(discount.toFixed(2), col.disc, y + 13, { size: 10, align: 'right' });
      T.put(amount.toFixed(2), col.amt, y + 13, { size: 10, align: 'right' });

      doc.setDrawColor(220); doc.setLineWidth(1);
      doc.line(margin, y + rowH, rightX, y + rowH);
      y += rowH;
    });

    // --- totals maths ---
    const orderDiscount = Number(order.order_discount_amount) || 0;
    const deliveryFee = Number(order.delivery_fee) || 0;
    const tax = 0;
    let total = subtotal - orderDiscount + deliveryFee + tax;
    // Safety net: the total stored on the order is what the customer was really
    // charged. If the itemised lines don't add up to it (e.g. an older order that
    // never saved each item's original price), show the gap as its own row.
    let adjustment = 0;
    if(order.total !== null && order.total !== undefined && isFinite(Number(order.total)) &&
       Math.abs(Number(order.total) - total) > 0.005){
      adjustment = total - Number(order.total); // > 0 = a discount that wasn't itemised
      total = Number(order.total);
    }
    // Paid comes from the order's tracked paid_amount (deposits, partial payments).
    // Falls back to the old status-based rule for orders saved before that column existed.
    const paid = (order.paid_amount !== null && order.paid_amount !== undefined)
      ? Number(order.paid_amount)
      : ((order.status === 'confirmed' || order.status === 'shipped') ? total : 0);
    const balance = total - paid;

    const hasLineDisc = lineDiscountTotal > 0.004;
    const hasAdjust = Math.abs(adjustment) > 0.004;
    const rows = []; // [label, value]
    if(hasLineDisc || orderDiscount > 0 || deliveryFee > 0 || hasAdjust) rows.push(['Subtotal', `$${(subtotal + lineDiscountTotal).toFixed(2)}`]);
    if(hasLineDisc) rows.push(['Item discount', `-$${lineDiscountTotal.toFixed(2)}`]);
    if(orderDiscount > 0){
      const pct = order.order_discount_type === 'percent' ? ` (${Number(order.order_discount_value)}%)` : '';
      rows.push([(hasLineDisc ? 'Order discount' : 'Discount') + pct, `-$${orderDiscount.toFixed(2)}`]);
    }
    if(adjustment > 0.004) rows.push([(hasLineDisc || orderDiscount > 0) ? 'Other discount' : 'Discount', `-$${adjustment.toFixed(2)}`]);
    if(adjustment < -0.004) rows.push(['Adjustment', `+$${Math.abs(adjustment).toFixed(2)}`]);
    if(deliveryFee > 0) rows.push(['Delivery fee', `$${deliveryFee.toFixed(2)}`]);
    rows.push(['Tax (0.0%)', `$${tax.toFixed(2)}`]);

    // --- Payment Detail (left) + Totals (right): keep the block together on one page ---
    y += 26;
    const blockH = Math.max(90, rows.length * 18 + 75);
    if(y + blockH > bottomLimit){ doc.addPage(); y = 50; }
    const payY = y;

    T.put('Payment Detail', margin, payY, { size: 10, bold: true });
    T.put('Payable To', margin, payY + 16, { size: 9, gray: 90 });
    T.put('Account No', margin, payY + 30, { size: 9, gray: 90 });
    T.put('Other Details', margin, payY + 44, { size: 9, gray: 90 });
    T.put(BUSINESS.payableTo, margin + 80, payY + 16, { size: 9 });
    T.put(BUSINESS.accountNo, margin + 80, payY + 30, { size: 9 });
    T.put(BUSINESS.paymentMethod, margin + 80, payY + 44, { size: 9 });

    if(qr && qr.dataUrl){
      const qrSize = 74;
      const qrX = margin + 220;
      try{
        doc.addImage(qr.dataUrl, 'JPEG', qrX, payY - 8, qrSize, qrSize);
        T.put('Scan to pay', qrX + qrSize / 2, payY - 8 + qrSize + 10, { size: 7.5, gray: 120, align: 'center' });
      }catch(e){ /* image failed to embed — invoice still renders fine without it */ }
    }

    const totW = 200, totX = rightX - totW;
    let ty = payY;
    rows.forEach(([label, value]) => {
      T.put(label, totX, ty, { size: 9, gray: 90 });
      T.put(value, rightX, ty, { size: 9, align: 'right' });
      ty += 18;
    });
    T.put('Total', totX, ty, { size: 11, bold: true });
    T.put(`$${total.toFixed(2)}`, rightX, ty, { size: 11, bold: true, align: 'right' });
    ty += 18;
    T.put('Paid', totX, ty, { size: 9, gray: 90 });
    T.put(`$${paid.toFixed(2)}`, rightX, ty, { size: 9, align: 'right' });
    ty += 10;
    doc.setDrawColor(0); doc.setLineWidth(1); doc.line(totX, ty, rightX, ty);
    ty += 16;
    T.put('Balance', totX, ty, { size: 13, bold: true });
    T.put(`$${balance.toFixed(2)}`, rightX, ty, { size: 13, bold: true, align: 'right' });

    y = Math.max(payY + 60, ty + 40);

    // --- Terms & Conditions ---
    const termLines = TERMS.map(line => doc.splitTextToSize('• ' + line, 280));
    const termsH = 16 + termLines.reduce((a, l) => a + l.length * 12, 0) + 30;
    if(y + termsH > bottomLimit){ doc.addPage(); y = 50; }
    T.put('Terms & Condition', margin, y, { size: 10, bold: true });
    y += 16;
    termLines.forEach(wrapped => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 12;
    });

    // --- Signature ---
    T.put(BUSINESS.name, rightX, y - 10, { size: 10, align: 'right' });
    T.put('Signature', rightX, y + 4, { size: 10, align: 'right' });
    doc.setTextColor(0);

    return { doc, invoiceNo };
  }

  window.KeycamInvoice = { build, invoiceNumberFor, typeName, BUSINESS, DEFAULT_MAINTENANCE_DISCOUNT, _pricing: reconstructLinePricing };
})();
