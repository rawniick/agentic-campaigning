import { promises as fs } from "fs";
import path from "path";
import {
  buildDriveConfig,
  listDriveFolder,
  fetchDriveFile,
  type DriveConfig,
  type DriveFileInfo,
} from "@/lib/integrations/google-drive";
import { getCachedFile, setCachedFile, getManualFile } from "./drive-cache";
import {
  loadToneOfVoiceFromFrontify,
  loadCIRulesFromFrontify,
  loadGlossarFromFrontify,
  resetFrontifyContext,
} from "./frontify-adapter";
import {
  loadToneOfVoiceFromAirtable,
  loadCIRulesFromAirtable,
  loadGlossarFromAirtable,
  loadGoldenExamplesFromAirtable,
  resetAirtableContext,
} from "./airtable-adapter";

// Brand Brain Dateien - Frontify + Google Drive + lokal als Quellen
export interface BrandBrainFiles {
  toneOfVoice: string;
  glossar: GlossarData;
  goldenExamples?: GoldenExample[];
  ciRules?: CIRules;
}

export interface GlossarTerm {
  use: string;
  wrong: string[];
  context: string;
}

export interface GlossarData {
  _meta: { version: string; language: string; description: string };
  terms: Record<string, GlossarTerm>;
}

// Struktur entspricht brand-brain/golden-examples.json
export interface GoldenExample {
  type: string;
  campaign_name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  notes?: string;
}

// Struktur entspricht brand-brain/ci-rules.json
export interface CIRules {
  _meta: { version: string; brand: string; description: string };
  colors: Record<string, unknown>;
  typography: Record<string, unknown>;
  logo: Record<string, unknown>;
  image_style: Record<string, unknown>;
  layout_rules: string[];
}

// Quellen-Typ fuer Brand Brain Dateien
export type BrandBrainSource = "manual" | "frontify" | "airtable" | "drive" | "local" | "cache" | "default";

// Lade-Ergebnis mit Quellen-Info
export interface LoadResult<T> {
  data: T;
  source: BrandBrainSource;
}

const BRAND_BRAIN_LOCAL_PATH = path.join(process.cwd(), "prompts", "brand");
const BRAND_BRAIN_FALLBACK_PATH = path.join(process.cwd(), "brand-brain");

// Drive-Konfiguration wird einmal pro Prozess aufgeloest (lazy)
let driveConfigResolved = false;
let driveConfig: DriveConfig | null = null;
let driveFiles: Map<string, DriveFileInfo> | null = null;

async function getDriveContext(): Promise<{
  config: DriveConfig;
  files: Map<string, DriveFileInfo>;
} | null> {
  if (!driveConfigResolved) {
    driveConfigResolved = true;
    driveConfig = buildDriveConfig();
    if (driveConfig) {
      try {
        driveFiles = await listDriveFolder(driveConfig);
      } catch (err) {
        console.warn("[Brand Brain] Drive-Ordner konnte nicht geladen werden:", err);
        driveConfig = null;
        driveFiles = null;
      }
    }
  }

  if (driveConfig && driveFiles) {
    return { config: driveConfig, files: driveFiles };
  }
  return null;
}

/**
 * Universeller Loader mit erweiterter Fallback-Kette:
 * 0. Manual-Upload (Supabase Storage manual/) → kein TTL, hoechste Prio
 * 1. Supabase Cache → falls TTL gueltig
 * 2. Google Drive → Cache schreiben → Content zurueck
 * 3. Filesystem: prompts/brand/{datei}
 * 4. Filesystem: brand-brain/{datei}
 * 5. Default-Wert
 *
 * Frontify wird NICHT hier verwendet — TOV und CI-Rules haben eigene
 * Frontify-aware Loader (loadToneOfVoice, loadCIRules).
 */
async function loadFileWithDriveFallback<T>(
  driveFilename: string,
  localFilenames: string[],
  parse: (raw: string) => T,
  defaultValue: T
): Promise<T> {
  // Stufe 0: Manual-Upload (hoechste Prioritaet, kein TTL)
  try {
    const manual = await getManualFile(driveFilename);
    if (manual !== null) {
      return parse(manual);
    }
  } catch {
    // Kein Manual-Upload, weiter
  }

  // Stufe 1 + 2: Drive-basiertes Laden
  const drive = await getDriveContext();
  if (drive) {
    const fileInfo = drive.files.get(driveFilename);
    if (fileInfo) {
      // Stufe 1: Cache pruefen
      try {
        const cached = await getCachedFile(driveFilename);
        if (cached !== null) {
          return parse(cached);
        }
      } catch (err) {
        console.warn(`[Brand Brain] Cache-Lesefehler fuer ${driveFilename}:`, err);
      }

      // Stufe 2: Aus Drive laden und cachen
      try {
        const content = await fetchDriveFile(
          drive.config,
          fileInfo.id,
          fileInfo.mimeType
        );
        // Cache async schreiben (nicht auf Ergebnis warten)
        setCachedFile(driveFilename, content, fileInfo.modifiedTime).catch((err) => {
          console.warn(`[Brand Brain] Cache-Schreibfehler fuer ${driveFilename}:`, err);
        });
        return parse(content);
      } catch (err) {
        console.warn(`[Brand Brain] Drive-Download fehlgeschlagen fuer ${driveFilename}:`, err);
        // Weiter zu Filesystem-Fallback
      }
    }
  }

  // Stufe 3 + 4: Filesystem-Fallback
  for (const filepath of localFilenames) {
    try {
      const content = await fs.readFile(filepath, "utf-8");
      return parse(content);
    } catch {
      // Naechsten Pfad versuchen
    }
  }

  // Stufe 5: Default
  return defaultValue;
}

