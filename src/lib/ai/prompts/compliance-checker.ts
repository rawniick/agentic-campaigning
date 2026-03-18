import { promises as fs } from "fs";
import path from "path";
import type { PromptContext } from "../brand-brain/context-builder";

// Compliance-Checker Prompt laden
export async function buildComplianceCheckerPrompt(
  context: PromptContext,
  brandName: string
): Promise<string> {
  const promptPath = path.join(
    process.cwd(),
    "prompts",
    "system",
    "compliance-checker.v1.0.md"
  );

  let systemPrompt: string;
  try {
    systemPrompt = await fs.readFile(promptPath, "utf-8");
    systemPrompt = systemPrompt.replace(/\{\{brand_name\}\}/g, brandName);
  } catch {
    systemPrompt = getInlineCompliancePrompt(brandName);
  }

  return `${systemPrompt}

## Kampagnen-Input (Referenz fuer Validierung)

${context.campaignContext}

## Compliance-Anforderungen

${context.complianceContext}

## Glossar (Pruefe Konformitaet)

${context.glossarContext}`;
}

function getInlineCompliancePrompt(brandName: string): string {
  return `Du bist ein Compliance-Pruefer fuer ${brandName} Marketing-Assets.

Vergleiche den generierten Output mit dem Promo-Input und identifiziere JEDE Abweichung.

Pruefkatalog:
1. KRITISCH: Preise exakt, Rabatt mathematisch korrekt, Waehrung korrekt
2. KRITISCH: Disclaimer enthalten, 5G Badge, Swisscom Netz Hinweis
3. WICHTIG: Zeichenlimits (SEA 30/90, CRM 50, Claims 8 Woerter)
4. WICHTIG: Keine unbelegten Features, Daten korrekt
5. HINWEIS: Tonalitaet, keine Anglizismen, keine unbelegten Superlative

Entscheide:
- BLOCK: Mindestens 1 CRITICAL Issue
- REVISE: Nur WARNINGS
- APPROVE: Alle Checks bestanden

Antworte AUSSCHLIESSLICH mit validem JSON:
{
  "overall_status": "PASS|FAIL|WARNING",
  "critical_issues": [],
  "warnings": [],
  "passed_checks": 0,
  "total_checks": 0,
  "recommendation": "APPROVE|REVISE|BLOCK"
}`;
}
