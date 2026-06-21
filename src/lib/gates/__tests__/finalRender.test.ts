// @vitest-environment node

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createInMemoryStorage } from "../../storage/inMemoryStorage";
import { loadBrand } from "../../brand/loadBrand";
import { createCampaign } from "../../db/queries/campaigns";
import { finalRender } from "../finalRender";
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
    name: "T",
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

describe("finalRender (Gate 4)", () => {
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

    // approved copy
    await db.query(
      `INSERT INTO campaign_copy
         (campaign_id, language, headlines, subline, cta_label, disclaimer_ids,
          selected_headline_idx, is_approved, approved_at)
         VALUES ($1, 'de', ARRAY['Headline 0','Headline 1','Headline 2'],
                 'Subline-DE', 'CTA', ARRAY[$2]::uuid[], 1, true, now())`,
      [campaignId, disclaimerId]
    );

    // approved hero
    await db.query(
      `INSERT INTO campaign_hero
         (campaign_id, storage_url, source, mime_type, is_approved, approved_at)
         VALUES ($1, 'memory://hero.jpg', 'upload', 'image/jpeg', true, now())`,
      [campaignId]
    );

    // approved layout (price_top)
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

  it("renders the asset, persists it, and transitions to done", async () => {
    const storage = createInMemoryStorage();
    const renderSpy = vi
      .fn()
      .mockResolvedValue(Buffer.concat([PNG_SIG, Buffer.alloc(64, 0)]));

    await finalRender(db, storage, {
      campaignId,
      brandConfig,
      logoUrl: "memory://logo.svg",
      renderToPng: renderSpy,
    });

    expect(renderSpy).toHaveBeenCalledOnce();
    const renderOpts = renderSpy.mock.calls[0][1] as { width: number; height: number };
    expect(renderOpts.width).toBe(300);
    expect(renderOpts.height).toBe(600);

    const status = await db.query<{ status: string }>(
      `SELECT status FROM campaigns WHERE id = $1`,
      [campaignId]
    );
    expect(status.rows[0].status).toBe("done");

    const assets = await db.query<{ language: string; storage_url: string }>(
      `SELECT language, storage_url FROM assets WHERE campaign_id = $1`,
      [campaignId]
    );
    expect(assets.rows).toHaveLength(1);
    expect(assets.rows[0].language).toBe("de");
    expect(assets.rows[0].storage_url).toContain("memory://");
  });

  it("passes the selected headline (index 1) verbatim into the template", async () => {
    const storage = createInMemoryStorage();
    const renderSpy = vi.fn().mockResolvedValue(Buffer.from(PNG_SIG));

    await finalRender(db, storage, {
      campaignId,
      brandConfig,
      logoUrl: "memory://logo.svg",
      renderToPng: renderSpy,
    });

    expect(renderSpy).toHaveBeenCalledOnce();
    const jsx = renderSpy.mock.calls[0][0] as { props: { headline: string; variant: string; pricePromo: string; disclaimer: string } };
    expect(jsx.props.headline).toBe("Headline 1");
    expect(jsx.props.variant).toBe("price_top");
    expect(jsx.props.pricePromo).toBe("19.95");
    expect(jsx.props.disclaimer).toBe("5G im Swisscom Netz");
  });

  it("renders ALL matched disclaimers, not just the first (compliance)", async () => {
    const d2 = await db.query<{ id: string }>(
      `INSERT INTO disclaimers
         (brand_id, slug, name, conditions_json, applies_to_categories,
          text_de, text_fr, text_it, text_en)
         VALUES ($1, 'zweiter', 'Zweiter', '{}'::jsonb, ARRAY['mobile'],
                 'Zweiter Hinweis DE', 'fr2', 'it2', 'en2')
         RETURNING id`,
      [wingoId]
    );
    await db.query(
      `UPDATE campaign_copy SET disclaimer_ids = ARRAY[$1, $2]::uuid[]
         WHERE campaign_id = $3 AND language = 'de'`,
      [disclaimerId, d2.rows[0].id, campaignId]
    );

    const storage = createInMemoryStorage();
    const renderSpy = vi.fn().mockResolvedValue(Buffer.from(PNG_SIG));

    await finalRender(db, storage, {
      campaignId,
      brandConfig,
      logoUrl: "memory://logo.svg",
      renderToPng: renderSpy,
    });

    const jsx = renderSpy.mock.calls[0][0] as { props: { disclaimer: string } };
    expect(jsx.props.disclaimer).toContain("5G im Swisscom Netz");
    expect(jsx.props.disclaimer).toContain("Zweiter Hinweis DE");
  });

  it("rejects if not in final_pending state", async () => {
    await db.query(`UPDATE campaigns SET status = 'done' WHERE id = $1`, [campaignId]);
    const storage = createInMemoryStorage();

    await expect(
      finalRender(db, storage, {
        campaignId,
        brandConfig,
        logoUrl: "memory://logo.svg",
      })
    ).rejects.toThrow(/Invalid transition|state/i);
  });

  describe("campaign art emphasis", () => {
    it("threads emphasis='urgency' into the render for a flash_sale campaign", async () => {
      const storage = createInMemoryStorage();
      const renderSpy = vi.fn().mockResolvedValue(Buffer.from(PNG_SIG));

      await finalRender(db, storage, {
        campaignId,
        brandConfig,
        logoUrl: "memory://logo.svg",
        renderToPng: renderSpy,
      });

      const jsx = renderSpy.mock.calls[0][0] as { props: { emphasis?: string } };
      expect(jsx.props.emphasis).toBe("urgency");
    });

    it("threads emphasis='neutral' into the render for a standard campaign", async () => {
      await db.query(`UPDATE campaigns SET art = 'standard' WHERE id = $1`, [
        campaignId,
      ]);
      const storage = createInMemoryStorage();
      const renderSpy = vi.fn().mockResolvedValue(Buffer.from(PNG_SIG));

      await finalRender(db, storage, {
        campaignId,
        brandConfig,
        logoUrl: "memory://logo.svg",
        renderToPng: renderSpy,
      });

      const jsx = renderSpy.mock.calls[0][0] as { props: { emphasis?: string } };
      expect(jsx.props.emphasis).toBe("neutral");
    });
  });
});
