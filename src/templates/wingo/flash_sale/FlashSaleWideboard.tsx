import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import type { AiLabelConfig } from "../../../lib/render/AiLabelOverlay";
import type { CampaignStyle } from "../campaignStyle";
import { CanonicalLandscape } from "./CanonicalLandscape";

// Wingo Flash Sale — Wideboard XL 994x500 (DV360). Aspect ~2:1.
// Duenner Wrapper um das kanonische Landscape-Layout (CanonicalLandscape).

export type FlashSaleWideboardVariant = "price_top" | "price_bottom";

export interface FlashSaleWideboardProps {
  tokens: BrandTokens;
  headline: string;
  subline: string;
  pricePromo: string;
  priceSuffix: string;
  ctaLabel: string;
  disclaimer: string;
  heroImageUrl: string;
  logoSrc: string;
  variant?: FlashSaleWideboardVariant;
  emphasis?: "urgency" | "neutral";
  style?: CampaignStyle;
  priceBlobSrc?: string;
  aiLabel?: AiLabelConfig;
  productName?: string;
  priceStandard?: string;
  channels?: string;
}

const WIDTH = 994;
const HEIGHT = 500;

export function FlashSaleWideboard(props: FlashSaleWideboardProps): ReactElement {
  return <CanonicalLandscape {...props} width={WIDTH} height={HEIGHT} />;
}
