import { describe, it, expect } from "vitest";
import { validateCompliance } from "./compliance";
import type { PromoInput } from "@/lib/schemas/promo-input";

// Minimaler PromoInput fuer Tests (neue 6-Sektionen-Struktur)
function makeInput(overrides: Partial<{
  disclaimer_text: string;
  five_g_badge: boolean;
  swisscom_netz_hinweis: boolean;
  features: string[];
}>): PromoInput {
  return {
    kampagne: {
      name: "Test Kampagne",
      datum_von: "2026-03-01",
      datum_bis: "2026-03-31",
      produkt_kategorie: "mobile",
      id: "CM-2026-W10-001",
      meta: {
        brand: "test_brand",
        campaign_type: "aktionswoche",
        status: "draft",
        priority: "normal",
      },
    },
    produktuebersicht: {
      produkt: "Test Abo",
      produkt_typ: "abo",
      promoangebot: {
        price_new: 29.95,
        currency: "CHF",
        price_suffix: "/Mt.",
      },
      konditionen: {},
      features: overrides.features ?? [],
    },
    vermarktung: {
      zielgruppe: [],
      massnahmen: {
        print: { enabled: false, formats: [] },
        digital: { enabled: true, formats: [] },
        sea: { enabled: false, platforms: [] },
        social_organic: { enabled: false, platforms: [] },
        crm: { enabled: false, types: [] },
        ooh: { enabled: false, formats: [] },
        pos: { enabled: false, formats: [] },
      },
      claim_direction: "auto",
      languages: ["de", "fr", "it"],
    },
    sujets: {
      website_bilder: false,
    },
    sonstiges: {
      disclaimer_required: true,
      disclaimer_text: overrides.disclaimer_text,
      five_g_badge: overrides.five_g_badge ?? false,
      swisscom_netz_hinweis: overrides.swisscom_netz_hinweis ?? false,
      legal_review_required: false,
      additional_legal: [],
    },
    timeline: [],
    restrictions: [],
  };
}

describe("validateCompliance", () => {
  it("FAIL wenn Disclaimer fehlt", () => {
    const input = makeInput({ disclaimer_text: "Nur fuer Neukunden." });
    const text = "Tolles Abo fuer CHF 29.95";
    const result = validateCompliance(text, input);
    expect(result.status).toBe("FAIL");
    expect(result.criticalIssues.some((i) => i.type === "disclaimer_missing")).toBe(true);
    expect(result.recommendation).toBe("BLOCK");
  });

  it("FAIL wenn 5G Badge fehlt", () => {
    const input = makeInput({ five_g_badge: true });
    const text = "Schnelles Internet fuer CHF 29.95";
    const result = validateCompliance(text, input);
    expect(result.status).toBe("FAIL");
    expect(result.criticalIssues.some((i) => i.type === "five_g_missing")).toBe(true);
  });

  it("FAIL wenn Swisscom Netz fehlt", () => {
    const input = makeInput({ swisscom_netz_hinweis: true });
    const text = "Bestes Netz fuer CHF 29.95";
    const result = validateCompliance(text, input);
    expect(result.status).toBe("FAIL");
    expect(result.criticalIssues.some((i) => i.type === "swisscom_netz_missing")).toBe(true);
  });

  it("PASS wenn alle Pflichtfelder vorhanden", () => {
    const input = makeInput({
      disclaimer_text: "Nur fuer Neukunden.",
      five_g_badge: true,
      swisscom_netz_hinweis: true,
    });
    const text = "5G im Swisscom Netz fuer CHF 29.95. Nur fuer Neukunden.";
    const result = validateCompliance(text, input);
    expect(result.status).toBe("PASS");
    expect(result.criticalIssues).toHaveLength(0);
    expect(result.recommendation).toBe("APPROVE");
  });

  it("WARNING bei unbelegten Features", () => {
    const input = makeInput({ features: ["Datenvolumen 10GB"] });
    const text = "Unlimitiertes Datenvolumen fuer CHF 29.95";
    const result = validateCompliance(text, input);
    expect(result.warnings.some((w) => w.type === "unbacked_claim")).toBe(true);
  });

  it("WARNING bei Anglizismen", () => {
    const input = makeInput({});
    const text = "Best deal fuer dein neues Abo";
    const result = validateCompliance(text, input);
    expect(result.warnings.some((w) => w.type === "anglicism_detected")).toBe(true);
  });

  it("kein Anglizismus-Warning fuer 'streaming'", () => {
    const input = makeInput({});
    const text = "Inklusive Streaming fuer unterwegs";
    const result = validateCompliance(text, input);
    const anglicismWarning = result.warnings.find((w) => w.type === "anglicism_detected");
    if (anglicismWarning) {
      expect(anglicismWarning.found).not.toContain("streaming");
    }
  });

  it("PASS ohne Compliance-Anforderungen", () => {
    const input = makeInput({});
    const text = "Tolles Abo fuer CHF 29.95";
    const result = validateCompliance(text, input);
    expect(result.status).toBe("PASS");
  });
});
