import { promises as fs } from "fs";
import path from "path";
import type { PromptContext } from "../brand-brain/context-builder";

// Konzept-Generator Prompt aus MD-Datei laden und mit Kontext anreichern
export async function buildConceptGeneratorPrompt(
  context: PromptContext,
  brandName: string
): Promise<string> {
  // System-Prompt aus Datei laden
  const promptPath = path.join(
    process.cwd(),
    "prompts",
    "system",
    "konzept-generator.v1.0.md"
  );

  let systemPrompt: string;
  try {
    systemPrompt = await fs.readFile(promptPath, "utf-8");
  } catch {
    // Fallback: Inline-Prompt verwenden
    systemPrompt = getInlineConceptPrompt();
  }

  // Template-Variablen ersetzen
  systemPrompt = systemPrompt.replace(/\{\{brand_name\}\}/g, brandName);

  // Kontext anhaengen
  return `${systemPrompt}

## Zusaetzlicher Kontext

${context.systemContext}

### Tone of Voice (VERBINDLICH)

${context.brandContext}

### Glossar (VERBINDLICH - diese Begriffe MUESSEN exakt so verwendet werden)

${context.glossarContext}

### Compliance-Anforderungen

${context.complianceContext}

### Referenz-Kampagnen (Golden Examples – orientiere dich an Stil und Qualitaet)

${context.goldenExamplesContext}

### Visuelle Richtung (CI-Rules – fuer key_visuals_direction beruecksichtigen)

${context.visualContext}`;
}

// Inline-Fallback falls MD-Datei nicht gefunden
function getInlineConceptPrompt(): string {
  return `Du bist ein Senior Marketing Strategist fuer {{brand_name}}.

Erstelle basierend auf dem Promo-Input einen vollstaendigen Kampagnensteckbrief mit Leitidee, Claim-Varianten und kanalspezifischen Adaptionen.

WICHTIG: Tone of Voice, Glossar, CI-Rules und Golden Examples werden dir als zusaetzlicher Kontext mitgeliefert. Halte dich STRIKT an diese dynamisch geladenen Vorgaben.

Regeln (STRICT):
1. Preise EXAKT aus dem Input uebernehmen. NIEMALS runden.
2. Rabatt-Prozente mathematisch korrekt.
3. Alle Pflichthinweise aus Compliance referenzieren.
4. SEA Headlines: Max 30 Zeichen (HART).
5. SEA Descriptions: Max 90 Zeichen (HART).
6. Kein Claim ohne Beleg im Input.
7. Claim-Direction aus dem Input respektieren.

Antworte AUSSCHLIESSLICH mit validem JSON.`;
}
