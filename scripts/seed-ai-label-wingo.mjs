// Seed des Wingo-AI-Label-Assets in die ai_label_assets-Tabelle.
// Liest DATABASE_URL aus .env.local. Idempotent: upsert per (brand_id) via
// ON CONFLICT DO UPDATE.
//
// Wozu: Das AI-Label ist Pflicht auf JEDEM AI-generierten Sujet (Brand Manual).
// resolveAiLabelConfig liefert nur dann ein Label, wenn fuer die Brand eine Zeile
// existiert — dieses Skript legt sie an. Die tatsaechlichen Label-Bytes loest der
// Render lokal via resolveAiLabelSrc auf (brand-assets/wingo/ai-label/), daher ist
// storage_url hier nur ein Praesenz-/Positions-Marker (kein Fetch-Ziel).
//
// Aufruf:  node scripts/seed-ai-label-wingo.mjs
import fs from "fs";
import pg from "pg";

const url = fs
  .readFileSync(".env.local", "utf-8")
  .match(/^DATABASE_URL=(.*)$/m)[1]
  .trim();

// Brand-globale Default-Position des Labels (unten-rechts, kleiner Badge). Pro
// Format kann format_specs.ai_label_position das ueberschreiben.
const DEFAULT_POSITION = {
  anchor: "bottom-right",
  offset: { x: 8, y: 8 },
  size: { w: 50, h: 16 },
};

const c = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const wingo = (await c.query("SELECT id FROM brands WHERE slug='wingo'")).rows[0]
  .id;

await c.query(
  `INSERT INTO ai_label_assets (brand_id, storage_url, default_position)
     VALUES ($1, $2, $3::jsonb)
   ON CONFLICT (brand_id) DO UPDATE SET
      storage_url = EXCLUDED.storage_url,
      default_position = EXCLUDED.default_position,
      updated_at = now()`,
  [wingo, "brand-asset:wingo/ai-label", JSON.stringify(DEFAULT_POSITION)]
);

const row = (
  await c.query(
    "SELECT brand_id, storage_url, default_position FROM ai_label_assets WHERE brand_id=$1",
    [wingo]
  )
).rows[0];
console.log("Wingo AI-Label registriert:", JSON.stringify(row));
await c.end();