/**
 * Glossar fuer eine Sprache laden.
 * Fallback-Kette: Manual → Cache → Frontify (optional) → Drive → Lokal → Default
 *
 * Frontify ist fuer Glossar optional — nur wenn eine Glossar-Page existiert.
 * Google Drive bleibt primaere Quelle fuer Glossar-Dateien.
 */
export async function loadGlossar(
  language: string
): Promise<GlossarData> {
  const driveFilename = `glossar-${language}.json`;
  const localPaths = [
    path.join(BRAND_BRAIN_LOCAL_PATH, driveFilename),
    path.join(BRAND_BRAIN_FALLBACK_PATH, driveFilename),
  ];
  const defaultGlossar: GlossarData = {
    _meta: { version: "0.0.0", language, description: "Fallback - kein Glossar gefunden" },
    terms: {},
  };

  // Stufe 0: Manual-Upload (hoechste Prioritaet)
  try {
    const manual = await getManualFile(driveFilename);
    if (manual !== null) {
      return JSON.parse(manual) as GlossarData;
    }
  } catch {
    // Kein Manual-Upload, weiter
  }

  // Cache pruefen (source-agnostisch)
  try {
    const cached = await getCachedFile(`frontify:glossar-${language}`);
    if (cached !== null) {
      return JSON.parse(cached) as GlossarData;
    }
  } catch {
    // Cache-Miss, weiter
  }

  // Frontify: Glossar optional (nur falls Glossar-Page konfiguriert)
  try {
    const frontifyGlossar = await loadGlossarFromFrontify(language);
    if (frontifyGlossar && Object.keys(frontifyGlossar.terms).length > 0) {
      // In Cache schreiben
      setCachedFile(
        `frontify:glossar-${language}`,
        JSON.stringify(frontifyGlossar)
      ).catch(() => {});

      // Frontify-Glossar mit Drive-Glossar mergen (Drive hat Vorrang)
      const driveGlossar = await loadFileWithDriveFallback(
        driveFilename,
        localPaths,
        (raw) => JSON.parse(raw) as GlossarData,
        defaultGlossar
      );

      // Merge: Drive-Terms ueberschreiben Frontify-Terms
      return {
        _meta: driveGlossar._meta.version !== "0.0.0" ? driveGlossar._meta : frontifyGlossar._meta,
        terms: { ...frontifyGlossar.terms, ...driveGlossar.terms },
      };
    }
  } catch (err) {
    console.warn(`[Brand Brain] Frontify Glossar-Laden fehlgeschlagen:`, err);
  }

  // Airtable: Glossar (nach Frontify, vor Drive)
  try {
    const airtableGlossar = await loadGlossarFromAirtable(language);
    if (airtableGlossar && Object.keys(airtableGlossar.terms).length > 0) {
      return airtableGlossar;
    }
  } catch (err) {
    console.warn(`[Brand Brain] Airtable Glossar-Laden fehlgeschlagen:`, err);
  }

  // Standard: Drive → Lokal → Default
  return loadFileWithDriveFallback(
    driveFilename,
    localPaths,
    (raw) => JSON.parse(raw) as GlossarData,
    defaultGlossar
  );
}

/**
 * Tone of Voice laden.
 * Fallback-Kette: Manual → Cache → Frontify → Drive → Lokal → Default
 *
 * Frontify ist primaere Quelle fuer TOV (strukturierte Guideline Pages).
 */
export async function loadToneOfVoice(): Promise<string> {
  const driveFilename = "tone-of-voice.md";
  const localPaths = [
    path.join(BRAND_BRAIN_LOCAL_PATH, driveFilename),
    path.join(BRAND_BRAIN_FALLBACK_PATH, driveFilename),
  ];
  const defaultTov = "# Tone of Voice\nKeine Datei gefunden. Standard-Tonalitaet verwenden.";

  // Stufe 0: Manual-Upload (hoechste Prioritaet)
  try {
    const manual = await getManualFile(driveFilename);
    if (manual !== null) {
      return manual;
    }
  } catch {
    // Kein Manual-Upload, weiter
  }

  // Cache pruefen (Frontify-spezifisch)
  try {
    const cached = await getCachedFile("frontify:tone-of-voice");
    if (cached !== null) {
      return cached;
    }
  } catch {
    // Cache-Miss, weiter
  }

  // Frontify: TOV aus Guideline Pages
  try {
    const frontifyTov = await loadToneOfVoiceFromFrontify();
    if (frontifyTov) {
      // In Cache schreiben
      setCachedFile("frontify:tone-of-voice", frontifyTov).catch(() => {});
      return frontifyTov;
    }
  } catch (err) {
    console.warn("[Brand Brain] Frontify TOV-Laden fehlgeschlagen:", err);
  }

  // Airtable: TOV (nach Frontify, vor Drive)
  try {
    const airtableTov = await loadToneOfVoiceFromAirtable();
    if (airtableTov) {
      return airtableTov;
    }
  } catch (err) {
    console.warn("[Brand Brain] Airtable TOV-Laden fehlgeschlagen:", err);
  }

  // Fallback: Drive → Lokal → Default
  return loadFileWithDriveFallback(
    driveFilename,
    localPaths,
    (raw) => raw,
    defaultTov
  );
}

