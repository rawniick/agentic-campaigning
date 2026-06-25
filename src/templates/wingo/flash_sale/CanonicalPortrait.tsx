import type { CSSProperties, ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import {
  AiLabelOverlay,
  type AiLabelConfig,
} from "../../../lib/render/AiLabelOverlay";
import { resolveTemplateStyle, type CampaignStyle } from "../campaignStyle";

// Wingo Flash Sale — KANONISCHES PORTRAIT-LAYOUT (hoeher-als-breit + Square).
// Anker: brand-assets/wingo/samples/Beispiel Kampagne Flash Sale/Flash_2.png
// (portrait) + Nicks freigegebener Tracer (git 873c077 FlashSaleHalfpage).
//
// Anatomie (FLASH): roter Vollflaechen-BG · Wingo-Logo oben-links (weiss) ·
// "flash sale"-Wordmark (gross, weiss, lowercase, 2 Zeilen) · kurze Headline
// (Claim, Auto-Fit via maxHeight+overflow) · freigestellte Person (object-fit:
// contain, blutet an Rand) · "Gratis Aktivierung"-Badge (schwarzer Kreis) ·
// weisser Stern-Blob (priceBlobSrc als bg) mit DOPPELPREIS (productName + alter
// Preis durchgestrichen + "nur" + pricePromo) · CTA (weiss, rote Schrift) ·
// Channel-Footer (weiss) · Legal-Line (klein, mehrzeilig, weiss).
//
// Layout-Flow: FLEX-FLOW statt fixer Slot-Hoehen → KEIN Text-Overlap bei langer
// Copy. Header/Footer als Flex-Spalten, Mittelzone position:relative + flex:1
// faengt die Ueberlappungen (Hero/Blob/Badge via position:absolute) ab.
//
// Satori-kompatibel: nur Inline-Styles, jedes Mehr-Kind-<div> mit display:flex,
// keine explizit-undefined Style-Werte (Keys konditional weglassen).

export interface CanonicalPortraitProps {
  tokens: BrandTokens;
  headline: string;
  subline: string;
  pricePromo: string;
  priceSuffix: string;
  ctaLabel: string;
  disclaimer: string;
  heroImageUrl: string;
  logoSrc: string;
  variant?: string;
  emphasis?: "urgency" | "neutral";
  style?: CampaignStyle;
  priceBlobSrc?: string;
  aiLabel?: AiLabelConfig;
  productName?: string;
  priceStandard?: string;
  channels?: string;
  // Canvas-Masse — von den Format-Wrappern gesetzt (Halfpage 300x600 etc.).
  width: number;
  height: number;
}

const INK = "#292B2D"; // Anthrazit fuer Text im weissen Blob
const OLD_PRICE_GREY = "#737373"; // Streichpreis-Grau (semantic.price_old)

export function CanonicalPortrait(props: CanonicalPortraitProps): ReactElement {
  const { width, height } = props;
  const t = props.tokens;
  const s = resolveTemplateStyle(props);
  const font = t.typography?.fonts?.headline?.family ?? "Inter";

  // Art-Gating: nur FLASH zeigt die Flash-Chrome (Wordmark + Gratis-Badge +
  // weisser Stern-Blob mit dunklem Preis). Standard (neutral) = neutrale Variante.
  const isFlash = props.emphasis !== "neutral";

  // Grobe proportionale Skalierung an der Canvas-Hoehe (Referenz-Hoehe = 600).
  // Geclamped, damit 1080x1920 nicht absurd gross und 320x416 nicht winzig wird.
  const k = clamp(height / 600, 0.85, 3.4);
  const px = (n: number) => Math.round(n * k);

  const pad = px(18);
  const channels = props.channels ?? "mobile · tv · internet";

  // Flash: weisser Vollflaechen-BG-Text. Standard: dezenter Body-Text (s.foreground).
  const headlineColor = s.foreground;
  // Preis-Farbe: FLASH → dunkel im weissen Blob (INK). STANDARD → s.priceColor
  // (neutral, NICHT im Brand-Akzent-Rot). Das haelt den V1.1 Flash-vs-Standard-
  // Unterschied + die emphasis-Tests gruen.
  const priceColor = isFlash ? INK : s.priceColor;

  // ---- HEADER ----------------------------------------------------------------
  const logo = (
    <img
      key="logo"
      src={props.logoSrc}
      alt="Wingo"
      // objectFit:contain — Logo proportional, nie verzerren (KO).
      style={{ width: px(84), height: px(26), objectFit: "contain" }}
    />
  );

  // "flash sale"-Wordmark — nur FLASH, zweizeilig, lowercase, gross + weiss.
  const wordmark = isFlash ? (
    <div
      key="wordmark"
      style={{ display: "flex", flexDirection: "column", marginTop: px(10) }}
    >
      <span
        style={{ fontSize: px(46), fontWeight: 800, lineHeight: 0.95, color: s.foreground }}
      >
        flash
      </span>
      <span
        style={{ fontSize: px(46), fontWeight: 800, lineHeight: 0.95, color: s.foreground }}
      >
        sale
      </span>
    </div>
  ) : null;

  // Kurze Headline (Claim). Auto-Fit: maxHeight + overflow:hidden kappt zu lange
  // Claims statt das Layout zu sprengen.
  const headlineClaim = props.headline ? (
    <div
      key="claim"
      style={{
        display: "flex",
        marginTop: px(10),
        fontSize: px(16),
        fontWeight: 700,
        lineHeight: 1.2,
        color: headlineColor,
        maxHeight: px(58),
        overflow: "hidden",
      }}
    >
      {props.headline}
    </div>
  ) : null;

  // Standard hat keine Flash-Wordmark → die Subline traegt die Botschaft.
  const sublineClaim =
    !isFlash && props.subline ? (
      <div
        key="subline"
        style={{
          display: "flex",
          marginTop: px(6),
          fontSize: px(12),
          fontWeight: 400,
          lineHeight: 1.3,
          color: s.foreground,
          maxHeight: px(48),
          overflow: "hidden",
        }}
      >
        {props.subline}
      </div>
    ) : null;

  // ---- MIDDLE (absolute Overlaps) -------------------------------------------
  // Freigestellte Person, blutet unten-rechts an den Rand (object-fit:contain).
  const heroW = px(190);
  const heroH = px(330);
  const hero = props.heroImageUrl ? (
    <img
      key="hero"
      src={props.heroImageUrl}
      alt=""
      style={{
        position: "absolute",
        right: -px(10),
        bottom: 0,
        width: heroW,
        height: heroH,
        objectFit: "contain",
      }}
    />
  ) : null;

  // "Gratis Aktivierung"-Badge (schwarzer Kreis, weisser Text) — nur FLASH.
  const badgeSize = px(78);
  const badge = isFlash ? (
    <div
      key="badge"
      style={{
        position: "absolute",
        right: px(8),
        top: px(6),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: badgeSize,
        height: badgeSize,
        borderRadius: badgeSize / 2,
        backgroundColor: INK,
        textAlign: "center",
        lineHeight: 1.05,
      }}
    >
      <span style={{ fontSize: px(12), fontWeight: 700, color: "#FFFFFF" }}>Gratis</span>
      <span style={{ fontSize: px(11), fontWeight: 600, color: "#FFFFFF" }}>
        Aktivierung
      </span>
    </div>
  ) : null;

  // Doppelpreis NUR wenn productName && priceStandard gesetzt; sonst Einzelpreis.
  const dualPrice = Boolean(props.productName && props.priceStandard);

  const blobInner = dualPrice ? (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ fontSize: px(15), fontWeight: 700, color: INK }}>
        {props.productName}
      </span>
      <span
        style={{
          fontSize: px(18),
          fontWeight: 600,
          color: OLD_PRICE_GREY,
          textDecorationLine: "line-through",
          marginTop: px(2),
        }}
      >
        {props.priceStandard}
        {props.priceSuffix}
      </span>
      <div
        style={{ display: "flex", alignItems: "baseline", marginTop: px(2), color: priceColor }}
      >
        <span style={{ fontSize: px(16), fontWeight: 600, marginRight: px(4) }}>nur</span>
        <span style={{ fontSize: px(40), fontWeight: 800, lineHeight: 1 }}>
          {props.pricePromo}
        </span>
        <span style={{ fontSize: px(15), fontWeight: 500, marginLeft: px(2) }}>
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
        color: priceColor,
      }}
    >
      <span style={{ fontSize: px(46), fontWeight: 800, lineHeight: 1 }}>
        {props.pricePromo}
      </span>
      <span style={{ fontSize: px(15), fontWeight: 500 }}>{props.priceSuffix}</span>
    </div>
  );

  // Blob-Hintergrund: FLASH = weisser Stern-Blob (priceBlobSrc als bg, sonst
  // weisser Kreis). STANDARD = transparenter, dezenter Preis-Container (kein
  // weisser Blob auf grauem BG). Satori chokt auf explizit-undefined → Keys
  // konditional weglassen.
  // Blob auf die Canvas-Hoehe deckeln, damit er bei kleinen Formaten (Ricchi
  // 320x416) NICHT aus der Mittelzone in den Footer/CTA laeuft (Overlap-Bug).
  const blobSize = Math.min(px(210), Math.round(height * 0.36));
  const blobBg: CSSProperties = isFlash
    ? props.priceBlobSrc
      ? { backgroundImage: `url(${props.priceBlobSrc})`, backgroundSize: "100% 100%" }
      : { backgroundColor: "#FFFFFF", borderRadius: px(24) }
    : {};

  // Blob ist ein FLEX-Kind der Mittelzone (zentriert), NICHT absolut → er bleibt
  // garantiert zwischen Header und Footer und kollidiert nie mit dem CTA.
  const blob = (
    <div
      key="blob"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: blobSize,
        height: blobSize,
        ...blobBg,
      }}
    >
      {blobInner}
    </div>
  );

  // Mittelzone: relative + flex:1, zentriert den Blob. Hero/Badge bleiben absolut
  // (bluten/ueberlappen), der Blob steht im Flex-Fluss → kein Footer-Overlap.
  const middle = (
    <div
      key="middle"
      style={{
        display: "flex",
        position: "relative",
        width: "100%",
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {hero}
      {blob}
      {badge}
    </div>
  );

  // ---- FOOTER ----------------------------------------------------------------
  // CTA — FLASH: weisser Button mit roter Schrift. STANDARD: s.cta* (Brand-Rot).
  const ctaBg = isFlash ? "#FFFFFF" : s.ctaBackground;
  const ctaFg = isFlash ? s.background : s.ctaText;
  const cta = (
    <div key="cta" style={{ display: "flex", marginTop: px(4) }}>
      <div
        style={{
          display: "flex",
          backgroundColor: ctaBg,
          color: ctaFg,
          padding: `${px(10)}px ${px(20)}px`,
          fontSize: px(15),
          fontWeight: 700,
          borderRadius: px(4),
        }}
      >
        {props.ctaLabel}
      </div>
    </div>
  );

  // Channel-Footer — nur FLASH (mobile · tv · internet), weiss.
  const footerNav = isFlash ? (
    <div
      key="nav"
      style={{ display: "flex", marginTop: px(10), fontSize: px(11), color: s.foreground }}
    >
      {channels}
    </div>
  ) : null;

  // Legal-Line — mehrzeilig lesbar, klein, maxHeight + overflow:hidden.
  const legal = props.disclaimer ? (
    <div
      key="legal"
      style={{
        display: "flex",
        marginTop: px(6),
        fontSize: px(9),
        lineHeight: 1.3,
        color: s.disclaimerColor,
        opacity: 0.9,
        maxHeight: px(40),
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
        width,
        height,
        backgroundColor: s.background,
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
          padding: `${pad}px ${pad}px 0 ${pad}px`,
        }}
      >
        {logo}
        {wordmark}
        {headlineClaim}
        {sublineClaim}
      </div>

      {/* MIDDLE (Hero + Blob + Badge) */}
      {middle}

      {/* FOOTER */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: `0 ${pad}px ${pad}px ${pad}px`,
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

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
