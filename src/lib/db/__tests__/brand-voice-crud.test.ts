import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import {
  upsertVoiceVariant,
  getAllVoiceVariants,
  deleteVoiceVariant,
  setDefaultVoice,
} from "../queries/brand-voice";

describe("brand_voice_variants CRUD", () => {
  let db: PGlite;
  let wingoId: string;

  beforeAll(async () => {
    db = await createTestDb();
    const r = await db.query<{ id: string }>(
      `SELECT id FROM brands WHERE slug = 'wingo'`
    );
    wingoId = r.rows[0].id;
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM brand_voice_variants`);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("sets and reads the brand default voice", async () => {
    await setDefaultVoice(db, wingoId, "# Wingo Default\nDirekt, klar.");

    const all = await getAllVoiceVariants(db, wingoId);
    expect(all).toHaveLength(1);
    expect(all[0].is_default).toBe(true);
    expect(all[0].tov_md).toContain("Direkt, klar.");
  });

  it("replaces the default when set a second time", async () => {
    await setDefaultVoice(db, wingoId, "# V1");
    await setDefaultVoice(db, wingoId, "# V2");

    const all = await getAllVoiceVariants(db, wingoId);
    const defaults = all.filter((v) => v.is_default);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].tov_md).toContain("# V2");
  });

  it("upserts a specific (art, zielgruppe) variant", async () => {
    await setDefaultVoice(db, wingoId, "# Default");
    await upsertVoiceVariant(db, {
      brand_id: wingoId,
      kampagne_art: "flash_sale",
      zielgruppe: "sozial",
      tov_md: "# Flash Sale Sozial Voice\nLauter, juenger.",
    });

    const all = await getAllVoiceVariants(db, wingoId);
    expect(all).toHaveLength(2);
    const variant = all.find(
      (v) => v.kampagne_art === "flash_sale" && v.zielgruppe === "sozial"
    );
    expect(variant?.tov_md).toContain("Lauter, juenger.");
  });

  it("upsert replaces an existing variant of the same (art, zielgruppe)", async () => {
    await upsertVoiceVariant(db, {
      brand_id: wingoId,
      kampagne_art: "flash_sale",
      zielgruppe: "sozial",
      tov_md: "V1",
    });
    await upsertVoiceVariant(db, {
      brand_id: wingoId,
      kampagne_art: "flash_sale",
      zielgruppe: "sozial",
      tov_md: "V2",
    });

    const all = await getAllVoiceVariants(db, wingoId);
    expect(all).toHaveLength(1);
    expect(all[0].tov_md).toBe("V2");
  });

  it("deletes a variant by id", async () => {
    await setDefaultVoice(db, wingoId, "# Default");
    const variant = await upsertVoiceVariant(db, {
      brand_id: wingoId,
      kampagne_art: "standard",
      zielgruppe: "rational",
      tov_md: "Standard Rational",
    });

    await deleteVoiceVariant(db, variant.id);

    const all = await getAllVoiceVariants(db, wingoId);
    expect(all).toHaveLength(1);
    expect(all[0].is_default).toBe(true);
  });

  it("refuses to delete the default variant", async () => {
    const def = await setDefaultVoice(db, wingoId, "# Default");

    await expect(deleteVoiceVariant(db, def.id)).rejects.toThrow(
      /default/i
    );
  });
});
