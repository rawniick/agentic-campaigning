import { describe, it, expect, beforeAll, afterAll } from "vitest";
import path from "path";
import { fileURLToPath } from "url";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { loadBrand } from "../loadBrand";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_BASE_DIR = path.join(__dirname, "fixtures");

describe("loadBrand", () => {
  let db: PGlite;
  let wingoId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const res = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = res.rows[0].id;

    // Seed: default voice + 1 disclaimer
    await db.query(
      `INSERT INTO brand_voice_variants
         (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
         VALUES ($1, NULL, NULL, 'Wingo default TOV', true)`,
      [wingoId]
    );
    await db.query(
      `INSERT INTO disclaimers
         (brand_id, slug, name, conditions_json, applies_to_categories,
          text_de, text_fr, text_it, text_en)
         VALUES ($1, 'widerruf', 'Widerrufsbelehrung',
                 '{}'::jsonb, ARRAY[]::TEXT[],
                 'Widerruf DE', 'Widerruf FR', 'Widerruf IT', 'Widerruf EN')`,
      [wingoId]
    );
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("composes a complete BrandConfig: brand record + tokens + voice + disclaimers + V1 formats", async () => {
    const cfg = await loadBrand(db, "wingo", { baseDir: FIXTURE_BASE_DIR });

    expect(cfg.brand.slug).toBe("wingo");
    expect(cfg.tokens.colors.primary.hex).toBe("#E61E2A");
    expect(cfg.defaultVoice.tov_md).toBe("Wingo default TOV");
    expect(cfg.defaultVoice.is_default).toBe(true);
    expect(cfg.disclaimers).toHaveLength(1);
    expect(cfg.disclaimers[0].slug).toBe("widerruf");
    expect(cfg.formats).toHaveLength(11);
  });
});
