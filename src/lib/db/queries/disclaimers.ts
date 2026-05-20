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
        AND is_active = true`,
    [brandId]
  );

  return result.rows.filter((d) => matchesContext(d, ctx));
}

function matchesContext(d: Disclaimer, ctx: ProductContext): boolean {
  const categoryOk =
    d.applies_to_categories.length === 0 ||
    d.applies_to_categories.includes(ctx.category);
  if (!categoryOk) return false;

  for (const [key, expected] of Object.entries(d.conditions_json)) {
    if (ctx[key] !== expected) return false;
  }
  return true;
}
