# Changelog

## 2026-11-12 — Thermal receipt printing for orders

Imported the standalone receipt maker (`invoice-maker (3).html`) into the KeyCam
admin and wired it to the `orders` table, so an order can be printed on a
Bluetooth / USB thermal printer without retyping anything.

### Files
| File | Status | Notes |
|---|---|---|
| `shared/thermal-receipt.js` | **new** | Receipt module (canvas → ESC/POS bitmap), printing, QR, font picker, prefs. |
| `admin-catalog.html` | modified | New script include, **Receipt** row button, **Print receipt** in the invoice modal, `openThermalReceipt()`, `closeInvoicePreview()`, `invoiceOrderId`. |
| `deskmat/admin.html` | modified | Same integration with `../shared/...` paths and QR `assets/ABA_QR.jpg`. |
| `shared/invoice.js` | unchanged | Source of `BUSINESS`, `_pricing()`, `invoiceNumberFor()` (created 2026-10-22). |

### What it does
- **Receipt button on every order row** (pending and all orders) in both admin pages.
- **Print receipt** button inside the existing Invoice Preview modal — closes the PDF preview and opens the receipt for the same order.
- Draws the receipt as a **bitmap, 1 canvas px = 1 printer dot**, so Khmer / Chinese
  product names print correctly on any ESC/POS printer (no printer font needed).
- **Print paths:** Bluetooth (Web Bluetooth), USB cable (WebUSB), System print,
  Save PNG. Bluetooth / USB need Chrome on Android or desktop over HTTPS.
- **Paper:** 58 mm (384 dots, default) and 80 mm (576 dots).
- **ABA KHQR:** uses `deskmat/ABA_QR.jpg` / `assets/ABA_QR.jpg` with
  “Scan to pay (ABA)”; falls back to an offline-generated Telegram QR if missing.
- **Logo upload** (stored as a downscaled PNG), footer message, print darkness,
  slow-Bluetooth mode.

### Pricing (must stay identical to the PDF invoice)
All math is delegated to `window.KeycamInvoice._pricing(order, item)` and
`invoiceNumberFor(order)`, so the receipt matches `shared/invoice.js`:
- line rate / qty / line discount / amount,
- subtotal, item discount, order discount (with % when percent),
- delivery fee,
- stored `orders.total` as the authoritative total (un-itemised differences are
  shown as “Other discount” / “Adjustment”),
- paid and balance.
- Legacy maintenance-mode discount is handled by `invoice.js` as before.
- Invoice number format: `INV-YYYYMMDD-XXXXXX`.

### Persistence (`localStorage`, per browser)
- `keycam_receipt_prefs_v1` → `{ conn, paper, dark, slow, note, font }`
- `keycam_receipt_logo_v1` → logo data URL
- Defaults: Bluetooth, 58 mm, darkness 165, note “Thank you!”, font `system`.

### Font picker (added same day, after first version)
Modal → **Style → Receipt font**:
| Key | Label |
|---|---|
| `system` | System (default) |
| `kantumruy` | Kantumruy Pro — Khmer + English (recommended) |
| `roboto` | Roboto Condensed — narrow, fits more |
| `inter` | Inter — clean and modern |
| `mono` | JetBrains Mono — receipt style |

- Google fonts are loaded on demand (`ensureFont`), with a 6 s timeout so an
  offline phone falls back to the system font instead of blocking.
- The modal opens immediately and redraws when the font is ready; switching
  font shows “Loading font…” and redraws after load.
- Because printing is a bitmap, only the phone/computer needs the font.

### API
```js
window.KeycamReceipt.open(order, { qrPath: 'deskmat/ABA_QR.jpg', qrCaption: 'Scan to pay (ABA)' });
window.KeycamReceipt.close();
window.KeycamReceipt.buildModel(order);   // { business, invoiceNo, date, customer, phone, lines, rows, total, paid, balance }
window.KeycamReceipt.renderCanvas();      // canvas for the current order
window.KeycamReceipt._qrMatrix(text);     // offline QR encoder (byte mode, EC M, v1–10)
window.KeycamReceipt._raster(canvas);     // ESC/POS GS v 0 bytes
```

### QR encoder fix
The imported offline encoder was patched: format-info modules are reserved before
data placement and the format bits + mask are applied per candidate mask, then the
lowest-penalty mask is chosen. Verified with `jsQR` (decodes exactly).

### Tested
- Receipt opens from order rows and from the invoice modal on both pages.
- Real orders reproduce invoice totals (Josua maintenance discount, 4-item Heng order).
- 384 / 576 widths; ESC/POS band headers (GS v 0), init `ESC @`, feed `ESC d 4` valid.
- All five fonts load, change the bitmap, and persist across reload.
- No console errors on either admin page.

### Known limitation (not fixed, deliberately skipped)
- **WebUSB on Windows** often fails with “Could not take control of the USB
  printer…” because the printer is bound to the Windows driver (`usbprint.sys`)
  rather than WinUSB; Chrome cannot claim the interface. Bluetooth works and is
  the chosen path. Options if USB is needed later: use System print, or replace
  the printer driver with WinUSB via Zadig (dedicates the device to the web app),
  or use Android Chrome + USB‑C OTG.

### To deploy
Upload to Netlify:
1. `shared/thermal-receipt.js` (new)
2. `admin-catalog.html`
3. `deskmat/admin.html`

The live site stays on the old code until these are uploaded.
