import type { BrandTokens } from "../../lib/brand/loadTokens";

// Kampagnentyp + visueller Stil. Eigenes Modul (importiert NUR BrandTokens),
// damit sowohl die registry als auch die Template-Komponenten es nutzen koennen
// ohne Zirkular-Import (registry importiert die Templates).

export type CampaignArt = "flash_sale" | "standard";

export type Emphasis = "urgency" | "neutral";

// Kampagnentyp -> Preis-Emphasis (Legacy-Signal, von styleForArt subsumiert):
// flash_sale faerbt den Preis im Brand-Akzent, standard rendert ihn neutral.
export function emphasisForArt(art: CampaignArt): Emphasis {
  return art === "flash_sale" ? "urgency" : "neutral";
}

// Voller visueller Stil pro Kampagnentyp (V1.1: zwei Styles).
export interface CampaignStyle {
  background: string; // Canvas-Hintergrund
  foreground: string; // Headline/Subline/Body-Text
  priceColor: string; // Preis-Zahl
  ctaBackground: string; // CTA-Button-Hintergrund
  ctaText: string; // CTA-Label
  disclaimerColor: string; // Legal-Footer
  logoVariant: "colour" | "white"; // welches Lockup (resolveLogoSrc)
}

// Leitet den Stil aus dem Kampagnentyp + den Brand-Tokens ab.
// flash_sale = roter Vollbild-BG (Brand-Primary) + weisses Logo/Text + weisser
// CTA-Button mit rotem Label (Dringlichkeit, wie die echte Wingo-Flash-Sale-Mechanik).
// standard = grauer BG + dunkles Logo/Text + Brand-Rot als Akzent (Preis/CTA).
export function styleForArt(art: CampaignArt, tokens: BrandTokens): CampaignStyle {
  const primary = tokens.colors.primary.hex;
  const secondary = tokens.colors.secondary?.hex ?? "#292B2D";
  const background = tokens.colors.background_primary?.hex ?? "#E7E7E7";

  if (art === "flash_sale") {
    return {
      background: primary,
      foreground: "#FFFFFF",
      priceColor: "#FFFFFF",
      ctaBackground: "#FFFFFF",
      ctaText: primary,
      disclaimerColor: "#FFFFFF",
      logoVariant: "white",
    };
  }
  return {
    background,
    foreground: secondary,
    priceColor: primary,
    ctaBackground: primary,
    ctaText: "#FFFFFF",
    disclaimerColor: "#525252",
    logoVariant: "colour",
  };
}

// Liefert den effektiven Stil eines Templates: explizit uebergebener `style`
// (Orchestrator) hat Vorrang; ohne ihn der Standard-Grau-Look mit Preis-Emphasis
// (Backwards-Compat fuer direkte Template-Renders/Tests ohne style).
export function resolveTemplateStyle(args: {
  style?: CampaignStyle;
  emphasis?: Emphasis;
  tokens: BrandTokens;
}): CampaignStyle {
  if (args.style) return args.style;
  const primary = args.tokens.colors.primary.hex;
  const secondary = args.tokens.colors.secondary?.hex ?? "#292B2D";
  return {
    background: args.tokens.colors.background_primary?.hex ?? "#E7E7E7",
    foreground: secondary,
    priceColor: args.emphasis === "neutral" ? secondary : primary,
    ctaBackground: primary,
    ctaText: "#FFFFFF",
    disclaimerColor: "#525252",
    logoVariant: "colour",
  };
}
