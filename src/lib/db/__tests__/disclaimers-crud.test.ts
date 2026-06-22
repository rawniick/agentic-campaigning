import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import { createCampaign } from "../queries/campaigns";
import type { Brief } from "../../schemas/brief";
import {
  createDisclaimer,
  getDisclaimerById,
  listAllDisclaimers,
  updateDisclaimer,
  deleteDisclaimer,
} from "../queries/disclaimers";

const BRIEF: Brief = {
  kampagne: {
    name: "x",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: { name: "x", preis_promo: 19.95, preis_suffix: "/Mt." },
  strategie: { input: "x" },
  vermarktung: { hauptbotschaft: "x", zielgruppe: "sozial", zielgebiet: "deutschschweiz" },
  assets_kanaele: { channel_kategorien: [], format_codes: ["dv360_halfpage"] },
  sonstiges: {},
};

describe("disclaimers CRUD", () => {
  let db: PGlite;
  let wingoId: string;

  beforeAll(async () => {
    db = await createTestDb();
    wingoId = (
      await db.query<{ id: string }>(`SELECT id FROM brands WHERE slug = 'wingo'`)
    ).rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM campaign_copy`);
    await db.query(`DELETE FROM campaign_briefs`);
    await db.query(`DELETE FROM campaigns`);
    await db.query(`DELETE FROM disclaimers`);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  const base = {
    slug: "5g_netz",
    name: "5G im Swisscom Netz",
    conditions_json: { network: "5g" },
    applies_to_categories: ["mobile"],
    text_de: "5G im Swisscom Netz",
    text_fr: "5G FR",
    text_it: "5G IT",
    text_en: "5G EN",
  };

  it("creates a disclaimer with defaults (is_required/is_active true)", async () => {
    const d = await createDisclaimer(db, { brand_id: wingoId, ...base });
    expect(d.id).toBeDefined();
    expect(d.slug).toBe("5g_netz");
    expect(d.conditions_json).toEqual({ network: "5g" });
    expect(d.applies_to_categories).toEqual(["mobile"]);
    expect(d.is_required).toBe(true);
    expect(d.is_active).toBe(true);
  });

  it("rejects a duplicate (brand, slug)", async () => {
    await createDisclaimer(db, { brand_id: wingoId, ...base });
    await expect(
      createDisclaimer(db, { brand_id: wingoId, ...base })
    ).rejects.toThrow();
  });

  it("getDisclaimerById returns the row, null for unknown", async () => {
    const d = await createDisclaimer(db, { brand_id: wingoId, ...base });
    const got = await getDisclaimerById(db, d.id);
    expect(got?.slug).toBe("5g_netz");
    expect(
      await getDisclaimerById(db, "00000000-0000-0000-0000-000000000000")
    ).toBeNull();
  });

  it("listAllDisclaimers includes inactive rows, ordered by slug", async () => {
    await createDisclaimer(db, { brand_id: wingoId, ...base, slug: "zzz", is_active: false });
    await createDisclaimer(db, { brand_id: wingoId, ...base, slug: "aaa" });
    const rows = await listAllDisclaimers(db, wingoId);
    expect(rows.map((r) => r.slug)).toEqual(["aaa", "zzz"]);
    expect(rows.find((r) => r.slug === "zzz")?.is_active).toBe(false);
  });

  it("updateDisclaimer changes fields", async () => {
    const d = await createDisclaimer(db, { brand_id: wingoId, ...base });
    const upd = await updateDisclaimer(db, d.id, {
      ...base,
      name: "Geaendert",
      text_de: "Neuer DE-Text",
      conditions_json: {},
      applies_to_categories: [],
      is_required: false,
      is_active: false,
    });
    expect(upd.name).toBe("Geaendert");
    expect(upd.text_de).toBe("Neuer DE-Text");
    expect(upd.conditions_json).toEqual({});
    expect(upd.applies_to_categories).toEqual([]);
    expect(upd.is_required).toBe(false);
    expect(upd.is_active).toBe(false);
  });

  it("deleteDisclaimer removes the row", async () => {
    const d = await createDisclaimer(db, { brand_id: wingoId, ...base });
    await deleteDisclaimer(db, d.id);
    expect(await getDisclaimerById(db, d.id)).toBeNull();
  });

  it("deleteDisclaimer refuses to delete a disclaimer referenced by a campaign (compliance)", async () => {
    const d = await createDisclaimer(db, { brand_id: wingoId, ...base });
    const c = await createCampaign(db, { brand_id: wingoId, brief: BRIEF });
    await db.query(
      `INSERT INTO campaign_copy
         (campaign_id, language, headlines, subline, cta_label, disclaimer_ids,
          selected_headline_idx, is_approved, approved_at)
         VALUES ($1, 'de', ARRAY['H'], 'S', 'C', ARRAY[$2]::uuid[], 0, true, now())`,
      [c.id, d.id]
    );

    await expect(deleteDisclaimer(db, d.id)).rejects.toThrow(/referenziert/i);
    expect(await getDisclaimerById(db, d.id)).not.toBeNull(); // bleibt erhalten

    // Ein nicht-referenzierter Disclaimer bleibt loeschbar.
    const free = await createDisclaimer(db, { brand_id: wingoId, ...base, slug: "frei" });
    await deleteDisclaimer(db, free.id);
    expect(await getDisclaimerById(db, free.id)).toBeNull();
  });
});
