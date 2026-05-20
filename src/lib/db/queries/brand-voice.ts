import type { Db } from "../types";

export interface BrandVoice {
  id: string;
  brand_id: string;
  kampagne_art: string | null;
  zielgruppe: string | null;
  tov_md: string;
  is_default: boolean;
}

export async function getAllVoiceVariants(
  db: Db,
  brandId: string
): Promise<BrandVoice[]> {
  const res = await db.query<BrandVoice>(
    `SELECT id, brand_id, kampagne_art, zielgruppe, tov_md, is_default
       FROM brand_voice_variants
      WHERE brand_id = $1
      ORDER BY is_default DESC, kampagne_art NULLS FIRST, zielgruppe NULLS FIRST`,
    [brandId]
  );
  return res.rows;
}

export interface UpsertVariantInput {
  brand_id: string;
  kampagne_art: string;
  zielgruppe: string;
  tov_md: string;
}

// Atomar: bei (brand, art, zielgruppe)-Konflikt aktualisieren statt einfuegen.
// Default-Row (mit NULL,NULL) hat einen separaten Code-Pfad via setDefaultVoice.
export async function upsertVoiceVariant(
  db: Db,
  input: UpsertVariantInput
): Promise<BrandVoice> {
  const res = await db.query<BrandVoice>(
    `INSERT INTO brand_voice_variants
       (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
       VALUES ($1, $2, $3, $4, false)
       ON CONFLICT (brand_id, COALESCE(kampagne_art, ''), COALESCE(zielgruppe, ''))
       DO UPDATE SET tov_md = EXCLUDED.tov_md, updated_at = now()
       RETURNING id, brand_id, kampagne_art, zielgruppe, tov_md, is_default`,
    [input.brand_id, input.kampagne_art, input.zielgruppe, input.tov_md]
  );
  return res.rows[0];
}

// Setzt (oder ersetzt) den Default-TOV einer Brand.
// Garantiert nur EINEN Default-Row pro Brand durch DELETE-vor-INSERT in einer
// Transaktion (das partial unique index erzwingt das, wir vermeiden den Conflict
// sauber).
export async function setDefaultVoice(
  db: Db,
  brandId: string,
  tov_md: string
): Promise<BrandVoice> {
  await db.query(`BEGIN`);
  try {
    await db.query(
      `DELETE FROM brand_voice_variants
        WHERE brand_id = $1 AND is_default = true`,
      [brandId]
    );
    const res = await db.query<BrandVoice>(
      `INSERT INTO brand_voice_variants
         (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
         VALUES ($1, NULL, NULL, $2, true)
         RETURNING id, brand_id, kampagne_art, zielgruppe, tov_md, is_default`,
      [brandId, tov_md]
    );
    await db.query(`COMMIT`);
    return res.rows[0];
  } catch (e) {
    await db.query(`ROLLBACK`);
    throw e;
  }
}

export async function deleteVoiceVariant(db: Db, id: string): Promise<void> {
  const res = await db.query<{ is_default: boolean }>(
    `SELECT is_default FROM brand_voice_variants WHERE id = $1`,
    [id]
  );
  if (res.rows[0]?.is_default) {
    throw new Error(
      "Cannot delete default brand voice variant — use setDefaultVoice to replace it"
    );
  }
  await db.query(`DELETE FROM brand_voice_variants WHERE id = $1`, [id]);
}

export async function getDefaultVoice(
  db: Db,
  brandId: string
): Promise<BrandVoice> {
  const result = await db.query<BrandVoice>(
    `SELECT id, brand_id, kampagne_art, zielgruppe, tov_md, is_default
       FROM brand_voice_variants
      WHERE brand_id = $1 AND is_default = true
      LIMIT 1`,
    [brandId]
  );
  const voice = result.rows[0];
  if (!voice) {
    throw new Error(`No default brand voice set for brand ${brandId}`);
  }
  return voice;
}

// Liefert die spezifische Variante fuer (art, zielgruppe), sonst den Brand-Default.
// is_default-Rows haben kampagne_art = NULL und zielgruppe = NULL.
// Wir sortieren so, dass spezifische Treffer Vorrang vor dem Default haben.
export async function findVoiceVariant(
  db: Db,
  brandId: string,
  kampagneArt: string,
  zielgruppe: string
): Promise<BrandVoice> {
  const result = await db.query<BrandVoice>(
    `SELECT id, brand_id, kampagne_art, zielgruppe, tov_md, is_default
       FROM brand_voice_variants
      WHERE brand_id = $1
        AND (
          (kampagne_art = $2 AND zielgruppe = $3)
          OR is_default = true
        )
      ORDER BY is_default ASC
      LIMIT 1`,
    [brandId, kampagneArt, zielgruppe]
  );
  const voice = result.rows[0];
  if (!voice) {
    throw new Error(
      `No brand voice variant found for brand ${brandId}: neither specific (${kampagneArt}, ${zielgruppe}) nor default exists. Seed at least one is_default=true row.`
    );
  }
  return voice;
}
