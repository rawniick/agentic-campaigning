// @vitest-environment node

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createInMemoryStorage } from "../../storage/inMemoryStorage";
import { loadBrand } from "../../brand/loadBrand";
import { createCampaign } from "../../db/queries/campaigns";
import { runMultiplex } from "../runMultiplex";
import { listRegisteredFormatCodes } from "../../../templates/wingo/registry";
import type { Brief } from "../../schemas/brief";
import type { BrandConfig } from "../../brand/loadBrand";

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

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const BRIEF: Brief = {
  kampagne: {
    name: "Multiplex-Test",
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

describe("runMultiplex", () => {
  let db: PGlite;
  let wingoId: string;
  let brandConfig: BrandConfig;
  let campaignId: string;
  let disclaimerId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const r = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = r.rows[0].id;

    await db.query(
      `INSERT INTO brand_voice_variants (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
         VALUES ($1, NULL, NULL, 'default voice', true)`,
      [wingoId]
    );
    const d = await db.query<{ id: string }>(
      `INSERT INTO disclaimers
         (brand_id, slug, name, conditions_json, applies_to_categories,
          text_de, text_fr, text_it, text_en)
         VALUES ($1, '5g', '5G', '{"network":"5g"}'::jsonb, ARRAY['mobile'],
                 '5G im Swisscom Netz', 'fr', 'it', 'en')
         RETURNING id`,
      [wingoId]
    );
    disclaimerId = d.rows[0].id;
    brandConfig = await loadBrand(db, "wingo", { baseDir: FIXTURE_BASE_DIR });
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM assets`);
    await db.query(`DELETE FROM campaign_layout`);
    await db.query(`DELETE FROM campaign_hero`);
    await db.query(`DELETE FROM campaign_copy`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);

    const c = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    campaignId = c.id;
    await db.query(`UPDATE campaigns SET status = 'final_pending' WHERE id = $1`, [
      campaignId,
    ]);

    await db.query(
      `INSERT INTO campaign_copy
         (campaign_id, language, headlines, subline, cta_label, disclaimer_ids,
          selected_headline_idx, is_approved, approved_at)
         VALUES ($1, 'de', ARRAY['Headline 0','Headline 1','Headline 2'],
                 'Subline-DE', 'Jetzt entdecken', ARRAY[$2]::uuid[], 1, true, now())`,
      [campaignId, disclaimerId]
    );

    await db.query(
      `INSERT INTO campaign_hero
         (campaign_id, storage_url, source, mime_type, is_approved, approved_at)
         VALUES ($1, 'memory://hero.jpg', 'upload', 'image/jpeg', true, now())`,
      [campaignId]
    );

    await db.query(
      `INSERT INTO campaign_layout
         (campaign_id, master_format, variant, is_approved, approved_at)
         VALUES ($1, 'dv360_halfpage', 'price_top', true, now())`,
      [campaignId]
    );
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("renders one asset per registered template for the approved campaign", async () => {
    const storage = createInMemoryStorage();
    const renderSpy = vi
      .fn()
      .mockResolvedValue(Buffer.concat([PNG_SIG, Buffer.alloc(64, 0)]));

    const expected = listRegisteredFormatCodes("flash_sale").sort();

    const result = await runMultiplex(db, storage, {
      campaignId,
      brandConfig,
      logoUrl: "memory://logo.svg",
      renderToPng: renderSpy,
    });

    expect(result.assets.map((a) => a.formatCode).sort()).toEqual(expected);

    const dbAssets = await db.query<{ language: string; storage_url: string }>(
      `SELECT language, storage_url FROM assets WHERE campaign_id = $1`,
      [campaignId]
    );
    expect(dbAssets.rows).toHaveLength(expected.length);
    expect(dbAssets.rows[0].language).toBe("de");
  });

  it("passes selected headline, price, disclaimer text, and layout variant verbatim into the rendered template", async () => {
    const storage = createInMemoryStorage();
    const renderSpy = vi.fn().mockResolvedValue(Buffer.from(PNG_SIG));

    await runMultiplex(db, storage, {
      campaignId,
      brandConfig,
      logoUrl: "memory://logo.svg",
      renderToPng: renderSpy,
    });

    expect(renderSpy).toHaveBeenCalled();
    const jsx = renderSpy.mock.calls[0][0] as {
      props: {
        headline: string;
        pricePromo: string;
        priceSuffix: string;
        disclaimer: string;
        variant: string;
      };
    };
    expect(jsx.props.headline).toBe("Headline 1");
    expect(jsx.props.pricePromo).toBe("19.95");
    expect(jsx.props.priceSuffix).toBe("/Mt.");
    expect(jsx.props.disclaimer).toBe("5G im Swisscom Netz");
    expect(jsx.props.variant).toBe("price_top");
  });

  it("transitions campaign status from final_pending to done after a successful render batch", async () => {
    const storage = createInMemoryStorage();
    const renderSpy = vi.fn().mockResolvedValue(Buffer.from(PNG_SIG));

    await runMultiplex(db, storage, {
      campaignId,
      brandConfig,
      logoUrl: "memory://logo.svg",
      renderToPng: renderSpy,
    });

    const r = await db.query<{ status: string }>(
      `SELECT status FROM campaigns WHERE id = $1`,
      [campaignId]
    );
    expect(r.rows[0].status).toBe("done");
  });

  it("transitions campaign status to failed when no render succeeds", async () => {
    const storage = createInMemoryStorage();
    const renderSpy = vi.fn().mockRejectedValue(new Error("render boom"));

    await expect(
      runMultiplex(db, storage, {
        campaignId,
        brandConfig,
        logoUrl: "memory://logo.svg",
        renderToPng: renderSpy,
      })
    ).rejects.toThrow();

    const r = await db.query<{ status: string }>(
      `SELECT status FROM campaigns WHERE id = $1`,
      [campaignId]
    );
    expect(r.rows[0].status).toBe("failed");
  });
});
