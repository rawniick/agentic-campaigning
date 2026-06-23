import type { ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import {
  AiLabelOverlay,
  type AiLabelConfig,
} from "../../../lib/render/AiLabelOverlay";
import { resolveTemplateStyle, type CampaignStyle } from "../campaignStyle";

// Wingo Flash Sale — Square 1200x1200 (SEA Ad Extension Picture).
// Aspect 1:1. Hero top (~640px), Content unten mit grosser Type-Hierarchy.

export type FlashSaleSquareVariant = "price_top" | "price_bottom";

export interface FlashSaleSquareProps {
  tokens: BrandTokens;
  headline: string;
  subline: string;
  pricePromo: string;
  priceSuffix: string;
  ctaLabel: string;
  disclaimer: string;
  heroImageUrl: string;
  logoSrc: string;
  variant?: FlashSaleSquareVariant;
  emphasis?: "urgency" | "neutral";
  style?: CampaignStyle;
  // Weisser Stern-Blob als Preis-Container (flash_sale). Vom Orchestrator gesetzt.
  priceBlobSrc?: string;
  aiLabel?: AiLabelConfig;
}

const WIDTH = 1200;
const HEIGHT = 1200;
const HERO_HEIGHT = 640;

export function FlashSaleSquare(props: FlashSaleSquareProps): ReactElement {
  const t = props.tokens;
  const s = resolveTemplateStyle(props);
  const headlineFont = t.typography?.fonts?.headline?.family ?? "Inter";
  const variant: FlashSaleSquareVariant = props.variant ?? "price_bottom";

  const heroBlock = (
    <div
      key="hero"
      style={{ display: "flex", width: WIDTH, height: HERO_HEIGHT, overflow: "hidden" }}
    >
      <img
        src={props.heroImageUrl}
        alt=""
        style={{ width: WIDTH, height: HERO_HEIGHT, objectFit: "cover" }}
      />
    </div>
  );

  const logoBlock = (
    <div key="logo" style={{ display: "flex", padding: "40px 48px 0 48px" }}>
      {/* objectFit:contain — Logo proportional in den Slot, nie verzerren (KO) */}
      <img
        src={props.logoSrc}
        alt="Wingo"
        style={{ width: 200, height: 60, objectFit: "contain" }}
      />
    </div>
  );

  const headlineBlock = (
    <div
      key="headline"
      style={{
        display: "flex",
        padding: "24px 48px 8px 48px",
        fontSize: 76,
        fontWeight: 700,
        lineHeight: 1.05,
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
        padding: "0 48px 18px 48px",
        fontSize: 34,
        fontWeight: 400,
        lineHeight: 1.25,
        color: s.foreground,
      }}
    >
      {props.subline}
    </div>
  );

  // Square (1200x1200, Hero 640 -> nur 560px Content) ist zu eng fuer den
  // Stern-Blob -> plain Preis, auch im flash_sale-Look. Der Blob greift nur in
  // Formaten mit genug Preis-Slot (Halfpage, MetaImage, priceCtaRow-Formate).
  const priceBlock = (
    <div
      key="price"
      style={{
        display: "flex",
        alignItems: "baseline",
        padding: "8px 48px 0 48px",
        color: s.priceColor,
      }}
    >
      <span style={{ fontSize: 132, fontWeight: 700, lineHeight: 1 }}>{props.pricePromo}</span>
      <span style={{ fontSize: 38, fontWeight: 400, marginLeft: 10 }}>{props.priceSuffix}</span>
    </div>
  );

  const ctaBlock = (
    <div key="cta" style={{ display: "flex", padding: "18px 48px 0 48px" }}>
      <div
        style={{
          display: "flex",
          backgroundColor: s.ctaBackground,
          color: s.ctaText,
          padding: "20px 40px",
          fontSize: 32,
          fontWeight: 700,
          borderRadius: 8,
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
        padding: "0 48px 28px 48px",
        fontSize: 18,
        lineHeight: 1.2,
        color: s.disclaimerColor,
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
        backgroundColor: s.background,
        fontFamily: headlineFont,
        color: s.foreground,
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
