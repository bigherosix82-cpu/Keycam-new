// KeyCam Telegram catalog bot — READ ONLY, no AI.
//
// Reads the same public data your website reads (anon key only, never the
// admin login), so it can never change prices, edit products or see orders.
//
//   Keyboard / Accessories / Mouse -> catalog_products_public + catalog_variants_public
//   Deskmat                        -> products + pricing + collections
//   Discounts                      -> store_settings (festival + maintenance)
//
// Secrets (supabase secrets set ...):
//   TELEGRAM_BOT_TOKEN       from @BotFather
//   TELEGRAM_WEBHOOK_SECRET  any random string, also passed to setWebhook
//   CONTACT_URL   (optional) e.g. https://t.me/YourUsername  -> "Message us" button
//   SITE_URL      (optional) e.g. https://yoursite.netlify.app -> "Open website" button
// SUPABASE_URL and SUPABASE_ANON_KEY are provided automatically.

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const SB_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SB_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const CONTACT_URL = Deno.env.get("CONTACT_URL") ?? "";
const SITE_URL = Deno.env.get("SITE_URL") ?? "";
const TG = `https://api.telegram.org/bot${TOKEN}`;

const PAGE_SIZE = 8;

/* =========================
   SUPABASE (read-only, anon)
========================= */
async function sbGet(path: string): Promise<any[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return await r.json();
}

// PostgREST returns at most 1000 rows per request, so page through.
async function sbGetAll(table: string, query = "select=*"): Promise<any[]> {
  const out: any[] = [];
  const step = 1000;
  for (let offset = 0; ; offset += step) {
    const rows = await sbGet(`${table}?${query}&limit=${step}&offset=${offset}`);
    out.push(...rows);
    if (rows.length < step) break;
  }
  return out;
}

const cache = new Map<string, { t: number; v: unknown }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < ttlMs) return hit.v as T;
  const v = await fn();
  cache.set(key, { t: Date.now(), v });
  return v;
}

/* =========================
   MONEY + DISCOUNTS
   (same rules as shared/catalog-client.js and deskmat/app.js)
========================= */
const money = (n: number) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;

function priceRange(values: number[]): string {
  if (!values.length) return "—";
  const min = Math.min(...values), max = Math.max(...values);
  return min === max ? money(min) : `${money(min)} – ${money(max)}`;
}

type Variant = { group: string; label: string; price: number | null; inStock: boolean };
type Product = {
  id: string; category: string; subtype: string | null; name: string;
  image: string | null; collection: string | null; base: number | null;
  discountOverride: number | null; specs: string | null; description: string | null;
  sort: number; variants: Variant[];
};
type Festival = { active: boolean; percent: number; label: string };

function festivalFrom(row: any): Festival {
  const f: Festival = { active: false, percent: 20, label: "Festival Sale" };
  if (!row) return f;
  const now = new Date();
  const starts = row.festival_discount_starts_at ? new Date(row.festival_discount_starts_at) : null;
  const ends = row.festival_discount_ends_at ? new Date(row.festival_discount_ends_at) : null;
  const within = (!starts || now >= starts) && (!ends || now <= ends);
  f.active = !!row.festival_discount_mode && within;
  if (row.festival_discount_percent != null) f.percent = Number(row.festival_discount_percent);
  if (row.festival_discount_label) f.label = row.festival_discount_label;
  return f;
}

function discountPct(p: Product, fest: Festival): number {
  if (!fest.active) return 0;
  const pct = Number(p.discountOverride ?? fest.percent);
  return !pct || pct <= 0 ? 0 : Math.min(100, pct);
}
const applyPct = (price: number, pct: number) =>
  pct ? Math.round(price * (1 - pct / 100) * 100) / 100 : price;

function productPrices(p: Product): number[] {
  const out: number[] = [];
  if (p.base != null) out.push(p.base);
  for (const v of p.variants) out.push(v.price ?? p.base ?? NaN);
  return out.filter((n) => Number.isFinite(n));
}

