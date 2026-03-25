// Airtable → BrandBrain Adapter
// Transformiert Airtable Records in bestehende BrandBrain-Interfaces

import type { AirtableConfig, AirtableRecord } from "@/lib/integrations/airtable";
import { buildAirtableConfig, listRecords } from "@/lib/integrations/airtable";
import { setCachedFile } from "./drive-cache";
import type { CIRules, GlossarData, GoldenExample } from "./loader";

// --- Erwartete Airtable Field-Strukturen ---
// Die Adapter sind flexibel: Felder werden case-insensitive gesucht.

/**
 * Tone of Voice Table — erwartete Felder:
 * - Titel/Title/Name: Ueberschrift der Regel
 * - Inhalt/Content/Beschreibung/Description: Regel-Text
 * - Kategorie/Category (optional): Gruppierung
 * - Reihenfolge/Order/Sort (optional): Sortierung
 */

/**
 * Glossar Table — erwartete Felder:
 * - Begriff/Term/Name: Der korrekte Begriff
 * - Verwendung/Use/Richtig: Wie der Begriff genutzt wird
 * - Falsch/Wrong/Vermeiden: Falsche Varianten (komma-getrennt oder Array)
 * - Kontext/Context/Hinweis: Erlaeuterung
 * - Sprache/Language/Lang: DE/FR/IT/EN
 */

/**
 * CI-Rules Table — erwartete Felder:
 * - Kategorie/Category/Typ/Type: colors/typography/logo/layout
 * - Name/Bezeichnung: Name der Regel
 * - Wert/Value: Wert (z.B. Hex-Code, Font-Name)
 * - Regeln/Rules/Hinweis: Zusaetzliche Regeln
 */

/**
 * Golden Examples Table — erwartete Felder:
 * - Typ/Type/Kanal/Channel: social, sea, crm etc.
 * - Kampagne/Campaign/Name: Kampagnen-Name
 * - Input: JSON-String oder strukturierte Felder
 * - Output: JSON-String oder strukturierte Felder
 * - Notizen/Notes (optional)
 */

// --- Field Resolver ---

/**
 * Sucht ein Feld case-insensitive in einem Record.
 * Probiert mehrere Varianten (DE/EN).
 */
function resolveField(
  fields: Record<string, unknown>,
  ...candidates: string[]
): unknown {
  // Exakte Suche
  for (const c of candidates) {
    if (c in fields) return fields[c];
  }
  // Case-insensitive Suche
  const lowerMap = new Map(
    Object.entries(fields).map(([k, v]) => [k.toLowerCase(), v])
  );
  for (const c of candidates) {
    const val = lowerMap.get(c.toLowerCase());
    if (val !== undefined) return val;
  }
  return undefined;
}

function resolveString(fields: Record<string, unknown>, ...candidates: string[]): string {
  const val = resolveField(fields, ...candidates);
  if (typeof val === "string") return val;
  if (Array.isArray(val)) return val.join(", ");
  return val ? String(val) : "";
}

function resolveNumber(fields: Record<string, unknown>, ...candidates: string[]): number {
  const val = resolveField(fields, ...candidates);
  if (typeof val === "number") return val;
  if (typeof val === "string") return parseFloat(val) || 0;
  return 0;
}

// --- Tone of Voice Extraction ---

/**
 * Tone of Voice aus Airtable Records zusammenbauen.
 * Jeder Record = eine Regel/Sektion. Wird als Markdown zusammengefuegt.
 */
