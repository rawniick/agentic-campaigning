import type { PromptContext } from "../brand-brain/context-builder";

// Kanal-spezifische Adaptionen generieren
export function buildChannelAdapterPrompt(
  context: PromptContext,
  channels: string[],
  concept: { leitidee: string; claims: string[]; hero_message: string }
): string {
  return `Du bist ein Multichannel-Marketing-Spezialist. Nutze die Brand-Informationen aus dem Kontext.

${context.brandContext}

## Deine Aufgabe

Adaptiere das genehmigte Konzept fuer die folgenden Kanaele: ${channels.join(", ")}

## Genehmigtes Konzept

- Leitidee: ${concept.leitidee}
- Claims: ${concept.claims.join(" | ")}
- Hero Message: ${concept.hero_message}

## Kampagnen-Daten

${context.campaignContext}

## Glossar (VERBINDLICH)

${context.glossarContext}

## Compliance

${context.complianceContext}

## Referenz-Kampagnen (Golden Examples – orientiere dich an Stil und Qualitaet der Kanal-Outputs)

${context.goldenExamplesContext}

## Kanal-spezifische Regeln

- **Social:** Locker, Du-Ansprache, max 1 Emoji, Hashtags
- **CRM:** Freundlich, persoenlich, Subject max 50 Zeichen
- **Website:** Klar, informativ, Du-Ansprache
- **SEA:** Headlines EXAKT max 30 Zeichen, Descriptions EXAKT max 90 Zeichen
- **Print:** Professionell, Sie-Ansprache, Pflichttext-Block

## Output-Format

Antworte AUSSCHLIESSLICH mit validem JSON:

{
  "kanaladaptionen": {
    "social": {
      "hook": "max 10 Woerter",
      "body": "2-3 Saetze",
      "cta": "max 5 Woerter",
      "hashtags": ["3-5 Hashtags"]
    },
    "crm": {
      "subject_line": "max 50 Zeichen",
      "preview_text": "max 80 Zeichen",
      "headline": "kurz",
      "body": "2-3 Saetze",
      "cta": "Button-Text"
    },
    "website": {
      "hero_headline": "max 8 Woerter",
      "hero_subline": "max 15 Woerter",
      "cta_primary": "Button",
      "cta_secondary": "optional"
    },
    "sea": {
      "headlines": ["EXAKT max 30 Zeichen je"],
      "descriptions": ["EXAKT max 90 Zeichen je"]
    },
    "print": {
      "headline": "max 8 Woerter",
      "subline": "max 12 Woerter",
      "body": "max 40 Woerter",
      "pflichttext": "aus Compliance uebernommen"
    }
  }
}`;
}
