import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import { findVoiceVariant } from "../queries/brand-voice";

describe("findVoiceVariant", () => {
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
    await db.query(`DELETE FROM brand_voice_variants`);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("returns the specific variant when (kampagne_art, zielgruppe) matches", async () => {
    await db.query(
      `INSERT INTO brand_voice_variants
         (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
         VALUES ($1, 'flash_sale', 'sozial', 'urgent + community vibe', false)`,
      [wingoId]
    );
    await db.query(
      `INSERT INTO brand_voice_variants
         (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
         VALUES ($1, NULL, NULL, 'default voice', true)`,
      [wingoId]
    );

    const v = await findVoiceVariant(db, wingoId, "flash_sale", "sozial");

    expect(v.tov_md).toBe("urgent + community vibe");
  });

  it("falls back to the brand default when no specific variant exists", async () => {
    await db.query(
      `INSERT INTO brand_voice_variants
         (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
         VALUES ($1, NULL, NULL, 'default voice', true)`,
      [wingoId]
    );

    const v = await findVoiceVariant(db, wingoId, "standard", "rational");

    expect(v.tov_md).toBe("default voice");
    expect(v.is_default).toBe(true);
  });

  it("throws when neither a specific match nor a default exists for the brand", async () => {
    await expect(
      findVoiceVariant(db, wingoId, "flash_sale", "sozial")
    ).rejects.toThrow(/no brand voice/i);
  });
});
