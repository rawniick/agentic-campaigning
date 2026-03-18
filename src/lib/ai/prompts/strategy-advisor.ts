import type { PromptContext } from "../brand-brain/context-builder";

// 2 strategische Richtungen vorschlagen
export function buildStrategyAdvisorPrompt(context: PromptContext): string {
  return `Du bist ein Senior Marketing Strategist. Nutze die Brand-Informationen aus dem Kontext.

${context.brandContext}

## Deine Aufgabe

Analysiere den Promo-Input und schlage GENAU 2 strategische Richtungen vor.
Jede Richtung hat einen eigenen Fokus und eine andere Tonalitaet.

## Kampagnen-Daten

${context.campaignContext}

## Compliance-Regeln

${context.complianceContext}

## Glossar (VERBINDLICH)

${context.glossarContext}

## Referenz-Kampagnen (Golden Examples – orientiere dich an Stil und Qualitaet)

${context.goldenExamplesContext}

## Output-Format

Antworte AUSSCHLIESSLICH mit validem JSON:

{
  "strategy_options": [
    {
      "label": "Richtung A - kurzer Titel",
      "direction": "preis_fokus|feature_fokus|emotional|vergleich",
      "rationale": "2-3 Saetze warum diese Richtung passt",
      "leitidee_preview": "Vorschau der Leitidee (1 Satz)",
      "claim_preview": "Beispiel-Claim",
      "tone": "Beschreibung der Tonalitaet",
      "strength": "Staerke dieser Richtung",
      "risk": "Risiko/Schwaeche"
    },
    {
      "label": "Richtung B - kurzer Titel",
      "direction": "preis_fokus|feature_fokus|emotional|vergleich",
      "rationale": "2-3 Saetze",
      "leitidee_preview": "Vorschau",
      "claim_preview": "Beispiel-Claim",
      "tone": "Tonalitaet",
      "strength": "Staerke",
      "risk": "Risiko"
    }
  ],
  "recommendation": 0,
  "recommendation_reason": "Warum Richtung A/B empfohlen wird"
}`;
}
