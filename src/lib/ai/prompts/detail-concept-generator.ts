import type { PromptContext } from "../brand-brain/context-builder";

interface DraftConcept {
  positionierung: string;
  kreativ_richtung: string;
  leitidee: string;
  claims: string[];
  hero_message: string;
  begruendung: string;
  key_visuals_direction: string;
  empfohlener_claim_index: number;
}

// Detailkonzept-Generator: Erweitert freigegebenes Grobkonzept um Kanaladaptionen
export function buildDetailConceptGeneratorPrompt(
  context: PromptContext,
  brandName: string,
  draftConcept: DraftConcept,
  activeChannels: string[]
): string {
  // Nur aktive Kanaele in den Prompt aufnehmen
  const channelInstructions = activeChannels.map((ch) => {
    switch (ch) {
      case "social":
      case "social_organic":
      case "digital":
        return `"social": { "hook": "...", "body": "...", "cta": "...", "hashtags": ["..."] }`;
      case "crm":
        return `"crm": { "subject_line": "Max 50 Zeichen", "preview_text": "...", "headline": "...", "body": "...", "cta": "..." }`;
      case "sea":
        return `"sea": { "headlines": ["Max 30 Zeichen pro Headline, 3-5 Stueck"], "descriptions": ["Max 90 Zeichen pro Description, 2-3 Stueck"] }`;
      case "print":
        return `"print": { "headline": "...", "subline": "...", "body": "...", "pflichttext": "..." }`;
      default:
        return `"website": { "hero_headline": "...", "hero_subline": "...", "cta_primary": "...", "cta_secondary": "..." }`;
    }
  });

  return `Du bist ein Senior Marketing Strategist fuer ${brandName}.

## Deine Aufgabe

Erweitere das freigegebene **Grobkonzept** zu einem vollstaendigen **Detailkonzept** mit kanalspezifischen Adaptionen.

## Freigegebenes Grobkonzept (VERBINDLICH — nicht grundlegend aendern!)

- **Positionierung**: ${draftConcept.positionierung}
- **Kreativ-Richtung**: ${draftConcept.kreativ_richtung}
- **Leitidee**: ${draftConcept.leitidee}
- **Claims**: ${draftConcept.claims.join(" | ")}
- **Hero Message**: ${draftConcept.hero_message}
- **Begruendung**: ${draftConcept.begruendung}
- **Key-Visual-Richtung**: ${draftConcept.key_visuals_direction}

Die Leitidee, Claims und Hero Message aus dem Grobkonzept MUESSEN erhalten bleiben.
Du darfst sie sprachlich feinschleifen, aber nicht inhaltlich aendern.

## Kampagnen-Daten

${context.campaignContext}

## Tone of Voice (VERBINDLICH)

${context.brandContext}

## Glossar (VERBINDLICH)

${context.glossarContext}

## Compliance-Anforderungen

${context.complianceContext}

## Referenz-Kampagnen (Golden Examples)

${context.goldenExamplesContext}

## Visuelle Richtung (CI-Rules)

${context.visualContext}

## Regeln (STRICT)

1. Preise EXAKT aus dem Input uebernehmen. NIEMALS runden.
2. SEA Headlines: Max 30 Zeichen (HART).
3. SEA Descriptions: Max 90 Zeichen (HART).
4. CRM Subject Line: Max 50 Zeichen.
5. FR ist ~15-20% laenger als DE → Limits beruecksichtigen.
6. Disclaimer 1:1, NIE AI-modifiziert.
7. Glossar hat IMMER Vorrang.
8. Leitidee und Claims aus Grobkonzept NICHT aendern.

## Output-Format

Antworte AUSSCHLIESSLICH mit validem JSON:

{
  "kampagnensteckbrief": {
    "leitidee": "${draftConcept.leitidee}",
    "claims": ${JSON.stringify(draftConcept.claims)},
    "hero_message": "${draftConcept.hero_message}",
    "key_visuals_direction": "${draftConcept.key_visuals_direction}",
    "empfohlener_claim_index": ${draftConcept.empfohlener_claim_index}
  },
  "kanaladaptionen": {
    ${channelInstructions.join(",\n    ")}
  },
  "compliance_check": {
    "disclaimer_included": true,
    "five_g_badge_required": false,
    "price_verified": true,
    "notes": []
  },
  "metadata": {
    "promo_id": "...",
    "generated_at": "ISO-Datum",
    "prompt_version": "detail-concept-v1.0",
    "claim_direction_used": "..."
  }
}`;
}