export function extractToneOfVoiceFromRecords(
  records: AirtableRecord[]
): string {
  if (records.length === 0) return "";

  // Nach Reihenfolge sortieren (falls vorhanden)
  const sorted = [...records].sort((a, b) => {
    const orderA = resolveNumber(a.fields, "Reihenfolge", "Order", "Sort", "Sortierung");
    const orderB = resolveNumber(b.fields, "Reihenfolge", "Order", "Sort", "Sortierung");
    return orderA - orderB;
  });

  const parts: string[] = ["# Tone of Voice (Airtable)"];
  let currentCategory = "";

  for (const record of sorted) {
    const category = resolveString(record.fields, "Kategorie", "Category", "Bereich", "Section");
    const title = resolveString(record.fields, "Titel", "Title", "Name", "Bezeichnung", "Regel");
    const content = resolveString(
      record.fields,
      "Inhalt", "Content", "Beschreibung", "Description", "Text", "Regel-Text"
    );
    const doItems = resolveString(record.fields, "Do", "Dos", "Richtig", "Empfohlen");
    const dontItems = resolveString(record.fields, "Dont", "Don't", "Donts", "Falsch", "Vermeiden");

    // Kategorie als H2 Ueberschrift
    if (category && category !== currentCategory) {
      parts.push(`\n## ${category}`);
      currentCategory = category;
    }

    // Titel als H3
    if (title) {
      parts.push(`\n### ${title}`);
    }

    // Content als Text
    if (content) {
      parts.push(content);
    }

    // Do/Don't
    if (doItems) {
      parts.push(`\n**DO:** ${doItems}`);
    }
    if (dontItems) {
      parts.push(`**DON'T:** ${dontItems}`);
    }
  }

  return parts.join("\n");
}

// --- Glossar Extraction ---

/**
 * Glossar aus Airtable Records extrahieren.
 * Filtert nach Sprache (Feld: Sprache/Language).
 */
export function extractGlossarFromRecords(
  records: AirtableRecord[],
  language: string
): GlossarData {
  const terms: Record<string, { use: string; wrong: string[]; context: string }> = {};
  const langUpper = language.toUpperCase();

  for (const record of records) {
    const lang = resolveString(record.fields, "Sprache", "Language", "Lang").toUpperCase();

    // Wenn Sprach-Feld vorhanden: nur Records der gewuenschten Sprache
    if (lang && lang !== langUpper) continue;

    const term = resolveString(record.fields, "Begriff", "Term", "Name", "Bezeichnung");
    if (!term) continue;

    const use = resolveString(record.fields, "Verwendung", "Use", "Richtig", "Korrekt", "Correct");
    const wrongRaw = resolveField(record.fields, "Falsch", "Wrong", "Vermeiden", "Avoid", "Incorrect");
    const context = resolveString(record.fields, "Kontext", "Context", "Hinweis", "Note", "Bemerkung");

    // "Wrong" kann ein Array oder komma-getrennter String sein
    let wrong: string[] = [];
    if (Array.isArray(wrongRaw)) {
      wrong = wrongRaw.map(String);
    } else if (typeof wrongRaw === "string" && wrongRaw) {
      wrong = wrongRaw.split(/[,;]/).map((w) => w.trim()).filter(Boolean);
    }

    terms[term] = {
      use: use || term,
      wrong,
      context: context || "Aus Airtable importiert",
    };
  }

  return {
    _meta: {
      version: "airtable",
      language,
      description: `Glossar (${language}) aus Airtable importiert`,
    },
    terms,
  };
}

// --- CI-Rules Extraction ---

/**
 * CI-Rules aus Airtable Records zusammenbauen.
 * Erwartet ein Feld "Kategorie/Category" mit Werten: colors, typography, logo, layout.
 */
