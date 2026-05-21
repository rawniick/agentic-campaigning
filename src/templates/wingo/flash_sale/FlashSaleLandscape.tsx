import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import {
  AiLabelOverlay,
  type AiLabelConfig,
} from "../../../lib/render/AiLabelOverlay";

// Wingo Flash Sale — Landscape 1200x628.
// Geteilt von Google Performance Max, Google Discovery / Demand Gen,
// Reddit Link Ad. Aspect ~1.91:1 — Standard Open-Graph-Quote.
// Layout: Hero links (~600x628), Content rechts. Disclaimer-Footer ueber gesamte Breite.

export type FlashSaleLandscapeVariant = "price_top" | "price_bottom";

export interface FlashSaleLandscapeProps {
  tokens: BrandTokens;
  headline: string;
  subline: string;
  pricePromo: string;
  priceSuffix: string;
  ctaLabel: string;
  disclaimer: string;
  heroImageUrl: string;
  logoSrc: string;
  variant?: FlashSaleLandscapeVariant;
  aiLabel?: AiLabelConfig;
}

const WIDTH = 1200;
const HEIGHT = 628;
const HERO_WIDTH = 580;
const DISCLAIMER_H = 36;
const MAIN_H = HEIGHT - DISCLAIMER_H;

export function FlashSaleLandscape(props: FlashSaleLandscapeProps): ReactElement {
  const t = props.tokens;
  const primary = t.colors.primary.hex;
  const secondary = "#1D1D1B";
  const background = "#EFEFEF";
  const headlineFont = t.typography?.fonts?.headline?.family ?? "Inter";
  const variant: FlashSaleLandscapeVariant = props.variant ?? "price_bottom";

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
        style={{ width: HERO_WIDTH, height: MAIN_H, objectFit: "cover" }}
      />
    </div>
  );

  const logoBlock = (
    <div key="logo" style={{ display: "flex", paddingBottom: 20 }}>
      <img src={props.logoSrc} alt="Wingo" style={{ width: 160, height: 48 }} />
    </div>
  );

  const headlineBlock = (
    <div
      key="headline"
      style={{
        display: "flex",
        fontSize: 64,
        fontWeight: 700,
        lineHeight: 1.05,
        color: secondary,
        paddingBottom: 10,
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
        fontSize: 26,
        fontWeight: 400,
        lineHeight: 1.3,
        color: secondary,
        paddingBottom: 20,
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
        gap: 28,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", color: primary }}>
        <span style={{ fontSize: 88, fontWeight: 700, lineHeight: 1 }}>{props.pricePromo}</span>
        <span style={{ fontSize: 28, fontWeight: 400, marginLeft: 8 }}>{props.priceSuffix}</span>
      </div>
      <div
        style={{
          display: "flex",
          backgroundColor: primary,
          color: "#FFFFFF",
          padding: "16px 28px",
          fontSize: 22,
          fontWeight: 700,
          borderRadius: 6,
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
        padding: "40px 40px",
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
        padding: "0 40px",
        alignItems: "center",
        fontSize: 14,
        lineHeight: 1.2,
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
      {props.aiLabel && <AiLabelOverlay config={props.aiLabel} />}
    </div>
  );
}
