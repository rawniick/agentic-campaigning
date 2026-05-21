// @vitest-environment node

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createCampaign } from "../../db/queries/campaigns";
import { translateCampaignCopy } from "../translateCampaignCopy";
import type { Brief } from "../../schemas/brief";
import type {
  TranslateLLMFn,
  TranslateLLMResponse,
} from "../translateCampaignCopy";

const BRIEF: Brief = {
  kampagne: {
    name: "Translate-Test",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: { name: "Wingo Mobile Swiss", preis_promo: 19.95, preis_suffix: "/Mt." },
  strategie: { input: "x" },
  vermarktung: { hauptbotschaft: "x", zielgruppe: "sozial", zielgebiet: "deutschschweiz" },
  assets_kanaele: { channel_kategorien: [], format_codes: [] },
  sonstiges: {},
};

const BATCH_RESPONSE: TranslateLLMResponse = {
  fr: {
    headlines: ["FR H1", "FR H2", "FR H3"],
    subline: "FR Subline",
    cta_label: "FR CTA",
  },
  it: {
    headlines: ["IT H1", "IT H2", "IT H3"],
    subline: "IT Subline",
    cta_label: "IT CTA",
  },
  en: {
    headlines: ["EN H1", "EN H2", "EN H3"],
    subline: "EN Subline",
    cta_label: "EN CTA",
  },
};

const PASSTHROUGH_TERMS = ["Wingo", "Wingo Mobile Swiss", "Swisscom", "5G im Swisscom Netz"];

describe("translateCampaignCopy", () => {
  let db: PGlite;
  let wingoId: string;
  let campaignId: string;
  let disclaimerId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const b = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = b.rows[0].id;
    const d = await db.query<{ id: string }>(
      `INSERT INTO disclaimers
         (brand_id, slug, name, conditions_json, applies_to_categories,
          text_de, text_fr, text_it, text_en)
         VALUES ($1, '5g', '5G', '{}'::jsonb, ARRAY['mobile'],
                 '5G im Swisscom Netz', 'fr-d', 'it-d', 'en-d')
         RETURNING id`,
      [wingoId]
    );
    disclaimerId = d.rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM campaign_copy`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);
    const c = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    campaignId = c.id;

    await db.query(
      `INSERT INTO campaign_copy
         (campaign_id, language, headlines, subline, cta_label, disclaimer_ids,
          selected_headline_idx, is_approved, approved_at)
         VALUES ($1, 'de',
                 ARRAY['DE Schweizer Netz, halber Preis.','DE Wingo Mobile Swiss fuer 19.95.','DE Headline 3'],
                 'DE Unlimitiert telefonieren.',
                 'Jetzt entdecken',
                 ARRAY[$2]::uuid[], 0, true, now())`,
      [campaignId, disclaimerId]
    );
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("persists FR/IT/EN copy rows derived from the approved DE source", async () => {
    const llm: TranslateLLMFn = vi.fn().mockResolvedValue(BATCH_RESPONSE);

    await translateCampaignCopy(db, {
      campaignId,
      passthroughTerms: PASSTHROUGH_TERMS,
      llm,
    });

    const rows = await db.query<{
      language: string;
      headlines: string[];
      subline: string;
      cta_label: string;
      disclaimer_ids: string[];
    }>(
      `SELECT language, headlines, subline, cta_label, disclaimer_ids
         FROM campaign_copy
        WHERE campaign_id = $1
        ORDER BY language`,
      [campaignId]
    );

    expect(rows.rows.map((r) => r.language).sort()).toEqual(["de", "en", "fr", "it"]);

    const fr = rows.rows.find((r) => r.language === "fr")!;
    expect(fr.headlines).toEqual(["FR H1", "FR H2", "FR H3"]);
    expect(fr.subline).toBe("FR Subline");
    expect(fr.cta_label).toBe("FR CTA");
    // Disclaimer-IDs werden vom DE-Source uebernommen, NICHT vom LLM erzeugt.
    expect(fr.disclaimer_ids).toEqual([disclaimerId]);
  });
});
