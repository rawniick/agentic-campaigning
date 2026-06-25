import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import type { AiLabelConfig } from "../../../lib/render/AiLabelOverlay";
import type { CampaignStyle } from "../campaignStyle";
import { CanonicalLandscape } from "./CanonicalLandscape";

// Wingo Flash Sale — Landscape 1200x628.
// Geteilt von Google Performance Max, Google Discovery / Demand Gen,
// Reddit Link Ad. Aspect ~1.91:1 — Standard Open-Graph-Quote.
// Duenner Wrapper um das kanonische Landscape-Layout (CanonicalLandscape).

export type FlashSaleLandscapeVariant = "price_top" | "price_bottom";

export interface FlashSaleLandscapeProps {
  tokens: BrandTokens;
  headline: string;
  subline: string;
  pricePromo: string;
  priceSuffix: string;
  ctaLabel: string;
  disclaimer: string;
  heroImageUrl: string;
  logoSrc: string;
  variant?: FlashSaleLandscapeVariant;
  emphasis?: "urgency" | "neutral";
  style?: CampaignStyle;
  priceBlobSrc?: string;
  aiLabel?: AiLabelConfig;
  productName?: string;
  priceStandard?: string;
  channels?: string;
}

const WIDTH = 1200;
const HEIGHT = 628;

export function FlashSaleLandscape(props: FlashSaleLandscapeProps): ReactElement {
  return <CanonicalLandscape {...props} width={WIDTH} height={HEIGHT} />;
}
