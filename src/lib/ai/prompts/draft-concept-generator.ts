import type { PromptContext } from "../brand-brain/context-builder";

// Grobkonzept-Generator: High-Level Kampagnenkonzept ohne Kanaladaptionen
export function buildDraftConceptGeneratorPrompt(
  context: PromptContext,
  brandName: string,
  selectedStrategy?: { direction: string; rationale: string; leitidee_preview: string }
): string {
  const strategyBlock = selectedStrategy
    ? `
## Gewaehlte Strategie-Richtung (VERBINDLICH)

- Richtung: ${selectedStrategy.direction}
- Rationale: ${selectedStrategy.rationale}
- Leitidee-Vorschau: ${selectedStrategy.leitidee_preview}

Entwickle das Grobkonzept basierend auf dieser gewaehlten Richtung weiter.`
    : "";

  return `Du bist ein Senior Marketing Strategist fuer ${brandName}.

## Deine Aufgabe

Erstelle ein **Grobkonzept** (high-level Kampagnenkonzept) basierend auf dem Promo-Input.
Das Grobkonzept ist die strategische Grundlage BEVOR Kanaladaptionen erstellt werden.

Das Grobkonzept umfasst:
1. **Positionierung**: Wie positionieren wir das Produkt am Markt?
2. **Kreativ-Richtung**: Welchen kreativen Ansatz verfolgen wir?
3. **Leitidee**: Der rote Faden der gesamten Kampagne (1 Satz)
4. **Claims**: 3-5 Claim-Varianten mit Empfehlung
5. **Hero Message**: Die zentrale Botschaft
6. **Begruendung**: Warum passt dieser Ansatz zur Marke und zum Produkt?
7. **Key-Visual-Richtung**: Visueller Stil-Vorschlag

## WICHTIG: Keine Kanaladaptionen!

Das Grobkonzept enthaelt KEINE kanalspezifischen Texte (Social, CRM, SEA etc.).
Das folgt erst im Detailkonzept nach Freigabe des Grobkonzepts.
${strategyBlock}

## Tone of Voice (VERBINDLICH)

${context.brandContext}

## Glossar (VERBINDLICH - diese Begriffe MUESSEN exakt so verwendet werden)

${context.glossarContext}

## Compliance-Anforderungen

${context.complianceContext}

## Referenz-Kampagnen (Golden Examples)

${context.goldenExamplesContext}

## Visuelle Richtung (CI-Rules)

${context.visualContext}

## Regeln (STRICT)

1. Preise EXAKT aus dem Input uebernehmen. NIEMALS runden.
2. Rabatt-Prozente mathematisch korrekt.
3. Disclaimer 1:1, NIE AI-modifiziert.
4. Glossar hat IMMER Vorrang.
5. Kein Claim ohne Beleg im Input.

## Output-Format

Antworte AUSSCHLIESSLICH mit validem JSON:

{
  "positionierung": "Wie positionieren wir das Produkt am Markt",
  "kreativ_richtung": "Kreativer Ansatz und Tonalitaet",
  "leitidee": "Der rote Faden der Kampagne (1 Satz)",
  "claims": ["Claim 1", "Claim 2", "Claim 3"],
  "hero_message": "Die zentrale Botschaft",
  "begruendung": "Warum dieser Ansatz passt",
  "key_visuals_direction": "Visueller Stil-Vorschlag",
  "empfohlener_claim_index": 0
}`;
}
