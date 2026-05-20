import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";

// Wingo Flash Sale — Billboard 970x250 (Wide Horizontal).
// Aufteilung in einer Row: Hero links 380px, Content-Spalte rechts.
// Variants:
//   'price_bottom' (Default): Headline -> Subline -> Price -> CTA
//   'price_top':              Price -> Headline -> Subline -> CTA
// Disclaimer-Footer ueber gesamte Breite (12px Hoehe, klein gehalten).

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
}

const WIDTH = 970;
const HEIGHT = 250;
const HERO_WIDTH = 380;
const DISCLAIMER_H = 16;
const MAIN_H = HEIGHT - DISCLAIMER_H;

export function FlashSaleBillboard(props: FlashSaleBillboardProps): ReactElement {
  const t = props.tokens;
  const primary = t.colors.primary.hex;
  const secondary = "#1D1D1B";
  const background = "#EFEFEF";
  const headlineFont = t.typography?.fonts?.headline?.family ?? "Inter";
  const variant: FlashSaleBillboardVariant = props.variant ?? "price_bottom";

  const heroCol = (
    <div
      key="hero"
      style={{
        display: "flex",
        width: HERO_WIDTH,
        height: MAIN_H,
        overflow: "hidden",
      }}
    >
      <img
        src={props.heroImageUrl}
        alt=""
        style={{
          width: HERO_WIDTH,
          height: MAIN_H,
          objectFit: "cover",
        }}
      />
    </div>
  );

  const logoBlock = (
    <div key="logo" style={{ display: "flex", paddingBottom: 8 }}>
      <img src={props.logoSrc} alt="Wingo" style={{ width: 96, height: 28 }} />
    </div>
  );

  const headlineBlock = (
    <div
      key="headline"
      style={{
        display: "flex",
        fontSize: 32,
        fontWeight: 700,
        lineHeight: 1.1,
        color: secondary,
        paddingBottom: 4,
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
        fontSize: 14,
        fontWeight: 400,
        lineHeight: 1.3,
        color: secondary,
        paddingBottom: 8,
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
        gap: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", color: primary }}>
        <span style={{ fontSize: 42, fontWeight: 700, lineHeight: 1 }}>
          {props.pricePromo}
        </span>
        <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>
          {props.priceSuffix}
        </span>
      </div>
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

  const contentOrder =
    variant === "price_top"
      ? [priceCtaRow, headlineBlock, sublineBlock]
      : [headlineBlock, sublineBlock, priceCtaRow];

  const contentCol = (
    <div
      key="content"
      style={{
        display: "flex",
        flexDirection: "column",
        width: WIDTH - HERO_WIDTH,
        height: MAIN_H,
        padding: "16px 20px",
        justifyContent: "center",
      }}
    >
      {logoBlock}
      {contentOrder}
    </div>
  );

  const mainRow = (
    <div
      key="main"
      style={{
        display: "flex",
        flexDirection: "row",
        width: WIDTH,
        height: MAIN_H,
      }}
    >
      {heroCol}
      {contentCol}
    </div>
  );

  const disclaimerBar = (
    <div
      key="disclaimer"
      style={{
        display: "flex",
        width: WIDTH,
        height: DISCLAIMER_H,
        padding: "0 20px",
        alignItems: "center",
        fontSize: 8,
        lineHeight: 1.1,
        color: "#525252",
      }}
    >
      {props.disclaimer}
    </div>
  );

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
      {mainRow}
      {disclaimerBar}
    </div>
  );
}
