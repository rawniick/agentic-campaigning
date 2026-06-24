import { describe, it, expect, vi } from "vitest";
import {
  parseTeaserPrices,
  extractStandardPrice,
  fetchWingoStandardPrice,
} from "../scrapeWingo";

// Repräsentativer Ausschnitt aus einer echten wingo.ch-Mobile-Produktseite
// (mehrere Abo-Teaser-Karten auf einer Seite, Stand Juni 2026).
const HTML_FIXTURE = `
<div data-teaser-card-price='{"price": 39, "promoPrice": 13.95}'>...</div>
<div data-teaser-card-price='{"price": 50, "promoPrice": 17.95}'>...</div>
<div data-teaser-card-price='{"price": 68, "promoPrice": 21.95}'>...</div>
<div data-teaser-card-price='{"price": 78, "promoPrice": 23.95}'>...</div>
<script type="application/ld+json">{"@type":"Offer","price":"17.95"}</script>
`;

describe("scrapeWingo / parseTeaserPrices", () => {
  it("parst alle data-teaser-card-price-Blobs", () => {
    const cards = parseTeaserPrices(HTML_FIXTURE);
    expect(cards).toHaveLength(4);
    expect(cards).toContainEqual({ price: 50, promoPrice: 17.95 });
  });

  it("überspringt malformed JSON ohne zu werfen", () => {
    const cards = parseTeaserPrices(
      `<div data-teaser-card-price='{kaputt}'></div>` +
        `<div data-teaser-card-price='{"price": 50, "promoPrice": 17.95}'></div>`
    );
    expect(cards).toEqual([{ price: 50, promoPrice: 17.95 }]);
  });
});

describe("scrapeWingo / extractStandardPrice", () => {
  it("matcht die Karte über den Promo-Preis und liefert den Standard-Preis", () => {
    expect(extractStandardPrice(HTML_FIXTURE, 17.95)).toBe(50);
    expect(extractStandardPrice(HTML_FIXTURE, 23.95)).toBe(78);
  });

  it("liefert null, wenn kein Promo-Preis matcht", () => {
    expect(extractStandardPrice(HTML_FIXTURE, 99.95)).toBeNull();
  });

  it("ignoriert Karten, deren Standard nicht grösser als der Promo-Preis ist", () => {
    const html = `<div data-teaser-card-price='{"price": 17.95, "promoPrice": 17.95}'></div>`;
    expect(extractStandardPrice(html, 17.95)).toBeNull();
  });
});

describe("scrapeWingo / fetchWingoStandardPrice", () => {
  it("holt + extrahiert über injizierten fetch", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => HTML_FIXTURE,
    } as Response);
    const r = await fetchWingoStandardPrice("https://www.wingo.ch/x", 17.95, fakeFetch);
    expect(r.standardPrice).toBe(50);
    expect(r.detail).toBe("ok");
  });

  it("gibt HTTP-Detail zurück bei Nicht-200", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 } as Response);
    const r = await fetchWingoStandardPrice("https://www.wingo.ch/x", 17.95, fakeFetch);
    expect(r.standardPrice).toBeNull();
    expect(r.detail).toBe("HTTP 404");
  });

  it("fängt Netzwerk-Fehler ab statt zu werfen", async () => {
    const fakeFetch = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));
    const r = await fetchWingoStandardPrice("https://www.wingo.ch/x", 17.95, fakeFetch);
    expect(r.standardPrice).toBeNull();
    expect(r.detail).toContain("ENOTFOUND");
  });
});
