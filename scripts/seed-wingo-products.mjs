// Seed der aktuellen Wingo-Abos (Stand wingo.ch, Juni 2026) in die products-Tabelle.
// Liest DATABASE_URL aus .env.local. Idempotent: deaktiviert bestehende Wingo-
// Produkte + upsertet die untenstehende Liste per Name. Aufruf:
//   node scripts/seed-wingo-products.mjs
import fs from "fs";
import pg from "pg";

const url = fs
  .readFileSync(".env.local", "utf-8")
  .match(/^DATABASE_URL=(.*)$/m)[1]
  .trim();

// network: mobile -> 5g_swisscom (alle Wingo-Mobile-Abos sind 5G), sonst null.
const PRODUCTS = [
  // --- Mobile (5G im Swisscom Netz) ---
  { name: "Wingo Swiss Mini", category: "mobile", price_promo: 13.95, network: "5g_swisscom", link: "https://www.wingo.ch/de/mobile/wingo-swiss-mini" },
  { name: "Wingo Swiss Go", category: "mobile", price_promo: 17.95, network: "5g_swisscom", link: "https://www.wingo.ch/de/mobile/wingo-swiss-go" },
  { name: "Wingo Red Swiss", category: "mobile", price_promo: 21.95, network: "5g_swisscom", link: "https://www.wingo.ch/de/mobile/wingo-red-swiss" },
  { name: "Wingo Red", category: "mobile", price_promo: 23.95, network: "5g_swisscom", link: "https://www.wingo.ch/de/mobile/wingo-red" },
  { name: "Wingo Europe Go", category: "mobile", price_promo: 27.95, network: "5g_swisscom", link: "https://www.wingo.ch/de/mobile/wingo-europe-go" },
  { name: "Wingo Red Pro", category: "mobile", price_promo: 27.95, network: "5g_swisscom", link: "https://www.wingo.ch/de/mobile/wingo-red-pro" },
  { name: "Wingo Europe Max", category: "mobile", price_promo: 36.95, network: "5g_swisscom", link: "https://www.wingo.ch/de/mobile/wingo-europe-max" },
  { name: "Wingo International Pro", category: "mobile", price_promo: 49.95, network: "5g_swisscom", link: "https://www.wingo.ch/de/mobile/wingo-international-pro" },
  // --- Internet ---
  { name: "Wingo Internet Light", category: "internet", price_promo: 34.95, link: "https://www.wingo.ch/de/internet" },
  { name: "Wingo Internet Start", category: "internet", price_promo: 39.95, link: "https://www.wingo.ch/de/internet" },
  { name: "Wingo Internet Red", category: "internet", price_promo: 39.95, link: "https://www.wingo.ch/de/internet" },
  { name: "Wingo Internet Max", category: "internet", price_promo: 49.95, link: "https://www.wingo.ch/de/internet" },
  // --- TV ---
  { name: "Wingo TV Max", category: "tv", price_promo: 9.95, price_standard: 20.0, link: "https://www.wingo.ch/de/internet/wingo-tv/tv-max" },
];

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const wingo = (await c.query("SELECT id FROM brands WHERE slug='wingo'")).rows[0].id;

// Bestehende Wingo-Produkte deaktivieren (Dropdown zeigt nur is_active) — nicht
// loeschen, damit referenzierende Kampagnen intakt bleiben.
await c.query("UPDATE products SET is_active=false WHERE brand_id=$1", [wingo]);

for (const p of PRODUCTS) {
  const upd = await c.query(
    `UPDATE products SET category=$3, price_promo=$4, price_standard=$5,
        price_suffix='/Mt.', link=$6, network=$7, is_active=true, updated_at=now()
       WHERE brand_id=$1 AND name=$2`,
    [wingo, p.name, p.category, p.price_promo, p.price_standard ?? null, p.link ?? null, p.network ?? null]
  );
  if (upd.rowCount === 0) {
    await c.query(
      `INSERT INTO products
         (brand_id, name, category, price_promo, price_standard, price_suffix, link, network, is_active)
         VALUES ($1,$2,$3,$4,$5,'/Mt.',$6,$7,true)`,
      [wingo, p.name, p.category, p.price_promo, p.price_standard ?? null, p.link ?? null, p.network ?? null]
    );
  }
}

const rows = (
  await c.query(
    "SELECT category, count(*)::int n FROM products WHERE brand_id=$1 AND is_active=true GROUP BY category ORDER BY category",
    [wingo]
  )
).rows;
console.log("aktive Wingo-Produkte:", JSON.stringify(rows));
await c.end();
