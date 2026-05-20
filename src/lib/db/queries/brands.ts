import type { Db } from "../types";

export interface Brand {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
}

export async function getActiveBrand(
  db: Db,
  slug: string
): Promise<Brand | null> {
  const result = await db.query<Brand>(
    `SELECT id, slug, name, is_active
       FROM brands
      WHERE slug = $1
        AND is_active = true
      LIMIT 1`,
    [slug]
  );
  return result.rows[0] ?? null;
}
