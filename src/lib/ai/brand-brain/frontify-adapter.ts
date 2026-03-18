// Frontify → BrandBrain Adapter
// Transformiert Frontify Guideline Pages in bestehende BrandBrain-Interfaces

import type {
  FrontifyConfig,
  FrontifyGuidelinePage,
  FrontifyContentBlock,
  FrontifyTextBlock,
  FrontifyColorBlock,
  FrontifyTypographyBlock,
  FrontifyDoDontBlock,
  FrontifyCalloutBlock,
  FrontifyTableBlock,
  PageMapping,
} from "@/lib/integrations/frontify";
import {
  buildFrontifyConfig,
  discoverPageMappings,
  fetchGuidelinePage,
} from "@/lib/integrations/frontify";
import type { CIRules, GlossarData } from "./loader";

// --- Content Block Extraction Helpers ---

/**
 * Alle Text-Blocks einer Page als Markdown zusammenfuegen.
 * Frontify liefert HTML — wird zu vereinfachtem Markdown konvertiert.
 */
function extractTextContent(blocks: FrontifyContentBlock[]): string {
  return blocks
    .filter((b): b is FrontifyTextBlock => b.__typename === "TextBlock")
    .map((b) => htmlToSimpleMarkdown(b.content))
    .join("\n\n");
}

/**
 * Vereinfachte HTML-zu-Markdown-Konvertierung fuer Frontify Text Blocks.
 * Deckt die gaengigsten Tags ab die in Guideline-Texten vorkommen.
 */
function htmlToSimpleMarkdown(html: string): string {
  return html
    // Block-Elemente zuerst
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n")
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n")
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n")
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, "#### $1\n")
    .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
    .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Inline-Elemente
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*")
    .replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*")
    .replace(/<code[^>]*>(.*?)<\/code>/gi, "`$1`")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)")
    // Restliche Tags entfernen
    .replace(/<[^>]+>/g, "")
    // HTML-Entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Mehrfache Leerzeilen bereinigen
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Farben aus ColorBlock extrahieren und als strukturiertes Objekt zurueckgeben.
 */
function extractColors(blocks: FrontifyContentBlock[]): Record<string, unknown> {
  const colorBlocks = blocks.filter(
    (b): b is FrontifyColorBlock => b.__typename === "ColorBlock"
  );

  if (colorBlocks.length === 0) return {};

  // Alle Farben sammeln
  const allColors = colorBlocks.flatMap((b) => b.colors);

  // Versuche Primaer/Sekundaer/Akzent zuzuordnen
  const result: Record<string, unknown> = {};
  const usageRules: string[] = [];

  for (const color of allColors) {
    const nameLower = (color.name ?? "").toLowerCase();

    if (
      nameLower.includes("primary") ||
      nameLower.includes("primaer") ||
      nameLower.includes("haupt")
    ) {
      result.primary = color.hex;
      result.primary_name = color.name;
    } else if (
      nameLower.includes("secondary") ||
      nameLower.includes("sekundaer") ||
      nameLower.includes("neben")
    ) {
      result.secondary = color.hex;
      result.secondary_name = color.name;
    } else if (
      nameLower.includes("accent") ||
      nameLower.includes("akzent") ||
      nameLower.includes("highlight")
    ) {
      result.accent = color.hex;
      result.accent_name = color.name;
    } else if (
      nameLower.includes("background") ||
      nameLower.includes("hintergrund") ||
      nameLower.includes("bg")
    ) {
      result.background = color.hex;
    } else if (
      nameLower.includes("text") ||
      nameLower.includes("body") ||
      nameLower.includes("schrift")
    ) {
      result.text = color.hex;
    }
  }

  // Falls keine semantischen Namen: nach Position zuordnen
  if (!result.primary && allColors.length > 0) {
    result.primary = allColors[0].hex;
    result.primary_name = allColors[0].name;
  }
  if (!result.secondary && allColors.length > 1) {
    result.secondary = allColors[1].hex;
    result.secondary_name = allColors[1].name;
  }
  if (!result.accent && allColors.length > 2) {
    result.accent = allColors[2].hex;
    result.accent_name = allColors[2].name;
  }

  result.usage_rules = usageRules;

  // Alle Farben als Referenz mitgeben
  result._all_colors = allColors.map((c) => ({
    hex: c.hex,
    name: c.name,
  }));

  return result;
}

/**
 * Typografie-Infos aus TypographyBlock extrahieren.
 */
