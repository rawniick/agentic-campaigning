import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "../../db/__tests__/fixtures/createTestDb";
import { createInMemoryStorage } from "../../storage/inMemoryStorage";
import { createMockEmbeddingProvider } from "../../embedding/mockEmbeddingProvider";
import { uploadToHeroLibrary } from "../uploadToHeroLibrary";
import { listHeroLibrary } from "../../db/queries/hero-library";

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

describe("uploadToHeroLibrary", () => {
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
    await db.query(`DELETE FROM hero_library`);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("uploads bytes to storage and creates a library entry", async () => {
    const storage = createInMemoryStorage();

    const entry = await uploadToHeroLibrary(db, storage, {
      brand_id: wingoId,
      brandSlug: "wingo",
      name: "Sport Sample",
      bytes: JPEG_MAGIC,
      contentType: "image/jpeg",
      filename: "sport.jpg",
      categories: ["mobile"],
      lifestyles: ["sport"],
    });

    expect(entry.id).toMatch(/[0-9a-f-]{36}/);
    expect(entry.name).toBe("Sport Sample");
    expect(entry.storage_url).toContain("memory://");
    expect(entry.categories).toEqual(["mobile"]);
    expect(entry.lifestyles).toEqual(["sport"]);

    const storageKey = entry.storage_url.replace("memory://", "");
    expect(storage.has(storageKey)).toBe(true);

    const all = await listHeroLibrary(db, wingoId);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(entry.id);
  });

  it("namespaces storage keys by brandSlug under hero-library/", async () => {
    const storage = createInMemoryStorage();

    const entry = await uploadToHeroLibrary(db, storage, {
      brand_id: wingoId,
      brandSlug: "wingo",
      name: "Namespaced",
      bytes: JPEG_MAGIC,
      contentType: "image/jpeg",
      filename: "n.jpg",
    });

    const key = entry.storage_url.replace("memory://", "");
    expect(key.startsWith("hero-library/wingo/")).toBe(true);
  });

  it("embeds entry name on save when provider is given", async () => {
    const storage = createInMemoryStorage();
    const provider = createMockEmbeddingProvider({
      "Sport Sample": [0.9, 0.1, 0.1],
    });

    const entry = await uploadToHeroLibrary(
      db,
      storage,
      {
        brand_id: wingoId,
        brandSlug: "wingo",
        name: "Sport Sample",
        bytes: JPEG_MAGIC,
        contentType: "image/jpeg",
        filename: "sport.jpg",
      },
      provider
    );

    expect(entry.embedding).toEqual([0.9, 0.1, 0.1]);
  });

  it("rejects empty bytes", async () => {
    const storage = createInMemoryStorage();

    await expect(
      uploadToHeroLibrary(db, storage, {
        brand_id: wingoId,
        brandSlug: "wingo",
        name: "Empty",
        bytes: Buffer.alloc(0),
        contentType: "image/jpeg",
        filename: "empty.jpg",
      })
    ).rejects.toThrow(/empty/i);
  });
});
