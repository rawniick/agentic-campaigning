import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import {
  AiLabelOverlay,
  type AiLabelConfig,
} from "../../../lib/render/AiLabelOverlay";

// Wingo Flash Sale — Display Halfpage 300x600 (DV360)
// Satori-kompatibel: ausschliesslich Inline-Styles. Layout-Variants:
//   - 'price_bottom' (Default): logo → hero → headline → subline → price → cta → disclaimer
//   - 'price_top':              logo → price → headline → subline → hero → cta → disclaimer
// Brand-Mechanik: Grauer BG, Akzentfarbe Rot fuer Preis + CTA.

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
  aiLabel?: AiLabelConfig;
}

const WIDTH = 300;
const HEIGHT = 600;

export function FlashSaleHalfpage(props: FlashSaleHalfpageProps): ReactElement {
  const t = props.tokens;
  const primary = t.colors.primary.hex;
  const secondary = "#1D1D1B";
  const background = "#EFEFEF";
  const headlineFont = t.typography?.fonts?.headline?.family ?? "Inter";
  const variant: FlashSaleHalfpageVariant = props.variant ?? "price_bottom";

  // Slot-Bloecke einmal definieren, dann je nach Variant unterschiedlich anordnen.
  const logoBlock = (
    <div key="logo" style={{ display: "flex", padding: "16px 16px 8px 16px" }}>
      <img src={props.logoSrc} alt="Wingo" style={{ width: 80, height: 24 }} />
    </div>
  );

  const heroBlock = (
    <div key="hero" style={{ display: "flex", width: WIDTH, height: 200, overflow: "hidden" }}>
      <img
        src={props.heroImageUrl}
        alt=""
        style={{ width: WIDTH, height: 200, objectFit: "cover" }}
      />
    </div>
  );

  const headlineBlock = (
    <div
      key="headline"
      style={{
        display: "flex",
        padding: "12px 16px 4px 16px",
        fontSize: 22,
        fontWeight: 700,
        lineHeight: 1.15,
        color: secondary,
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
        padding: "0 16px 8px 16px",
        fontSize: 13,
        fontWeight: 400,
        lineHeight: 1.4,
        color: secondary,
      }}
    >
      {props.subline}
    </div>
  );

  const priceBlock = (
    <div
      key="price"
      style={{
        display: "flex",
        alignItems: "baseline",
        padding: "8px 16px 0 16px",
        color: primary,
      }}
    >
      <span style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>{props.pricePromo}</span>
      <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>{props.priceSuffix}</span>
    </div>
  );

  const ctaBlock = (
    <div key="cta" style={{ display: "flex", padding: "12px 16px 0 16px" }}>
      <div
        style={{
          display: "flex",
          backgroundColor: primary,
          color: "#FFFFFF",
          padding: "10px 18px",
          fontSize: 14,
          fontWeight: 700,
          borderRadius: 4,
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
        padding: "4px 16px 8px 16px",
        fontSize: 8,
        lineHeight: 1.2,
        color: "#525252",
      }}
    >
      {props.disclaimer}
    </div>
  );

  const order =
    variant === "price_top"
      ? [logoBlock, priceBlock, headlineBlock, sublineBlock, heroBlock, ctaBlock, spacer, disclaimerBlock]
      : [logoBlock, heroBlock, headlineBlock, sublineBlock, priceBlock, ctaBlock, spacer, disclaimerBlock];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: background,
        fontFamily: headlineFont,
        color: secondary,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {order}
      {props.aiLabel && <AiLabelOverlay config={props.aiLabel} />}
    </div>
  );
}
