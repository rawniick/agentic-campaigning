import type { Db } from "../types";
import type { Brief } from "../../schemas/brief";

export type CampaignStatus =
  | "created"
  | "copy_pending"
  | "hero_pending"
  | "layout_pending"
  | "final_pending"
  | "rendering"
  | "done"
  | "failed";

export interface Campaign {
  id: string;
  brand_id: string;
  product_id: string | null;
  name: string;
  art: string;
  datum_von: string;
  datum_bis: string;
  produkt_kategorie: string;
  price_promo: number;
  price_standard: number | null;
  price_suffix: string;
  zielgruppe: string;
  zielgebiet: string;
  languages: string[];
  status: CampaignStatus;
  current_gate: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignWithBrief extends Campaign {
  brief: Brief;
}

export interface CreateCampaignInput {
  brand_id: string;
  product_id?: string;
  brief: Brief;
  languages?: string[];
}

function normalizeCampaign(row: Record<string, unknown>): Campaign {
  return {
    ...(row as unknown as Campaign),
    price_promo: Number(row.price_promo),
    price_standard:
      row.price_standard === null ? null : Number(row.price_standard),
  };
}

// Server-Action: legt campaigns- und campaign_briefs-Zeile transaktional an.
// Brief ist die Source of Truth, campaigns-Spalten denormalisieren das, was die
// Status-Machine und Listen-Filter brauchen.
export async function createCampaign(
  db: Db,
  input: CreateCampaignInput
): Promise<Campaign> {
  const b = input.brief;

  await db.query(`BEGIN`);
  try {
    const campaignRes = await db.query<Record<string, unknown>>(
      `INSERT INTO campaigns
         (brand_id, product_id, name, art, datum_von, datum_bis, produkt_kategorie,
          price_promo, price_standard, price_suffix,
          zielgruppe, zielgebiet, languages, status)
         VALUES
         ($1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12, COALESCE($13, ARRAY['de','fr','it','en']::TEXT[]), 'created')
         RETURNING *`,
      [
        input.brand_id,
        input.product_id ?? null,
        b.kampagne.name,
        b.kampagne.art,
        b.kampagne.datum_von,
        b.kampagne.datum_bis,
        b.kampagne.produkt_kategorie,
        b.produkt.preis_promo,
        b.produkt.preis_standard ?? null,
        b.produkt.preis_suffix,
        b.vermarktung.zielgruppe,
        b.vermarktung.zielgebiet,
        input.languages ?? null,
      ]
    );
    const campaign = normalizeCampaign(campaignRes.rows[0]);

    await db.query(
      `INSERT INTO campaign_briefs (campaign_id, brief_json) VALUES ($1, $2::jsonb)`,
      [campaign.id, JSON.stringify(b)]
    );

    await db.query(`COMMIT`);
    return campaign;
  } catch (e) {
    await db.query(`ROLLBACK`);
    throw e;
  }
}

export async function getCampaignById(
  db: Db,
  id: string
): Promise<CampaignWithBrief | null> {
  const res = await db.query<Record<string, unknown>>(
    `SELECT c.*, b.brief_json
       FROM campaigns c
       LEFT JOIN campaign_briefs b ON b.campaign_id = c.id
      WHERE c.id = $1
      LIMIT 1`,
    [id]
  );
  const row = res.rows[0];
  if (!row) return null;
  const briefJson = row.brief_json;
  const brief =
    typeof briefJson === "string"
      ? (JSON.parse(briefJson) as Brief)
      : (briefJson as Brief);
  return { ...normalizeCampaign(row), brief };
}