function extractTypography(blocks: FrontifyContentBlock[]): Record<string, unknown> {
  const typoBlocks = blocks.filter(
    (b): b is FrontifyTypographyBlock => b.__typename === "TypographyBlock"
  );

  if (typoBlocks.length === 0) return {};

  const result: Record<string, unknown> = {};
  const rules: string[] = [];

  // Erster Block = Headline-Font, zweiter = Body-Font (Konvention)
  if (typoBlocks.length >= 1) {
    result.headline_font = `${typoBlocks[0].family}-${typoBlocks[0].weight}`;
    if (typoBlocks[0].size) {
      result.headline_sizes = { hero: typoBlocks[0].size };
    }
  }
  if (typoBlocks.length >= 2) {
    result.body_font = `${typoBlocks[1].family}-${typoBlocks[1].weight}`;
    if (typoBlocks[1].size) {
      result.body_size = typoBlocks[1].size;
    }
  }

  // Zeilen-/Buchstabenabstand als Regeln
  for (const block of typoBlocks) {
    if (block.lineHeight) {
      rules.push(`Zeilenabstand: ${block.lineHeight} (${block.family})`);
    }
    if (block.letterSpacing) {
      rules.push(`Buchstabenabstand: ${block.letterSpacing} (${block.family})`);
    }
  }

  result.rules = rules;

  return result;
}

/**
 * Do/Don't Blocks als Regellisten extrahieren.
 */
function extractDosAndDonts(
  blocks: FrontifyContentBlock[]
): { dos: string[]; donts: string[] } {
  const doDontBlocks = blocks.filter(
    (b): b is FrontifyDoDontBlock => b.__typename === "DoDontBlock"
  );

  return {
    dos: doDontBlocks.flatMap((b) => b.doItems),
    donts: doDontBlocks.flatMap((b) => b.dontItems),
  };
}

/**
 * Callout Blocks extrahieren (Tipps, Warnungen, Infos).
 */
function extractCallouts(
  blocks: FrontifyContentBlock[]
): Array<{ type: string; content: string }> {
  return blocks
    .filter((b): b is FrontifyCalloutBlock => b.__typename === "CalloutBlock")
    .map((b) => ({ type: b.type, content: htmlToSimpleMarkdown(b.content) }));
}

/**
 * Table Blocks extrahieren (z.B. Kanal-Tonalitaets-Matrix).
 */
function extractTables(
  blocks: FrontifyContentBlock[]
): Array<{ rows: Array<{ cells: string[] }> }> {
  return blocks
    .filter((b): b is FrontifyTableBlock => b.__typename === "TableBlock")
    .map((b) => ({ rows: b.rows }));
}

// --- BrandBrain Mapping Functions ---

/**
 * Tone of Voice aus Frontify Guideline Page extrahieren.
 * Kombiniert Text-Blocks, Do/Don't-Blocks und Tabellen zu Markdown.
 */
export function extractToneOfVoice(page: FrontifyGuidelinePage): string {
  const parts: string[] = [`# ${page.title}`];

  // Haupt-Text (Kernwerte, Sprachregeln etc.)
  const textContent = extractTextContent(page.blocks);
  if (textContent) {
    parts.push(textContent);
  }

  // Do's and Don'ts als separate Sektionen
  const { dos, donts } = extractDosAndDonts(page.blocks);
  if (dos.length > 0) {
    parts.push("## DO");
    parts.push(dos.map((d) => `- ${htmlToSimpleMarkdown(d)}`).join("\n"));
  }
  if (donts.length > 0) {
    parts.push("## DON'T");
    parts.push(donts.map((d) => `- ${htmlToSimpleMarkdown(d)}`).join("\n"));
  }

  // Callouts als Hinweise
  const callouts = extractCallouts(page.blocks);
  for (const callout of callouts) {
    const prefix =
      callout.type === "warning"
        ? "WICHTIG"
        : callout.type === "tip"
          ? "TIPP"
          : "HINWEIS";
    parts.push(`> **${prefix}:** ${callout.content}`);
  }

  // Tabellen (z.B. Kanal-Tonalitaets-Matrix)
  const tables = extractTables(page.blocks);
  for (const table of tables) {
    if (table.rows.length > 0) {
      // Erste Zeile als Header
      const header = table.rows[0].cells;
      parts.push(`| ${header.join(" | ")} |`);
      parts.push(`|${header.map(() => "-------").join("|")}|`);
      for (const row of table.rows.slice(1)) {
        parts.push(`| ${row.cells.join(" | ")} |`);
      }
    }
  }

  return parts.join("\n\n");
}

