import { describe, it, expect } from "vitest";
import { styleForArt, resolveTemplateStyle } from "../campaignStyle";
import type { BrandTokens } from "../../../lib/brand/loadTokens";

const tokens = {
  colors: {
    primary: { hex: "#FF5759" },
    secondary: { hex: "#292B2D" },
    background_primary: { hex: "#E7E7E7" },
  },
  typography: { fonts: { headline: { family: "Radikal" } } },
  logo: { variants: {}, default_variant: "kombi" },
} as unknown as BrandTokens;

describe("styleForArt", () => {
  it("flash_sale = roter Vollbild-BG + weisses Logo/Text + weisser CTA-Button", () => {
    const s = styleForArt("flash_sale", tokens);
    expect(s.background).toBe("#FF5759"); // Brand-Primary als BG
    expect(s.foreground).toBe("#FFFFFF");
    expect(s.priceColor).toBe("#FFFFFF");
    expect(s.ctaBackground).toBe("#FFFFFF");
    expect(s.ctaText).toBe("#FF5759"); // rotes Label auf weissem Button
    expect(s.logoVariant).toBe("white");
    expect(s.priceInBlob).toBe(true); // Preis im weissen Stern-Blob
  });

  it("standard = grauer BG + dunkles Logo/Text + Brand-Rot als Akzent", () => {
    const s = styleForArt("standard", tokens);
    expect(s.background).toBe("#E7E7E7");
    expect(s.foreground).toBe("#292B2D");
    expect(s.priceColor).toBe("#FF5759");
    expect(s.ctaBackground).toBe("#FF5759");
    expect(s.ctaText).toBe("#FFFFFF");
    expect(s.logoVariant).toBe("colour");
    expect(s.priceInBlob).toBe(false);
  });

  it("faellt auf Defaults zurueck wenn secondary/background fehlen", () => {
    const minimal = {
      colors: { primary: { hex: "#FF5759" } },
    } as unknown as BrandTokens;
    const s = styleForArt("standard", minimal);
    expect(s.background).toBe("#E7E7E7");
    expect(s.foreground).toBe("#292B2D");
  });
});

describe("resolveTemplateStyle", () => {
  it("expliziter style hat Vorrang", () => {
    const explicit = styleForArt("flash_sale", tokens);
    expect(resolveTemplateStyle({ style: explicit, tokens })).toBe(explicit);
  });

  it("ohne style: Standard-Grau-Look, Preis per emphasis (Backwards-Compat)", () => {
    expect(resolveTemplateStyle({ emphasis: "urgency", tokens }).priceColor).toBe("#FF5759");
    expect(resolveTemplateStyle({ emphasis: "neutral", tokens }).priceColor).toBe("#292B2D");
    expect(resolveTemplateStyle({ tokens }).background).toBe("#E7E7E7");
    expect(resolveTemplateStyle({ tokens }).logoVariant).toBe("colour");
  });
});
