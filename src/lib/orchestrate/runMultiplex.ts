import type { ReactElement } from "react";
import type { Db } from "../db/types";
import type { AssetStorage } from "../storage/types";
import type { BrandConfig } from "../brand/loadBrand";
import { getV1Formats, type FormatSpec } from "../db/queries/format-specs";
import { createAsset } from "../db/queries/assets";
import { renderToPng as defaultRenderToPng } from "../render/renderToPng";
import { transitionGate, type CampaignState } from "../state/transitionGate";
import { runVisionQA, type VisionQAClient } from "../qa/runVisionQA";
import { resolveAiLabelConfig } from "../aiLabel/resolveAiLabelConfig";
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
  visionClient?: VisionQAClient;
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
  hero_source: string;
  variant: string;
}

function disclaimerColumnFor(language: string): "text_de" | "text_fr" | "text_it" | "text_en" {
  switch (language) {
    case "de":
      return "text_de";
    case "fr":
      return "text_fr";
    case "it":
      return "text_it";
    case "en":
      return "text_en";
    default:
      return "text_de";
  }
}

// Liefert eine GateData-Zeile pro approved Sprache der Kampagne.
// Disclaimer-Text wird pro Sprache aus der disclaimers-Tabelle gezogen
// (NIE via LLM uebersetzt — Compliance-Pass-through).
async function loadGateDataPerLanguage(db: Db, campaignId: string): Promise<GateData[]> {
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
    hero_source: string;
    variant: string;
  }>(
    `SELECT
        c.brand_id, c.art, c.price_promo::text AS price_promo, c.price_suffix,
        cc.language, cc.headlines, cc.subline, cc.cta_label,
        cc.selected_headline_idx, cc.disclaimer_ids,
        ch.storage_url AS hero_url,
        ch.source AS hero_source,
        cl.variant
       FROM campaigns c
       JOIN campaign_copy cc ON cc.campaign_id = c.id AND cc.is_approved = true
       LEFT JOIN campaign_hero ch ON ch.campaign_id = c.id
       LEFT JOIN campaign_layout cl ON cl.campaign_id = c.id
      WHERE c.id = $1`,
    [campaignId]
  );
  if (res.rows.length === 0) {
    throw new Error(`Campaign ${campaignId} has no approved copy`);
  }

  // Collect all distinct disclaimer ids across languages — one query, one map per lang
  const allIds = Array.from(
    new Set(res.rows.flatMap((r) => r.disclaimer_ids ?? []))
  );
  const disclaimerTexts = new Map<string, Record<string, string>>(); // id -> {de,fr,it,en}
  if (allIds.length > 0) {
    const d = await db.query<{
      id: string;
      text_de: string;
      text_fr: string;
      text_it: string;
      text_en: string;
      slug: string;
    }>(
      `SELECT id, text_de, text_fr, text_it, text_en, slug
         FROM disclaimers
        WHERE id = ANY($1::uuid[])
        ORDER BY slug`,
      [allIds]
    );
    for (const row of d.rows) {
      disclaimerTexts.set(row.id, {
        de: row.text_de,
        fr: row.text_fr,
        it: row.text_it,
        en: row.text_en,
      });
    }
  }

  return res.rows.map((row) => {
    const firstId = row.disclaimer_ids?.[0];
    const texts = firstId ? disclaimerTexts.get(firstId) : undefined;
    const col = disclaimerColumnFor(row.language).slice(5) as "de" | "fr" | "it" | "en";
    const disclaimer_text = texts?.[col] ?? "";
    return {
      brand_id: row.brand_id,
      kampagne_art: row.art as CampaignArt,
      price_promo: row.price_promo,
      price_suffix: row.price_suffix,
      language: row.language,
      headline: row.headlines[row.selected_headline_idx],
      subline: row.subline,
      cta_label: row.cta_label,
      disclaimer_text,
      hero_url: row.hero_url,
      hero_source: row.hero_source,
      variant: row.variant,
    };
  });
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
  renderImpl: NonNullable<RunMultiplexInput["renderToPng"]>,
  visionClient: VisionQAClient | undefined
): Promise<MultiplexedAsset> {
  // AI-Label-Pflicht (Brand-Compliance): nur bei source='ai' beziehen.
  // Wenn die Brand kein Label registriert hat, gibt der Resolver null zurueck —
  // Template laesst das Asset dann weg (gleicher Codepfad wie upload/library).
  const aiLabel =
    data.hero_source === "ai"
      ? (await resolveAiLabelConfig(db, brandConfig.brand.id, format)) ?? undefined
      : undefined;

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
    aiLabel,
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

  if (visionClient) {
    await runVisionQA(db, visionClient, {
      assetId: asset.id,
      imageBytes: png,
      imageMimeType: "image/png",
      brandPrimaryHex: brandConfig.tokens.colors.primary.hex,
      formatCode: format.code,
    });
  }

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
    const dataPerLang = await loadGateDataPerLanguage(db, input.campaignId);
    const kampagneArt = dataPerLang[0].kampagne_art;
    const v1Formats = await getV1Formats(db);

    const renderableTargets: Array<{ format: FormatSpec; component: TemplateComponent }> =
      [];
    for (const format of v1Formats) {
      const component = findTemplate(format.code, kampagneArt);
      if (component) renderableTargets.push({ format, component });
    }

    // Cartesian product: jedes Format x jede Sprache
    const renderTasks: Array<{
      format: FormatSpec;
      component: TemplateComponent;
      data: GateData;
    }> = [];
    for (const target of renderableTargets) {
      for (const data of dataPerLang) {
        renderTasks.push({ ...target, data });
      }
    }

    const assets = await Promise.all(
      renderTasks.map(({ format, component, data }) =>
        renderOneFormat(
          db,
          storage,
          input.brandConfig,
          input.campaignId,
          format,
          component,
          data,
          input.logoUrl,
          renderImpl,
          input.visionClient
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
