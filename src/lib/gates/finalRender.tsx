import type { ReactElement } from "react";
import type { Db } from "../db/types";
import type { AssetStorage } from "../storage/types";
import type { BrandConfig } from "../brand/loadBrand";
import { transitionGate, type CampaignState } from "../state/transitionGate";
import { createAsset } from "../db/queries/assets";
import { renderToPng as defaultRenderToPng } from "../render/renderToPng";
import React from "react";
import { findTemplate, emphasisForArt, type CampaignArt } from "../../templates/wingo/registry";

export interface FinalRenderInput {
  campaignId: string;
  brandConfig: BrandConfig;
  logoUrl: string;
  // optional injizierbar fuer Tests
  renderToPng?: (node: ReactElement, opts: { width: number; height: number }) => Promise<Buffer>;
}

interface GateData {
  brand_id: string;
  art: CampaignArt;
  produkt_kategorie: string;
  price_promo: string;
  price_suffix: string;
  language: string;
  headlines: string[];
  subline: string;
  cta_label: string;
  selected_headline_idx: number;
  disclaimer_ids: string[];
  hero_url: string;
  variant: string;
  master_format: string;
}

async function loadGateData(db: Db, campaignId: string): Promise<GateData> {
  const res = await db.query<{
    brand_id: string;
    art: string;
    produkt_kategorie: string;
    price_promo: string;
    price_suffix: string;
    language: string;
    headlines: string[];
    subline: string;
    cta_label: string;
    selected_headline_idx: number | null;
    disclaimer_ids: string[];
    hero_url: string | null;
    variant: string | null;
    master_format: string | null;
  }>(
    `SELECT
        c.brand_id, c.art, c.produkt_kategorie, c.price_promo::text AS price_promo, c.price_suffix,
        cc.language, cc.headlines, cc.subline, cc.cta_label,
        cc.selected_headline_idx, cc.disclaimer_ids,
        ch.storage_url AS hero_url,
        cl.variant, cl.master_format
       FROM campaigns c
       LEFT JOIN campaign_copy cc ON cc.campaign_id = c.id AND cc.language = 'de'
       LEFT JOIN campaign_hero ch ON ch.campaign_id = c.id
       LEFT JOIN campaign_layout cl ON cl.campaign_id = c.id
      WHERE c.id = $1`,
    [campaignId]
  );
  const row = res.rows[0];
  if (!row) throw new Error(`Campaign ${campaignId} not found`);
  if (row.selected_headline_idx === null)
    throw new Error("Gate 1 not approved (selected_headline_idx missing)");
  if (!row.hero_url) throw new Error("Gate 2 not approved (campaign_hero missing)");
  if (!row.variant || !row.master_format)
    throw new Error("Gate 3 not approved (campaign_layout missing)");

  return {
    brand_id: row.brand_id,
    art: row.art as CampaignArt,
    produkt_kategorie: row.produkt_kategorie,
    price_promo: row.price_promo,
    price_suffix: row.price_suffix,
    language: row.language,
    headlines: row.headlines,
    subline: row.subline,
    cta_label: row.cta_label,
    selected_headline_idx: row.selected_headline_idx,
    disclaimer_ids: row.disclaimer_ids ?? [],
    hero_url: row.hero_url,
    variant: row.variant,
    master_format: row.master_format,
  };
}

async function loadDisclaimerText(
  db: Db,
  ids: string[],
  language: string
): Promise<string> {
  if (ids.length === 0) return "";
  const col =
    language === "de"
      ? "text_de"
      : language === "fr"
        ? "text_fr"
        : language === "it"
          ? "text_it"
          : "text_en";
  const res = await db.query<{ text: string }>(
    `SELECT ${col} AS text FROM disclaimers WHERE id = ANY($1::uuid[]) ORDER BY slug`,
    [ids]
  );
  // ALLE zutreffenden Disclaimer rendern (Compliance: ein Produkt kann mehrere
  // Pflicht-Hinweise haben, z.B. 5G-Netz + Preis-/Vertrags-Disclaimer) — nicht
  // nur der erste. Separator " · " konsistent mit runMultiplex.
  return res.rows
    .map((r) => r.text)
    .filter((t): t is string => Boolean(t))
    .join(" · ");
}

// Gate-4-Action: Final Render. Pass-through Compliance bleibt erhalten —
// Preis und Disclaimer fliessen verbatim aus DB ins Template, kein LLM.
// State-Transitions: final_pending -> rendering -> done (oder failed).
export async function finalRender(
  db: Db,
  storage: AssetStorage,
  input: FinalRenderInput
): Promise<void> {
  const cur = await db.query<{ status: CampaignState }>(
    `SELECT status FROM campaigns WHERE id = $1`,
    [input.campaignId]
  );
  if (cur.rows.length === 0) throw new Error("Campaign not found");
  const renderingState = transitionGate(cur.rows[0].status, "FINAL_APPROVED");

  await db.query(`UPDATE campaigns SET status = $2, updated_at = now() WHERE id = $1`, [
    input.campaignId,
    renderingState,
  ]);

  try {
    const data = await loadGateData(db, input.campaignId);

    const format = input.brandConfig.formats.find(
      (f) => f.code === data.master_format
    );
    if (!format) {
      throw new Error(`Format ${data.master_format} not in BrandConfig`);
    }

    const disclaimerText = await loadDisclaimerText(
      db,
      data.disclaimer_ids,
      data.language
    );

    // Template + Emphasis aus dem Kampagnentyp ableiten (Registry-Lookup statt
    // hartverdrahteter Halfpage — funktioniert fuer jedes Master-Format und
    // beide Arten; flash_sale = Preis im Akzent, standard = neutral).
    const Component = findTemplate(data.master_format, data.art);
    if (!Component) {
      throw new Error(
        `Kein Template fuer Format ${data.master_format} (art=${data.art})`
      );
    }
    const emphasis = emphasisForArt(data.art);

    const jsx = React.createElement(Component, {
      tokens: input.brandConfig.tokens,
      headline: data.headlines[data.selected_headline_idx],
      subline: data.subline,
      pricePromo: Number(data.price_promo).toFixed(2),
      priceSuffix: data.price_suffix,
      ctaLabel: data.cta_label,
      disclaimer: disclaimerText,
      heroImageUrl: data.hero_url,
      logoSrc: input.logoUrl,
      variant: data.variant,
      emphasis,
    });

    const renderImpl = input.renderToPng ?? defaultRenderToPng;
    const png = await renderImpl(jsx, { width: format.width, height: format.height });

    const key = `${input.brandConfig.brand.slug}/${input.campaignId}/${format.code}-${data.language}.png`;
    const { url } = await storage.upload(key, png, "image/png");

    await createAsset(db, {
      campaign_id: input.campaignId,
      format_id: format.id,
      language: data.language,
      storage_url: url,
      file_size_bytes: png.length,
      mime_type: "image/png",
    });

    const doneState = transitionGate(renderingState, "RENDER_COMPLETE");
    await db.query(`UPDATE campaigns SET status = $2, updated_at = now() WHERE id = $1`, [
      input.campaignId,
      doneState,
    ]);
  } catch (e) {
    const failedState = transitionGate(renderingState, "RENDER_FAILED");
    await db.query(`UPDATE campaigns SET status = $2, updated_at = now() WHERE id = $1`, [
      input.campaignId,
      failedState,
    ]);
    throw e;
  }
}
