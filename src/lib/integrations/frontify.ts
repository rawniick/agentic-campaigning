// Frontify GraphQL API Client
// Personal Developer Token fuer Server-to-Server Zugriff

export interface FrontifyConfig {
  domain: string; // z.B. "acme.frontify.com"
  token: string; // Personal Developer Token
  brandId?: string; // Optional, wird per Auto-Discovery gefunden
}

export type FrontifyErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "QUERY_ERROR"
  | "UNKNOWN";

export class FrontifyError extends Error {
  constructor(
    public readonly code: FrontifyErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "FrontifyError";
  }
}

// --- Content Block Types aus Frontify Guidelines ---

export interface FrontifyTextBlock {
  __typename: "TextBlock";
  content: string; // HTML oder Richtext
}

export interface FrontifyColorValue {
  hex: string;
  name: string | null;
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export interface FrontifyColorBlock {
  __typename: "ColorBlock";
  colors: FrontifyColorValue[];
}

export interface FrontifyTypographyBlock {
  __typename: "TypographyBlock";
  family: string;
  weight: string;
  size: string | null;
  lineHeight: string | null;
  letterSpacing: string | null;
}

export interface FrontifyDoDontBlock {
  __typename: "DoDontBlock";
  doItems: string[];
  dontItems: string[];
}

export interface FrontifyImageBlock {
  __typename: "ImageBlock";
  assets: Array<{
    id: string;
    title: string;
    downloadUrl: string;
    previewUrl: string;
  }>;
}

export interface FrontifyCalloutBlock {
  __typename: "CalloutBlock";
  type: string; // "info" | "warning" | "tip"
  content: string;
}

export interface FrontifyTableBlock {
  __typename: "TableBlock";
  rows: Array<{ cells: string[] }>;
}

export type FrontifyContentBlock =
  | FrontifyTextBlock
  | FrontifyColorBlock
  | FrontifyTypographyBlock
  | FrontifyDoDontBlock
  | FrontifyImageBlock
  | FrontifyCalloutBlock
  | FrontifyTableBlock
  | { __typename: string; [key: string]: unknown };

export interface FrontifyGuidelinePage {
  id: string;
  title: string;
  blocks: FrontifyContentBlock[];
}

export interface FrontifyGuideline {
  id: string;
  title: string;
  pages: Array<{ id: string; title: string }>;
}

export interface FrontifyBrand {
  id: string;
  name: string;
  guidelines: FrontifyGuideline[];
}

export interface FrontifyAsset {
  id: string;
  title: string;
  filename: string;
  downloadUrl: string;
  previewUrl: string;
  tags: string[];
  description: string | null;
}

// --- Config Builder ---

/**
 * Frontify-Konfiguration aus Env-Vars erstellen.
 * Gibt null zurueck wenn nicht konfiguriert (= andere Quellen nutzen).
 */
export function buildFrontifyConfig(): FrontifyConfig | null {
  const domain = process.env.FRONTIFY_DOMAIN;
  const token = process.env.FRONTIFY_TOKEN;

  if (!domain || !token) {
    return null;
  }

  return {
    domain,
    token,
    brandId: process.env.FRONTIFY_BRAND_ID || undefined,
  };
}

// --- GraphQL Client ---

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; extensions?: Record<string, unknown> }>;
}

/**
 * Generischer GraphQL-Request gegen die Frontify API.
 * Retry bei Rate-Limiting (max 2 Versuche).
 */
async function graphqlRequest<T>(
  config: FrontifyConfig,
  query: string,
  variables?: Record<string, unknown>,
  retries = 2
): Promise<T> {
  const endpoint = `https://${config.domain}/graphql`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (response.status === 429 && attempt < retries) {
      // Rate-Limited: kurz warten und nochmal
      const retryAfter = parseInt(response.headers.get("retry-after") ?? "2", 10);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      throw new FrontifyError(
        "UNAUTHENTICATED",
        `Frontify Auth-Fehler (${response.status}): Token ungueltig oder abgelaufen`
      );
    }

    if (response.status === 429) {
      throw new FrontifyError("RATE_LIMITED", "Frontify Rate Limit erreicht");
    }

    if (!response.ok) {
      throw new FrontifyError(
        "UNKNOWN",
        `Frontify HTTP-Fehler: ${response.status} ${response.statusText}`
      );
    }

    const json = (await response.json()) as GraphQLResponse<T>;

    if (json.errors && json.errors.length > 0) {
      const errorMsg = json.errors.map((e) => e.message).join("; ");
      throw new FrontifyError("QUERY_ERROR", `Frontify GraphQL-Fehler: ${errorMsg}`);
    }

    if (!json.data) {
      throw new FrontifyError("UNKNOWN", "Frontify: Leere Response ohne Fehler");
    }

    return json.data;
  }

  throw new FrontifyError("RATE_LIMITED", "Frontify: Max Retries erreicht");
}

// --- Queries ---

const BRANDS_QUERY = `
  query ListBrands {
    brands {
      items {
        id
        name
      }
    }
  }
`;

const BRAND_GUIDELINES_QUERY = `
  query BrandGuidelines($brandId: ID!) {
    brand(id: $brandId) {
      id
      name
      guidelines {
        id
        title
        pages {
          id
          title
        }
      }
    }
  }
`;

