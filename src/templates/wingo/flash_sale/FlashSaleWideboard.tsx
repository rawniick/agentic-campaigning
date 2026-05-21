import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import {
  AiLabelOverlay,
  type AiLabelConfig,
} from "../../../lib/render/AiLabelOverlay";

// Wingo Flash Sale — Wideboard XL 994x500 (DV360).
// Aspect ~2:1. Hero links 480px x 500, Content rechts mit groesserer Type-Hierarchy.

export type FlashSaleWideboardVariant = "price_top" | "price_bottom";

export interface FlashSaleWideboardProps {
  tokens: BrandTokens;
  headline: string;
  subline: string;
  pricePromo: string;
  priceSuffix: string;
  ctaLabel: string;
  disclaimer: string;
  heroImageUrl: string;
  logoSrc: string;
  variant?: FlashSaleWideboardVariant;
  aiLabel?: AiLabelConfig;
}

const WIDTH = 994;
const HEIGHT = 500;
const HERO_WIDTH = 480;
const DISCLAIMER_H = 28;
const MAIN_H = HEIGHT - DISCLAIMER_H;

export function FlashSaleWideboard(props: FlashSaleWideboardProps): ReactElement {
  const t = props.tokens;
  const primary = t.colors.primary.hex;
  const secondary = "#1D1D1B";
  const background = "#EFEFEF";
  const headlineFont = t.typography?.fonts?.headline?.family ?? "Inter";
  const variant: FlashSaleWideboardVariant = props.variant ?? "price_bottom";

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
    <div key="logo" style={{ display: "flex", paddingBottom: 16 }}>
      <img src={props.logoSrc} alt="Wingo" style={{ width: 132, height: 40 }} />
    </div>
  );

  const headlineBlock = (
    <div
      key="headline"
      style={{
        display: "flex",
        fontSize: 56,
        fontWeight: 700,
        lineHeight: 1.05,
        color: secondary,
        paddingBottom: 8,
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
        fontSize: 22,
        fontWeight: 400,
        lineHeight: 1.3,
        color: secondary,
        paddingBottom: 16,
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
        gap: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", color: primary }}>
        <span style={{ fontSize: 72, fontWeight: 700, lineHeight: 1 }}>{props.pricePromo}</span>
        <span style={{ fontSize: 24, fontWeight: 400, marginLeft: 6 }}>{props.priceSuffix}</span>
      </div>
      <div
        style={{
          display: "flex",
          backgroundColor: primary,
          color: "#FFFFFF",
          padding: "14px 24px",
          fontSize: 20,
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
        padding: "32px 32px",
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
        padding: "0 32px",
        alignItems: "center",
        fontSize: 12,
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
