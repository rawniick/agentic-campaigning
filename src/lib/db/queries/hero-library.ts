import type { Db } from "../types";

export interface HeroLibraryEntry {
  id: string;
  brand_id: string;
  name: string;
  storage_url: string;
  categories: string[];
  lifestyles: string[];
  seasons: string[];
  embedding: number[] | null;
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
  embedding?: number[];
}

export interface ListHeroLibraryFilter {
  category?: string;
  lifestyle?: string;
  season?: string;
}

export interface SearchHeroLibraryInput {
  brandId: string;
  queryEmbedding: number[];
  k: number;
}

export interface SearchHit {
  entry: HeroLibraryEntry;
  similarity: number;
}

// Cosine-Similarity zweier gleich-dimensionierter Vektoren.
// Zero-Magnitude liefert 0 (keine Aehnlichkeit definiert) statt NaN.
function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Cosine: vector length mismatch (${a.length} vs ${b.length})`
    );
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

export async function createHeroLibraryEntry(
  db: Db,
  input: CreateHeroLibraryEntryInput
): Promise<HeroLibraryEntry> {
  const res = await db.query<HeroLibraryEntry>(
    `INSERT INTO hero_library
       (brand_id, name, storage_url, categories, lifestyles, seasons, embedding)
       VALUES ($1, $2, $3, $4::TEXT[], $5::TEXT[], $6::TEXT[], $7::FLOAT8[])
       RETURNING *`,
    [
      input.brand_id,
      input.name,
      input.storage_url,
      input.categories ?? [],
      input.lifestyles ?? [],
      input.seasons ?? [],
      input.embedding ?? null,
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

// In-Code Ranking, weil PGlite kein pgvector hat und V1 mit O(100) Library-
// Eintraegen klein genug bleibt fuer Linear-Scan. Wenn die Library auf O(10k+)
// waechst, hier auf pgvector wechseln.
export async function searchHeroLibrary(
  db: Db,
  input: SearchHeroLibraryInput
): Promise<SearchHit[]> {
  const res = await db.query<HeroLibraryEntry>(
    `SELECT * FROM hero_library
       WHERE brand_id = $1 AND embedding IS NOT NULL`,
    [input.brandId]
  );
  const hits: SearchHit[] = res.rows.map((entry) => ({
    entry,
    similarity: cosine(input.queryEmbedding, entry.embedding as number[]),
  }));
  hits.sort((a, b) => b.similarity - a.similarity);
  return hits.slice(0, input.k);
}
