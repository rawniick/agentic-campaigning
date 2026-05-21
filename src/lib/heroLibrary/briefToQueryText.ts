import type { Brief } from "../schemas/brief";

// Canonical text fuer Embedding-Search. Kombiniert die Brief-Felder die
// semantisch ueber das gewuenschte Hero-Bild informieren — Kategorie, Produkt,
// Strategie, Zielgruppe, Hauptbotschaft. Library-Entries sollten mit
// vergleichbarem Vokabular embeddet werden, damit die Cosine-Distance sinnvolle
// Aehnlichkeitsscores liefert.
export function briefToQueryText(brief: Brief): string {
  return [
    brief.kampagne.produkt_kategorie,
    brief.produkt.name,
    brief.strategie.input,
    brief.vermarktung.zielgruppe,
    brief.vermarktung.hauptbotschaft,
  ]
    .filter((s) => s && s.length > 0)
    .join(" ");
}