// Guideline Page mit allen Content Blocks
const GUIDELINE_PAGE_QUERY = `
  query GuidelinePage($pageId: ID!) {
    node(id: $pageId) {
      ... on GuidelinePage {
        id
        title
        blocks {
          __typename
          ... on TextBlock {
            content
          }
          ... on ColorBlock {
            colors {
              hex
              name
              red
              green
              blue
              alpha
            }
          }
          ... on TypographyBlock {
            family
            weight
            size
            lineHeight
            letterSpacing
          }
          ... on DoDontBlock {
            doItems
            dontItems
          }
          ... on CalloutBlock {
            type
            content
          }
          ... on TableBlock {
            rows {
              cells
            }
          }
          ... on ImageBlock {
            assets {
              id
              title
              downloadUrl
              previewUrl
            }
          }
        }
      }
    }
  }
`;

// --- API Functions ---

/**
 * Alle Brands im Frontify Account auflisten.
 */
export async function fetchBrands(
  config: FrontifyConfig
): Promise<FrontifyBrand[]> {
  const data = await graphqlRequest<{
    brands: { items: Array<{ id: string; name: string }> };
  }>(config, BRANDS_QUERY);

  // Brands kommen ohne guidelines, nur ID + Name
  return data.brands.items.map((b) => ({
    ...b,
    guidelines: [],
  }));
}

/**
 * Brand mit Guidelines und Page-Struktur laden.
 * Falls brandId nicht in Config: nimmt den ersten Brand.
 */
export async function fetchBrandWithGuidelines(
  config: FrontifyConfig
): Promise<FrontifyBrand> {
  let brandId = config.brandId;

  // Auto-Discovery: ersten Brand nehmen
  if (!brandId) {
    const brands = await fetchBrands(config);
    if (brands.length === 0) {
      throw new FrontifyError("NOT_FOUND", "Keine Brands in Frontify gefunden");
    }
    brandId = brands[0].id;
  }

  const data = await graphqlRequest<{ brand: FrontifyBrand }>(
    config,
    BRAND_GUIDELINES_QUERY,
    { brandId }
  );

  if (!data.brand) {
    throw new FrontifyError("NOT_FOUND", `Brand ${brandId} nicht gefunden`);
  }

  return data.brand;
}

/**
 * Guideline Page mit allen Content Blocks laden.
 */
export async function fetchGuidelinePage(
  config: FrontifyConfig,
  pageId: string
): Promise<FrontifyGuidelinePage> {
  const data = await graphqlRequest<{ node: FrontifyGuidelinePage }>(
    config,
    GUIDELINE_PAGE_QUERY,
    { pageId }
  );

  if (!data.node) {
    throw new FrontifyError("NOT_FOUND", `Guideline Page ${pageId} nicht gefunden`);
  }

  return data.node;
}

// --- Page Discovery (Titel-basiert) ---

// Bekannte Titel-Patterns fuer Auto-Mapping
const PAGE_TITLE_PATTERNS: Record<string, RegExp> = {
  "tone-of-voice": /tone\s*of\s*voice|tonali(ty|taet)|sprach(e|regeln)|brand\s*voice/i,
  "ci-rules": /corporate\s*identity|ci[-\s]?rules|brand\s*guidelines|visual\s*identity|design\s*system/i,
  "colors": /farb(en|palette)|colors?|colour/i,
  "typography": /typogra(fie|phy)|schrift(en)?|fonts?/i,
  "logo": /logo(s|usage|regeln)?/i,
  "dos-donts": /do('?s)?\s*(and|&|und)\s*don'?t/i,
  "glossar": /gloss?ar|terminolog(ie|y)|wording/i,
};

export interface PageMapping {
  pageId: string;
  pageTitle: string;
  mappedTo: string; // z.B. "tone-of-voice", "ci-rules"
}

/**
 * Guideline Pages automatisch nach Titel-Keywords mappen.
 * Durchsucht alle Guidelines und Pages eines Brands.
 */
export async function discoverPageMappings(
  config: FrontifyConfig
): Promise<PageMapping[]> {
  const brand = await fetchBrandWithGuidelines(config);
  const mappings: PageMapping[] = [];

  for (const guideline of brand.guidelines) {
    for (const page of guideline.pages) {
      for (const [key, pattern] of Object.entries(PAGE_TITLE_PATTERNS)) {
        if (pattern.test(page.title)) {
          mappings.push({
            pageId: page.id,
            pageTitle: page.title,
            mappedTo: key,
          });
          break; // Nur erstes Match pro Page
        }
      }
    }
  }

  return mappings;
}

/**
 * Spezifische Pages nach Mapping-Key suchen und laden.
 * Gibt null zurueck wenn keine passende Page gefunden.
 */
export async function fetchMappedPage(
  config: FrontifyConfig,
  mappingKey: string,
  cachedMappings?: PageMapping[]
): Promise<FrontifyGuidelinePage | null> {
  const mappings = cachedMappings ?? (await discoverPageMappings(config));
  const mapping = mappings.find((m) => m.mappedTo === mappingKey);

  if (!mapping) {
    return null;
  }

  return fetchGuidelinePage(config, mapping.pageId);
}
