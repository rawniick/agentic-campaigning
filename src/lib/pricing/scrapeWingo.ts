// Scrape-Assist für Standard-Preise von wingo.ch.
//
// wingo.ch bettet pro Abo ein strukturiertes Attribut ein:
//   data-teaser-card-price='{"price": 50, "promoPrice": 17.95}'
// `price` = regulärer (durchgestrichener) Preis, `promoPrice` = Aktionspreis.
// Wir matchen die richtige Karte über den bereits bekannten Promo-Preis des
// Produkts und nehmen deren `price` als Standard-Preis. Das ist robuster als
// visuelles Scraping (kein Layout-/CSS-Klassen-Risiko) — bricht nur, wenn wingo
// das Datenattribut umbenennt.
//
// Compliance: Preise sind exakt-sensibel. Diese Funktion ist KEIN LLM, sondern
// deterministische Extraktion; der gescrapte Wert ist der Referenz-/Standardpreis
// (nicht der bindende Aktionspreis) und wird nach dem Scrape manuell reviewt.

const TEASER_PRICE_RE = /data-teaser-card-price='(\{[^']*\})'/g;

export interface TeaserPrice {
  price: number;
  promoPrice: number;
}

// Pure: alle data-teaser-card-price-Blobs aus dem HTML parsen.
export function parseTeaserPrices(html: string): TeaserPrice[] {
  const out: TeaserPrice[] = [];
  TEASER_PRICE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = TEASER_PRICE_RE.exec(html)) !== null) {
    try {
      const obj = JSON.parse(m[1]) as { price?: unknown; promoPrice?: unknown };
      if (typeof obj.price === "number" && typeof obj.promoPrice === "number") {
        out.push({ price: obj.price, promoPrice: obj.promoPrice });
      }
    } catch {
      // malformed JSON in einem Blob — überspringen, andere Karten zählen weiter
    }
  }
  return out;
}

// Pure: Standard-Preis für ein Produkt aus dem HTML ziehen, gematcht über den
// bekannten Promo-Preis. Gibt null zurück, wenn keine passende Karte existiert
// oder der gefundene "Standard" nicht grösser als der Promo-Preis ist.
export function extractStandardPrice(html: string, promoPrice: number): number | null {
  const cards = parseTeaserPrices(html);
  const match = cards.find(
    (c) => Math.abs(c.promoPrice - promoPrice) < 0.005 && c.price > c.promoPrice
  );
  return match ? match.price : null;
}

export interface FetchResult {
  standardPrice: number | null;
  detail: string;
}

// Holt die wingo.ch-Produktseite und extrahiert den Standard-Preis. fetchImpl
// ist injizierbar für Tests (kein echter Netzwerk-Call im Unit-Test).
export async function fetchWingoStandardPrice(
  link: string,
  promoPrice: number,
  fetchImpl: typeof fetch = fetch
): Promise<FetchResult> {
  let res: Response;
  try {
    res = await fetchImpl(link, {
      headers: { "User-Agent": "Mozilla/5.0 (ACE Wingo Preis-Refresh)" },
    });
  } catch (e) {
    return {
      standardPrice: null,
      detail: `Fetch-Fehler: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (!res.ok) {
    return { standardPrice: null, detail: `HTTP ${res.status}` };
  }
  const html = await res.text();
  const standardPrice = extractStandardPrice(html, promoPrice);
  return {
    standardPrice,
    detail:
      standardPrice !== null
        ? "ok"
        : "kein Preis-Match auf der Seite (manuell prüfen)",
  };
}
