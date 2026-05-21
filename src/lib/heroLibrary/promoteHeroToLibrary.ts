import type { Db } from "../db/types";
import type { EmbeddingProvider } from "../embedding/types";
import {
  createHeroLibraryEntry,
  type HeroLibraryEntry,
} from "../db/queries/hero-library";

export interface PromoteHeroToLibraryInput {
  campaignId: string;
  name: string;
  categories?: string[];
  lifestyles?: string[];
  seasons?: string[];
}

// Nach Final-Render: User uebernimmt das gerade gerenderte Hero in die Library.
// Wiederverwendet die bestehende storage_url ohne Copy — fuer V1 reicht der
// gemeinsame Storage-Lifecycle (Bucket ohne Auto-Delete). Wenn Library- und
// Campaign-Lifecycle divergieren muessen, separate Storage-Lokation nachruesten.
export async function promoteHeroToLibrary(
  db: Db,
  input: PromoteHeroToLibraryInput,
  embeddingProvider?: EmbeddingProvider
): Promise<HeroLibraryEntry> {
  const res = await db.query<{
    brand_id: string;
    storage_url: string;
    source: string;
  }>(
    `SELECT c.brand_id, h.storage_url, h.source
       FROM campaigns c
       JOIN campaign_hero h ON h.campaign_id = c.id
      WHERE c.id = $1`,
    [input.campaignId]
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error(
      `Campaign ${input.campaignId} not found or has no hero`
    );
  }
  if (row.source === "library") {
    throw new Error(
      `Hero is already from the library — duplicate promotion not allowed`
    );
  }

  const embedding = embeddingProvider
    ? await embeddingProvider.embed(input.name)
    : undefined;

  return createHeroLibraryEntry(db, {
    brand_id: row.brand_id,
    name: input.name,
    storage_url: row.storage_url,
    categories: input.categories,
    lifestyles: input.lifestyles,
    seasons: input.seasons,
    embedding,
  });
}
