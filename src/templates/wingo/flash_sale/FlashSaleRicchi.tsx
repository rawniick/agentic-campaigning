import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import {
  AiLabelOverlay,
  type AiLabelConfig,
} from "../../../lib/render/AiLabelOverlay";

// Wingo Flash Sale — Ricchi Ad 320x416 (DV360 Rich Media).
// Vertikal-Layout aehnlich Halfpage aber kuerzer (ca. 4:5).
// Variants:
//   'price_bottom' (Default): Logo -> Hero -> Headline -> Subline -> Price -> CTA -> Disclaimer
//   'price_top':              Logo -> Price -> Headline -> Subline -> Hero -> CTA -> Disclaimer

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
  aiLabel?: AiLabelConfig;
}

const WIDTH = 320;
const HEIGHT = 416;
const HERO_H = 160;

export function FlashSaleRicchi(props: FlashSaleRicchiProps): ReactElement {
  const t = props.tokens;
  const primary = t.colors.primary.hex;
  const secondary = "#1D1D1B";
  const background = "#EFEFEF";
  const headlineFont = t.typography?.fonts?.headline?.family ?? "Inter";
  const variant: FlashSaleRicchiVariant = props.variant ?? "price_bottom";

  const logoBlock = (
    <div key="logo" style={{ display: "flex", padding: "12px 14px 6px 14px" }}>
      {/* objectFit:contain — Logo proportional in den Slot, nie verzerren (KO) */}
      <img
        src={props.logoSrc}
        alt="Wingo"
        style={{ width: 72, height: 22, objectFit: "contain" }}
      />
    </div>
  );

  const heroBlock = (
    <div key="hero" style={{ display: "flex", width: WIDTH, height: HERO_H, overflow: "hidden" }}>
      <img
        src={props.heroImageUrl}
        alt=""
        style={{ width: WIDTH, height: HERO_H, objectFit: "cover" }}
      />
    </div>
  );

  const headlineBlock = (
    <div
      key="headline"
      style={{
        display: "flex",
        padding: "10px 14px 2px 14px",
        fontSize: 18,
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
        padding: "0 14px 6px 14px",
        fontSize: 11,
        fontWeight: 400,
        lineHeight: 1.3,
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
        padding: "6px 14px 0 14px",
        color: props.emphasis === "neutral" ? secondary : primary,
      }}
    >
      <span style={{ fontSize: 32, fontWeight: 700, lineHeight: 1 }}>{props.pricePromo}</span>
      <span style={{ fontSize: 13, fontWeight: 400, marginLeft: 4 }}>{props.priceSuffix}</span>
    </div>
  );

  const ctaBlock = (
    <div key="cta" style={{ display: "flex", padding: "10px 14px 0 14px" }}>
      <div
        style={{
          display: "flex",
          backgroundColor: primary,
          color: "#FFFFFF",
          padding: "8px 14px",
          fontSize: 12,
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
        padding: "4px 14px 8px 14px",
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
