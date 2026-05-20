import type { ReactElement } from "react";
import type { Db } from "../db/types";
import type { AssetStorage } from "../storage/types";
import type { Brief } from "../schemas/brief";
import type { BrandConfig } from "../brand/loadBrand";
import type { FormatSpec } from "../db/queries/format-specs";
import { createCampaign, type Campaign } from "../db/queries/campaigns";
import {
  matchDisclaimers,
  type ProductContext,
  type Disclaimer,
} from "../db/queries/disclaimers";
import { createAsset, type Asset } from "../db/queries/assets";
import { generateCopy, type CampaignCopy } from "../copy/generateCopy";
import { renderToPng as defaultRenderToPng } from "../render/renderToPng";
import { FlashSaleHalfpage } from "../../templates/wingo/flash_sale/FlashSaleHalfpage";
import type { ClaudeCallOptions, ClaudeResponse } from "../ai/claude";
import type { CopyOutput } from "../copy/generateCopy";

export interface RunCampaignTracerBulletInput {
  db: Db;
  storage: AssetStorage;
  brandConfig: BrandConfig;
  brief: Brief;
  language: string;
  format: FormatSpec;
  productContext: ProductContext;
  heroImageUrl: string;
  logoUrl: string;
  llm: (opts: ClaudeCallOptions) => Promise<ClaudeResponse<CopyOutput>>;
  // optional, injizierbar fuer Tests die den Render gegen einen Spy ersetzen
  renderToPng?: (node: ReactElement, opts: { width: number; height: number }) => Promise<Buffer>;
}

export interface RunCampaignTracerBulletResult {
  campaign: Campaign;
  copy: CampaignCopy;
  asset: Asset;
  disclaimersApplied: Disclaimer[];
}

// Compliance: Pass-through fuer Preise + Disclaimer-Texte. Beide werden NICHT
// von der LLM erzeugt oder mutiert, sondern als Strings durch die Pipeline
// gereicht: Brief.produkt.preis_promo -> Template.pricePromo (verbatim),
// disclaimer.text_<lang> -> Template.disclaimer (verbatim).
//
// Format des Preises: locale-agnostisch via toFixed(2), kein Tausender-
// Trennzeichen, kein Currency-Suffix (das ist price_suffix).
function formatPricePromoVerbatim(value: number): string {
  return value.toFixed(2);
}

function pickDisclaimerText(
  disclaimer: Disclaimer | undefined,
  language: string
): string {
  if (!disclaimer) return "";
  switch (language) {
    case "de":
      return disclaimer.text_de;
    case "fr":
      return disclaimer.text_fr;
    case "it":
      return disclaimer.text_it;
    case "en":
      return disclaimer.text_en;
    default:
      return disclaimer.text_de;
  }
}

export async function runCampaignTracerBullet(
  input: RunCampaignTracerBulletInput
): Promise<RunCampaignTracerBulletResult> {
  const {
    db,
    storage,
    brandConfig,
    brief,
    language,
    format,
    productContext,
    heroImageUrl,
    logoUrl,
    llm,
    renderToPng: renderToPngImpl = defaultRenderToPng,
  } = input;

  // 1) Kampagne persistieren
  const campaign = await createCampaign(db, {
    brand_id: brandConfig.brand.id,
    brief,
  });

  // 2) Disclaimer matchen
  const disclaimersApplied = await matchDisclaimers(
    db,
    brandConfig.brand.id,
    productContext
  );

  // 3) Copy generieren (LLM)
  const copy = await generateCopy(db, {
    campaignId: campaign.id,
    brief,
    brandConfig,
    language,
    disclaimers: disclaimersApplied,
    llm,
  });

  // 4) Template-Props mit STRIKTER Pass-through-Disziplin
  const headline = copy.headlines[0];
  const disclaimerText = pickDisclaimerText(disclaimersApplied[0], language);

  const jsx = (
    <FlashSaleHalfpage
      tokens={brandConfig.tokens}
      headline={headline}
      subline={copy.subline}
      pricePromo={formatPricePromoVerbatim(brief.produkt.preis_promo)}
      priceSuffix={brief.produkt.preis_suffix}
      ctaLabel={copy.cta_label}
      disclaimer={disclaimerText}
      heroImageUrl={heroImageUrl}
      logoSrc={logoUrl}
    />
  );

  // 5) Rendern -> PNG
  const png = await renderToPngImpl(jsx, {
    width: format.width,
    height: format.height,
  });

  // 6) Storage Upload
  const key = `${brandConfig.brand.slug}/${campaign.id}/${format.code}-${language}.png`;
  const { url } = await storage.upload(key, png, "image/png");

  // 7) Asset-Record
  const asset = await createAsset(db, {
    campaign_id: campaign.id,
    format_id: format.id,
    language,
    storage_url: url,
    file_size_bytes: png.length,
    mime_type: "image/png",
  });

  return { campaign, copy, asset, disclaimersApplied };
}
