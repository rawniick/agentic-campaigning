import type { CSSProperties, ReactElement } from "react";
import type { BrandTokens } from "../../../lib/brand/loadTokens";
import {
  AiLabelOverlay,
  type AiLabelConfig,
} from "../../../lib/render/AiLabelOverlay";
import { resolveTemplateStyle, type CampaignStyle } from "../campaignStyle";

// Wingo Flash Sale — KANONISCHES LANDSCAPE-LAYOUT (breiter-als-hoch).
// Anker: brand-assets/wingo/samples/.../Flash_1.png (landscape).
// Horizontale Aufteilung:
//   LINKS   Logo + "flash sale"-Wordmark + kurze Headline (Claim)
//   MITTE   weisser Doppelpreis-Blob (productName + Streichpreis + "nur" + Promo)
//           mit ueberlappendem schwarzem "Gratis Aktivierung"-Badge
//   RECHTS  freigestellte Person (bleeding, object-fit:contain)
//   UNTEN   Channel-Footer + Legal-Line links · CTA rechts-unten
//
// Satori-kompatibel: ausschliesslich Inline-Styles, jedes Mehr-Kind-<div> mit
// display:flex. Flex-Flow + position:relative-Mittelzone statt fixer Slot-Hoehen
// → kein Text-Overlap bei langer Copy (der KO-Bug). position:absolute nur fuer
// Hero/Blob/Badge innerhalb der relative-Mittelzone.
//
// Art-Gating: nur FLASH zeigt Wordmark + Gratis-Badge + roten Vollbild-BG.
// Standard (emphasis === 'neutral') rendert eine neutrale horizontale Variante
// ohne Flash-Chrome (Logo + Headline + Subline + Hero + plain-Preis + CTA + Legal).
//
// Alles parametrisiert ueber width/height → proportionale Skalierung via `scale`.
// Die 4 konkreten Format-Wrapper (Billboard/Wideboard/Landscape/Rectangle) sind
// duenne Aufrufer dieser Komponente mit fixer Dimension.

export interface CanonicalLandscapeProps {
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
  // V1.2 kanonische Anatomie — optional. Mit productName + priceStandard rendert
  // der Blob den Doppelpreis (alt durchgestrichen + neu), sonst Einzelpreis.
  productName?: string;
  priceStandard?: string;
  channels?: string;
  // Aeussere Dimension (vom Format-Wrapper gesetzt).
  width: number;
  height: number;
}

const INK = "#292B2D"; // Anthrazit fuer Text im weissen Blob / Badge
const OLD_PRICE_GREY = "#737373"; // Streichpreis-Grau (semantic.price_old)