export function extractCIRulesFromRecords(
  records: AirtableRecord[]
): CIRules {
  const colors: Record<string, unknown> = {};
  const typography: Record<string, unknown> = {};
  const logo: Record<string, unknown> = { placement: "", forbidden: [] as string[] };
  const imageStyle: Record<string, unknown> = {};
  const layoutRules: string[] = [];

  for (const record of records) {
    const category = resolveString(
      record.fields, "Kategorie", "Category", "Typ", "Type", "Bereich"
    ).toLowerCase();
    const name = resolveString(record.fields, "Name", "Bezeichnung", "Label", "Eigenschaft", "Property");
    const value = resolveString(record.fields, "Wert", "Value", "Hex", "Font", "Inhalt");
    const rules = resolveString(record.fields, "Regeln", "Rules", "Hinweis", "Note");

    switch (category) {
      case "colors":
      case "farben":
      case "farbe":
      case "color": {
        const nameLower = name.toLowerCase();
        if (nameLower.includes("primary") || nameLower.includes("primaer") || nameLower.includes("haupt")) {
          colors.primary = value;
          colors.primary_name = name;
        } else if (nameLower.includes("secondary") || nameLower.includes("sekundaer")) {
          colors.secondary = value;
          colors.secondary_name = name;
        } else if (nameLower.includes("accent") || nameLower.includes("akzent")) {
          colors.accent = value;
          colors.accent_name = name;
        } else {
          colors[name] = value;
        }
        if (rules) {
          if (!Array.isArray(colors.usage_rules)) colors.usage_rules = [];
          (colors.usage_rules as string[]).push(rules);
        }
        break;
      }

      case "typography":
      case "typografie":
      case "schrift":
      case "font": {
        const nameLower = name.toLowerCase();
        if (nameLower.includes("headline") || nameLower.includes("ueberschrift") || nameLower.includes("h1")) {
          typography.headline_font = value;
        } else if (nameLower.includes("body") || nameLower.includes("fliesstext") || nameLower.includes("text")) {
          typography.body_font = value;
        } else {
          typography[name] = value;
        }
        if (rules) {
          if (!Array.isArray(typography.rules)) typography.rules = [];
          (typography.rules as string[]).push(rules);
        }
        break;
      }

      case "logo": {
        const nameLower = name.toLowerCase();
        if (nameLower.includes("placement") || nameLower.includes("platzierung")) {
          logo.placement = value;
        } else if (nameLower.includes("forbidden") || nameLower.includes("verboten") || nameLower.includes("dont")) {
          (logo.forbidden as string[]).push(value);
        } else {
          logo[name] = value;
        }
        break;
      }

      case "image":
      case "bild":
      case "image_style":
      case "bildstil":
        imageStyle[name] = value;
        break;

      case "layout":
      case "layout_rules":
      default:
        if (name || value) {
          layoutRules.push(rules || `${name}: ${value}`);
        }
        break;
    }
  }

  return {
    _meta: {
      version: "airtable",
      brand: "airtable-import",
      description: "CI-Rules aus Airtable importiert",
    },
    colors,
    typography,
    logo,
    image_style: imageStyle,
    layout_rules: layoutRules.filter(Boolean),
  };
}

// --- Golden Examples Extraction ---

/**
 * Golden Examples aus Airtable Records extrahieren.
 */
export function extractGoldenExamplesFromRecords(
  records: AirtableRecord[]
): GoldenExample[] {
  const results: GoldenExample[] = [];

  for (const record of records) {
    const type = resolveString(record.fields, "Typ", "Type", "Kanal", "Channel");
    const campaignName = resolveString(
      record.fields, "Kampagne", "Campaign", "Name", "Kampagnenname", "Campaign Name"
    );
    const inputRaw = resolveField(record.fields, "Input", "Eingabe");
    const outputRaw = resolveField(record.fields, "Output", "Ausgabe", "Ergebnis");
    const notes = resolveString(record.fields, "Notizen", "Notes", "Bemerkung", "Hinweis");

    if (!type && !campaignName) continue;

    // Input/Output: JSON-String oder Record
    let input: Record<string, unknown> = {};
    let output: Record<string, unknown> = {};

    if (typeof inputRaw === "string") {
      try { input = JSON.parse(inputRaw); } catch { input = { raw: inputRaw }; }
    } else if (inputRaw && typeof inputRaw === "object") {
      input = inputRaw as Record<string, unknown>;
    }

    if (typeof outputRaw === "string") {
      try { output = JSON.parse(outputRaw); } catch { output = { raw: outputRaw }; }
    } else if (outputRaw && typeof outputRaw === "object") {
      output = outputRaw as Record<string, unknown>;
    }

    results.push({
      type: type || "unknown",
      campaign_name: campaignName || "Unbenannt",
      input,
      output,
      notes: notes || undefined,
    });
  }

  return results;
}

