// @vitest-environment node
//
// LIVE SHIP-PROOF — laeuft NUR mit SHIP_PROOF=1 und schreibt gegen die ECHTE
// Supabase-Instanz (DATABASE_URL + SUPABASE_* aus .env.local). Beweist die
// Kette Brief -> Claude-Translate -> 44 echte Renders (echtes Logo/Font/Farben)
// -> Live-Storage -> Konformitaets-Gate -> ZIP. Erzeugt Test-Daten im Live-Projekt.
//
//   SHIP_PROOF=1 npx vitest run src/lib/orchestrate/__tests__/shipProof.live.test.ts
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { getDb } from "../../db/server";
import { loadBrand } from "../../brand/loadBrand";
import {
  resolveLogoSrc,
  logoIsPlaceholder,
  resolveStarBlobSrc,
} from "../../brand/resolveLogoSrc";
import { createSupabaseStorage } from "../../storage/supabaseStorage";
import { createClaudeTranslator } from "../../copy/claudeTranslator";
import { createCampaign } from "../../db/queries/campaigns";
import { runMultiplex } from "../runMultiplex";
import { exportCampaignZip } from "../../export/exportCampaignZip";
import type { Brief } from "../../schemas/brief";

// .env.local -> process.env (vitest laedt es nicht automatisch).
function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const [, k, vRaw] = m;
    if (process.env[k]) continue;
    let v = vRaw;
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    process.env[k] = v;
  }
}
// Nur im Live-Lauf .env.local laden — sonst keine Env-Seiteneffekte auf die Suite.
if (process.env.SHIP_PROOF) loadEnvLocal();

const BRIEF: Brief = {
  kampagne: {
    name: "Ship-Proof Wingo Red Swiss Flash Sale",
    art: "flash_sale",
    datum_von: "2026-06-23",
    datum_bis: "2026-06-30",
    produkt_kategorie: "mobile",
  },
  produkt: { name: "Wingo Red Swiss", preis_promo: 23.95, preis_suffix: "/Mt." },
  strategie: { input: "Flash Sale Handy-Abo im Schweizer Netz" },
  vermarktung: {
    hauptbotschaft: "Schweizer Netz, halber Preis",
    zielgruppe: "sozial",
    zielgebiet: "deutschschweiz",
  },
  assets_kanaele: { channel_kategorien: [], format_codes: ["dv360_halfpage"] },
  sonstiges: {},
};

const DE_HEADLINES = [
  "Schweizer Netz, halber Preis.",
  "Flash Sale: dein Handy-Abo zum halben Preis",
  "Jetzt zugreifen: Wingo Red Swiss",
];
const DE_SUBLINE = "Unlimitiert telefonieren & surfen im besten Schweizer Netz.";
const DE_CTA = "Hol's dir";

