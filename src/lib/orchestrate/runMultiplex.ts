import type { ReactElement } from "react";
import type { Db } from "../db/types";
import type { AssetStorage } from "../storage/types";
import type { BrandConfig } from "../brand/loadBrand";
import { getV1Formats, type FormatSpec } from "../db/queries/format-specs";
import { createAsset } from "../db/queries/assets";
import { renderToPng as defaultRenderToPng } from "../render/renderToPng";
import { transitionGate, type CampaignState } from "../state/transitionGate";
import {
  findTemplate,
  type CampaignArt,
  type TemplateComponent,
} from "../../templates/wingo/registry";
import React from "react";

export interface RunMultiplexInput {
  campaignId: string;
  brandConfig: BrandConfig;
  logoUrl: string;
  // injizierbar fuer Tests
  renderToPng?: (
    node: ReactElement,
    opts: { width: number; height: number }
  ) => Promise<Buffer>;
}

export interface MultiplexedAsset {
  formatCode: string;
  language: string;
  assetId: string;
  storageUrl: string;
}

export interface RunMultiplexResult {
  assets: MultiplexedAsset[];
  durationMs: number;
}

interface GateData {
  brand_id: string;
  kampagne_art: CampaignArt;
  price_promo: string;
  price_suffix: string;
  language: string;
  headline: string;
  subline: string;
  cta_label: string;
  disclaimer_text: string;
  hero_url: string;
  variant: string;
}

async function loadGateData(db: Db, campaignId: string): Promise<GateData> {
  const res = await db.query<{
    brand_id: string;
    art: string;
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
  }>(
    `SELECT
        c.brand_id, c.art, c.price_promo::text AS price_promo, c.price_suffix,
        cc.language, cc.headlines, cc.subline, cc.cta_label,
        cc.selected_headline_idx, cc.disclaimer_ids,
        ch.storage_url AS hero_url,
        cl.variant
       FROM campaigns c
       LEFT JOIN campaign_copy cc ON cc.campaign_id = c.id AND cc.language = 'de'
       LEFT JOIN campaign_hero ch ON ch.campaign_id = c.id
       LEFT JOIN campaign_layout cl ON cl.campaign_id = c.id
      WHERE c.id = $1`,
    [campaignId]
  );
  const row = res.rows[0];
  if (!row) throw new Error(`Campaign ${campaignId} not found`);

  let disclaimerText = "";
  if (row.disclaimer_ids && row.disclaimer_ids.length > 0) {
    const lang = row.language ?? "de";
    const col =
      lang === "de"
        ? "text_de"
        : lang === "fr"
          ? "text_fr"
          : lang === "it"
            ? "text_it"
            : "text_en";
    const d = await db.query<{ text: string }>(
      `SELECT ${col} AS text FROM disclaimers WHERE id = ANY($1::uuid[]) ORDER BY slug LIMIT 1`,
      [row.disclaimer_ids]
    );
    disclaimerText = d.rows[0]?.text ?? "";
  }

  return {
    brand_id: row.brand_id,
    kampagne_art: row.art as CampaignArt,
    price_promo: row.price_promo,
    price_suffix: row.price_suffix,
    language: row.language,
    headline: row.headlines[row.selected_headline_idx],
    subline: row.subline,
    cta_label: row.cta_label,
    disclaimer_text: disclaimerText,
    hero_url: row.hero_url,
    variant: row.variant,
  };
}

async function renderOneFormat(
  db: Db,
  storage: AssetStorage,
  brandConfig: BrandConfig,
  campaignId: string,
  format: FormatSpec,
  component: TemplateComponent,
  data: GateData,
  logoUrl: string,
  renderImpl: NonNullable<RunMultiplexInput["renderToPng"]>
): Promise<MultiplexedAsset> {
  const jsx = React.createElement(component, {
    tokens: brandConfig.tokens,
    headline: data.headline,
    subline: data.subline,
    pricePromo: Number(data.price_promo).toFixed(2),
    priceSuffix: data.price_suffix,
    ctaLabel: data.cta_label,
    disclaimer: data.disclaimer_text,
    heroImageUrl: data.hero_url,
    logoSrc: logoUrl,
    variant: data.variant,
  });

  const png = await renderImpl(jsx, { width: format.width, height: format.height });
  const key = `${brandConfig.brand.slug}/${campaignId}/${format.code}-${data.language}.png`;
  const { url } = await storage.upload(key, png, "image/png");

  const asset = await createAsset(db, {
    campaign_id: campaignId,
    format_id: format.id,
    language: data.language,
    storage_url: url,
    file_size_bytes: png.length,
    mime_type: "image/png",
  });

  return {
    formatCode: format.code,
    language: data.language,
    assetId: asset.id,
    storageUrl: url,
  };
}

// Multi-Format Orchestrator: laedt einmal die approved Gate-Daten,
// laeuft parallel ueber alle V1-Formate, fuer die ein Template registriert ist.
// State-Machine: final_pending -> rendering -> done (oder failed).
export async function runMultiplex(
  db: Db,
  storage: AssetStorage,
  input: RunMultiplexInput
): Promise<RunMultiplexResult> {
  const t0 = Date.now();
  const renderImpl = input.renderToPng ?? defaultRenderToPng;

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
    const v1Formats = await getV1Formats(db);

    const renderableTargets: Array<{ format: FormatSpec; component: TemplateComponent }> =
      [];
    for (const format of v1Formats) {
      const component = findTemplate(format.code, data.kampagne_art);
      if (component) renderableTargets.push({ format, component });
    }

    const assets = await Promise.all(
      renderableTargets.map(({ format, component }) =>
        renderOneFormat(
          db,
          storage,
          input.brandConfig,
          input.campaignId,
          format,
          component,
          data,
          input.logoUrl,
          renderImpl
        )
      )
    );

    const doneState = transitionGate(renderingState, "RENDER_COMPLETE");
    await db.query(`UPDATE campaigns SET status = $2, updated_at = now() WHERE id = $1`, [
      input.campaignId,
      doneState,
    ]);

    return {
      assets,
      durationMs: Date.now() - t0,
    };
  } catch (e) {
    const failedState = transitionGate(renderingState, "RENDER_FAILED");
    await db.query(`UPDATE campaigns SET status = $2, updated_at = now() WHERE id = $1`, [
      input.campaignId,
      failedState,
    ]);
    throw e;
  }
}
