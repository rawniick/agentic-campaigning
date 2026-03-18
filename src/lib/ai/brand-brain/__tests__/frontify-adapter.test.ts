import { describe, it, expect } from "vitest";
import {
  extractToneOfVoice,
  extractCIRules,
  extractGlossar,
} from "../frontify-adapter";
import type { FrontifyGuidelinePage } from "@/lib/integrations/frontify";

// --- Test Data ---

const mockTovPage: FrontifyGuidelinePage = {
  id: "page-tov-1",
  title: "Tone of Voice",
  blocks: [
    {
      __typename: "TextBlock",
      content: "<h2>Kernwerte</h2><p>Wir sind <strong>unkompliziert</strong> und <em>ehrlich</em>.</p>",
    },
    {
      __typename: "DoDontBlock",
      doItems: ["Kurze Saetze", "Aktive Sprache"],
      dontItems: ["Anglizismen", "Superlative ohne Beleg"],
    },
    {
      __typename: "CalloutBlock",
      type: "warning",
      content: "<p>Nie Konkurrenten nennen!</p>",
    },
    {
      __typename: "TableBlock",
      rows: [
        { cells: ["Kanal", "Register", "Du/Sie"] },
        { cells: ["Social", "Locker", "Du"] },
        { cells: ["Print", "Professionell", "Sie"] },
      ],
    },
  ],
};

const mockColorPage: FrontifyGuidelinePage = {
  id: "page-colors-1",
  title: "Brand Colors",
  blocks: [
    {
      __typename: "ColorBlock",
      colors: [
        { hex: "#E3000B", name: "Primary Rot", red: 227, green: 0, blue: 11, alpha: 1 },
        { hex: "#1D1D1B", name: "Secondary Schwarz", red: 29, green: 29, blue: 27, alpha: 1 },
        { hex: "#FFD700", name: "Accent Gelb", red: 255, green: 215, blue: 0, alpha: 1 },
      ],
    },
  ],
};

const mockTypoPage: FrontifyGuidelinePage = {
  id: "page-typo-1",
  title: "Typography",
  blocks: [
    {
      __typename: "TypographyBlock",
      family: "CoopNew",
      weight: "Bold",
      size: "48px",
      lineHeight: "1.2",
      letterSpacing: null,
    },
    {
      __typename: "TypographyBlock",
      family: "CoopNew",
      weight: "Regular",
      size: "16px",
      lineHeight: "1.4",
      letterSpacing: "0.01em",
    },
  ],
};

const mockLogoPage: FrontifyGuidelinePage = {
  id: "page-logo-1",
  title: "Logo Usage",
  blocks: [
    {
      __typename: "TextBlock",
      content: "<p>Logo oben-links oder unten-rechts platzieren</p>",
    },
    {
      __typename: "DoDontBlock",
      doItems: ["Auf hellem Hintergrund", "Mindestabstand einhalten"],
      dontItems: ["Logo drehen", "Farben aendern", "Auf rotem Hintergrund"],
    },
  ],
};

const mockGlossarPage: FrontifyGuidelinePage = {
  id: "page-glossar-1",
  title: "Wording / Glossar",
  blocks: [
    {
      __typename: "TableBlock",
      rows: [
        { cells: ["Begriff", "Richtig", "Falsch", "Kontext"] },
        { cells: ["Abo", "Handy-Abo", "Mobilfunkvertrag, Vertrag", "Immer verwenden"] },
        { cells: ["Preis", "CHF 11.95 /Mt.", "11,95 CHF", "Punkt als Dezimaltrennzeichen"] },
      ],
    },
    {
      __typename: "DoDontBlock",
      doItems: ["5G im Swisscom Netz"],
      dontItems: ["5G Netz"],
    },
  ],
};

// --- Tests ---

describe("extractToneOfVoice", () => {
  it("extrahiert Text-Blocks als Markdown", () => {
    const tov = extractToneOfVoice(mockTovPage);
    expect(tov).toContain("# Tone of Voice");
    expect(tov).toContain("**unkompliziert**");
    expect(tov).toContain("*ehrlich*");
    expect(tov).toContain("Kernwerte");
  });

  it("extrahiert Do/Don't Blocks", () => {
    const tov = extractToneOfVoice(mockTovPage);
    expect(tov).toContain("## DO");
    expect(tov).toContain("- Kurze Saetze");
    expect(tov).toContain("## DON'T");
    expect(tov).toContain("- Anglizismen");
  });

  it("extrahiert Callouts", () => {
    const tov = extractToneOfVoice(mockTovPage);
    expect(tov).toContain("**WICHTIG:**");
    expect(tov).toContain("Nie Konkurrenten nennen!");
  });

  it("extrahiert Tabellen als Markdown", () => {
    const tov = extractToneOfVoice(mockTovPage);
    expect(tov).toContain("| Kanal | Register | Du/Sie |");
    expect(tov).toContain("| Social | Locker | Du |");
  });
});

