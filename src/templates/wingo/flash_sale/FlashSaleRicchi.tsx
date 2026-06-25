import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import type { AiLabelConfig } from "../../../lib/render/AiLabelOverlay";
import type { CampaignStyle } from "../campaignStyle";
import { CanonicalPortrait } from "./CanonicalPortrait";

// Wingo Flash Sale — Ricchi Ad 320x416 (DV360 Rich Media), ca. 4:5 portrait.
// Duenner Format-Wrapper auf die kanonische Portrait-Anatomie.

export type FlashSaleRicchiVariant = "price_top" | "price_bottom";

export interface FlashSaleRicchiProps {
  tokens: BrandTokens;
  headline: string;
  subline: string;
  pricePromo: string;
  priceSuffix: string;
  ctaLabel: string;
  disclaimer: string;
  heroImageUrl: string;
  logoSrc: string;
  variant?: FlashSaleRicchiVariant;
  emphasis?: "urgency" | "neutral";
  style?: CampaignStyle;
  priceBlobSrc?: string;
  aiLabel?: AiLabelConfig;
  productName?: string;
  priceStandard?: string;
  channels?: string;
}

const WIDTH = 320;
const HEIGHT = 416;

export function FlashSaleRicchi(props: FlashSaleRicchiProps): ReactElement {
  return <CanonicalPortrait {...props} width={WIDTH} height={HEIGHT} />;
}