/**
 * CI-Rules aus mehreren Frontify Pages zusammenbauen.
 * Erwartet separate Pages fuer Colors, Typography, Logo oder eine kombinierte CI-Page.
 */
export function extractCIRules(
  pages: Array<{ key: string; page: FrontifyGuidelinePage }>
): CIRules {
  let colors: Record<string, unknown> = {};
  let typography: Record<string, unknown> = {};
  const logo: Record<string, unknown> = {};
  const imageStyle: Record<string, unknown> = {};
  const layoutRules: string[] = [];

  for (const { key, page } of pages) {
    switch (key) {
      case "colors":
        colors = { ...colors, ...extractColors(page.blocks) };
        break;

      case "typography":
        typography = { ...typography, ...extractTypography(page.blocks) };
        break;

      case "logo": {
        const { dos, donts } = extractDosAndDonts(page.blocks);
        const text = extractTextContent(page.blocks);
        // Placement aus Text extrahieren
        if (text) {
          logo.placement = text.split("\n")[0]; // Erste Zeile als Placement-Hinweis
        }
        if (dos.length > 0) {
          logo.background_rules = dos.map((d) => htmlToSimpleMarkdown(d));
        }
        if (donts.length > 0) {
          logo.forbidden = donts.map((d) => htmlToSimpleMarkdown(d));
        }
        break;
      }

      case "ci-rules": {
        // Kombinierte CI-Page: alles extrahieren
        const ciColors = extractColors(page.blocks);
        const ciTypo = extractTypography(page.blocks);
        const { dos: ciDos, donts: ciDonts } = extractDosAndDonts(page.blocks);

        if (Object.keys(ciColors).length > 0) colors = { ...colors, ...ciColors };
        if (Object.keys(ciTypo).length > 0) typography = { ...typography, ...ciTypo };
        if (ciDonts.length > 0) logo.forbidden = ciDonts.map((d) => htmlToSimpleMarkdown(d));
        if (ciDos.length > 0) layoutRules.push(...ciDos.map((d) => htmlToSimpleMarkdown(d)));

        // Text-Content als Layout-Regeln
        const ciText = extractTextContent(page.blocks);
        if (ciText) {
          const textRules = ciText
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line.startsWith("- "))
            .map((line) => line.replace(/^-\s*/, ""));
          layoutRules.push(...textRules);
        }
        break;
      }

      case "dos-donts": {
        const { donts: globalDonts } = extractDosAndDonts(page.blocks);
        if (globalDonts.length > 0) {
          layoutRules.push(
            ...globalDonts.map((d) => `NICHT: ${htmlToSimpleMarkdown(d)}`)
          );
        }
        break;
      }
    }
  }

  return {
    _meta: {
      version: "frontify",
      brand: pages[0]?.page.title ?? "unknown",
      description: "CI-Rules aus Frontify Guidelines extrahiert",
    },
    colors,
    typography,
    logo,
    image_style: imageStyle,
    layout_rules: layoutRules,
  };
}

/**
 * Glossar aus Frontify Guideline Page extrahieren (optional).
 * Versucht Do/Don't Blocks und Tabellen als Glossar-Eintraege zu interpretieren.
 */
export function extractGlossar(
  page: FrontifyGuidelinePage,
  language: string
): GlossarData {
  const terms: Record<string, { use: string; wrong: string[]; context: string }> = {};

  // Do/Don't Blocks → Glossar-Terms
  const { dos, donts } = extractDosAndDonts(page.blocks);
  for (let i = 0; i < dos.length; i++) {
    const doItem = htmlToSimpleMarkdown(dos[i]);
    const dontItem = i < donts.length ? htmlToSimpleMarkdown(donts[i]) : "";
    terms[doItem] = {
      use: doItem,
      wrong: dontItem ? [dontItem] : [],
      context: "Aus Frontify Guideline importiert",
    };
  }

  // Tabellen → Glossar-Terms (Spalten: Term | Richtig | Falsch | Kontext)
  const tables = extractTables(page.blocks);
  for (const table of tables) {
    // Erste Zeile = Header ueberspringen
    for (const row of table.rows.slice(1)) {
      if (row.cells.length >= 2) {
        const term = row.cells[0].trim();
        const use = row.cells[1].trim();
        const wrong = row.cells.length > 2 ? row.cells[2].split(/[,;]/).map((w) => w.trim()).filter(Boolean) : [];
        const context = row.cells.length > 3 ? row.cells[3].trim() : "Aus Frontify Glossar";
        terms[term] = { use, wrong, context };
      }
    }
  }

  return {
    _meta: {
      version: "frontify",
      language,
      description: `Glossar (${language}) aus Frontify Guidelines extrahiert`,
    },
    terms,
  };
}

