import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import type { AiLabelConfig } from "../../../lib/render/AiLabelOverlay";
import type { CampaignStyle } from "../campaignStyle";
import { CanonicalLandscape } from "./CanonicalLandscape";

// Wingo Flash Sale — Display Rectangle 300x250 (DV360 MPU).
// Kompaktes, quasi-quadratisches Landscape — CanonicalLandscape skaliert die
// Anatomie proportional herunter; Legal via maxHeight/overflow gekuerzt.

export type FlashSaleRectangleVariant = "price_top" | "price_bottom";

export interface FlashSaleRectangleProps {
  tokens: BrandTokens;
  headline: string;
  subline: string;
  pricePromo: string;
  priceSuffix: string;
  ctaLabel: string;
  disclaimer: string;
  heroImageUrl: string;
  logoSrc: string;
  variant?: FlashSaleRectangleVariant;
  emphasis?: "urgency" | "neutral";
  style?: CampaignStyle;
  priceBlobSrc?: string;
  aiLabel?: AiLabelConfig;
  productName?: string;
  priceStandard?: string;
  channels?: string;
}

const WIDTH = 300;
const HEIGHT = 250;

export function FlashSaleRectangle(props: FlashSaleRectangleProps): ReactElement {
  return <CanonicalLandscape {...props} width={WIDTH} height={HEIGHT} />;
}
