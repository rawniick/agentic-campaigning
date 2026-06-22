import type { Db } from "../types";

export interface Disclaimer {
  id: string;
  brand_id: string;
  slug: string;
  name: string;
  conditions_json: Record<string, unknown>;
  applies_to_categories: string[];
  text_de: string;
  text_fr: string;
  text_it: string;
  text_en: string;
  is_required: boolean;
}

export interface ProductContext {
  category: "mobile" | "tv" | "internet";
  network?: "5g" | "4g" | "other";
  has_hardware?: boolean;
  [extra: string]: unknown;
}

// Liefert alle Disclaimer fuer eine Brand, die im gegebenen Produkt-Kontext greifen.
// Match-Regel:
//   1) applies_to_categories ist leer ODER enthaelt ctx.category
//   2) Jeder Schluessel/Wert in conditions_json muss im ctx vorhanden und gleich sein
export async function getAllDisclaimers(
  db: Db,
  brandId: string
): Promise<Disclaimer[]> {
  const result = await db.query<Disclaimer>(
    `SELECT id, brand_id, slug, name, conditions_json, applies_to_categories,
            text_de, text_fr, text_it, text_en, is_required
       FROM disclaimers
      WHERE brand_id = $1 AND is_active = true
      ORDER BY slug`,
    [brandId]
  );
  return result.rows;
}

export async function matchDisclaimers(
  db: Db,
  brandId: string,
  ctx: ProductContext
): Promise<Disclaimer[]> {
  const result = await db.query<Disclaimer>(
    `SELECT id, brand_id, slug, name, conditions_json, applies_to_categories,
            text_de, text_fr, text_it, text_en, is_required
       FROM disclaimers
      WHERE brand_id = $1
        AND is_active = true
      ORDER BY slug`,
    [brandId]
  );

  // ORDER BY slug oben macht die Disclaimer-Reihenfolge deterministisch — wichtig,
  // weil generateCopy diese Reihenfolge als disclaimer_ids[] speichert und der
  // Multiplexer sie in genau dieser Reihenfolge in jedes Asset rendert.
  return result.rows.filter((d) => matchesContext(d, ctx));
}

function matchesContext(d: Disclaimer, ctx: ProductContext): boolean {
  const categoryOk =
    d.applies_to_categories.length === 0 ||
    d.applies_to_categories.includes(ctx.category);
  if (!categoryOk) return false;

  for (const [key, expected] of Object.entries(d.conditions_json)) {
    // String-koerzierter Vergleich: ein Admin-Werttyp-Tippfehler (z.B. "true"
    // statt boolean true, oder "5g" vs 5) soll einen Pflicht-Disclaimer nicht
    // lautlos droppen. Echte Mismatches (z.B. "5g" vs "4g") schlagen weiterhin fehl.
    if (String(ctx[key]) !== String(expected)) return false;
  }
  return true;
}

// ---- Admin-CRUD --------------------------------------------------------------
// getAllDisclaimers/matchDisclaimers oben blenden is_active=false aus (Live-Pfad);
// die Admin-Pflege braucht alle Zeilen inkl. is_active.

export interface DisclaimerRow extends Disclaimer {
  is_active: boolean;
}

const CRUD_COLS = `id, brand_id, slug, name, conditions_json, applies_to_categories,
  text_de, text_fr, text_it, text_en, is_required, is_active`;

export interface CreateDisclaimerInput {
  brand_id: string;
  slug: string;
  name: string;
  conditions_json?: Record<string, unknown>;
  applies_to_categories?: string[];
  text_de: string;
  text_fr: string;
  text_it: string;
  text_en: string;
  is_required?: boolean;
  is_active?: boolean;
}

export interface UpdateDisclaimerInput {
  slug: string;
  name: string;
  conditions_json: Record<string, unknown>;
  applies_to_categories: string[];
  text_de: string;
  text_fr: string;
  text_it: string;
  text_en: string;
  is_required: boolean;
  is_active: boolean;
}

export async function createDisclaimer(
  db: Db,
  input: CreateDisclaimerInput
): Promise<DisclaimerRow> {
  const res = await db.query<DisclaimerRow>(
    `INSERT INTO disclaimers
       (brand_id, slug, name, conditions_json, applies_to_categories,
        text_de, text_fr, text_it, text_en, is_required, is_active)
       VALUES ($1, $2, $3, $4::jsonb, $5::text[], $6, $7, $8, $9,
               COALESCE($10, true), COALESCE($11, true))
       RETURNING ${CRUD_COLS}`,
    [
      input.brand_id,
      input.slug,
      input.name,
      JSON.stringify(input.conditions_json ?? {}),
      input.applies_to_categories ?? [],
      input.text_de,
      input.text_fr,
      input.text_it,
      input.text_en,
      input.is_required ?? null,
      input.is_active ?? null,
    ]
  );
  return res.rows[0];
}

export async function getDisclaimerById(
  db: Db,
  id: string
): Promise<DisclaimerRow | null> {
  const res = await db.query<DisclaimerRow>(
    `SELECT ${CRUD_COLS} FROM disclaimers WHERE id = $1 LIMIT 1`,
    [id]
  );
  return res.rows[0] ?? null;
}

export async function listAllDisclaimers(
  db: Db,
  brandId: string
): Promise<DisclaimerRow[]> {
  const res = await db.query<DisclaimerRow>(
    `SELECT ${CRUD_COLS} FROM disclaimers WHERE brand_id = $1 ORDER BY slug`,
    [brandId]
  );
  return res.rows;
}

export async function updateDisclaimer(
  db: Db,
  id: string,
  input: UpdateDisclaimerInput
): Promise<DisclaimerRow> {
  const res = await db.query<DisclaimerRow>(
    `UPDATE disclaimers SET
        slug = $2, name = $3, conditions_json = $4::jsonb,
        applies_to_categories = $5::text[],
        text_de = $6, text_fr = $7, text_it = $8, text_en = $9,
        is_required = $10, is_active = $11, updated_at = now()
      WHERE id = $1
      RETURNING ${CRUD_COLS}`,
    [
      id,
      input.slug,
      input.name,
      JSON.stringify(input.conditions_json),
      input.applies_to_categories,
      input.text_de,
      input.text_fr,
      input.text_it,
      input.text_en,
      input.is_required,
      input.is_active,
    ]
  );
  if (res.rows.length === 0) throw new Error(`Disclaimer ${id} nicht gefunden`);
  return res.rows[0];
}

export async function deleteDisclaimer(db: Db, id: string): Promise<void> {
  // Compliance-Guard: campaign_copy.disclaimer_ids[] referenziert nur per id (kein
  // FK auf Array-Elemente). Ein Hard-Delete eines referenzierten Disclaimers wuerde
  // den Pflichttext bei Re-Renders lautlos droppen (runMultiplex .filter(Boolean)).
  // Darum: referenziert -> nicht loeschen, sondern deaktivieren (is_active=false).
  const ref = await db.query(
    `SELECT 1 FROM campaign_copy WHERE $1 = ANY(disclaimer_ids) LIMIT 1`,
    [id]
  );
  if (ref.rows.length > 0) {
    throw new Error(
      "Disclaimer wird noch von Kampagnen referenziert — deaktiviere ihn (Aktiv-Haken aus) statt zu loeschen."
    );
  }
  await db.query(`DELETE FROM disclaimers WHERE id = $1`, [id]);
}