/* =========================
   LOADERS
========================= */
async function loadCatalog() {
  return await cached("catalog", 60_000, async () => {
    const [prows, vrows, srows] = await Promise.all([
      sbGetAll("catalog_products_public", "select=*&archived=eq.false&order=sort_order,name"),
      sbGetAll("catalog_variants_public", "select=*&order=id"),
      sbGet("store_settings?select=*&id=eq.1").catch(() => []),
    ]);
    const byProduct = new Map<string, Variant[]>();
    vrows
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .forEach((v) => {
        const list = byProduct.get(v.product_id) ?? [];
        list.push({
          group: v.group_name, label: v.option_label,
          price: v.price == null ? null : Number(v.price),
          inStock: v.in_stock !== false,
        });
        byProduct.set(v.product_id, list);
      });
    const products: Product[] = prows.map((p) => ({
      id: p.id, category: p.category, subtype: p.subtype ?? null, name: p.name,
      image: p.image ?? null, collection: p.collection ?? null,
      base: p.base_price == null ? null : Number(p.base_price),
      discountOverride: p.discount_percent == null ? null : Number(p.discount_percent),
      specs: p.specs ?? null, description: p.description ?? null,
      sort: p.sort_order ?? 0, variants: byProduct.get(p.id) ?? [],
    }));
    return { products, festival: festivalFrom(srows[0]) };
  });
}

type Design = {
  id: string; name: string; image: string | null; collections: string[];
  series: string | null; ready: boolean;
  stockType: string | null; stockThickness: string | null;
  stockSize: string | null; stockPrice: number | null;
};

async function loadDeskmat() {
  return await cached("deskmat", 300_000, async () => {
    const [pricing, collections, rows, srows] = await Promise.all([
      sbGetAll("pricing", "select=*"),
      sbGetAll("collections", "select=*&archived=eq.false&order=sort_order,name"),
      sbGetAll("products", "select=*&order=id"),
      sbGet("store_settings?select=*&id=eq.1").catch(() => []),
    ]);
    // One entry per unique image, like the website does.
    const byImage = new Map<string, Design>();
    for (const r of rows) {
      const key = String(r.image || r.thumbnail || r.id || "");
      if (!key) continue;
      const ex = byImage.get(key);
      if (!ex) {
        byImage.set(key, {
          id: String(r.id), name: r.name, image: r.image ?? null,
          collections: r.collection ? [r.collection] : [],
          series: r.series_name || r.series || null,
          ready: !!r.in_stock_ready,
          stockType: r.stock_type ?? null, stockThickness: r.stock_thickness ?? null,
          stockSize: r.stock_size_label ?? null,
          stockPrice: r.stock_price == null ? null : Number(r.stock_price),
        });
      } else {
        if (r.collection && !ex.collections.includes(r.collection)) ex.collections.push(r.collection);
        if (r.in_stock_ready) {
          ex.ready = true;
          ex.stockType ??= r.stock_type ?? null;
          ex.stockThickness ??= r.stock_thickness ?? null;
          ex.stockSize ??= r.stock_size_label ?? null;
          if (ex.stockPrice == null && r.stock_price != null) ex.stockPrice = Number(r.stock_price);
        }
      }
    }
    const s = srows[0];
    return {
      pricing,
      collections: collections.map((c) => ({ id: String(c.id), name: String(c.name) })),
      designs: [...byImage.values()],
      maintenance: !!s?.maintenance_mode,
      maintenanceDiscount: s?.maintenance_discount != null ? Number(s.maintenance_discount) : 0.2,
    };
  });
}

