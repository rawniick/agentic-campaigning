import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import type { AiLabelConfig } from "../../../lib/render/AiLabelOverlay";
import type { CampaignStyle } from "../campaignStyle";
import { CanonicalLandscape } from "./CanonicalLandscape";

// Wingo Flash Sale — Billboard 970x250 (Wide Horizontal, DV360).
// Sehr flach → CanonicalLandscape skaliert Schrift/Abstaende proportional ueber
// die Hoehe; Legal wird via maxHeight/overflow kompakt gehalten.

export type FlashSaleBillboardVariant = "price_top" | "price_bottom";

export interface FlashSaleBillboardProps {
  tokens: BrandTokens;
  headline: string;
  subline: string;
  pricePromo: string;
  priceSuffix: string;
  ctaLabel: string;
  disclaimer: string;
  heroImageUrl: string;
  logoSrc: string;
  variant?: FlashSaleBillboardVariant;
  emphasis?: "urgency" | "neutral";
  style?: CampaignStyle;
  priceBlobSrc?: string;
  aiLabel?: AiLabelConfig;
  productName?: string;
  priceStandard?: string;
  channels?: string;
}

const WIDTH = 970;
const HEIGHT = 250;

export function FlashSaleBillboard(props: FlashSaleBillboardProps): ReactElement {
  return <CanonicalLandscape {...props} width={WIDTH} height={HEIGHT} />;
}
