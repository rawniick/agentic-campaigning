import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import type { AiLabelConfig } from "../../../lib/render/AiLabelOverlay";
import type { CampaignStyle } from "../campaignStyle";
import { CanonicalPortrait } from "./CanonicalPortrait";

// Wingo Flash Sale — Display Halfpage 300x600 (DV360).
// Duenner Format-Wrapper: rendert die kanonische Portrait-Anatomie
// (CanonicalPortrait) mit den Halfpage-Massen. Look-and-Feel + Art-Gating
// (Flash-Chrome vs. neutrale Standard-Variante) leben in CanonicalPortrait.

export type FlashSaleHalfpageVariant = "price_top" | "price_bottom";

export interface FlashSaleHalfpageProps {
  tokens: BrandTokens;
  headline: string;
  subline: string;
  pricePromo: string;
  priceSuffix: string;
  ctaLabel: string;
  disclaimer: string;
  heroImageUrl: string;
  logoSrc: string;
  variant?: FlashSaleHalfpageVariant;
  emphasis?: "urgency" | "neutral";
  style?: CampaignStyle;
  priceBlobSrc?: string;
  aiLabel?: AiLabelConfig;
  productName?: string;
  priceStandard?: string;
  channels?: string;
}

const WIDTH = 300;
const HEIGHT = 600;

export function FlashSaleHalfpage(props: FlashSaleHalfpageProps): ReactElement {
  return <CanonicalPortrait {...props} width={WIDTH} height={HEIGHT} />;
}
