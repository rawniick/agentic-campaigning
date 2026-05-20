import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb } from "./fixtures/createTestDb";
import {
  createProduct,
  getProductsForBrand,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../queries/products";

describe("products CRUD", () => {
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
    await db.query(`DELETE FROM products`);
  });

  afterAll(async () => {
    if (db) await db.close();
  });

  it("creates a product and returns it by id", async () => {
    const created = await createProduct(db, {
      brand_id: wingoId,
      name: "Wingo Mobile Swiss",
      category: "mobile",
      price_promo: 19.95,
      price_standard: 29.95,
      price_suffix: "/Mt.",
      link: "https://wingo.ch/de/mobile-abos/wingo-mobile-swiss",
      features: ["Unlimitiert telefonieren", "5G Swisscom Netz"],
      sku: "WMS-2026",
      network: "5g_swisscom",
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe("Wingo Mobile Swiss");

    const fetched = await getProductById(db, created.id);
    expect(fetched?.name).toBe("Wingo Mobile Swiss");
    expect(fetched?.price_promo).toBe(19.95);
    expect(fetched?.features).toEqual([
      "Unlimitiert telefonieren",
      "5G Swisscom Netz",
    ]);
  });

  it("lists only products of the given brand", async () => {
    await createProduct(db, {
      brand_id: wingoId,
      name: "Wingo Internet 1G",
      category: "internet",
      price_promo: 49.95,
    });
    await createProduct(db, {
      brand_id: wingoId,
      name: "Wingo TV Basic",
      category: "tv",
      price_promo: 9.95,
    });

    const items = await getProductsForBrand(db, wingoId);

    expect(items).toHaveLength(2);
    expect(items.map((p) => p.name).sort()).toEqual([
      "Wingo Internet 1G",
      "Wingo TV Basic",
    ]);
  });

  it("updates a product price", async () => {
    const p = await createProduct(db, {
      brand_id: wingoId,
      name: "Wingo Mobile Basic",
      category: "mobile",
      price_promo: 14.95,
    });

    const updated = await updateProduct(db, p.id, { price_promo: 12.95 });

    expect(updated?.price_promo).toBe(12.95);
  });

  it("deletes a product", async () => {
    const p = await createProduct(db, {
      brand_id: wingoId,
      name: "Wingo Throwaway",
      category: "mobile",
      price_promo: 1,
    });

    await deleteProduct(db, p.id);

    expect(await getProductById(db, p.id)).toBeNull();
  });
});
