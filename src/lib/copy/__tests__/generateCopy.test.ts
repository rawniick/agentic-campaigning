import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { generateCopy } from "../generateCopy";
import { loadBrand } from "../../brand/loadBrand";
import { createCampaign } from "../../db/queries/campaigns";
import { matchDisclaimers } from "../../db/queries/disclaimers";
import type { Brief } from "../../schemas/brief";
import type { BrandConfig } from "../../brand/loadBrand";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_BASE_DIR = path.join(__dirname, "..", "..", "brand", "__tests__", "fixtures");

const VALID_BRIEF: Brief = {
  kampagne: {
    name: "Wingo Mobile Swiss — Flash Sale Test",
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
  strategie: { input: "Reaktion auf Salt-Preissenkung" },
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

describe("generateCopy", () => {
  let db: PGlite;
  let wingoId: string;
  let brandConfig: BrandConfig;
  let campaignId: string;
  let disclaimer5gId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const r = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = r.rows[0].id;

    // Default-TOV + ein Beispiel-Disclaimer fuer 5G Mobile
    await db.query(
      `INSERT INTO brand_voice_variants
         (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
         VALUES ($1, NULL, NULL,
           '# Wingo Default Voice\n- Direkt, klar, schweizerisch.\n- Du-Form.',
           true)`,
      [wingoId]
    );

    const disclaimerRes = await db.query<{ id: string }>(
      `INSERT INTO disclaimers
         (brand_id, slug, name, conditions_json, applies_to_categories,
          text_de, text_fr, text_it, text_en)
         VALUES ($1, '5g_swisscom_netz', '5G im Swisscom Netz',
                 '{"network": "5g"}'::jsonb, ARRAY['mobile'],
                 'Aktion gueltig bis 30.06.2026. Mindestvertragslaufzeit 24 Monate.',
                 'Offre valable jusqu au 30.06.2026. Duree minimale 24 mois.',
                 'Offerta valida fino al 30.06.2026. Durata minima 24 mesi.',
                 'Offer valid until 30.06.2026. Minimum term 24 months.')
         RETURNING id`,
      [wingoId]
    );
    disclaimer5gId = disclaimerRes.rows[0].id;

    brandConfig = await loadBrand(db, "wingo", { baseDir: FIXTURE_BASE_DIR });
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM campaign_copy`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);

    const campaign = await createCampaign(db, {
      brand_id: wingoId,
      brief: VALID_BRIEF,
    });
    campaignId = campaign.id;
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("uses the matrix voice variant for (art, zielgruppe) over the brand default", async () => {
    // VALID_BRIEF ist flash_sale + sozial.
    await db.query(
      `INSERT INTO brand_voice_variants
         (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
         VALUES ($1, 'flash_sale', 'sozial',
           '# Flash Sozial Voice\n- Laut, dringlich, Du.', false)`,
      [wingoId]
    );
    try {
      const llm = vi.fn().mockResolvedValueOnce({
        data: { headlines: ["A", "B", "C"], subline: "S", cta_label: "C" },
        rawText: "{}",
        tokensUsed: { input: 50, output: 50, total: 100 },
        model: "claude-sonnet-4-6",
        stopReason: "end_turn",
      });

      await generateCopy(db, {
        campaignId,
        brief: VALID_BRIEF,
        brandConfig,
        language: "de",
        disclaimers: [],
        llm,
      });

      const { systemPrompt } = llm.mock.calls[0][0];
      expect(systemPrompt).toContain("Flash Sozial Voice");
      expect(systemPrompt).not.toContain("Wingo Default Voice");
    } finally {
      // brand_voice_variants wird nicht pro Test geleert — spezifische Zelle wieder weg,
      // damit die anderen Tests den Default-Fallback sehen.
      await db.query(
        `DELETE FROM brand_voice_variants WHERE brand_id = $1 AND is_default = false`,
        [wingoId]
      );
    }
  });

  it("calls the LLM with the brand TOV in the system prompt", async () => {
    const llm = vi.fn().mockResolvedValueOnce({
      data: {
        headlines: ["Schweizer Netz, halber Preis.", "Jetzt 12 Mt. fuer 19.95.", "Wingo Mobile Swiss — 19.95/Mt."],
        subline: "Unlimitiert telefonieren im Swisscom Netz.",
        cta_label: "Jetzt entdecken",
      },
      rawText: "{}",
      tokensUsed: { input: 100, output: 50, total: 150 },
      model: "claude-sonnet-4-6",
      stopReason: "end_turn",
    });

    const disclaimers = await matchDisclaimers(db, wingoId, {
      category: "mobile",
      network: "5g",
    });

    await generateCopy(db, {
      campaignId,
      brief: VALID_BRIEF,
      brandConfig,
      language: "de",
      disclaimers,
      llm,
    });

    expect(llm).toHaveBeenCalledOnce();
    const args = llm.mock.calls[0][0];
    expect(args.systemPrompt).toContain("Wingo Default Voice");
    expect(args.systemPrompt).toContain("Du-Form");
  });

  it("stores 3 headlines + subline + cta + disclaimer-ids in campaign_copy", async () => {
    const llm = vi.fn().mockResolvedValueOnce({
      data: {
        headlines: ["H1", "H2", "H3"],
        subline: "Sub",
        cta_label: "Jetzt entdecken",
      },
      rawText: "{}",
      tokensUsed: { input: 100, output: 50, total: 150 },
      model: "claude-sonnet-4-6",
      stopReason: "end_turn",
    });
    const disclaimers = await matchDisclaimers(db, wingoId, {
      category: "mobile",
      network: "5g",
    });

    const copy = await generateCopy(db, {
      campaignId,
      brief: VALID_BRIEF,
      brandConfig,
      language: "de",
      disclaimers,
      llm,
    });

    expect(copy.headlines).toEqual(["H1", "H2", "H3"]);
    expect(copy.subline).toBe("Sub");
    expect(copy.cta_label).toBe("Jetzt entdecken");
    expect(copy.disclaimer_ids).toContain(disclaimer5gId);
    expect(copy.language).toBe("de");
  });

  it("never sends disclaimer text to the LLM (pass-through compliance)", async () => {
    const llm = vi.fn().mockResolvedValueOnce({
      data: { headlines: ["X", "Y", "Z"], subline: "S", cta_label: "C" },
      rawText: "{}",
      tokensUsed: { input: 50, output: 50, total: 100 },
      model: "claude-sonnet-4-6",
      stopReason: "end_turn",
    });
    const disclaimers = await matchDisclaimers(db, wingoId, {
      category: "mobile",
      network: "5g",
    });

    await generateCopy(db, {
      campaignId,
      brief: VALID_BRIEF,
      brandConfig,
      language: "de",
      disclaimers,
      llm,
    });

    const args = llm.mock.calls[0][0];
    const full = `${args.systemPrompt}\n${args.userMessage}`;
    expect(full).not.toContain("Mindestvertragslaufzeit 24 Monate");
    expect(full).not.toContain("Aktion gueltig bis 30.06.2026");
  });

  it("never sends the promo price to the LLM (pass-through compliance)", async () => {
    const llm = vi.fn().mockResolvedValueOnce({
      data: { headlines: ["X", "Y", "Z"], subline: "S", cta_label: "C" },
      rawText: "{}",
      tokensUsed: { input: 50, output: 50, total: 100 },
      model: "claude-sonnet-4-6",
      stopReason: "end_turn",
    });
    const disclaimers: never[] = [];

    await generateCopy(db, {
      campaignId,
      brief: VALID_BRIEF,
      brandConfig,
      language: "de",
      disclaimers,
      llm,
    });

    const args = llm.mock.calls[0][0];
    expect(args.systemPrompt).not.toMatch(/19\.95/);
    expect(args.userMessage).not.toMatch(/19\.95/);
  });

  it("never sends konditionen (free-text that may contain prices) to the LLM", async () => {
    const briefWithKonditionen: Brief = {
      ...VALID_BRIEF,
      produkt: {
        ...VALID_BRIEF.produkt,
        konditionen: "Aktionspreis 9.95 fuer 12 Monate, danach 29.95/Mt.",
      },
    };
    const llm = vi.fn().mockResolvedValueOnce({
      data: { headlines: ["X", "Y", "Z"], subline: "S", cta_label: "C" },
      rawText: "{}",
      tokensUsed: { input: 50, output: 50, total: 100 },
      model: "claude-sonnet-4-6",
      stopReason: "end_turn",
    });

    await generateCopy(db, {
      campaignId,
      brief: briefWithKonditionen,
      brandConfig,
      language: "de",
      disclaimers: [],
      llm,
    });

    const args = llm.mock.calls[0][0];
    const full = `${args.systemPrompt}\n${args.userMessage}`;
    expect(full).not.toContain("9.95");
    expect(full).not.toContain("Aktionspreis");
  });

  it("injects the brand glossar passthrough terms into the DE system prompt", async () => {
    const llm = vi.fn().mockResolvedValueOnce({
      data: { headlines: ["X", "Y", "Z"], subline: "S", cta_label: "C" },
      rawText: "{}",
      tokensUsed: { input: 50, output: 50, total: 100 },
      model: "claude-sonnet-4-6",
      stopReason: "end_turn",
    });

    await generateCopy(db, {
      campaignId,
      brief: VALID_BRIEF,
      brandConfig,
      language: "de",
      disclaimers: [],
      llm,
    });

    const { systemPrompt } = llm.mock.calls[0][0];
    expect(brandConfig.glossar.passthrough_terms.length).toBeGreaterThan(0);
    for (const term of brandConfig.glossar.passthrough_terms) {
      expect(systemPrompt).toContain(term);
    }
  });
});
