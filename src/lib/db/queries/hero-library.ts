import type { Db } from "../types";

export interface HeroLibraryEntry {
  id: string;
  brand_id: string;
  name: string;
  storage_url: string;
  categories: string[];
  lifestyles: string[];
  seasons: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateHeroLibraryEntryInput {
  brand_id: string;
  name: string;
  storage_url: string;
  categories?: string[];
  lifestyles?: string[];
  seasons?: string[];
}

export interface ListHeroLibraryFilter {
  category?: string;
  lifestyle?: string;
  season?: string;
}

export async function createHeroLibraryEntry(
  db: Db,
  input: CreateHeroLibraryEntryInput
): Promise<HeroLibraryEntry> {
  const res = await db.query<HeroLibraryEntry>(
    `INSERT INTO hero_library
       (brand_id, name, storage_url, categories, lifestyles, seasons)
       VALUES ($1, $2, $3, $4::TEXT[], $5::TEXT[], $6::TEXT[])
       RETURNING *`,
    [
      input.brand_id,
      input.name,
      input.storage_url,
      input.categories ?? [],
      input.lifestyles ?? [],
      input.seasons ?? [],
    ]
  );
  return res.rows[0];
}

export async function getHeroLibraryEntry(
  db: Db,
  id: string
): Promise<HeroLibraryEntry | null> {
  const res = await db.query<HeroLibraryEntry>(
    `SELECT * FROM hero_library WHERE id = $1 LIMIT 1`,
    [id]
  );
  return res.rows[0] ?? null;
}

export async function deleteHeroLibraryEntry(db: Db, id: string): Promise<void> {
  await db.query(`DELETE FROM hero_library WHERE id = $1`, [id]);
}

export async function listHeroLibrary(
  db: Db,
  brandId: string,
  filter: ListHeroLibraryFilter = {}
): Promise<HeroLibraryEntry[]> {
  const conditions: string[] = [`brand_id = $1`];
  const params: unknown[] = [brandId];

  if (filter.category) {
    params.push(filter.category);
    conditions.push(`$${params.length} = ANY(categories)`);
  }
  if (filter.lifestyle) {
    params.push(filter.lifestyle);
    conditions.push(`$${params.length} = ANY(lifestyles)`);
  }
  if (filter.season) {
    params.push(filter.season);
    conditions.push(`$${params.length} = ANY(seasons)`);
  }

  const res = await db.query<HeroLibraryEntry>(
    `SELECT * FROM hero_library
       WHERE ${conditions.join(" AND ")}
       ORDER BY created_at DESC`,
    params
  );
  return res.rows;
}