describe("extractCIRules", () => {
  it("extrahiert Farben aus ColorBlock", () => {
    const ciRules = extractCIRules([{ key: "colors", page: mockColorPage }]);
    expect(ciRules.colors.primary).toBe("#E3000B");
    expect(ciRules.colors.primary_name).toBe("Primary Rot");
    expect(ciRules.colors.secondary).toBe("#1D1D1B");
    expect(ciRules.colors.accent).toBe("#FFD700");
  });

  it("extrahiert Typografie aus TypographyBlock", () => {
    const ciRules = extractCIRules([{ key: "typography", page: mockTypoPage }]);
    expect(ciRules.typography.headline_font).toBe("CoopNew-Bold");
    expect(ciRules.typography.body_font).toBe("CoopNew-Regular");
    expect(ciRules.typography.body_size).toBe("16px");
  });

  it("extrahiert Logo-Regeln aus Do/Don't Blocks", () => {
    const ciRules = extractCIRules([{ key: "logo", page: mockLogoPage }]);
    expect(ciRules.logo.forbidden).toContain("Logo drehen");
    expect(ciRules.logo.forbidden).toContain("Farben aendern");
    expect(ciRules.logo.background_rules).toContain("Auf hellem Hintergrund");
  });

  it("kombiniert mehrere Pages zu einem CIRules-Objekt", () => {
    const ciRules = extractCIRules([
      { key: "colors", page: mockColorPage },
      { key: "typography", page: mockTypoPage },
      { key: "logo", page: mockLogoPage },
    ]);
    expect(ciRules.colors.primary).toBe("#E3000B");
    expect(ciRules.typography.headline_font).toBe("CoopNew-Bold");
    expect(ciRules.logo.forbidden).toContain("Logo drehen");
    expect(ciRules._meta.version).toBe("frontify");
  });

  it("setzt _meta korrekt", () => {
    const ciRules = extractCIRules([{ key: "colors", page: mockColorPage }]);
    expect(ciRules._meta.version).toBe("frontify");
    expect(ciRules._meta.description).toContain("Frontify");
  });

  it("ordnet Farben ohne semantische Namen nach Position zu", () => {
    const page: FrontifyGuidelinePage = {
      id: "p1",
      title: "Colors",
      blocks: [{
        __typename: "ColorBlock",
        colors: [
          { hex: "#FF0000", name: "Red", red: 255, green: 0, blue: 0, alpha: 1 },
          { hex: "#00FF00", name: "Green", red: 0, green: 255, blue: 0, alpha: 1 },
          { hex: "#0000FF", name: "Blue", red: 0, green: 0, blue: 255, alpha: 1 },
        ],
      }],
    };
    const ciRules = extractCIRules([{ key: "colors", page }]);
    // Keine semantischen Namen => Position-basiert
    expect(ciRules.colors.primary).toBe("#FF0000");
    expect(ciRules.colors.secondary).toBe("#00FF00");
    expect(ciRules.colors.accent).toBe("#0000FF");
  });
});

describe("extractGlossar", () => {
  it("extrahiert Glossar-Terms aus Tabellen", () => {
    const glossar = extractGlossar(mockGlossarPage, "de");
    expect(glossar.terms["Abo"]).toBeDefined();
    expect(glossar.terms["Abo"].use).toBe("Handy-Abo");
    expect(glossar.terms["Abo"].wrong).toContain("Mobilfunkvertrag");
    expect(glossar.terms["Abo"].wrong).toContain("Vertrag");
    expect(glossar.terms["Abo"].context).toBe("Immer verwenden");
  });

  it("extrahiert Glossar-Terms aus Do/Don't Blocks", () => {
    const glossar = extractGlossar(mockGlossarPage, "de");
    expect(glossar.terms["5G im Swisscom Netz"]).toBeDefined();
    expect(glossar.terms["5G im Swisscom Netz"].wrong).toContain("5G Netz");
  });

  it("setzt Meta-Daten korrekt", () => {
    const glossar = extractGlossar(mockGlossarPage, "de");
    expect(glossar._meta.version).toBe("frontify");
    expect(glossar._meta.language).toBe("de");
  });

  it("gibt leeres Glossar fuer leere Page", () => {
    const emptyPage: FrontifyGuidelinePage = {
      id: "empty",
      title: "Empty",
      blocks: [],
    };
    const glossar = extractGlossar(emptyPage, "fr");
    expect(Object.keys(glossar.terms)).toHaveLength(0);
    expect(glossar._meta.language).toBe("fr");
  });
});
