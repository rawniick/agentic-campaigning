import type { ReactElement } from "react";
import type { BrandTokens } from "../../lib/brand/loadTokens";
import { FlashSaleHalfpage } from "./flash_sale/FlashSaleHalfpage";
import { FlashSaleRectangle } from "./flash_sale/FlashSaleRectangle";
import { FlashSaleBillboard } from "./flash_sale/FlashSaleBillboard";
import { FlashSaleMetaImage } from "./flash_sale/FlashSaleMetaImage";
import { FlashSaleRicchi } from "./flash_sale/FlashSaleRicchi";
import { FlashSaleWideboard } from "./flash_sale/FlashSaleWideboard";
import { FlashSaleLandscape } from "./flash_sale/FlashSaleLandscape";
import { FlashSaleSquare } from "./flash_sale/FlashSaleSquare";

// Template-Registry — mapped (formatCode, campaignArt) auf eine konkrete
// React-Komponente. Phase 3 fuellt die 11 V1-Formate Schritt fuer Schritt.
// Public Interface bleibt klein: findTemplate() liefert die Komponente,
// listRegisteredFormatCodes() ist die Source-of-Truth fuer den Multiplexer.

export interface TemplateProps {
  tokens: BrandTokens;
  headline: string;
  subline: string;
  pricePromo: string;
  priceSuffix: string;
  ctaLabel: string;
  disclaimer: string;
  heroImageUrl: string;
  logoSrc: string;
  variant?: string;
}

export type TemplateComponent = (props: TemplateProps) => ReactElement;

export type CampaignArt = "flash_sale" | "standard";

interface TemplateEntry {
  formatCode: string;
  campaignArt: CampaignArt;
  component: TemplateComponent;
}

const REGISTRY: TemplateEntry[] = [
  {
    formatCode: "dv360_halfpage",
    campaignArt: "flash_sale",
    component: FlashSaleHalfpage as TemplateComponent,
  },
  {
    formatCode: "dv360_rectangle",
    campaignArt: "flash_sale",
    component: FlashSaleRectangle as TemplateComponent,
  },
  {
    formatCode: "dv360_billboard",
    campaignArt: "flash_sale",
    component: FlashSaleBillboard as TemplateComponent,
  },
  {
    formatCode: "meta_image",
    campaignArt: "flash_sale",
    component: FlashSaleMetaImage as TemplateComponent,
  },
  {
    formatCode: "dv360_ricchi",
    campaignArt: "flash_sale",
    component: FlashSaleRicchi as TemplateComponent,
  },
  {
    formatCode: "dv360_wideboard_xl",
    campaignArt: "flash_sale",
    component: FlashSaleWideboard as TemplateComponent,
  },
  // 1200x628 — same component, three distribution channels.
  {
    formatCode: "google_pmax_static",
    campaignArt: "flash_sale",
    component: FlashSaleLandscape as TemplateComponent,
  },
  {
    formatCode: "google_discovery",
    campaignArt: "flash_sale",
    component: FlashSaleLandscape as TemplateComponent,
  },
  {
    formatCode: "reddit_link_image",
    campaignArt: "flash_sale",
    component: FlashSaleLandscape as TemplateComponent,
  },
  {
    formatCode: "google_sea_ad_ext",
    campaignArt: "flash_sale",
    component: FlashSaleSquare as TemplateComponent,
  },
  // 1080x1920 — TikTok identische Dimension wie Meta Image. Reuse erlaubt
  // brand-/format-spezifische Filenames bei identischem Layout.
  {
    formatCode: "tiktok_image",
    campaignArt: "flash_sale",
    component: FlashSaleMetaImage as TemplateComponent,
  },
];

export function findTemplate(
  formatCode: string,
  campaignArt: CampaignArt
): TemplateComponent | undefined {
  return REGISTRY.find(
    (e) => e.formatCode === formatCode && e.campaignArt === campaignArt
  )?.component;
}

export function listRegisteredFormatCodes(campaignArt: CampaignArt): string[] {
  return REGISTRY.filter((e) => e.campaignArt === campaignArt).map((e) => e.formatCode);
}
