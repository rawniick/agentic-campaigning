import { describe, it, expect } from "vitest";
import { briefToQueryText } from "../briefToQueryText";
import type { Brief } from "../../schemas/brief";

const BRIEF: Brief = {
  kampagne: {
    name: "Mobile Schweiz Q3",
    art: "flash_sale",
    datum_von: "2026-07-01",
    datum_bis: "2026-07-15",
    produkt_kategorie: "mobile",
  },
  produkt: {
    name: "Wingo Mobile Swiss",
    preis_promo: 19.95,
    preis_suffix: "/Mt.",
  },
  strategie: { input: "Schnelle 5G-Aktivierung fuer Sommer-Reisende" },
  vermarktung: {
    hauptbotschaft: "Schweizweit unbegrenzt surfen",
    zielgruppe: "sozial",
    zielgebiet: "deutschschweiz",
  },
  assets_kanaele: { channel_kategorien: [], format_codes: ["dv360_halfpage"] },
  sonstiges: {},
};

describe("briefToQueryText", () => {
  it("includes produkt_kategorie, product name, strategy, zielgruppe and hauptbotschaft", () => {
    const text = briefToQueryText(BRIEF);

    expect(text).toContain("mobile");
    expect(text).toContain("Wingo Mobile Swiss");
    expect(text).toContain("Schnelle 5G-Aktivierung fuer Sommer-Reisende");
    expect(text).toContain("sozial");
    expect(text).toContain("Schweizweit unbegrenzt surfen");
  });
});
