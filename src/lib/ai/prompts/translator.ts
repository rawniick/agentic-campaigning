import { promises as fs } from "fs";
import path from "path";
import type { PromptContext } from "../brand-brain/context-builder";

export type TargetLanguage = "fr" | "it" | "en";

// Uebersetzungs-Prompt bauen: DE -> FR/IT/EN mit Glossar-Enforcement
export async function buildTranslatorPrompt(
  context: PromptContext,
  targetLanguage: TargetLanguage,
  brandName: string
): Promise<string> {
  // Versuch sprachspezifischen Prompt zu laden
  const promptPath = path.join(
    process.cwd(),
    "prompts",
    "system",
    `translate-de-${targetLanguage}.v1.0.md`
  );

  let systemPrompt: string;
  try {
    systemPrompt = await fs.readFile(promptPath, "utf-8");
    systemPrompt = systemPrompt.replace(/\{\{brand_name\}\}/g, brandName);
  } catch {
    systemPrompt = getInlineTranslatorPrompt(targetLanguage, brandName);
  }

  return `${systemPrompt}

## Glossar ${targetLanguage.toUpperCase()} (VERBINDLICH)

${context.glossarContext}

## Compliance

${context.complianceContext}`;
}

function getInlineTranslatorPrompt(
  language: TargetLanguage,
  brandName: string
): string {
  const langNames: Record<TargetLanguage, string> = {
    fr: "Franzoesisch (Schweizer Franzoesisch)",
    it: "Italienisch (Schweizer Italienisch)",
    en: "Englisch",
  };

  return `Du bist ein professioneller Uebersetzer fuer ${brandName} Marketing-Texte.
Uebersetze von Deutsch nach ${langNames[language]}.

## STRIKTE Regeln

1. Preise und Zahlen NIEMALS uebersetzen (CHF 11.95 bleibt CHF 11.95)
2. Markennamen NICHT uebersetzen (${brandName} bleibt ${brandName})
3. ${language === "fr" ? "Schweizer Franzoesisch verwenden (natel statt portable, septante statt soixante-dix)" : language === "it" ? "Schweizer Italienisch verwenden" : "British English bevorzugen"}
4. Glossar hat IMMER Vorrang - exakte Uebersetzungen verwenden
5. Zeichenlimits beibehalten (SEA 30 Zeichen bleibt 30 Zeichen)
6. Disclaimer separat uebersetzen (woertlich, rechtlich korrekt)
7. Nur deutsche Hashtags uebersetzen
8. Tonalitaet beibehalten (direkt, unkompliziert)

## Output-Format

Antworte AUSSCHLIESSLICH mit validem JSON - gleiche Struktur wie Input, aber uebersetzt:

{
  "target_language": "${language}",
  "translated_claims": ["Claim 1", "Claim 2"],
  "translated_hero_message": "Uebersetzter Hero Message",
  "translated_channel_adaptations": { ... },
  "translated_disclaimer": "Uebersetzter Disclaimer",
  "glossar_terms_used": [{"de": "Original", "${language}": "Uebersetzung"}],
  "translation_notes": ["Hinweise zur Uebersetzung"]
}`;
}
