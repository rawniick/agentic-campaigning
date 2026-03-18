import { describe, it, expect } from "vitest";
import { promoInputSchema } from "./promo-input";

// Vollstaendiger gueltiger Input (neue 6-Sektionen-Struktur)
const validInput = {
  kampagne: {
    name: "Fruehlingsangebot 2026",
    datum_von: "2026-03-01",
    datum_bis: "2026-03-31",
    produkt_kategorie: "mobile",
    id: "ACE-2026-W10-001",
    krea_nr: "K-2026-042",
    meta: {
      brand: "demo_brand",
      campaign_type: "aktionswoche",
    },
  },
  produktuebersicht: {
    produkt: "Basic Abo",
    produkt_typ: "abo",
    link: "https://example.com/basic",
    promoangebot: {
      price_new: 29.95,
      price_old: 49.95,
      currency: "CHF",
      price_suffix: "/Mt.",
      discount_type: "percentage",
      discount_value: 40,
      discount_display: "40% Rabatt",
    },
    konditionen: {
      duration: "12_monate",
      conditions: "Nur bei Neuabschluss",
    },
    features: ["5G", "Unlimitiert telefonieren"],
  },
  vermarktung: {
    hauptbotschaft: "Bestes Preis-Leistungs-Verhaeltnis",
    nebenbotschaft: "Jetzt mit EU-Roaming",
    zielgruppe: ["neukunden"],
    zielgebiet: "Deutschschweiz",
    massnahmen: {
      digital: { enabled: true, formats: ["social_feed", "display_banner"] },
      sea: { enabled: true, platforms: ["google"] },
    },
    budget: "CHF 50000",
    order_ziel: "500 Neuabschluesse",
    claim_direction: "preis_fokus",
    languages: ["de", "fr", "it"],
  },
  sujets: {
    ads: "Social Ads fuer Instagram + Facebook",
    website_bilder: true,
  },
  sonstiges: {
    auftraggeber: "Marketing Schweiz",
    freigabe: "Max Muster",
    disclaimer_required: true,
    disclaimer_text: "Nur fuer Neukunden gueltig.",
    five_g_badge: true,
    swisscom_netz_hinweis: true,
  },
  timeline: [
    { datum: "2026-02-15", beschreibung: "Briefing-Abgabe" },
    { datum: "2026-02-28", beschreibung: "Freigabe Konzept" },
    { datum: "2026-03-01", beschreibung: "Go-Live" },
  ],
};

describe("promoInputSchema", () => {
  it("akzeptiert vollstaendigen gueltigen Input", () => {
    const result = promoInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("lehnt ungueltige Promo-ID ab", () => {
    const result = promoInputSchema.safeParse({
      ...validInput,
      kampagne: { ...validInput.kampagne, id: "INVALID-123" },
    });
    expect(result.success).toBe(false);
  });

  it("setzt korrekte Defaults", () => {
    const result = promoInputSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.kampagne.meta.status).toBe("draft");
      expect(result.data.kampagne.meta.priority).toBe("normal");
      expect(result.data.vermarktung.claim_direction).toBe("preis_fokus");
    }
  });

  it("lehnt negativen Preis ab", () => {
    const result = promoInputSchema.safeParse({
      ...validInput,
      produktuebersicht: {
        ...validInput.produktuebersicht,
        promoangebot: { ...validInput.produktuebersicht.promoangebot, price_new: -10 },
      },
    });
    expect(result.success).toBe(false);
  });

  it("erfordert mindestens eine Sprache", () => {
    const result = promoInputSchema.safeParse({
      ...validInput,
      vermarktung: { ...validInput.vermarktung, languages: [] },
    });
    expect(result.success).toBe(false);
  });
});
