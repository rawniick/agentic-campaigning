import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import {
  AiLabelOverlay,
  type AiLabelConfig,
} from "../../../lib/render/AiLabelOverlay";

// Wingo Flash Sale — Meta Image Ad 1080x1920 (Story-Format, 9:16 portrait).
// Layout vertikal: Hero deckt obere 50% ab, dann Content-Block mit Brand + Copy.
// Variants:
//   'price_top' (Hero kleiner, Preis im oberen Drittel)
//   'price_bottom' (Default — Preis ueber CTA am Ende)

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
  aiLabel?: AiLabelConfig;
}

const WIDTH = 1080;
const HEIGHT = 1920;
const HERO_HEIGHT = 1000;

export function FlashSaleMetaImage(props: FlashSaleMetaImageProps): ReactElement {
  const t = props.tokens;
  const primary = t.colors.primary.hex;
  const secondary = "#292B2D";
  const background = "#E7E7E7";
  const headlineFont = t.typography?.fonts?.headline?.family ?? "Inter";
  const variant: FlashSaleMetaImageVariant = props.variant ?? "price_bottom";

  const heroBlock = (
    <div
      key="hero"
      style={{
        display: "flex",
        width: WIDTH,
        height: HERO_HEIGHT,
        overflow: "hidden",
      }}
    >
      <img
        src={props.heroImageUrl}
        alt=""
        style={{ width: WIDTH, height: HERO_HEIGHT, objectFit: "cover" }}
      />
    </div>
  );

  const logoBlock = (
    <div key="logo" style={{ display: "flex", padding: "48px 64px 0 64px" }}>
      {/* objectFit:contain — Logo proportional in den Slot, nie verzerren (KO) */}
      <img
        src={props.logoSrc}
        alt="Wingo"
        style={{ width: 240, height: 72, objectFit: "contain" }}
      />
    </div>
  );

  const headlineBlock = (
    <div
      key="headline"
      style={{
        display: "flex",
        padding: "32px 64px 8px 64px",
        fontSize: 88,
        fontWeight: 700,
        lineHeight: 1.05,
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
        padding: "0 64px 24px 64px",
        fontSize: 42,
        fontWeight: 400,
        lineHeight: 1.25,
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
        padding: "16px 64px 0 64px",
        color: props.emphasis === "neutral" ? secondary : primary,
      }}
    >
      <span style={{ fontSize: 168, fontWeight: 700, lineHeight: 1 }}>
        {props.pricePromo}
      </span>
      <span style={{ fontSize: 48, fontWeight: 400, marginLeft: 12 }}>
        {props.priceSuffix}
      </span>
    </div>
  );

  const ctaBlock = (
    <div key="cta" style={{ display: "flex", padding: "24px 64px 0 64px" }}>
      <div
        style={{
          display: "flex",
          backgroundColor: primary,
          color: "#FFFFFF",
          padding: "28px 56px",
          fontSize: 42,
          fontWeight: 700,
          borderRadius: 12,
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
        padding: "0 64px 36px 64px",
        fontSize: 22,
        lineHeight: 1.2,
        color: "#525252",
      }}
    >
      {props.disclaimer}
    </div>
  );

  const contentOrder =
    variant === "price_top"
      ? [logoBlock, priceBlock, headlineBlock, sublineBlock, ctaBlock, spacer, disclaimerBlock]
      : [logoBlock, headlineBlock, sublineBlock, priceBlock, ctaBlock, spacer, disclaimerBlock];

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
      {heroBlock}
      {contentOrder}
      {props.aiLabel && <AiLabelOverlay config={props.aiLabel} />}
    </div>
  );
}
