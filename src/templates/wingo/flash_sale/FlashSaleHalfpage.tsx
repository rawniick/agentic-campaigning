import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";

// Wingo Flash Sale — Display Halfpage 300x600 (DV360)
// Satori-kompatibel: ausschliesslich Inline-Styles, keine Web-CSS-Features die
// satori nicht versteht (z.B. CSS-Variables, grid mit auto-rows). Width/Height
// werden vom Renderer ueber satori-options gesetzt; das Outer-div setzt sie
// dennoch fest, damit der Static-Render-Test sie sieht.

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
}

const WIDTH = 300;
const HEIGHT = 600;

export function FlashSaleHalfpage(props: FlashSaleHalfpageProps): ReactElement {
  const t = props.tokens;
  const primary = t.colors.primary.hex;
  const secondary = "#1D1D1B";
  const background = "#EFEFEF";
  const headlineFont = t.typography?.fonts?.headline?.family ?? "Inter";

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
      {/* Logo */}
      <div style={{ display: "flex", padding: "16px 16px 8px 16px" }}>
        <img src={props.logoSrc} alt="Wingo" style={{ width: 80, height: 24 }} />
      </div>

      {/* Hero-Image */}
      <div
        style={{
          display: "flex",
          width: WIDTH,
          height: 200,
          overflow: "hidden",
        }}
      >
        <img
          src={props.heroImageUrl}
          alt=""
          style={{ width: WIDTH, height: 200, objectFit: "cover" }}
        />
      </div>

      {/* Headline */}
      <div
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

      {/* Subline */}
      <div
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

      {/* Preis */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          padding: "8px 16px 0 16px",
          color: primary,
        }}
      >
        <span style={{ fontSize: 44, fontWeight: 700, lineHeight: 1 }}>
          {props.pricePromo}
        </span>
        <span style={{ fontSize: 16, fontWeight: 400, marginLeft: 4 }}>
          {props.priceSuffix}
        </span>
      </div>

      {/* CTA */}
      <div style={{ display: "flex", padding: "12px 16px 0 16px" }}>
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

      {/* Spacer push disclaimer to bottom */}
      <div style={{ display: "flex", flex: 1 }} />

      {/* Disclaimer */}
      <div
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
    </div>
  );
}
