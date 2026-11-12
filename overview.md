# KeyCam Cambodia — Project Overview

Site: https://keycam.netlify.app/ (hosted on Netlify)
Backend: Supabase (Postgres + Storage). Public storage bucket: `keycam-images`.

## What the site is
A shop for custom keyboards, switches, keycaps, mice and desk mats. Customers browse the catalog and configure products online, then order directly on Telegram (t.me/Key_Cam). Social links: Facebook, Instagram, TikTok, map location.

The product list loads with JavaScript after the page opens (the raw HTML only shows "Loading…").

## Database (public schema)

### New catalog (keyboards / accessories / mouse)
| Table | ~Rows | Purpose |
|---|---|---|
| `catalog_products` | 176 | Products. `category` is one of keyboard, accessories, mouse. Fields: subtype, name, image, thumbnail, collection, base_price, discount_percent, specs, description, sort_order, archived, theme, profile, shipping_info, payment_info, stock_qty |
| `catalog_variants` | 212 | Options per product (`group_name`, `option_label`, `price`, `in_stock`, `stock_qty`, `image`). Deleted with the product |
| `catalog_product_images` | 1,026 | Gallery images per product (`url`, `thumb_url`, `sort_order`) |
| `catalog_product_components` | few | Links a product to other products (`component_product_id`, `role_label`), likely for bundles |

Views used for public reading (they leave out `stock_qty`): `catalog_products_public`, `catalog_variants_public`.

### Collections / desk-mat style data
| Table | ~Rows | Purpose |
|---|---|---|
| `collections` | 15 | Collection list (`id` text, name, thumbnail, sort_order, archived, hidden_from_home) |
| `products` | 1,846 | Designs per collection: image, thumbnail, folder, series, series_name, focal_x/focal_y, plus ready-stock fields (in_stock_ready, stock_type, stock_thickness, stock_size_label, stock_price) |
| `pricing` | few | Price by (type, thickness, size_label) |
| `series_links` | few | Links a series in one collection to another collection |

### Orders and settings
| Table | ~Rows | Purpose |
|---|---|---|
| `orders` | 28 | `items` (jsonb), total, status (default `pending`), customer_name, customer_phone, customer_note, paid_amount, delivery_fee, order_discount_type/value/amount, maintenance_mode, maintenance_discount |
| `store_settings` | 1 (id = 1 only) | maintenance_mode (default true), maintenance_discount (default 0.20), festival_discount_mode / percent / label ("Pchum Ben Festival Sale") / starts_at / ends_at |

No database functions, triggers or enums exist. All pricing and order logic lives in the website code.

## Access rules (RLS is enabled on every table)
- **Visitors (anon):** read products, pricing, collections, store_settings, catalog images and components; read catalog products/variants through the public views; insert orders.
- **Logged-in users (authenticated):** insert/update/delete on products, catalog tables, collections, pricing (update), series_links; read and update orders; update store_settings; upload/update/delete images in `keycam-images`. Orders cannot be deleted.

## Security notes to fix (found from the schema)
1. **Every logged-in user is treated as admin.** All write policies use `true`. If new sign-ups are open in Supabase Auth, anyone can create an account and then edit/delete products and read customer names and phone numbers in `orders`. Turn off public sign-ups, or restrict policies to an admin list.
2. **The two public views are writable by anon.** `anon` has INSERT/UPDATE/DELETE on `catalog_products_public` and `catalog_variants_public`. Views usually run with the owner's rights, which skip RLS. Revoke those rights (SQL below).
3. **Extra table privileges.** `anon` and `authenticated` hold TRUNCATE, TRIGGER and REFERENCES on most tables. Not normally reachable through the API, but worth revoking.
4. **Orders:** anyone can insert, and totals come from the browser (no server-side check). Fine if every order is confirmed on Telegram, but spam is possible.

Fix for item 2:

```sql
revoke insert, update, delete, truncate, references, trigger
  on public.catalog_products_public, public.catalog_variants_public
  from anon, authenticated;
```

## Not yet known (need the code)
- Frontend framework and file structure
- Admin page: where it is and how login works
- How the configurator calculates prices and builds the Telegram order message
- How `store_settings` (maintenance and festival discounts) is applied

## Upgrade ideas
- Admin check (e.g. an `admins` table) in all write policies
- Server-side order total validation
- Migrate the older `products`/`pricing` data into the `catalog_*` structure if one system is preferred
