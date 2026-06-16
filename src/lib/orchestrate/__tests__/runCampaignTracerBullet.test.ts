// @vitest-environment node

import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  vi,
} from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { loadBrand } from "../../brand/loadBrand";
import { createInMemoryStorage } from "../../storage/inMemoryStorage";
import { runCampaignTracerBullet } from "../runCampaignTracerBullet";
import { getAssetsForCampaign } from "../../db/queries/assets";
import type { Brief } from "../../schemas/brief";
import type { BrandConfig } from "../../brand/loadBrand";
import type { FormatSpec } from "../../db/queries/format-specs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_BASE_DIR = path.join(
  __dirname,
  "..",
  "..",
  "brand",
  "__tests__",
  "fixtures"
);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const VALID_BRIEF: Brief = {
  kampagne: {
    name: "Wingo Mobile Swiss — Flash Sale Mai",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: {
    name: "Wingo Mobile Swiss",
    preis_promo: 19.95,
    preis_standard: 29.95,
    preis_suffix: "/Mt.",
  },
  strategie: { input: "Marktreaktion auf Salt-Preissenkung" },
  vermarktung: {
    hauptbotschaft: "Schweizer Netz, halber Preis.",
    zielgruppe: "sozial",
    zielgebiet: "deutschschweiz",
  },
  assets_kanaele: {
    channel_kategorien: ["Display Standard"],
    format_codes: ["dv360_halfpage"],
  },
  sonstiges: {},
};

describe("runCampaignTracerBullet", () => {
  let db: PGlite;
  let brandConfig: BrandConfig;
  let halfpageFormat: FormatSpec;
  let wingoId: string;
  let disclaimer5gText: string;

  beforeAll(async () => {
    db = await createTestDb();
    const r = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = r.rows[0].id;

    await db.query(
      `INSERT INTO brand_voice_variants
         (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
         VALUES ($1, NULL, NULL,
           '# Wingo Default Voice\nDirekt, klar, schweizerisch. Du-Form.',
           true)`,
      [wingoId]
    );

    await db.query(
      `INSERT INTO disclaimers
         (brand_id, slug, name, conditions_json, applies_to_categories,
          text_de, text_fr, text_it, text_en)
         VALUES ($1, '5g_swisscom_netz', '5G im Swisscom Netz',
                 '{"network": "5g"}'::jsonb, ARRAY['mobile'],
                 '5G im Swisscom Netz',
                 '5G dans le reseau Swisscom',
                 'Rete 5G di Swisscom',
                 '5G in Swisscom network')`,
      [wingoId]
    );
    disclaimer5gText = "5G im Swisscom Netz";

    brandConfig = await loadBrand(db, "wingo", { baseDir: FIXTURE_BASE_DIR });

    const fmt = await db.query<FormatSpec>(
      `SELECT * FROM format_specs WHERE code = 'dv360_halfpage' LIMIT 1`
    );
    halfpageFormat = fmt.rows[0];
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM assets`);
    await db.query(`DELETE FROM campaign_copy`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("creates campaign, generates copy, renders one PNG, uploads, persists asset", async () => {
    const storage = createInMemoryStorage();
    const llm = vi.fn().mockResolvedValueOnce({
      data: {
        headlines: [
          "Schweizer Netz, halber Preis.",
          "Wingo Mobile Swiss fuer 19.95.",
          "Jetzt 12 Mt. zum halben Preis.",
        ],
        subline: "Unlimitiert telefonieren im Swisscom Netz.",
        cta_label: "Jetzt entdecken",
      },
      rawText: "{}",
      tokensUsed: { input: 100, output: 50, total: 150 },
      model: "claude-sonnet-4-6",
      stopReason: "end_turn",
    });

    const result = await runCampaignTracerBullet({
      db,
      storage,
      brandConfig,
      brief: VALID_BRIEF,
      language: "de",
      format: halfpageFormat,
      productContext: { category: "mobile", network: "5g" },
      heroImageUrl: "https://placehold.co/300x200/EFEFEF/E61E2A.png",
      logoUrl: "https://placehold.co/80x24/EFEFEF/E61E2A.png?text=wingo",
      llm,
    });

    expect(result.campaign.id).toBeDefined();
    expect(result.copy.headlines).toHaveLength(3);
    expect(result.asset.storage_url).toContain("memory://");

    // Storage hat genau ein Objekt
    expect(storage.has(result.asset.storage_url!.replace("memory://", ""))).toBe(true);

    // Asset-Bytes sind valides PNG
    const bytes = storage.read(
      result.asset.storage_url!.replace("memory://", "")
    )!;
    expect(bytes.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);

    // DB-Konsistenz: ein Asset fuer die Kampagne
    const assetsInDb = await getAssetsForCampaign(db, result.campaign.id);
    expect(assetsInDb).toHaveLength(1);
    expect(assetsInDb[0].language).toBe("de");
  }, 30_000);

  it("passes the promo price string verbatim into the template (no rounding, no localization)", async () => {
    const storage = createInMemoryStorage();
    const renderSpy = vi.fn().mockResolvedValue(Buffer.from(PNG_SIGNATURE));
    const llm = vi.fn().mockResolvedValueOnce({
      data: {
        headlines: ["H1", "H2", "H3"],
        subline: "S",
        cta_label: "Jetzt",
      },
      rawText: "{}",
      tokensUsed: { input: 50, output: 50, total: 100 },
      model: "claude-sonnet-4-6",
      stopReason: "end_turn",
    });

    await runCampaignTracerBullet({
      db,
      storage,
      brandConfig,
      brief: VALID_BRIEF,
      language: "de",
      format: halfpageFormat,
      productContext: { category: "mobile", network: "5g" },
      heroImageUrl: "https://x",
      logoUrl: "https://y",
      llm,
      renderToPng: renderSpy,
    });

    expect(renderSpy).toHaveBeenCalledOnce();
    const [jsx] = renderSpy.mock.calls[0];
    // jsx.props.pricePromo MUST equal the exact string of brief.produkt.preis_promo
    expect((jsx as { props: { pricePromo: string } }).props.pricePromo).toBe(
      "19.95"
    );
  });

  it("passes the matched disclaimer text verbatim from the DB (no LLM rewrite)", async () => {
    const storage = createInMemoryStorage();
    const renderSpy = vi.fn().mockResolvedValue(Buffer.from(PNG_SIGNATURE));
    const llm = vi.fn().mockResolvedValueOnce({
      data: {
        headlines: ["H1", "H2", "H3"],
        subline: "S",
        cta_label: "Jetzt",
      },
      rawText: "{}",
      tokensUsed: { input: 50, output: 50, total: 100 },
      model: "claude-sonnet-4-6",
      stopReason: "end_turn",
    });

    await runCampaignTracerBullet({
      db,
      storage,
      brandConfig,
      brief: VALID_BRIEF,
      language: "de",
      format: halfpageFormat,
      productContext: { category: "mobile", network: "5g" },
      heroImageUrl: "https://x",
      logoUrl: "https://y",
      llm,
      renderToPng: renderSpy,
    });

    const [jsx] = renderSpy.mock.calls[0];
    expect((jsx as { props: { disclaimer: string } }).props.disclaimer).toBe(
      disclaimer5gText
    );
  });
});
