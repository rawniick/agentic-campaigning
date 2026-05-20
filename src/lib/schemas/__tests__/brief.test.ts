import { describe, it, expect } from "vitest";
import { briefSchema } from "../brief";

const VALID_BRIEF = {
  kampagne: {
    name: "Wingo Mobile Swiss — Flash Sale Mai",
    art: "flash_sale",
    datum_von: "2026-05-22",
    datum_bis: "2026-05-28",
    produkt_kategorie: "mobile",
  },
  produkt: {
    name: "Wingo Mobile Swiss",
    website_link: "https://wingo.ch/de/mobile-abos/wingo-mobile-swiss",
    preis_promo: 19.95,
    preis_standard: 29.95,
    preis_suffix: "/Mt.",
    konditionen: "12 Monate gratis, danach 29.95/Mt.",
  },
  strategie: {
    input: "Konkurrenz Salt senkt Preise. Wir reagieren mit Aktionspreis fuer 12 Monate.",
  },
  vermarktung: {
    hauptbotschaft: "Schweizer Netz, halber Preis.",
    nebenbotschaft: "Unlimitiert telefonieren und surfen im Swisscom Netz.",
    zielgruppe: "sozial",
    zielgebiet: "deutschschweiz",
    massnahmen: "Display + Social + Google Ads",
    budget: "CHF 50'000",
    order_ziel: "300 Aktivierungen",
  },
  assets_kanaele: {
    channel_kategorien: ["Display Standard", "Social Media"],
    format_codes: ["dv360_halfpage", "meta_image"],
  },
  sonstiges: {
    umsetzung: "Agentur intern",
    auftraggeber: "Wingo Marketing",
  },
};

describe("briefSchema", () => {
  it("parses a complete Wingo brief without errors", () => {
    const parsed = briefSchema.parse(VALID_BRIEF);

    expect(parsed.kampagne.name).toBe("Wingo Mobile Swiss — Flash Sale Mai");
    expect(parsed.produkt.preis_promo).toBe(19.95);
    expect(parsed.vermarktung.zielgruppe).toBe("sozial");
  });

  it("rejects a brief that is missing the promo price", () => {
    const broken = structuredClone(VALID_BRIEF) as Record<string, unknown>;
    delete (broken.produkt as Record<string, unknown>).preis_promo;

    expect(() => briefSchema.parse(broken)).toThrow();
  });

  it("rejects an unknown kampagnen-art", () => {
    const broken = structuredClone(VALID_BRIEF);
    (broken.kampagne as Record<string, unknown>).art = "irgendwas";

    expect(() => briefSchema.parse(broken)).toThrow();
  });
});