/* =========================
   TEXT HELPERS (Telegram HTML)
========================= */
const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const SUBTYPES: Record<string, string> = {
  prebuild: "Prebuild", customized: "Customized", barebone: "Barebone",
  switch: "Switch", keycap: "Keycap", artisan: "Artisan",
};
const DESKMAT_TYPES: Record<string, string> = {
  mousepad: "Regular Mouse Pad", fps: "FPS Mouse Pad", glass: "Glass Mouse Pad",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function productLabel(p: Product, fest: Festival): string {
  const pct = discountPct(p, fest);
  const vals = productPrices(p).map((n) => applyPct(n, pct));
  return `${p.name} — ${priceRange(vals)}`.slice(0, 60);
}

function productDetail(p: Product, fest: Festival): string {
  const pct = discountPct(p, fest);
  const lines: string[] = [];
  lines.push(`<b>${esc(p.name)}</b>`);
  const kind = [cap(p.category), p.subtype ? cap(p.subtype) : null, p.collection].filter(Boolean).join(" · ");
  lines.push(esc(kind));
  if (p.specs) lines.push(esc(p.specs));
  lines.push("");

  const original = productPrices(p);
  if (pct) {
    lines.push(
      `💰 <s>${priceRange(original)}</s> → <b>${priceRange(original.map((n) => applyPct(n, pct)))}</b>`,
      `🎉 ${esc(fest.label)} (-${Number.isInteger(pct) ? pct : pct.toFixed(1)}%)`,
    );
  } else {
    lines.push(`💰 <b>${priceRange(original)}</b>`);
  }

  if (p.variants.length) {
    const groups = new Map<string, Variant[]>();
    p.variants.forEach((v) => groups.set(v.group, [...(groups.get(v.group) ?? []), v]));
    for (const [group, opts] of groups) {
      lines.push("", `<b>${esc(group)}</b>`);
      for (const v of opts) {
        const own = v.price != null && v.price !== p.base;
        const price = own ? ` — ${money(applyPct(v.price as number, pct))}` : "";
        lines.push(`${v.inStock ? "✅" : "❌"} ${esc(v.label)}${price}${v.inStock ? "" : " (out of stock)"}`);
      }
    }
  }
  if (p.description) {
    const d = p.description.trim();
    lines.push("", esc(d.length > 400 ? d.slice(0, 400) + "…" : d));
  }
  lines.push("", "<i>Prices in USD. Stock can change — message us to confirm before ordering.</i>");
  return lines.join("\n");
}

/* =========================
   SEARCH (words, not AI)
========================= */
const STOP = new Set([
  "do", "you", "have", "any", "the", "a", "an", "is", "are", "what", "whats", "what's", "price",
  "prices", "how", "much", "of", "for", "me", "show", "i", "want", "need", "please", "available",
  "variant", "variants", "in", "stock", "cost", "looking", "got", "there", "does", "can", "get",
  "buy", "with", "and", "to", "your", "u", "sell", "selling", "list", "all", "pls",
]);
const norm = (s: unknown) => String(s ?? "").toLowerCase().normalize("NFKC");
const stem = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

function parseQuery(raw: string) {
  let text = norm(raw);
  let budget: number | null = null;
  const m = text.match(/(?:under|below|less than|max|cheaper than|<=?)\s*\$?\s*(\d+(?:\.\d+)?)/);
  if (m) { budget = Number(m[1]); text = text.replace(m[0], " "); }
  const words = text.match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  const tokens = words.filter((w) => !STOP.has(w)).map(stem);
  return { tokens, budget, deskmat: /desk\s*mat|mouse\s*pad|mousepad|\bfps\b|\bglass\b/.test(norm(raw)) };
}

function searchCatalog(products: Product[], fest: Festival, tokens: string[], budget: number | null) {
  const scored = products.map((p) => {
    const hay = norm([p.name, p.collection, p.subtype, p.category, p.specs, ...p.variants.map((v) => v.label)].join(" "));
    const hits = tokens.filter((t) => hay.includes(t)).length;
    return { p, hits };
  });
  let res = tokens.length === 0 ? scored : scored.filter((s) => s.hits === tokens.length);
  if (res.length === 0 && tokens.length > 1) res = scored.filter((s) => s.hits > 0);
  if (budget != null) {
    res = res.filter((s) => {
      const pct = discountPct(s.p, fest);
      const prices = productPrices(s.p).map((n) => applyPct(n, pct));
      return prices.length > 0 && Math.min(...prices) <= budget;
    });
  }
  return res.sort((a, b) => b.hits - a.hits || a.p.sort - b.p.sort).map((s) => s.p);
}

/* =========================
   DESKMAT TEXT
========================= */
function deskmatPrices(d: Awaited<ReturnType<typeof loadDeskmat>>): string {
  const lines = ["<b>Deskmat prices</b>", "<i>Made to order — pick any design, size and thickness.</i>"];
  for (const [type, title] of Object.entries(DESKMAT_TYPES)) {
    const rows = d.pricing.filter((r) => r.type === type);
    if (!rows.length) continue;
    const discounted = d.maintenance && type !== "glass";
    lines.push("", `<b>${title}</b>${discounted ? ` (-${Math.round(d.maintenanceDiscount * 100)}% now)` : ""}`);
    const byThick = new Map<string, any[]>();
    rows.forEach((r) => byThick.set(r.thickness, [...(byThick.get(r.thickness) ?? []), r]));
    for (const [thick, list] of byThick) {
      lines.push(`<i>${esc(thick)}</i>`);
      for (const r of list) {
        const orig = Number(r.price);
        const now = discounted ? Math.round(orig * (1 - d.maintenanceDiscount) * 100) / 100 : orig;
        lines.push(discounted && now !== orig
          ? `• ${esc(r.size_label)}: <s>${money(orig)}</s> <b>${money(now)}</b>`
          : `• ${esc(r.size_label)}: <b>${money(now)}</b>`);
      }
    }
  }
  lines.push("", "<i>Prices in USD.</i>");
  return lines.join("\n");
}

function designDetail(des: Design, d: Awaited<ReturnType<typeof loadDeskmat>>): string {
  const names = des.collections.map((id) => d.collections.find((c) => c.id === id)?.name ?? id);
  const lines = [`<b>${esc(des.name)}</b>`];
  if (names.length) lines.push(esc(names.join(" · ")));
  if (des.series) lines.push(`Series: ${esc(des.series)}`);
  lines.push("");
  if (des.ready && des.stockType && des.stockSize && des.stockPrice != null) {
    lines.push(
      "📦 <b>Ready to ship</b>",
      `${esc(DESKMAT_TYPES[des.stockType] ?? des.stockType)} · ${esc(des.stockSize)} · ${esc(des.stockThickness ?? "")}`,
      `💰 <b>${money(des.stockPrice)}</b>`,
    );
  } else {
    lines.push("🎨 Made to order in any size — tap <b>Deskmat prices</b> to see the price list.");
  }
  lines.push("", "<i>Prices in USD. Message us to confirm before ordering.</i>");
  return lines.join("\n");
}

/* =========================
   KEYBOARDS (inline buttons)
========================= */
type Btn = { text: string; callback_data?: string; url?: string };
const kb = (rows: Btn[][]) => ({ inline_keyboard: rows });

function extraButtons(): Btn[][] {
  const row: Btn[] = [];
  if (CONTACT_URL) row.push({ text: "💬 Message us", url: CONTACT_URL });
  if (SITE_URL) row.push({ text: "🌐 Website", url: SITE_URL });
  return row.length ? [row] : [];
}

function mainMenu() {
  return kb([
    [{ text: "⌨️ Keyboard", callback_data: "c:keyboard" }, { text: "🔌 Accessories", callback_data: "l:accessories:-:0" }],
    [{ text: "🖱 Mouse", callback_data: "l:mouse:-:0" }, { text: "🖼 Deskmat", callback_data: "d" }],
    ...extraButtons(),
  ]);
}
const MAIN_TEXT =
  "👋 Welcome to <b>KeyCam</b>!\n\nTap a category, or just type what you're looking for, e.g.:\n" +
  "• <i>keycap</i>\n• <i>switch under 20</i>\n• <i>naruto</i>\n• <i>mouse pad prices</i>";

function pager(prefix: string, page: number, total: number): Btn[] {
  const row: Btn[] = [];
  if (page > 0) row.push({ text: "⬅️ Prev", callback_data: `${prefix}:${page - 1}` });
  if ((page + 1) * PAGE_SIZE < total) row.push({ text: "Next ➡️", callback_data: `${prefix}:${page + 1}` });
  return row;
}

/* =========================
   TELEGRAM API
========================= */
async function tg(method: string, body: Record<string, unknown>) {
  const r = await fetch(`${TG}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return await r.json().catch(() => ({}));
}

const send = (chat_id: number, text: string, reply_markup?: unknown) =>
  tg("sendMessage", { chat_id, text, parse_mode: "HTML", reply_markup, disable_web_page_preview: true });

async function show(chat_id: number, message_id: number | null, text: string, reply_markup?: unknown) {
  // Menus edit the message in place; if that is not possible (e.g. it was a photo), send a new one.
  if (message_id) {
    const r: any = await tg("editMessageText", {
      chat_id, message_id, text, parse_mode: "HTML", reply_markup, disable_web_page_preview: true,
    });
    if (r?.ok || /not modified/i.test(r?.description ?? "")) return;
  }
  await send(chat_id, text, reply_markup);
}

async function showWithPhoto(chat_id: number, image: string | null, text: string, reply_markup: unknown) {
  if (image && /^https?:\/\//i.test(image) && text.length <= 1024) {
    const r: any = await tg("sendPhoto", { chat_id, photo: image, caption: text, parse_mode: "HTML", reply_markup });
    if (r?.ok) return;
  }
  await send(chat_id, text, reply_markup);
}

/* =========================
   HANDLERS
========================= */
async function listProducts(chat: number, msg: number | null, cat: string, sub: string, page: number) {
  const { products, festival } = await loadCatalog();
  const list = products.filter((p) => p.category === cat && (sub === "-" || p.subtype === sub));
  const title = sub !== "-" ? SUBTYPES[sub] ?? cap(sub) : cap(cat);
  const backTo = cat === "keyboard" ? "c:keyboard" : "m";
  if (!list.length) {
    return show(chat, msg, `<b>${esc(title)}</b>\n\nNothing listed here yet — check back soon!`,
      kb([[{ text: "⬅️ Back", callback_data: backTo }]]));
  }
  const slice = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const rows: Btn[][] = slice.map((p) => [{ text: productLabel(p, festival), callback_data: `p:${p.id}` }]);
  const nav = pager(`l:${cat}:${sub}`, page, list.length);
  if (nav.length) rows.push(nav);
  rows.push([{ text: "⬅️ Back", callback_data: backTo }]);
  const fest = festival.active ? `\n🎉 ${esc(festival.label)} prices shown` : "";
  return show(chat, msg,
    `<b>${esc(title)}</b> (${list.length})${fest}\nTap a product for variants and prices.`, kb(rows));
}

async function showProduct(chat: number, id: string) {
  const { products, festival } = await loadCatalog();
  const p = products.find((x) => x.id === id);
  if (!p) return send(chat, "Sorry, that product isn't available anymore.", mainMenu());
  const back = p.category === "keyboard" && p.subtype ? `l:keyboard:${p.subtype}:0` : `l:${p.category}:-:0`;
  return showWithPhoto(chat, p.image, productDetail(p, festival), kb([
    [{ text: "⬅️ Back to list", callback_data: back }, { text: "🏠 Menu", callback_data: "m" }],
    ...extraButtons(),
  ]));
}

async function deskmatMenu(chat: number, msg: number | null) {
  return show(chat, msg, "<b>🖼 Deskmat</b>\nMade-to-order desk mats and mouse pads, plus ready-to-ship stock.", kb([
    [{ text: "💰 Deskmat prices", callback_data: "dp" }],
    [{ text: "📦 Ready to ship", callback_data: "ds:0" }, { text: "🎨 Collections", callback_data: "dc:0" }],
    [{ text: "⬅️ Back", callback_data: "m" }],
  ]));
}

async function deskmatStock(chat: number, msg: number | null, page: number) {
  const d = await loadDeskmat();
  const list = d.designs.filter((x) => x.ready && x.stockPrice != null);
  if (!list.length) {
    return show(chat, msg, "<b>📦 Ready to ship</b>\n\nNo ready-to-ship deskmats right now.",
      kb([[{ text: "⬅️ Back", callback_data: "d" }]]));
  }
  const rows: Btn[][] = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((x) => [{
    text: `${x.name} — ${money(x.stockPrice as number)}`.slice(0, 60), callback_data: `dd:${x.id}`,
  }]);
  const nav = pager("ds", page, list.length);
  if (nav.length) rows.push(nav);
  rows.push([{ text: "⬅️ Back", callback_data: "d" }]);
  return show(chat, msg, `<b>📦 Ready to ship</b> (${list.length})`, kb(rows));
}

async function deskmatCollections(chat: number, msg: number | null, page: number) {
  const d = await loadDeskmat();
  const list = d.collections;
  const rows: Btn[][] = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    .map((c) => [{ text: c.name.slice(0, 50), callback_data: `dl:${c.id}:0`.slice(0, 64) }]);
  const nav = pager("dc", page, list.length);
  if (nav.length) rows.push(nav);
  rows.push([{ text: "⬅️ Back", callback_data: "d" }]);
  return show(chat, msg, `<b>🎨 Deskmat collections</b> (${list.length})`, kb(rows));
}

async function deskmatCollection(chat: number, msg: number | null, colId: string, page: number) {
  const d = await loadDeskmat();
  const col = d.collections.find((c) => c.id === colId);
  const list = d.designs.filter((x) => x.collections.includes(colId));
  const rows: Btn[][] = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    .map((x) => [{ text: x.name.slice(0, 55), callback_data: `dd:${x.id}` }]);
  const nav = pager(`dl:${colId}`, page, list.length);
  if (nav.length) rows.push(nav);
  rows.push([{ text: "⬅️ Collections", callback_data: "dc:0" }]);
  return show(chat, msg, `<b>${esc(col?.name ?? colId)}</b> (${list.length} designs)`, kb(rows));
}

async function showDesign(chat: number, id: string) {
  const d = await loadDeskmat();
  const des = d.designs.find((x) => x.id === id);
  if (!des) return send(chat, "Sorry, that design isn't available anymore.", mainMenu());
  return showWithPhoto(chat, des.image, designDetail(des, d), kb([
    [{ text: "💰 Deskmat prices", callback_data: "dp" }, { text: "🏠 Menu", callback_data: "m" }],
    ...extraButtons(),
  ]));
}

async function handleText(chat: number, text: string) {
  const q = parseQuery(text);

  if (q.deskmat) {
    const d = await loadDeskmat();
    const dtokens = q.tokens.filter((t) => !/^(desk|mat|deskmat|mouse|pad|mousepad|fps|glass)$/.test(t));
    if (dtokens.length) {
      const hits = d.designs.filter((x) => {
        const cols = x.collections.map((id) => d.collections.find((c) => c.id === id)?.name ?? id);
        const hay = norm([x.name, x.series, ...cols].join(" "));
        return dtokens.every((t) => hay.includes(t));
      }).slice(0, 10);
      if (hits.length) {
        const rows: Btn[][] = hits.map((x) => [{ text: x.name.slice(0, 55), callback_data: `dd:${x.id}` }]);
        rows.push([{ text: "💰 Deskmat prices", callback_data: "dp" }, { text: "🏠 Menu", callback_data: "m" }]);
        return send(chat, `🖼 Deskmat designs matching “${esc(text)}”:`, kb(rows));
      }
    }
    return send(chat, deskmatPrices(d), kb([
      [{ text: "📦 Ready to ship", callback_data: "ds:0" }, { text: "🎨 Collections", callback_data: "dc:0" }],
      [{ text: "🏠 Menu", callback_data: "m" }],
    ]));
  }

  const { products, festival } = await loadCatalog();
  const found = searchCatalog(products, festival, q.tokens, q.budget);

  // Deskmat designs are searched too (by name, series and collection), unless a budget was given
  // (Deskmat is priced by size, so a single "under $X" filter doesn't apply to designs).
  let designs: Design[] = [];
  if (q.tokens.length && q.budget == null) {
    const d = await loadDeskmat();
    designs = d.designs.filter((x) => {
      const cols = x.collections.map((id) => d.collections.find((c) => c.id === id)?.name ?? id);
      const hay = norm([x.name, x.series, ...cols].join(" "));
      return q.tokens.every((t) => hay.includes(t));
    });
  }

  if (!found.length && !designs.length) {
    return send(chat, `I couldn't find anything for “${esc(text)}”. Try a shorter word, or browse the categories:`, mainMenu());
  }

  const MAX = 10;
  const shownProducts = found.slice(0, MAX);
  const shownDesigns = designs.slice(0, Math.max(0, MAX - shownProducts.length));
  const rows: Btn[][] = [
    ...shownProducts.map((p) => [{ text: productLabel(p, festival), callback_data: `p:${p.id}` }]),
    ...shownDesigns.map((x) => [{ text: `🖼 ${x.name}`.slice(0, 55), callback_data: `dd:${x.id}` }]),
    [{ text: "🏠 Menu", callback_data: "m" }],
  ];
  const total = found.length + designs.length;
  const shownCount = shownProducts.length + shownDesigns.length;
  const more = total > shownCount ? `\n(+${total - shownCount} more — try a more specific word)` : "";
  const budget = q.budget != null ? ` under ${money(q.budget)}` : "";
  return send(chat, `Found ${total} result(s)${budget}:${more}`, kb(rows));
}

async function handleCallback(chat: number, msg: number, data: string) {
  const [a, b, c, d] = data.split(":");
  switch (a) {
    case "m": return show(chat, msg, MAIN_TEXT, mainMenu());
    case "c": return show(chat, msg, "<b>⌨️ Keyboard</b>\nWhat are you looking for?", kb([
      [{ text: "Prebuild", callback_data: "l:keyboard:prebuild:0" }, { text: "Customized", callback_data: "l:keyboard:customized:0" }],
      [{ text: "Barebone", callback_data: "l:keyboard:barebone:0" }, { text: "Switch", callback_data: "l:keyboard:switch:0" }],
      [{ text: "Keycap", callback_data: "l:keyboard:keycap:0" }, { text: "Artisan", callback_data: "l:keyboard:artisan:0" }],
      [{ text: "⬅️ Back", callback_data: "m" }],
    ]));
    case "l": return listProducts(chat, msg, b, c, Number(d) || 0);
    case "p": return showProduct(chat, data.slice(2));
    case "d": return deskmatMenu(chat, msg);
    case "dp": return show(chat, msg, deskmatPrices(await loadDeskmat()), kb([[{ text: "⬅️ Back", callback_data: "d" }]]));
    case "ds": return deskmatStock(chat, msg, Number(b) || 0);
    case "dc": return deskmatCollections(chat, msg, Number(b) || 0);
    case "dl": return deskmatCollection(chat, msg, b, Number(c) || 0);
    case "dd": return showDesign(chat, data.slice(3));
    default: return show(chat, msg, MAIN_TEXT, mainMenu());
  }
}

/* =========================
   WEBHOOK ENTRY
========================= */
Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("KeyCam bot is running.");
  if (WEBHOOK_SECRET && req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== WEBHOOK_SECRET) {
    return new Response("forbidden", { status: 403 });
  }
  let update: any;
  try { update = await req.json(); } catch { return new Response("bad request", { status: 400 }); }

  try {
    if (update.callback_query) {
      const cq = update.callback_query;
      await tg("answerCallbackQuery", { callback_query_id: cq.id });
      if (cq.message) await handleCallback(cq.message.chat.id, cq.message.message_id, String(cq.data ?? "m"));
    } else if (update.message?.text) {
      const chat = update.message.chat.id;
      const text: string = update.message.text.trim();
      if (/^\/(start|menu|help)\b/i.test(text)) await send(chat, MAIN_TEXT, mainMenu());
      else await handleText(chat, text);
    }
  } catch (e) {
    console.error("bot error:", e);
    const chat = update.message?.chat?.id ?? update.callback_query?.message?.chat?.id;
    if (chat) await send(chat, "Sorry, something went wrong on our side. Please try again in a moment.");
  }
  // Always 200 so Telegram doesn't keep retrying the same update.
  return new Response("ok");
});