// --- Lazy-Loaded Airtable Context ---

let airtableContextResolved = false;
let airtableConfig: AirtableConfig | null = null;

/**
 * Airtable-Kontext lazy initialisieren (einmal pro Prozess).
 */
export function getAirtableContext(): AirtableConfig | null {
  if (!airtableContextResolved) {
    airtableContextResolved = true;
    airtableConfig = buildAirtableConfig();
    if (airtableConfig) {
      console.log(
        `[Brand Brain] Airtable: Base ${airtableConfig.baseId}, Tables:`,
        Object.entries(airtableConfig.tableMappings)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}→"${v}"`)
          .join(", ") || "(keine Table-Mappings)"
      );
    }
  }
  return airtableConfig;
}

/**
 * Airtable-Kontext zuruecksetzen (fuer Refresh-Endpoint).
 */
export function resetAirtableContext(): void {
  airtableContextResolved = false;
  airtableConfig = null;
}

// --- Haupt-Funktionen fuer den Loader ---

/**
 * Tone of Voice aus Airtable laden.
 */
export async function loadToneOfVoiceFromAirtable(): Promise<string | null> {
  const config = getAirtableContext();
  if (!config || !config.tableMappings.toneOfVoice) return null;

  try {
    const records = await listRecords(config, config.tableMappings.toneOfVoice);
    const tov = extractToneOfVoiceFromRecords(records);
    if (tov) {
      // In Cache schreiben
      setCachedFile("airtable:tone-of-voice", tov).catch(() => {});
    }
    return tov || null;
  } catch (err) {
    console.warn("[Brand Brain] Airtable TOV-Laden fehlgeschlagen:", err);
    return null;
  }
}

/**
 * CI-Rules aus Airtable laden.
 */
export async function loadCIRulesFromAirtable(): Promise<CIRules | null> {
  const config = getAirtableContext();
  if (!config || !config.tableMappings.ciRules) return null;

  try {
    const records = await listRecords(config, config.tableMappings.ciRules);
    const ciRules = extractCIRulesFromRecords(records);
    setCachedFile("airtable:ci-rules", JSON.stringify(ciRules)).catch(() => {});
    return ciRules;
  } catch (err) {
    console.warn("[Brand Brain] Airtable CI-Rules-Laden fehlgeschlagen:", err);
    return null;
  }
}

/**
 * Glossar aus Airtable laden (filtert nach Sprache).
 */
export async function loadGlossarFromAirtable(
  language: string
): Promise<GlossarData | null> {
  const config = getAirtableContext();
  if (!config || !config.tableMappings.glossar) return null;

  try {
    const records = await listRecords(config, config.tableMappings.glossar);
    const glossar = extractGlossarFromRecords(records, language);
    if (Object.keys(glossar.terms).length > 0) {
      setCachedFile(
        `airtable:glossar-${language}`,
        JSON.stringify(glossar)
      ).catch(() => {});
      return glossar;
    }
    return null;
  } catch (err) {
    console.warn("[Brand Brain] Airtable Glossar-Laden fehlgeschlagen:", err);
    return null;
  }
}

/**
 * Golden Examples aus Airtable laden.
 */
export async function loadGoldenExamplesFromAirtable(): Promise<GoldenExample[] | null> {
  const config = getAirtableContext();
  if (!config || !config.tableMappings.goldenExamples) return null;

  try {
    const records = await listRecords(config, config.tableMappings.goldenExamples);
    const examples = extractGoldenExamplesFromRecords(records);
    if (examples.length > 0) {
      setCachedFile(
        "airtable:golden-examples",
        JSON.stringify(examples)
      ).catch(() => {});
      return examples;
    }
    return null;
  } catch (err) {
    console.warn("[Brand Brain] Airtable Golden-Examples-Laden fehlgeschlagen:", err);
    return null;
  }
}
