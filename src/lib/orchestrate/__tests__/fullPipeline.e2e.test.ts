// @vitest-environment node
//
// Full-Pipeline-E2E mit dem ECHTEN Satori/resvg-Renderer: beweist die ship-safe
// Kette Brief -> 44 Assets -> Konformitaets-Gate -> ZIP end-to-end, hermetisch
// (PGlite + In-Memory-Storage + Fixtures, KEIN Claude/Storage/Netz). Schliesst die
// "gruen-getestet != funktioniert"-Luecke, die alle anderen Tests mit gemocktem
// renderToPng offen lassen.
//
// Rendert 44 echte PNGs -> langsam. Standard-Suite ueberspringt; explizit:
//   E2E_FULL=1 npx vitest run src/lib/orchestrate/__tests__/fullPipeline.e2e.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import AdmZip from "adm-zip";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createInMemoryStorage } from "../../storage/inMemoryStorage";
import { loadBrand, type BrandConfig } from "../../brand/loadBrand";
import { createCampaign } from "../../db/queries/campaigns";
import { runMultiplex } from "../runMultiplex";
import { exportCampaignZip } from "../../export/exportCampaignZip";
import { listRegisteredFormatCodes } from "../../../templates/wingo/registry";
import type { Brief } from "../../schemas/brief";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_BASE_DIR = path.join(__dirname, "..", "..", "brand", "__tests__", "fixtures");

const BRIEF: Brief = {
  kampagne: {
    name: "E2E Flash Sale",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: { name: "Wingo Mobile Swiss", preis_promo: 19.95, preis_suffix: "/Mt." },
  strategie: { input: "x" },
  vermarktung: { hauptbotschaft: "x", zielgruppe: "sozial", zielgebiet: "deutschschweiz" },
  assets_kanaele: { channel_kategorien: [], format_codes: ["dv360_halfpage"] },
  sonstiges: {},
};

describe.skipIf(!process.env.E2E_FULL)("full pipeline E2E (real renderer)", () => {
  let db: PGlite;
  let wingoId: string;
  let brandConfig: BrandConfig;
  let campaignId: string;
  let heroBytes: Buffer;
  let logoDataUri: string;

  beforeAll(async () => {
    db = await createTestDb();
    wingoId = (await db.query<{ id: string }>(`SELECT id FROM brands WHERE slug='wingo'`)).rows[0].id;

    await db.query(
      `INSERT INTO brand_voice_variants (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
         VALUES ($1, NULL, NULL, '# Default Voice\n- Direkt, Du.', true)`,
      [wingoId]
    );
    const disc = await db.query<{ id: string }>(
      `INSERT INTO disclaimers
         (brand_id, slug, name, conditions_json, applies_to_categories, text_de, text_fr, text_it, text_en)
         VALUES ($1, '5g', '5G', '{"network":"5g"}'::jsonb, ARRAY['mobile'],
                 '5G im Swisscom Netz', '5G FR', '5G IT', '5G EN')
         RETURNING id`,
      [wingoId]
    );
    brandConfig = await loadBrand(db, "wingo", { baseDir: FIXTURE_BASE_DIR });

    // Fixtures: echter Hero (Bild) + echtes Logo-PNG-Data-URI (simuliert das
    // gedroppte wingo-lockup@3x.png -> logoIsPlaceholder=false).
    heroBytes = await sharp({
      create: { width: 800, height: 500, channels: 3, background: { r: 38, g: 92, b: 150 } },
    }).png().toBuffer();
    const logoPng = await sharp({
      create: { width: 240, height: 72, channels: 3, background: { r: 230, g: 30, b: 42 } },
    }).png().toBuffer();
    logoDataUri = `data:image/png;base64,${logoPng.toString("base64")}`;

    const c = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    campaignId = c.id;
    await db.query(`UPDATE campaigns SET status='final_pending' WHERE id=$1`, [campaignId]);

    for (const lang of ["de", "fr", "it", "en"] as const) {
      await db.query(
        `INSERT INTO campaign_copy
           (campaign_id, language, headlines, subline, cta_label, disclaimer_ids,
            selected_headline_idx, is_approved, approved_at)
           VALUES ($1, $2, ARRAY[$3,$4,$5], $6, $7, ARRAY[$8]::uuid[], 1, true, now())`,
        [
          campaignId,
          lang,
          `${lang.toUpperCase()} Headline 0`,
          `Schweizer Netz, halber Preis (${lang})`,
          `${lang.toUpperCase()} H2`,
          `Unlimitiert im Swisscom Netz (${lang})`,
          "Jetzt entdecken",
          disc.rows[0].id,
        ]
      );
    }
    await db.query(
      `INSERT INTO campaign_hero (campaign_id, storage_url, source, mime_type, is_approved, approved_at)
         VALUES ($1, 'https://fixture.local/hero.png', 'upload', 'image/png', true, now())`,
      [campaignId]
    );
    await db.query(
      `INSERT INTO campaign_layout (campaign_id, master_format, variant, is_approved, approved_at)
         VALUES ($1, 'dv360_halfpage', 'price_bottom', true, now())`,
      [campaignId]
    );
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("Brief -> 44 brand-conform assets (real Satori render) -> ZIP with 44 files", async () => {
    const storage = createInMemoryStorage();

    const result = await runMultiplex(db, storage, {
      campaignId,
      brandConfig,
      logoUrl: logoDataUri,
      logoIsPlaceholder: false, // echtes Logo vorhanden
      fetchHeroBytes: async () => heroBytes, // Hero wird real eingebettet + gerendert
    });

    const perLang = listRegisteredFormatCodes("flash_sale").length;
    expect(result.assets).toHaveLength(perLang * 4); // 44
    expect(result.failures).toHaveLength(0);

    // Alle 44 bestehen den deterministischen Konformitaets-Gate.
    const conf = await db.query<{ conformity_pass: boolean | null }>(
      `SELECT conformity_pass FROM assets WHERE campaign_id=$1`,
      [campaignId]
    );
    expect(conf.rows).toHaveLength(perLang * 4);
    expect(conf.rows.every((r) => r.conformity_pass === true)).toBe(true);

    // ZIP enthaelt 44 echte PNGs.
    const zip = await exportCampaignZip(db, campaignId, async (url) => {
      const bytes = storage.read(url.replace("memory://", ""));
      if (!bytes) throw new Error(`missing ${url}`);
      return bytes;
    });
    const entries = new AdmZip(zip).getEntries();
    expect(entries).toHaveLength(perLang * 4);
    // Jedes ZIP-File ist ein valides PNG.
    const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    for (const e of entries) {
      expect(e.getData().subarray(0, 8).equals(PNG_SIG)).toBe(true);
    }
  }, 240_000);
});
