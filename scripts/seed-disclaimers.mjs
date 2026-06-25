// Seed der Wingo-Pflicht-Disclaimer in die disclaimers-Tabelle.
// Liest DATABASE_URL aus .env.local. Idempotent: upsert per (brand_id, slug)
// via ON CONFLICT DO UPDATE — sicher fuer Re-Run, aktualisiert Texte.
//
// Wird separat zum Schema-Deploy gebraucht: scripts/deploy-schema.mjs spielt nur
// das schema-only consolidated_001-016.sql ein (keine Disclaimer). Dieses Skript
// haengt den 5G-Hinweis + den generischen Aktions-/Preis-Disclaimer an die Live-DB.
// Aufruf:  node scripts/seed-disclaimers.mjs
import fs from "fs";
import pg from "pg";

const url = fs
  .readFileSync(".env.local", "utf-8")
  .match(/^DATABASE_URL=(.*)$/m)[1]
  .trim();

// brand-scoped wingo, alle 4 Sprachen. conditions {} + leere applies_to => matcht
// JEDE Kampagne (Preis-/Aktions-Legal-Line muss auf jedem Asset erscheinen).
const DISCLAIMERS = [
  {
    slug: "5g_swisscom_netz",
    name: "5G im Swisscom Netz",
    conditions: { network: "5g" },
    applies_to: ["mobile"],
    text_de: "5G im Swisscom Netz",
    text_fr: "5G dans le reseau Swisscom",
    text_it: "Rete 5G di Swisscom",
    text_en: "5G in Swisscom network",
  },
  {
    slug: "aktion_preis_standard",
    name: "Aktions-/Preis-Disclaimer (Standard)",
    conditions: {},
    applies_to: [],
    text_de:
      "Aktion zeitlich begrenzt. Mindestvertragslaufzeit 24 Monate. Preise in CHF inkl. MwSt. Es gelten die AGB von Wingo.",
    text_fr:
      "Offre limitee dans le temps. Duree minimale du contrat 24 mois. Prix en CHF, TVA incluse. Les CG de Wingo s'appliquent.",
    text_it:
      "Offerta a tempo limitato. Durata minima del contratto 24 mesi. Prezzi in CHF, IVA inclusa. Si applicano le CG di Wingo.",
    text_en:
      "Offer for a limited time only. Minimum contract term 24 months. Prices in CHF incl. VAT. Wingo's GTC apply.",
  },
];

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const wingo = (await c.query("SELECT id FROM brands WHERE slug='wingo'")).rows[0].id;

for (const d of DISCLAIMERS) {
  await c.query(
    `INSERT INTO disclaimers
       (brand_id, slug, name, conditions_json, applies_to_categories,
        text_de, text_fr, text_it, text_en, is_required, is_active)
       VALUES ($1,$2,$3,$4::jsonb,$5::text[],$6,$7,$8,$9,true,true)
     ON CONFLICT (brand_id, slug) DO UPDATE SET
        name = EXCLUDED.name,
        conditions_json = EXCLUDED.conditions_json,
        applies_to_categories = EXCLUDED.applies_to_categories,
        text_de = EXCLUDED.text_de, text_fr = EXCLUDED.text_fr,
        text_it = EXCLUDED.text_it, text_en = EXCLUDED.text_en,
        is_required = true, is_active = true, updated_at = now()`,
    [
      wingo,
      d.slug,
      d.name,
      JSON.stringify(d.conditions),
      d.applies_to,
      d.text_de,
      d.text_fr,
      d.text_it,
      d.text_en,
    ]
  );
}

const rows = (
  await c.query(
    "SELECT slug, conditions_json, applies_to_categories FROM disclaimers WHERE brand_id=$1 AND is_active=true ORDER BY slug",
    [wingo]
  )
).rows;
console.log("aktive Wingo-Disclaimer:", JSON.stringify(rows));
await c.end();
