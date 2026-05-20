import type { Db } from "../types";

export interface Product {
  id: string;
  brand_id: string;
  name: string;
  category: "mobile" | "internet" | "tv";
  price_promo: number;
  price_standard: number | null;
  price_suffix: string;
  link: string | null;
  features: string[];
  sku: string | null;
  network: "5g_swisscom" | "4g_swisscom" | "other" | null;
  is_active: boolean;
}

export interface CreateProductInput {
  brand_id: string;
  name: string;
  category: Product["category"];
  price_promo: number;
  price_standard?: number;
  price_suffix?: string;
  link?: string;
  features?: string[];
  sku?: string;
  network?: Product["network"];
}

export interface UpdateProductInput {
  name?: string;
  category?: Product["category"];
  price_promo?: number;
  price_standard?: number | null;
  price_suffix?: string;
  link?: string | null;
  features?: string[];
  sku?: string | null;
  network?: Product["network"];
  is_active?: boolean;
}

// PGlite gibt NUMERIC als string zurueck — Helper-Cast auf number.
function normalize(row: Record<string, unknown>): Product {
  return {
    ...(row as unknown as Product),
    price_promo: Number(row.price_promo),
    price_standard:
      row.price_standard === null ? null : Number(row.price_standard),
  };
}

export async function createProduct(
  db: Db,
  input: CreateProductInput
): Promise<Product> {
  const res = await db.query<Record<string, unknown>>(
    `INSERT INTO products (brand_id, name, category, price_promo, price_standard, price_suffix, link, features, sku, network)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6, '/Mt.'), $7, COALESCE($8, ARRAY[]::TEXT[]), $9, $10)
     RETURNING *`,
    [
      input.brand_id,
      input.name,
      input.category,
      input.price_promo,
      input.price_standard ?? null,
      input.price_suffix ?? null,
      input.link ?? null,
      input.features ?? null,
      input.sku ?? null,
      input.network ?? null,
    ]
  );
  return normalize(res.rows[0]);
}

export async function getProductById(
  db: Db,
  id: string
): Promise<Product | null> {
  const res = await db.query<Record<string, unknown>>(
    `SELECT * FROM products WHERE id = $1 LIMIT 1`,
    [id]
  );
  return res.rows[0] ? normalize(res.rows[0]) : null;
}

export async function getProductsForBrand(
  db: Db,
  brandId: string
): Promise<Product[]> {
  const res = await db.query<Record<string, unknown>>(
    `SELECT * FROM products
      WHERE brand_id = $1 AND is_active = true
      ORDER BY name`,
    [brandId]
  );
  return res.rows.map(normalize);
}

export async function updateProduct(
  db: Db,
  id: string,
  patch: UpdateProductInput
): Promise<Product | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(patch)) {
    fields.push(`${key} = $${idx}`);
    values.push(value);
    idx++;
  }

  if (fields.length === 0) return getProductById(db, id);

  values.push(id);
  const res = await db.query<Record<string, unknown>>(
    `UPDATE products SET ${fields.join(", ")}, updated_at = now()
      WHERE id = $${idx}
      RETURNING *`,
    values
  );
  return res.rows[0] ? normalize(res.rows[0]) : null;
}

export async function deleteProduct(db: Db, id: string): Promise<void> {
  await db.query(`DELETE FROM products WHERE id = $1`, [id]);
}
