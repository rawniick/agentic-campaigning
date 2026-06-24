import type { CSSProperties, ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import {
  AiLabelOverlay,
  type AiLabelConfig,
} from "../../../lib/render/AiLabelOverlay";
import { resolveTemplateStyle, type CampaignStyle } from "../campaignStyle";

// Wingo Flash Sale — Display Halfpage 300x600 (DV360)
// Kanonische Flash-Sale-Anatomie (Anker: brand-assets/wingo/samples/.../Flash_2.png):
//   Logo · "flash sale"-Wordmark · kurze Headline (Hybrid-Claim) · freigestellte
//   Person (bleeding) · Gratis-Aktivierung-Badge · weisser Stern-Blob mit
//   DOPPELPREIS (alt durchgestrichen + neu) · CTA · Channel-Footer · Legal-Line.
// Satori-kompatibel: nur Inline-Styles, jedes Mehr-Kind-<div> mit display:flex.
// Flex-Flow statt fixer Slot-Hoehen → kein Text-Overlap bei langer Copy.

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
  emphasis?: "urgency" | "neutral";
  style?: CampaignStyle;
  // Weisser Stern-Blob als Preis-Container (flash_sale). Vom Orchestrator gesetzt.
  priceBlobSrc?: string;
  aiLabel?: AiLabelConfig;
  // V1.2 kanonische Anatomie — optional, damit Bestands-Caller (single-price)
  // weiter funktionieren. Mit beiden gesetzt rendert der Doppelpreis (alt + neu).
  productName?: string;
  // Bereits display-fertiger Standard-/Streichpreis (z.B. "50.–"). Ohne ihn faellt
  // der Blob auf den Einzelpreis zurueck.
  priceStandard?: string;
  // Channel-Footer (z.B. "mobile · tv · internet"). Default mobile/tv/internet.
  channels?: string;
}

const WIDTH = 300;
const HEIGHT = 600;
const PAD = 18; // Safezone-Rand

