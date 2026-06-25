import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import type { AiLabelConfig } from "../../../lib/render/AiLabelOverlay";
import type { CampaignStyle } from "../campaignStyle";
import { CanonicalPortrait } from "./CanonicalPortrait";

// Wingo Flash Sale — Meta Image Ad 1080x1920 (Story 9:16 portrait); auch TikTok.
// Duenner Format-Wrapper auf die kanonische Portrait-Anatomie.

export type FlashSaleMetaImageVariant = "price_top" | "price_bottom";

export interface FlashSaleMetaImageProps {
  tokens: BrandTokens;
  headline: string;
  subline: string;
  pricePromo: string;
  priceSuffix: string;
  ctaLabel: string;
  disclaimer: string;
  heroImageUrl: string;
  logoSrc: string;
  variant?: FlashSaleMetaImageVariant;
  emphasis?: "urgency" | "neutral";
  style?: CampaignStyle;
  priceBlobSrc?: string;
  aiLabel?: AiLabelConfig;
  productName?: string;
  priceStandard?: string;
  channels?: string;
}

const WIDTH = 1080;
const HEIGHT = 1920;

export function FlashSaleMetaImage(props: FlashSaleMetaImageProps): ReactElement {
  return <CanonicalPortrait {...props} width={WIDTH} height={HEIGHT} />;
}
