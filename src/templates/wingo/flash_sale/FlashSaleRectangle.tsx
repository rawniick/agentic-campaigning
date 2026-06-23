import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import {
  AiLabelOverlay,
  type AiLabelConfig,
} from "../../../lib/render/AiLabelOverlay";
import { resolveTemplateStyle, type CampaignStyle } from "../campaignStyle";

// Wingo Flash Sale — Display Rectangle 300x250 (DV360 MPU).
// Layout (column, top→bottom):
//   1. Logo strip
//   2. Hero strip (80px)
//   3. Headline (compact)
//   4. Subline (1 Zeile)
//   5. Price + CTA in einer Row
//   6. Disclaimer (Footer)
// Variants: 'price_top' (Preis ueber dem Hero) und 'price_bottom' (Default, Preis vor CTA).

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
  aiLabel?: AiLabelConfig;
}

const WIDTH = 300;
const HEIGHT = 250;

export function FlashSaleRectangle(props: FlashSaleRectangleProps): ReactElement {
  const t = props.tokens;
  const s = resolveTemplateStyle(props);
  const headlineFont = t.typography?.fonts?.headline?.family ?? "Inter";
  const variant: FlashSaleRectangleVariant = props.variant ?? "price_bottom";

  const logoBlock = (
    <div key="logo" style={{ display: "flex", padding: "8px 12px 0 12px" }}>
      {/* objectFit:contain — Logo proportional in den Slot, nie verzerren (KO) */}
      <img
        src={props.logoSrc}
        alt="Wingo"
        style={{ width: 60, height: 18, objectFit: "contain" }}
      />
    </div>
  );

  const heroBlock = (
    <div
      key="hero"
      style={{ display: "flex", width: WIDTH, height: 80, overflow: "hidden" }}
    >
      <img
        src={props.heroImageUrl}
        alt=""
        style={{ width: WIDTH, height: 80, objectFit: "cover" }}
      />
    </div>
  );

  const headlineBlock = (
    <div
      key="headline"
      style={{
        display: "flex",
        padding: "6px 12px 2px 12px",
        fontSize: 14,
        fontWeight: 700,
        lineHeight: 1.15,
        color: s.foreground,
      }}
    >
      {props.headline}
    </div>
  );

  const sublineBlock = (
    <div
      key="subline"
      style={{
        display: "flex",
        padding: "0 12px 4px 12px",
        fontSize: 10,
        fontWeight: 400,
        lineHeight: 1.3,
        color: s.foreground,
      }}
    >
      {props.subline}
    </div>
  );

  const priceCtaRow = (
    <div
      key="price_cta"
      style={{
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "4px 12px 0 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", color: s.priceColor }}>
        <span style={{ fontSize: 26, fontWeight: 700, lineHeight: 1 }}>
          {props.pricePromo}
        </span>
        <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 3 }}>
          {props.priceSuffix}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          backgroundColor: s.ctaBackground,
          color: s.ctaText,
          padding: "6px 10px",
          fontSize: 10,
          fontWeight: 700,
          borderRadius: 3,
        }}
      >
        {props.ctaLabel}
      </div>
    </div>
  );

  const spacer = <div key="spacer" style={{ display: "flex", flex: 1 }} />;

  const disclaimerBlock = (
    <div
      key="disclaimer"
      style={{
        display: "flex",
        padding: "2px 12px 6px 12px",
        fontSize: 7,
        lineHeight: 1.15,
        color: s.disclaimerColor,
      }}
    >
      {props.disclaimer}
    </div>
  );

  const order =
    variant === "price_top"
      ? [logoBlock, priceCtaRow, heroBlock, headlineBlock, sublineBlock, spacer, disclaimerBlock]
      : [logoBlock, heroBlock, headlineBlock, sublineBlock, priceCtaRow, spacer, disclaimerBlock];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: s.background,
        fontFamily: headlineFont,
        color: s.foreground,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {order}
      {props.aiLabel && <AiLabelOverlay config={props.aiLabel} />}
    </div>
  );
}
