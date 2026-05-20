import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import { matchDisclaimers } from "../queries/disclaimers";

describe("matchDisclaimers", () => {
  let db: PGlite;
  let wingoId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const res = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = res.rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM disclaimers`);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  // Helper fuer kompaktere Seed-Calls
  async function seedDisclaimer(
    slug: string,
    conditions: Record<string, unknown>,
    appliesTo: string[]
  ) {
    await db.query(
      `INSERT INTO disclaimers
         (brand_id, slug, name, conditions_json, applies_to_categories,
          text_de, text_fr, text_it, text_en, is_required)
         VALUES
         ($1, $2, $2, $3::jsonb, $4,
          $2 || ' DE', $2 || ' FR', $2 || ' IT', $2 || ' EN', true)`,
      [wingoId, slug, JSON.stringify(conditions), appliesTo]
    );
  }

  it("matches a 5G-only disclaimer for a 5G mobile product", async () => {
    await seedDisclaimer("5g_swisscom_netz", { network: "5g" }, ["mobile"]);

    const result = await matchDisclaimers(db, wingoId, {
      category: "mobile",
      network: "5g",
    });

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe("5g_swisscom_netz");
  });

  it("excludes a 5G-conditional disclaimer for a non-5G mobile product", async () => {
    await seedDisclaimer("5g_swisscom_netz", { network: "5g" }, ["mobile"]);

    const result = await matchDisclaimers(db, wingoId, {
      category: "mobile",
      network: "4g",
    });

    expect(result).toHaveLength(0);
  });

  it("excludes a mobile-only disclaimer for a TV product", async () => {
    await seedDisclaimer("mobile_standard", {}, ["mobile"]);
    await seedDisclaimer("tv_standard", {}, ["tv"]);

    const result = await matchDisclaimers(db, wingoId, { category: "tv" });

    expect(result.map((d) => d.slug)).toEqual(["tv_standard"]);
  });

  it("includes a category-agnostic disclaimer for any product", async () => {
    await seedDisclaimer("widerruf", {}, []);

    const mobileResult = await matchDisclaimers(db, wingoId, {
      category: "mobile",
    });
    const tvResult = await matchDisclaimers(db, wingoId, { category: "tv" });

    expect(mobileResult.map((d) => d.slug)).toEqual(["widerruf"]);
    expect(tvResult.map((d) => d.slug)).toEqual(["widerruf"]);
  });
});