// Golden Examples laden (optional) — Airtable + Drive + Lokal
export async function loadGoldenExamples(): Promise<GoldenExample[]> {
  const driveFilename = "golden-examples.json";
  const localPaths = [
    path.join(BRAND_BRAIN_LOCAL_PATH, driveFilename),
    path.join(BRAND_BRAIN_FALLBACK_PATH, driveFilename),
  ];

  // Airtable: Golden Examples
  try {
    const airtableExamples = await loadGoldenExamplesFromAirtable();
    if (airtableExamples && airtableExamples.length > 0) {
      return airtableExamples;
    }
  } catch (err) {
    console.warn("[Brand Brain] Airtable Golden-Examples-Laden fehlgeschlagen:", err);
  }

  return loadFileWithDriveFallback(
    driveFilename,
    localPaths,
    (raw) => JSON.parse(raw) as GoldenExample[],
    []
  );
}

/**
 * CI-Rules laden.
 * Fallback-Kette: Manual → Cache → Frontify → Drive → Lokal → Default
 *
 * Frontify ist primaere Quelle fuer CI-Rules (Farben, Typo, Logo aus Guideline Blocks).
 */
export async function loadCIRules(): Promise<CIRules | undefined> {
  const driveFilename = "ci-rules.json";
  const localPaths = [
    path.join(BRAND_BRAIN_LOCAL_PATH, driveFilename),
    path.join(BRAND_BRAIN_FALLBACK_PATH, driveFilename),
  ];

  // Stufe 0: Manual-Upload (hoechste Prioritaet)
  try {
    const manual = await getManualFile(driveFilename);
    if (manual !== null) {
      return JSON.parse(manual) as CIRules;
    }
  } catch {
    // Kein Manual-Upload, weiter
  }

  // Cache pruefen (Frontify-spezifisch)
  try {
    const cached = await getCachedFile("frontify:ci-rules");
    if (cached !== null) {
      return JSON.parse(cached) as CIRules;
    }
  } catch {
    // Cache-Miss, weiter
  }

  // Frontify: CI-Rules aus Guideline Pages (Farben, Typo, Logo)
  try {
    const frontifyCIRules = await loadCIRulesFromFrontify();
    if (frontifyCIRules) {
      // In Cache schreiben
      setCachedFile(
        "frontify:ci-rules",
        JSON.stringify(frontifyCIRules)
      ).catch(() => {});
      return frontifyCIRules;
    }
  } catch (err) {
    console.warn("[Brand Brain] Frontify CI-Rules-Laden fehlgeschlagen:", err);
  }

  // Airtable: CI-Rules (nach Frontify, vor Drive)
  try {
    const airtableCIRules = await loadCIRulesFromAirtable();
    if (airtableCIRules) {
      return airtableCIRules;
    }
  } catch (err) {
    console.warn("[Brand Brain] Airtable CI-Rules-Laden fehlgeschlagen:", err);
  }

  // Fallback: Drive → Lokal → Default
  return loadFileWithDriveFallback(
    driveFilename,
    localPaths,
    (raw) => JSON.parse(raw) as CIRules,
    undefined
  );
}

// Alle Brand Brain Dateien fuer eine Sprache laden
export async function loadBrandBrain(
  language: string = "de"
): Promise<BrandBrainFiles> {
  const [toneOfVoice, glossar, goldenExamples, ciRules] = await Promise.all([
    loadToneOfVoice(),
    loadGlossar(language),
    loadGoldenExamples(),
    loadCIRules(),
  ]);

  return { toneOfVoice, glossar, goldenExamples, ciRules };
}

/**
 * Alle Kontexte zuruecksetzen (Drive + Frontify).
 * Wird vom Refresh-Endpoint genutzt.
 */
export function resetDriveContext(): void {
  driveConfigResolved = false;
  driveConfig = null;
  driveFiles = null;
}

/**
 * Alle Brand Brain Quellen zuruecksetzen (Drive + Frontify + Cache).
 * Erweiterte Version von resetDriveContext.
 */
export function resetAllSources(): void {
  resetDriveContext();
  resetFrontifyContext();
  resetAirtableContext();
}