describe.skipIf(!process.env.SHIP_PROOF)("LIVE ship-proof (44 Assets gegen echte DB)", () => {
  it("Brief -> Claude-Translate -> 44 brand-konforme Assets -> Live-Storage -> ZIP", async () => {
    const db = getDb();
    const storage = createSupabaseStorage();

    const wingoId = (
      await db.query<{ id: string }>(`SELECT id FROM brands WHERE slug='wingo'`)
    ).rows[0].id;

    // Idempotenz: alte Ship-Proof-Test-Kampagnen im Live-Projekt aufraeumen.
    const stale = (
      await db.query<{ id: string }>(
        `SELECT id FROM campaigns WHERE name LIKE 'Ship-Proof%'`
      )
    ).rows.map((r) => r.id);
    if (stale.length) {
      for (const tbl of [
        "assets",
        "campaign_copy",
        "campaign_hero",
        "campaign_layout",
        "campaign_briefs",
      ]) {
        await db.query(`DELETE FROM ${tbl} WHERE campaign_id = ANY($1::uuid[])`, [stale]);
      }
      await db.query(`DELETE FROM campaigns WHERE id = ANY($1::uuid[])`, [stale]);
      console.log(`[ship-proof] ${stale.length} alte Test-Kampagne(n) aufgeraeumt`);
    }

    const brandConfig = await loadBrand(db, "wingo");
    const logoUrl = resolveLogoSrc(brandConfig.tokens, "wingo");
    const placeholder = logoIsPlaceholder("wingo");
    console.log(`[ship-proof] logoIsPlaceholder=${placeholder} (false = echtes Lockup da)`);
    expect(placeholder).toBe(false);

    // Hero: Homeoffice+Hund, vor-skaliert (Original ist 12000px / 2.3MB).
    const heroPath = path.join(
      process.cwd(),
      "brand-assets/wingo/imagery/wingo_Launch_2026_Homeoffice_Hund.jpeg"
    );
    const heroBytes = await sharp(heroPath)
      .resize({ width: 2000, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    // Campaign anlegen (denormalisiert art/price aus dem Brief).
    const campaign = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    const campaignId = campaign.id;
    console.log(`[ship-proof] campaign ${campaignId} angelegt`);

    // Alle Disclaimer der Brand (Compliance-Pass-through, nie via LLM).
    const discIds = (
      await db.query<{ id: string }>(
        `SELECT id FROM disclaimers WHERE brand_id=$1 ORDER BY slug`,
        [wingoId]
      )
    ).rows.map((r) => r.id);

    // Gate 1 (DE approved) — FR/IT/EN zieht runMultiplex via Claude-Translate nach.
    await db.query(
      `INSERT INTO campaign_copy
         (campaign_id, language, headlines, subline, cta_label, disclaimer_ids,
          selected_headline_idx, is_approved, approved_at)
         VALUES ($1, 'de', $2, $3, $4, $5::uuid[], 0, true, now())`,
      [campaignId, DE_HEADLINES, DE_SUBLINE, DE_CTA, discIds]
    );

    // Gate 2 (Hero) + Gate 3 (Layout). Hero-Bytes liefert der fetchHeroBytes-
    // Override; storage_url muss nur non-empty sein (Hero-Guard).
    await db.query(
      `INSERT INTO campaign_hero (campaign_id, storage_url, source, mime_type, is_approved, approved_at)
         VALUES ($1, 'https://fixture.local/hero.jpg', 'upload', 'image/jpeg', true, now())`,
      [campaignId]
    );
    await db.query(
      `INSERT INTO campaign_layout (campaign_id, master_format, variant, is_approved, approved_at)
         VALUES ($1, 'dv360_halfpage', 'price_bottom', true, now())`,
      [campaignId]
    );
    await db.query(`UPDATE campaigns SET status='final_pending' WHERE id=$1`, [campaignId]);

    // GATE 4: Multiplex 11x4 = 44, mit echtem Claude-Translate + echtem Render.
    const result = await runMultiplex(db, storage, {
      campaignId,
      brandConfig,
      logoUrl,
      // Art-bewusste Logo-Variante (white fuer flash_sale) — wie die Gate-Action.
      resolveLogo: (v) => resolveLogoSrc(brandConfig.tokens, "wingo", { variant: v }),
      resolvePriceBlob: () => resolveStarBlobSrc("wingo"),
      logoIsPlaceholder: placeholder,
      translate: {
        passthroughTerms: brandConfig.glossar.passthrough_terms,
        llm: createClaudeTranslator(),
      },
      fetchHeroBytes: async () => heroBytes,
    });

    console.log(
      `[ship-proof] gerendert: ${result.assets.length} | Fehler: ${result.failures.length} | ${result.durationMs}ms`
    );
    if (result.failures.length) console.log("[ship-proof] failures:", result.failures);

    const conf = await db.query<{ n: number; ok: number }>(
      `SELECT count(*)::int AS n, count(*) FILTER (WHERE conformity_pass)::int AS ok
         FROM assets WHERE campaign_id=$1 AND status<>'failed'`,
      [campaignId]
    );
    console.log(`[ship-proof] conformity: ${conf.rows[0].ok}/${conf.rows[0].n} konform`);

    expect(result.assets.length).toBe(44);
    expect(result.failures.length).toBe(0);
    expect(conf.rows[0].ok).toBe(44);

    // ZIP aus dem Live-Storage (HTTP-Fetch der public URLs) -> lokal speichern.
    const zip = await exportCampaignZip(db, campaignId, async (url) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`fetch ${url} -> ${r.status}`);
      return Buffer.from(await r.arrayBuffer());
    });
    fs.mkdirSync(path.join(process.cwd(), "scripts", "ship-proof"), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), "scripts", "ship-proof", "wingo-44.zip"), zip);
    console.log(`[ship-proof] ZIP: scripts/ship-proof/wingo-44.zip (${zip.length} bytes)`);

    // 3 Sample-Assets (DE) zum Anschauen herunterladen.
    const samples = [
      "dv360_halfpage",
      "dv360_rectangle",
      "dv360_billboard",
      "meta_image",
      "dv360_ricchi",
      "dv360_wideboard_xl",
      "google_pmax_static",
      "google_sea_ad_ext",
    ];
    for (const code of samples) {
      const a = result.assets.find((x) => x.formatCode === code && x.language === "de");
      if (!a) continue;
      const r = await fetch(a.storageUrl);
      const buf = Buffer.from(await r.arrayBuffer());
      fs.writeFileSync(
        path.join(process.cwd(), "scripts", "ship-proof", `sample_${code}_de.png`),
        buf
      );
    }
    console.log(`[ship-proof] Samples in scripts/ship-proof/`);
  }, 600_000);
});
