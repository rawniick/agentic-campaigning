// Zeichenlimits nach Kanal - SEA 30/90, CRM 50 etc.

export interface CharLimitResult {
  valid: boolean;
  warnings: CharLimitWarning[];
}

export interface CharLimitWarning {
  field: string;
  limit: number;
  actual: number;
  text: string;
  severity: "CRITICAL" | "WARNING";
}

// Harte Limits (Ueberschreitung = CRITICAL)
const HARD_LIMITS: Record<string, number> = {
  "sea.headlines": 30,
  "sea.descriptions": 90,
};

// Weiche Limits (Ueberschreitung = WARNING)
const SOFT_LIMITS: Record<string, number> = {
  "crm.subject_line": 50,
  "crm.preview_text": 80,
  "claims": 50, // ~8 Woerter
};

export function validateCharLimits(
  content: Record<string, unknown>,
  language?: string
): CharLimitResult {
  const warnings: CharLimitWarning[] = [];

  // Sprach-angepasste Soft-Limits (FR/IT ~15-20% laenger)
  const adjustedLimits = language ? adjustLimitsForLanguage(language) : null;

  // SEA Headlines pruefen (HART: 30 Zeichen - Plattform-Limit, NICHT anpassen)
  const seaHeadlines = extractNestedArray(content, "sea", "headlines");
  for (const [i, headline] of seaHeadlines.entries()) {
    if (headline.length > HARD_LIMITS["sea.headlines"]) {
      warnings.push({
        field: `sea.headlines[${i}]`,
        limit: HARD_LIMITS["sea.headlines"],
        actual: headline.length,
        text: headline,
        severity: "CRITICAL",
      });
    }
  }

  // SEA Descriptions pruefen (HART: 90 Zeichen)
  const seaDescriptions = extractNestedArray(content, "sea", "descriptions");
  for (const [i, desc] of seaDescriptions.entries()) {
    if (desc.length > HARD_LIMITS["sea.descriptions"]) {
      warnings.push({
        field: `sea.descriptions[${i}]`,
        limit: HARD_LIMITS["sea.descriptions"],
        actual: desc.length,
        text: desc,
        severity: "CRITICAL",
      });
    }
  }

  // CRM Subject Line pruefen (angepasste Limits fuer FR/IT)
  const subjectLimit = adjustedLimits?.["crm.subject_line"] ?? SOFT_LIMITS["crm.subject_line"];
  const subjectLine = extractNestedString(content, "crm", "subject_line");
  if (subjectLine && subjectLine.length > subjectLimit) {
    warnings.push({
      field: "crm.subject_line",
      limit: subjectLimit,
      actual: subjectLine.length,
      text: subjectLine,
      severity: "WARNING",
    });
  }

  // CRM Preview Text pruefen (angepasste Limits fuer FR/IT)
  const previewLimit = adjustedLimits?.["crm.preview_text"] ?? SOFT_LIMITS["crm.preview_text"];
  const previewText = extractNestedString(content, "crm", "preview_text");
  if (previewText && previewText.length > previewLimit) {
    warnings.push({
      field: "crm.preview_text",
      limit: previewLimit,
      actual: previewText.length,
      text: previewText,
      severity: "WARNING",
    });
  }

  // Claims Wortlimit pruefen (max 8 Woerter)
  const claims = extractClaims(content);
  for (const [i, claim] of claims.entries()) {
    const wordCount = claim.split(/\s+/).filter(Boolean).length;
    if (wordCount > 8) {
      warnings.push({
        field: `claims[${i}]`,
        limit: 8,
        actual: wordCount,
        text: `${claim} (${wordCount} Woerter)`,
        severity: "WARNING",
      });
    }
  }

  const hasCritical = warnings.some((w) => w.severity === "CRITICAL");

  return {
    valid: !hasCritical,
    warnings,
  };
}

// FR ist ~15-20% laenger als DE -> Limits anpassen
export function adjustLimitsForLanguage(
  language: string
): Record<string, number> {
  const factor = language === "fr" ? 1.15 : language === "it" ? 1.1 : 1.0;

  return {
    "sea.headlines": HARD_LIMITS["sea.headlines"], // SEA Limits NICHT anpassen (plattformseitig hart)
    "sea.descriptions": HARD_LIMITS["sea.descriptions"],
    "crm.subject_line": Math.floor(SOFT_LIMITS["crm.subject_line"] * factor),
    "crm.preview_text": Math.floor(SOFT_LIMITS["crm.preview_text"] * factor),
  };
}

// Hilfsfunktionen fuer verschachtelte JSON-Extraktion
function extractNestedArray(
  obj: Record<string, unknown>,
  ...keys: string[]
): string[] {
  let current: unknown = obj;
  for (const key of keys) {
    if (typeof current !== "object" || current === null) return [];
    current = (current as Record<string, unknown>)[key];
  }
  if (Array.isArray(current)) {
    return current.filter((item): item is string => typeof item === "string");
  }
  return [];
}

function extractNestedString(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | null {
  let current: unknown = obj;
  for (const key of keys) {
    if (typeof current !== "object" || current === null) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : null;
}

function extractClaims(obj: Record<string, unknown>): string[] {
  // In kampagnensteckbrief.claims oder direkt in claims suchen
  const steckbrief = obj["kampagnensteckbrief"] as Record<string, unknown> | undefined;
  if (steckbrief?.["claims"] && Array.isArray(steckbrief["claims"])) {
    return steckbrief["claims"].filter(
      (c): c is string => typeof c === "string"
    );
  }

  if (obj["claims"] && Array.isArray(obj["claims"])) {
    return (obj["claims"] as unknown[]).filter(
      (c): c is string => typeof c === "string"
    );
  }

  return [];
}
