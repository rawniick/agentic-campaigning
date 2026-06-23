import type { ReactElement } from "react";
import type { BrandTokens } from "../../lib/brand/loadTokens";
import type { AiLabelConfig } from "../../lib/render/AiLabelOverlay";
import { FlashSaleHalfpage } from "./flash_sale/FlashSaleHalfpage";
import { FlashSaleRectangle } from "./flash_sale/FlashSaleRectangle";
import { FlashSaleBillboard } from "./flash_sale/FlashSaleBillboard";
import { FlashSaleMetaImage } from "./flash_sale/FlashSaleMetaImage";
import { FlashSaleRicchi } from "./flash_sale/FlashSaleRicchi";
import { FlashSaleWideboard } from "./flash_sale/FlashSaleWideboard";
import { FlashSaleLandscape } from "./flash_sale/FlashSaleLandscape";
import { FlashSaleSquare } from "./flash_sale/FlashSaleSquare";
import {
  emphasisForArt,
  styleForArt,
  resolveTemplateStyle,
} from "./campaignStyle";
import type { CampaignArt, Emphasis, CampaignStyle } from "./campaignStyle";

// Re-Export, damit bestehende Importeure (Orchestrator, Tests) Stil + Art
// weiterhin aus der registry beziehen koennen.
export {
  emphasisForArt,
  styleForArt,
  resolveTemplateStyle,
  type CampaignArt,
  type Emphasis,
  type CampaignStyle,
};

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
  // 'urgency' (Flash Sale, Default) faerbt den Preis im Brand-Akzent; 'neutral'
  // (Standard) rendert ihn dezent (secondary). Wird vom Orchestrator via
  // emphasisForArt(campaign.art) abgeleitet und an die Templates durchgereicht.
  emphasis?: Emphasis;
  // Voller visueller Stil (V1.1). Vom Orchestrator via styleForArt(art) gesetzt.
  // Fehlt er, faellt resolveTemplateStyle auf den Standard-Grau-Look + emphasis zurueck.
  style?: CampaignStyle;
  // Pflicht bei hero.source === 'ai'. resolveAiLabelConfig liefert null wenn die
  // Brand kein Label registriert hat — in dem Fall lassen Templates das Asset weg.
  aiLabel?: AiLabelConfig;
}

export type TemplateComponent = (props: TemplateProps) => ReactElement;

interface TemplateEntry {
  formatCode: string;
  campaignArt: CampaignArt;
  component: TemplateComponent;
}

// Die 11 V1-Format-Layouts. Diese Komponenten sind format-spezifisch (Dimension +
// Slot-Anordnung), NICHT kampagnentyp-spezifisch: der Flash-Sale-vs-Standard-
// Unterschied ist allein das Emphasis-Treatment (Preis im Akzent vs. neutral),
// das der Orchestrator zur Render-Zeit ueber die `emphasis`-Prop setzt. Die
// FlashSale*-Benennung ist historisch (V1.0 war single-art).
const FORMAT_LAYOUTS: ReadonlyArray<{ formatCode: string; component: TemplateComponent }> = [
  { formatCode: "dv360_halfpage", component: FlashSaleHalfpage as TemplateComponent },
  { formatCode: "dv360_rectangle", component: FlashSaleRectangle as TemplateComponent },
  { formatCode: "dv360_billboard", component: FlashSaleBillboard as TemplateComponent },
  { formatCode: "meta_image", component: FlashSaleMetaImage as TemplateComponent },
  { formatCode: "dv360_ricchi", component: FlashSaleRicchi as TemplateComponent },
  { formatCode: "dv360_wideboard_xl", component: FlashSaleWideboard as TemplateComponent },
  // 1200x628 — same component, three distribution channels.
  { formatCode: "google_pmax_static", component: FlashSaleLandscape as TemplateComponent },
  { formatCode: "google_discovery", component: FlashSaleLandscape as TemplateComponent },
  { formatCode: "reddit_link_image", component: FlashSaleLandscape as TemplateComponent },
  { formatCode: "google_sea_ad_ext", component: FlashSaleSquare as TemplateComponent },
  // 1080x1920 — TikTok identische Dimension wie Meta Image. Reuse erlaubt
  // brand-/format-spezifische Filenames bei identischem Layout.
  { formatCode: "tiktok_image", component: FlashSaleMetaImage as TemplateComponent },
];

// V1 unterstuetzte Kampagnentypen — jeder teilt sich dieselben Format-Layouts.
// Neue Arten mit eigenem Layout werden hier NICHT erfasst (dann braucht es
// art-spezifische Eintraege statt der geteilten FORMAT_LAYOUTS).
const SUPPORTED_ARTS: readonly CampaignArt[] = ["flash_sale", "standard"];

const REGISTRY: TemplateEntry[] = SUPPORTED_ARTS.flatMap((campaignArt) =>
  FORMAT_LAYOUTS.map((layout) => ({ ...layout, campaignArt }))
);

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