// --- Lazy-Loaded Frontify Context ---

let frontifyContextResolved = false;
let frontifyConfig: FrontifyConfig | null = null;
let frontifyMappings: PageMapping[] | null = null;

/**
 * Frontify-Kontext lazy initialisieren (einmal pro Prozess).
 * Laedt Config und Page-Mappings.
 */
export async function getFrontifyContext(): Promise<{
  config: FrontifyConfig;
  mappings: PageMapping[];
} | null> {
  if (!frontifyContextResolved) {
    frontifyContextResolved = true;
    frontifyConfig = buildFrontifyConfig();

    if (frontifyConfig) {
      try {
        frontifyMappings = await discoverPageMappings(frontifyConfig);
        console.log(
          `[Brand Brain] Frontify: ${frontifyMappings.length} Pages gemappt:`,
          frontifyMappings.map((m) => `${m.mappedTo} → "${m.pageTitle}"`).join(", ")
        );
      } catch (err) {
        console.warn("[Brand Brain] Frontify Page-Discovery fehlgeschlagen:", err);
        frontifyConfig = null;
        frontifyMappings = null;
      }
    }
  }

  if (frontifyConfig && frontifyMappings) {
    return { config: frontifyConfig, mappings: frontifyMappings };
  }
  return null;
}

/**
 * Frontify-Kontext zuruecksetzen (fuer Refresh-Endpoint).
 */
export function resetFrontifyContext(): void {
  frontifyContextResolved = false;
  frontifyConfig = null;
  frontifyMappings = null;
}

// --- Haupt-Funktionen fuer den Loader ---

/**
 * Tone of Voice aus Frontify laden.
 * Sucht nach Pages mit Tone-of-Voice-Keywords.
 */
export async function loadToneOfVoiceFromFrontify(): Promise<string | null> {
  const ctx = await getFrontifyContext();
  if (!ctx) return null;

  const mapping = ctx.mappings.find((m) => m.mappedTo === "tone-of-voice");
  if (!mapping) return null;

  try {
    const page = await fetchGuidelinePage(ctx.config, mapping.pageId);
    return extractToneOfVoice(page);
  } catch (err) {
    console.warn("[Brand Brain] Frontify TOV-Laden fehlgeschlagen:", err);
    return null;
  }
}

/**
 * CI-Rules aus Frontify laden.
 * Sammelt Daten aus allen relevanten Pages (Colors, Typography, Logo, CI-Rules).
 */
export async function loadCIRulesFromFrontify(): Promise<CIRules | null> {
  const ctx = await getFrontifyContext();
  if (!ctx) return null;

  const relevantKeys = ["ci-rules", "colors", "typography", "logo", "dos-donts"];
  const relevantMappings = ctx.mappings.filter((m) =>
    relevantKeys.includes(m.mappedTo)
  );

  if (relevantMappings.length === 0) return null;

  try {
    // Alle relevanten Pages parallel laden
    const pageResults = await Promise.all(
      relevantMappings.map(async (mapping) => {
        const page = await fetchGuidelinePage(ctx.config, mapping.pageId);
        return { key: mapping.mappedTo, page };
      })
    );

    return extractCIRules(pageResults);
  } catch (err) {
    console.warn("[Brand Brain] Frontify CI-Rules-Laden fehlgeschlagen:", err);
    return null;
  }
}

/**
 * Glossar aus Frontify laden (optional, falls eine Glossar-Page existiert).
 */
export async function loadGlossarFromFrontify(
  language: string
): Promise<GlossarData | null> {
  const ctx = await getFrontifyContext();
  if (!ctx) return null;

  const mapping = ctx.mappings.find((m) => m.mappedTo === "glossar");
  if (!mapping) return null;

  try {
    const page = await fetchGuidelinePage(ctx.config, mapping.pageId);
    return extractGlossar(page, language);
  } catch (err) {
    console.warn("[Brand Brain] Frontify Glossar-Laden fehlgeschlagen:", err);
    return null;
  }
}