export function FlashSaleHalfpage(props: FlashSaleHalfpageProps): ReactElement {
  const t = props.tokens;
  const s = resolveTemplateStyle(props);
  const font = t.typography?.fonts?.headline?.family ?? "Inter";

  const red = s.background; // Flash-Sale: roter Vollflaechen-BG
  const white = s.foreground; // weisser Text/Logo
  const ink = "#292B2D"; // Anthrazit fuer Text im weissen Blob
  // Streichpreis-Grau = tokens.colors.semantic.price_old (#737373); das Zod-Token-
  // Schema exponiert `semantic` (noch) nicht typisiert, daher als Konstante.
  const oldPriceGrey = "#737373";
  const channels = props.channels ?? "mobile · tv · internet";

  // "flash sale"-Wordmark — fixe Brand-Chrome, zweizeilig.
  const wordmark = (
    <div
      key="wordmark"
      style={{ display: "flex", flexDirection: "column", marginTop: 10 }}
    >
      <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 0.95, color: white }}>
        flash
      </span>
      <span style={{ fontSize: 44, fontWeight: 800, lineHeight: 0.95, color: white }}>
        sale
      </span>
    </div>
  );

  // Kurze generierte Headline (Hybrid-Claim). maxHeight + overflow:hidden kappt
  // zu lange Claims, statt das Layout zu sprengen (Auto-Fit-Ersatz).
  const headlineClaim = props.headline ? (
    <div
      key="claim"
      style={{
        display: "flex",
        marginTop: 10,
        fontSize: 15,
        fontWeight: 600,
        lineHeight: 1.2,
        color: white,
        maxHeight: 54,
        overflow: "hidden",
      }}
    >
      {props.headline}
    </div>
  ) : null;

  // Freigestellte Person (bleeding, unten-rechts). Im Tracer ein Platzhalter.
  const hero = props.heroImageUrl ? (
    <img
      key="hero"
      src={props.heroImageUrl}
      alt=""
      style={{
        position: "absolute",
        right: -10,
        bottom: 0,
        width: 190,
        height: 330,
        objectFit: "contain",
      }}
    />
  ) : null;

  // Gratis-Aktivierung-Badge (schwarz, ueberlappt Blob-Ecke).
  const badge = (
    <div
      key="badge"
      style={{
        position: "absolute",
        left: 14,
        top: 6,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: 78,
        height: 78,
        borderRadius: 39,
        backgroundColor: ink,
        textAlign: "center",
        lineHeight: 1.05,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 700, color: white }}>Gratis</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: white }}>Aktivierung</span>
    </div>
  );

  // Preis-Inhalt im Blob: Doppelpreis wenn productName + priceStandard da.
  const dualPrice = props.productName && props.priceStandard;
  const blobInner = dualPrice ? (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 700, color: ink }}>
        {props.productName}
      </span>
      <span
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: oldPriceGrey,
          textDecorationLine: "line-through",
          marginTop: 2,
        }}
      >
        {props.priceStandard}
        {props.priceSuffix}
      </span>
      <div style={{ display: "flex", alignItems: "baseline", marginTop: 2 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: ink, marginRight: 4 }}>
          nur
        </span>
        <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1, color: ink }}>
          {props.pricePromo}
        </span>
        <span style={{ fontSize: 15, fontWeight: 500, color: ink, marginLeft: 2 }}>
          {props.priceSuffix}
        </span>
      </div>
    </div>
  ) : (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ fontSize: 46, fontWeight: 800, lineHeight: 1, color: ink }}>
        {props.pricePromo}
      </span>
      <span style={{ fontSize: 15, fontWeight: 500, color: ink }}>
        {props.priceSuffix}
      </span>
    </div>
  );

  // Satori chokt auf explizit-undefined Style-Werte → Keys konditional weglassen.
  const blobBg: CSSProperties = props.priceBlobSrc
    ? { backgroundImage: `url(${props.priceBlobSrc})`, backgroundSize: "100% 100%" }
    : { backgroundColor: white, borderRadius: 24 };

  const blob = (
    <div
      key="blob"
      style={{
        position: "absolute",
        left: 56,
        top: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 210,
        height: 210,
        ...blobBg,
      }}
    >
      {blobInner}
    </div>
  );

  // Mittlere Zone: relative, faengt die Ueberlappungen (Hero/Blob/Badge) ab und
  // waechst per flex:1 — schiebt Footer nach unten statt Text zu ueberlappen.
  const middle = (
    <div
      key="middle"
      style={{ display: "flex", position: "relative", width: WIDTH, flex: 1 }}
    >
      {hero}
      {blob}
      {badge}
    </div>
  );

  // CTA — weisser Button, rote Schrift (Hol's dir auf rotem BG).
  const cta = (
    <div key="cta" style={{ display: "flex", marginTop: 4 }}>
      <div
        style={{
          display: "flex",
          backgroundColor: white,
          color: red,
          padding: "10px 20px",
          fontSize: 15,
          fontWeight: 700,
          borderRadius: 4,
        }}
      >
        {props.ctaLabel}
      </div>
    </div>
  );

  const footerNav = (
    <div
      key="nav"
      style={{ display: "flex", marginTop: 10, fontSize: 11, color: white }}
    >
      {channels}
    </div>
  );

  const legal = props.disclaimer ? (
    <div
      key="legal"
      style={{
        display: "flex",
        marginTop: 6,
        fontSize: 8,
        lineHeight: 1.25,
        color: white,
        opacity: 0.9,
        maxHeight: 30,
        overflow: "hidden",
      }}
    >
      {props.disclaimer}
    </div>
  ) : null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: red,
        fontFamily: font,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: `${PAD}px ${PAD}px 0 ${PAD}px`,
        }}
      >
        <img
          src={props.logoSrc}
          alt="Wingo"
          style={{ width: 84, height: 26, objectFit: "contain" }}
        />
        {wordmark}
        {headlineClaim}
      </div>

      {/* MIDDLE (Hero + Blob + Badge) */}
      {middle}

      {/* FOOTER */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: `0 ${PAD}px ${PAD}px ${PAD}px`,
        }}
      >
        {cta}
        {footerNav}
        {legal}
      </div>

      {props.aiLabel && <AiLabelOverlay config={props.aiLabel} />}
    </div>
  );
}
