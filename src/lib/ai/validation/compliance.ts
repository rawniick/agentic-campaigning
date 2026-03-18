// Compliance-Validierung: Disclaimer, 5G Badge, Swisscom Netz, Glossar
import type { PromoInput } from "@/lib/schemas/promo-input";
import type { GlossarData } from "../brand-brain/loader";

export interface ComplianceResult {
  status: "PASS" | "FAIL" | "WARNING";
  criticalIssues: ComplianceIssue[];
  warnings: ComplianceIssue[];
  passedChecks: number;
  totalChecks: number;
  recommendation: "APPROVE" | "REVISE" | "BLOCK";
}

export interface ComplianceIssue {
  type: string;
  field: string;
  expected: string;
  found: string;
  severity: "CRITICAL" | "WARNING";
}

export function validateCompliance(
  generatedText: string,
  input: PromoInput,
  glossar?: GlossarData
): ComplianceResult {
  const criticalIssues: ComplianceIssue[] = [];
  const warnings: ComplianceIssue[] = [];
  let passedChecks = 0;
  let totalChecks = 0;

  // 1. KRITISCH - Disclaimer enthalten
  // Pruefe sowohl raw-Text als auch JSON-escaped Variante
  if (input.sonstiges.disclaimer_text) {
    totalChecks++;
    const disclaimer = input.sonstiges.disclaimer_text;
    const escapedDisclaimer = disclaimer.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    if (
      generatedText.includes(disclaimer) ||
      generatedText.includes(escapedDisclaimer)
    ) {
      passedChecks++;
    } else {
      criticalIssues.push({
        type: "disclaimer_missing",
        field: "sonstiges.disclaimer_text",
        expected: disclaimer,
        found: "Disclaimer nicht im Output gefunden",
        severity: "CRITICAL",
      });
    }
  }

  // 2. KRITISCH - 5G Badge
  if (input.sonstiges.five_g_badge) {
    totalChecks++;
    if (generatedText.includes("5G")) {
      passedChecks++;
    } else {
      criticalIssues.push({
        type: "five_g_missing",
        field: "sonstiges.five_g_badge",
        expected: '"5G" muss im Output vorkommen',
        found: "5G nicht gefunden",
        severity: "CRITICAL",
      });
    }
  }

  // 3. KRITISCH - Swisscom Netz Hinweis
  if (input.sonstiges.swisscom_netz_hinweis) {
    totalChecks++;
    if (
      generatedText.includes("Swisscom Netz") ||
      generatedText.includes("Swisscom-Netz") ||
      generatedText.includes("réseau Swisscom") ||
      generatedText.includes("rete Swisscom")
    ) {
      passedChecks++;
    } else {
      criticalIssues.push({
        type: "swisscom_netz_missing",
        field: "sonstiges.swisscom_netz_hinweis",
        expected: '"Swisscom Netz" muss im Output vorkommen',
        found: "Hinweis nicht gefunden",
        severity: "CRITICAL",
      });
    }
  }

  // 4. WICHTIG - Keine unbelegten Features
  if (input.produktuebersicht.features.length > 0) {
    totalChecks++;
    // Pruefe ob behauptete Features im Input stehen
    const suspiciousFeatures = findUnbackedClaims(
      generatedText,
      input.produktuebersicht.features
    );
    if (suspiciousFeatures.length === 0) {
      passedChecks++;
    } else {
      for (const feature of suspiciousFeatures) {
        warnings.push({
          type: "unbacked_claim",
          field: "produktuebersicht.features",
          expected: "Nur Features aus dem Input verwenden",
          found: feature,
          severity: "WARNING",
        });
      }
    }
  }

  // 5. HINWEIS - Glossar-Konformitaet
  if (glossar) {
    for (const [term, data] of Object.entries(glossar.terms)) {
      totalChecks++;
      // Pruefen ob falsche Varianten verwendet werden
      let hasViolation = false;
      for (const wrongTerm of data.wrong) {
        if (generatedText.includes(wrongTerm)) {
          warnings.push({
            type: "glossar_violation",
            field: `glossar.${term}`,
            expected: term,
            found: `Falsche Variante "${wrongTerm}" gefunden`,
            severity: "WARNING",
          });
          hasViolation = true;
        }
      }
      if (!hasViolation) {
        passedChecks++;
      }
    }
  }

  // 6. HINWEIS - Anglizismen pruefen
  totalChecks++;
  const anglicisms = detectAnglicisms(generatedText);
  if (anglicisms.length === 0) {
    passedChecks++;
  } else {
    warnings.push({
      type: "anglicism_detected",
      field: "brand.language",
      expected: "Deutsche Begriffe verwenden",
      found: `Moegliche Anglizismen: ${anglicisms.join(", ")}`,
      severity: "WARNING",
    });
  }

  // Empfehlung ableiten
  const hasCritical = criticalIssues.length > 0;
  const hasWarnings = warnings.length > 0;

  return {
    status: hasCritical ? "FAIL" : hasWarnings ? "WARNING" : "PASS",
    criticalIssues,
    warnings,
    passedChecks,
    totalChecks,
    recommendation: hasCritical ? "BLOCK" : hasWarnings ? "REVISE" : "APPROVE",
  };
}

// Haeufige Marketing-Anglizismen erkennen
const COMMON_ANGLICISMS = [
  { en: "sale", de: "Aktion/Rabatt" },
  { en: "deal", de: "Angebot" },
  { en: "best price", de: "bester Preis" },
  { en: "upgrade", de: "Wechsel/Upgrade" },
  { en: "subscribe", de: "abonnieren/bestellen" },
  { en: "unlimited", de: "unlimitiert" },
  { en: "download", de: "herunterladen" },
  { en: "streaming", de: "Streaming" }, // akzeptiert
];

function detectAnglicisms(text: string): string[] {
  const found: string[] = [];
  const lowerText = text.toLowerCase();

  for (const { en } of COMMON_ANGLICISMS) {
    // "sale" und "deal" als standalone Woerter pruefen
    const pattern = new RegExp(`\\b${en}\\b`, "i");
    if (
      pattern.test(lowerText) &&
      en !== "streaming" && // Akzeptierte Anglizismen
      en !== "upgrade"
    ) {
      found.push(en);
    }
  }

  return found;
}

// Pruefe ob Text Features behauptet die nicht im Input stehen
function findUnbackedClaims(
  text: string,
  inputFeatures: string[]
): string[] {
  const suspicious: string[] = [];
  const lowerText = text.toLowerCase();

  // Typische Feature-Claims die im Input belegt sein muessen
  const featureClaims = [
    { keyword: "unlimitiert", requires: "unlimitiert" },
    { keyword: "5g", requires: "5g" },
    { keyword: "roaming", requires: "roaming" },
    { keyword: "flatrate", requires: "flatrate" },
    { keyword: "eu-roaming", requires: "eu" },
  ];

  const lowerFeatures = inputFeatures.map((f) => f.toLowerCase());

  for (const claim of featureClaims) {
    if (lowerText.includes(claim.keyword)) {
      const backed = lowerFeatures.some((f) =>
        f.includes(claim.requires)
      );
      if (!backed) {
        suspicious.push(
          `"${claim.keyword}" behauptet, aber nicht in Features belegt`
        );
      }
    }
  }

  return suspicious;
}
