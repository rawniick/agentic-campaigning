import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import type { AiLabelConfig } from "../../../lib/render/AiLabelOverlay";
import type { CampaignStyle } from "../campaignStyle";
import { CanonicalPortrait } from "./CanonicalPortrait";

// Wingo Flash Sale — Square 1200x1200 (SEA Ad Extension Picture), Aspect 1:1.
// Duenner Format-Wrapper auf die kanonische Portrait-Anatomie (die vertikale
// Stack-Anordnung traegt auch das Square, das ohnehin hoehen-getrieben skaliert).

export type FlashSaleSquareVariant = "price_top" | "price_bottom";

export interface FlashSaleSquareProps {
  tokens: BrandTokens;
  headline: string;
  subline: string;
  pricePromo: string;
  priceSuffix: string;
  ctaLabel: string;
  disclaimer: string;
  heroImageUrl: string;
  logoSrc: string;
  variant?: FlashSaleSquareVariant;
  emphasis?: "urgency" | "neutral";
  style?: CampaignStyle;
  priceBlobSrc?: string;
  aiLabel?: AiLabelConfig;
  productName?: string;
  priceStandard?: string;
  channels?: string;
}

const WIDTH = 1200;
const HEIGHT = 1200;

export function FlashSaleSquare(props: FlashSaleSquareProps): ReactElement {
  return <CanonicalPortrait {...props} width={WIDTH} height={HEIGHT} />;
}
