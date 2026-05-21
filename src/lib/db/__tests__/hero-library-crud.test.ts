import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import {
  createHeroLibraryEntry,
  listHeroLibrary,
  getHeroLibraryEntry,
  deleteHeroLibraryEntry,
} from "../queries/hero-library";

describe("hero_library CRUD", () => {
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

  it("persists a new entry and returns it from list", async () => {
    const created = await createHeroLibraryEntry(db, {
      brand_id: wingoId,
      name: "Wingo Sample Sport 1",
      storage_url: "https://example.com/hero1.jpg",
    });

    expect(created.id).toMatch(/[0-9a-f-]{36}/);
    expect(created.brand_id).toBe(wingoId);
    expect(created.name).toBe("Wingo Sample Sport 1");
    expect(created.storage_url).toBe("https://example.com/hero1.jpg");

    const all = await listHeroLibrary(db, wingoId);
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(created.id);
    expect(all[0].name).toBe("Wingo Sample Sport 1");
  });

  it("isolates entries by brand_id", async () => {
    const r = await db.query<{ id: string }>(
      `INSERT INTO brands (slug, name) VALUES ('other_brand', 'Other Brand')
         RETURNING id`
    );
    const otherBrandId = r.rows[0].id;
    try {
      await createHeroLibraryEntry(db, {
        brand_id: wingoId,
        name: "Wingo Entry",
        storage_url: "https://example.com/w.jpg",
      });
      await createHeroLibraryEntry(db, {
        brand_id: otherBrandId,
        name: "Other Entry",
        storage_url: "https://example.com/o.jpg",
      });

      const wingoOnly = await listHeroLibrary(db, wingoId);
      expect(wingoOnly).toHaveLength(1);
      expect(wingoOnly[0].name).toBe("Wingo Entry");

      const otherOnly = await listHeroLibrary(db, otherBrandId);
      expect(otherOnly).toHaveLength(1);
      expect(otherOnly[0].name).toBe("Other Entry");
    } finally {
      await db.query(`DELETE FROM brands WHERE id = $1`, [otherBrandId]);
    }
  });

  it("filters by category, lifestyle, and season tags", async () => {
    await createHeroLibraryEntry(db, {
      brand_id: wingoId,
      name: "Mobile Sport Sommer",
      storage_url: "https://example.com/a.jpg",
      categories: ["mobile"],
      lifestyles: ["sport"],
      seasons: ["sommer"],
    });
    await createHeroLibraryEntry(db, {
      brand_id: wingoId,
      name: "TV Familie Weihnachten",
      storage_url: "https://example.com/b.jpg",
      categories: ["tv"],
      lifestyles: ["familie"],
      seasons: ["weihnachten"],
    });
    await createHeroLibraryEntry(db, {
      brand_id: wingoId,
      name: "Mobile+Internet Junge Always-On",
      storage_url: "https://example.com/c.jpg",
      categories: ["mobile", "internet"],
      lifestyles: ["junge"],
      seasons: ["always_on"],
    });

    const mobile = await listHeroLibrary(db, wingoId, { category: "mobile" });
    expect(mobile.map((e) => e.name).sort()).toEqual([
      "Mobile Sport Sommer",
      "Mobile+Internet Junge Always-On",
    ]);

    const familie = await listHeroLibrary(db, wingoId, { lifestyle: "familie" });
    expect(familie).toHaveLength(1);
    expect(familie[0].name).toBe("TV Familie Weihnachten");

    const sommer = await listHeroLibrary(db, wingoId, { season: "sommer" });
    expect(sommer).toHaveLength(1);
    expect(sommer[0].name).toBe("Mobile Sport Sommer");

    const all = await listHeroLibrary(db, wingoId);
    expect(all).toHaveLength(3);
  });

  it("gets a single entry by id and returns null for missing", async () => {
    const created = await createHeroLibraryEntry(db, {
      brand_id: wingoId,
      name: "Pickable",
      storage_url: "https://example.com/p.jpg",
    });

    const fetched = await getHeroLibraryEntry(db, created.id);
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.name).toBe("Pickable");

    const missing = await getHeroLibraryEntry(
      db,
      "00000000-0000-0000-0000-000000000000"
    );
    expect(missing).toBeNull();
  });

  it("deletes an entry by id", async () => {
    const created = await createHeroLibraryEntry(db, {
      brand_id: wingoId,
      name: "Disposable",
      storage_url: "https://example.com/d.jpg",
    });

    await deleteHeroLibraryEntry(db, created.id);

    const fetched = await getHeroLibraryEntry(db, created.id);
    expect(fetched).toBeNull();
  });
});