export function CanonicalLandscape(props: CanonicalLandscapeProps): ReactElement {
  const t = props.tokens;
  const s = resolveTemplateStyle(props);
  const font = t.typography?.fonts?.headline?.family ?? "Inter";

  const W = props.width;
  const H = props.height;

  // Sehr schmale Formate (Rectangle 300x250): kein Platz fuer eine Hero-Spalte —
  // Hero weglassen + Mittelspalte (Blob) verbreitern, sonst laeuft der Preis ueber.
  const compact = W < 520;

  // Proportionaler Skalierungsfaktor — die Referenz Flash_1.png ist 1200x628.
  // Schrift/Abstaende skalieren mit der Hoehe, damit flache Rectangles (300x250)
  // und Billboards (970x250) automatisch kompakter werden.
  const scale = H / 628;
  const px = (v: number) => Math.max(1, Math.round(v * scale));

  const isFlash = props.emphasis !== "neutral";

  // Roter Vollflaechen-BG nur im Flash-Look. Im Flash nutzen wir die Brand-
  // Primaerfarbe direkt (kanonische Anatomie); fehlt ein expliziter `style`,
  // bleibt der rote Look trotzdem korrekt. Standard nutzt den neutralen BG.
  const canvasBg = isFlash ? t.colors.primary.hex : s.background;
  // Textfarbe auf rotem (Flash) vs. neutralem (Standard) Grund.
  const onCanvas = isFlash ? "#FFFFFF" : s.foreground;

  const pad = px(40);
  const channels = props.channels ?? "mobile · tv · internet";

  // ----- LINKS: Logo + Wordmark + Headline ----------------------------------

  const logo = (
    <img
      key="logo"
      src={props.logoSrc}
      alt="Wingo"
      // objectFit:contain — Logo proportional, nie verzerren (KO-Kriterium).
      style={{
        width: px(160),
        height: px(48),
        objectFit: "contain",
      }}
    />
  );

  // "flash sale"-Wordmark — fixe Flash-Chrome, lowercase, zweizeilig, weiss.
  const wordmark = isFlash ? (
    <div
      key="wordmark"
      style={{
        display: "flex",
        flexDirection: "column",
        marginTop: px(14),
      }}
    >
      <span
        style={{
          fontSize: px(72),
          fontWeight: 800,
          lineHeight: 0.92,
          color: "#FFFFFF",
        }}
      >
        flash
      </span>
      <span
        style={{
          fontSize: px(72),
          fontWeight: 800,
          lineHeight: 0.92,
          color: "#FFFFFF",
        }}
      >
        sale
      </span>
    </div>
  ) : null;

  // Kurze Headline (Claim). maxHeight + overflow:hidden kappt zu lange Claims,
  // statt das Layout zu sprengen (Auto-Fit-Ersatz).
  const headlineClaim = props.headline ? (
    <div
      key="claim"
      style={{
        display: "flex",
        marginTop: px(16),
        fontSize: isFlash ? px(28) : px(46),
        fontWeight: isFlash ? 600 : 700,
        lineHeight: 1.12,
        color: onCanvas,
        maxHeight: px(isFlash ? 110 : 170),
        overflow: "hidden",
      }}
    >
      {props.headline}
    </div>
  ) : null;

  // Subline — nur im Standard-Look (Flash setzt auf Wordmark + Claim).
  const sublineBlock =
    !isFlash && props.subline ? (
      <div
        key="subline"
        style={{
          display: "flex",
          marginTop: px(12),
          fontSize: px(26),
          fontWeight: 400,
          lineHeight: 1.3,
          color: onCanvas,
          maxHeight: px(90),
          overflow: "hidden",
        }}
      >
        {props.subline}
      </div>
    ) : null;

  const leftCol = (
    <div
      key="left"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        width: Math.round(W * (compact ? 0.46 : 0.42)),
        height: H,
        padding: `${pad}px ${px(24)}px ${pad}px ${pad}px`,
      }}
    >
      {logo}
      {wordmark}
      {headlineClaim}
      {sublineBlock}
    </div>
  );

  // ----- MITTE: Doppelpreis-Blob (+ Gratis-Badge) ---------------------------

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
      <span style={{ fontSize: px(24), fontWeight: 700, color: INK }}>
        {props.productName}
      </span>
      <span
        style={{
          fontSize: px(28),
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
        style={{
          display: "flex",
          alignItems: "baseline",
          marginTop: px(4),
        }}
      >
        <span
          style={{
            fontSize: px(26),
            fontWeight: 600,
            color: INK,
            marginRight: px(6),
          }}
        >
          nur
        </span>
        <span
          style={{ fontSize: px(64), fontWeight: 800, lineHeight: 1, color: INK }}
        >
          {props.pricePromo}
        </span>
        <span
          style={{
            fontSize: px(24),
            fontWeight: 500,
            color: INK,
            marginLeft: px(2),
          }}
        >
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
      <span
        style={{ fontSize: px(72), fontWeight: 800, lineHeight: 1, color: INK }}
      >
        {props.pricePromo}
      </span>
      <span style={{ fontSize: px(24), fontWeight: 500, color: INK }}>
        {props.priceSuffix}
      </span>
    </div>
  );

  // Satori chokt auf explizit-undefined Style-Werte → Keys konditional weglassen.
  const blobBg: CSSProperties = props.priceBlobSrc
    ? {
        backgroundImage: `url(${props.priceBlobSrc})`,
        backgroundSize: "100% 100%",
      }
    : { backgroundColor: "#FFFFFF", borderRadius: px(40) };

  // Blob an die FLACHE Dimension koppeln: bei kurzen Formaten (Billboard 970x250)
  // wuerde px(300) auf ~120px schrumpfen und der Doppelpreis-Text liefe ueber.
  // min(H·0.9, W·0.3) haelt den Blob gross genug fuer den Preis UND in der Mittelspalte.
  const blobSize = Math.min(Math.round(H * 0.9), Math.round(W * (compact ? 0.42 : 0.3)));

  // Flash: weisser Stern-Blob mit Doppelpreis, ueber der relative-Mittelzone
  // vertikal zentriert positioniert. Standard: plainer Preis (kein Blob).
  const flashBlob = isFlash ? (
    <div
      key="blob"
      style={{
        position: "absolute",
        left: 0,
        top: "50%",
        transform: `translateY(-${Math.round(blobSize / 2)}px)`,
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
  ) : null;

  // Gratis-Aktivierung-Badge (schwarzer Kreis, weisser Text) — ueberlappt die
  // untere Blob-Ecke. Nur im Flash-Look.
  const badgeSize = px(112);
  const gratisBadge = isFlash ? (
    <div
      key="badge"
      style={{
        position: "absolute",
        left: px(36),
        top: `50%`,
        transform: `translateY(${Math.round(blobSize / 2 - badgeSize / 2 - px(8))}px)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: badgeSize,
        height: badgeSize,
        borderRadius: Math.round(badgeSize / 2),
        backgroundColor: INK,
        textAlign: "center",
        lineHeight: 1.05,
      }}
    >
      <span style={{ fontSize: px(18), fontWeight: 700, color: "#FFFFFF" }}>
        Gratis
      </span>
      <span style={{ fontSize: px(16), fontWeight: 600, color: "#FFFFFF" }}>
        Aktivierung
      </span>
    </div>
  ) : null;

  // Standard: plainer Preis (in s.priceColor — neutral, NICHT im Akzent-Rot).
  const standardPrice = !isFlash ? (
    <div
      key="std_price"
      style={{
        position: "absolute",
        left: px(12),
        top: "50%",
        transform: `translateY(-50%)`,
        display: "flex",
        alignItems: "baseline",
        color: s.priceColor,
      }}
    >
      <span style={{ fontSize: px(96), fontWeight: 700, lineHeight: 1 }}>
        {props.pricePromo}
      </span>
      <span style={{ fontSize: px(32), fontWeight: 400, marginLeft: px(8) }}>
        {props.priceSuffix}
      </span>
    </div>
  ) : null;

  const centerCol = (
    <div
      key="center"
      style={{
        display: "flex",
        position: "relative",
        width: Math.round(W * (compact ? 0.5 : 0.28)),
        height: H,
      }}
    >
      {flashBlob}
      {gratisBadge}
      {standardPrice}
    </div>
  );

  // ----- RECHTS: freigestellte Person (bleeding) ----------------------------

  const heroCol = !compact && props.heroImageUrl ? (
    <div
      key="hero"
      style={{
        display: "flex",
        position: "relative",
        width: Math.round(W * 0.3),
        height: H,
      }}
    >
      <img
        src={props.heroImageUrl}
        alt=""
        // object-fit:contain → freigestellte Person blutet an den Rand ohne
        // verzerrt zu werden. bottom-anchored via position:absolute.
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: "100%",
          height: H,
          objectFit: "contain",
        }}
      />
    </div>
  ) : null;

  // ----- CTA (rechts-unten, ueber allem) ------------------------------------

  const cta = (
    <div
      key="cta"
      style={{
        position: "absolute",
        right: pad,
        bottom: pad,
        display: "flex",
        backgroundColor: isFlash ? "#FFFFFF" : s.ctaBackground,
        color: isFlash ? t.colors.primary.hex : s.ctaText,
        padding: `${px(16)}px ${px(28)}px`,
        fontSize: px(22),
        fontWeight: 700,
        borderRadius: px(6),
      }}
    >
      {props.ctaLabel}
    </div>
  );

  // ----- UNTEN-LINKS: Channel-Footer + Legal --------------------------------

  const footerNav = isFlash ? (
    <div
      key="nav"
      style={{
        display: "flex",
        fontSize: Math.max(9, px(16)),
        fontWeight: 500,
        color: "#FFFFFF",
        marginBottom: px(6),
      }}
    >
      {channels}
    </div>
  ) : null;

  const legal = props.disclaimer ? (
    <div
      key="legal"
      style={{
        display: "flex",
        fontSize: Math.max(8, px(13)),
        lineHeight: 1.25,
        color: isFlash ? "#FFFFFF" : s.disclaimerColor,
        opacity: isFlash ? 0.9 : 1,
        // Legal mehrzeilig lesbar; maxHeight + overflow kappt Ueberlauf, damit
        // sehr flache Formate nicht gesprengt werden.
        maxHeight: px(46),
        overflow: "hidden",
      }}
    >
      {props.disclaimer}
    </div>
  ) : null;

  const footerLeft = (
    <div
      key="footer"
      style={{
        position: "absolute",
        left: pad,
        bottom: pad,
        display: "flex",
        flexDirection: "column",
        // CTA-Bereich rechts freihalten (grobe Reservierung).
        width: Math.round(W * 0.6),
      }}
    >
      {footerNav}
      {legal}
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        width: W,
        height: H,
        backgroundColor: canvasBg,
        fontFamily: font,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {leftCol}
      {centerCol}
      {heroCol}
      {footerLeft}
      {cta}
      {props.aiLabel && <AiLabelOverlay config={props.aiLabel} />}
    </div>
  );
}
