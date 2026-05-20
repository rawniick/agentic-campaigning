// Airtable REST API Client
// Personal Access Token fuer Server-to-Server Zugriff

export interface AirtableConfig {
  token: string; // Personal Access Token
  baseId: string; // Airtable Base ID (z.B. "appXXXXXXXX")
  tableMappings: AirtableTableMappings; // Brand Brain Table-Zuordnung
}

// Welche Airtable-Tables fuer welche Brand Brain Daten genutzt werden
export interface AirtableTableMappings {
  toneOfVoice?: string; // Table-Name/ID fuer Tone of Voice
  ciRules?: string; // Table-Name/ID fuer CI-Rules
  glossar?: string; // Table-Name/ID fuer Glossar (alle Sprachen in einer Table)
  goldenExamples?: string; // Table-Name/ID fuer Golden Examples
}

export type AirtableErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "UNKNOWN";

export class AirtableError extends Error {
  constructor(
    public readonly code: AirtableErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "AirtableError";
  }
}

// Airtable Record Typen
export interface AirtableRecord<T = Record<string, unknown>> {
  id: string;
  fields: T;
  createdTime: string;
}

export interface AirtableListResponse<T = Record<string, unknown>> {
  records: AirtableRecord<T>[];
  offset?: string; // Pagination Cursor
}

export interface AirtableTable {
  id: string;
  name: string;
  description?: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
    description?: string;
  }>;
}

export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: string;
}

// --- Config Builder ---

/**
 * Airtable-Konfiguration aus Env-Vars erstellen.
 * Gibt null zurueck wenn nicht konfiguriert.
 */
export function buildAirtableConfig(): AirtableConfig | null {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;

  if (!token || !baseId) {
    return null;
  }

  return {
    token,
    baseId,
    tableMappings: {
      toneOfVoice: process.env.AIRTABLE_TABLE_TONE_OF_VOICE || undefined,
      ciRules: process.env.AIRTABLE_TABLE_CI_RULES || undefined,
      glossar: process.env.AIRTABLE_TABLE_GLOSSAR || undefined,
      goldenExamples: process.env.AIRTABLE_TABLE_GOLDEN_EXAMPLES || undefined,
    },
  };
}

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";
const AIRTABLE_META_API = "https://api.airtable.com/v0/meta";

// --- Token Verification ---

/**
 * Prueft ob ein Token grundsaetzlich gueltig ist, auch ohne Meta-API Scope.
 * Versucht einen Data-API Zugriff auf die Base — 404 = Token OK aber Table fehlt,
 * 401/403 = Token wirklich ungueltig.
 */
export async function verifyTokenViaDataApi(
  token: string,
  baseId: string
): Promise<boolean> {
  const response = await fetch(`${AIRTABLE_API_BASE}/${baseId}/__ping__`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  // 401/403 = Token ist wirklich ungueltig
  if (response.status === 401 || response.status === 403) {
    return false;
  }

  // Alles andere (404, 422, etc.) = Token funktioniert, nur Table existiert nicht
  return true;
}

// --- REST Client ---

/**
 * Generischer Airtable API Request mit Retry bei Rate-Limiting.
 */
async function airtableRequest<T>(
  config: AirtableConfig,
  path: string,
  options: { method?: string; body?: unknown; retries?: number } = {}
): Promise<T> {
  const { method = "GET", body, retries = 2 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(`${AIRTABLE_API_BASE}/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    // Rate-Limited: 30s warten (Airtable empfiehlt 30s)
    if (response.status === 429 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 30_000));
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      throw new AirtableError(
        "UNAUTHENTICATED",
        `Airtable Auth-Fehler (${response.status}): Token ungueltig oder keine Berechtigung`
      );
    }

    if (response.status === 404) {
      throw new AirtableError(
        "NOT_FOUND",
        `Airtable Ressource nicht gefunden: ${path}`
      );
    }

    if (response.status === 429) {
      throw new AirtableError("RATE_LIMITED", "Airtable Rate Limit erreicht (5 req/s)");
    }

    if (response.status === 422) {
      const errBody = await response.json().catch(() => ({}));
      throw new AirtableError(
        "INVALID_REQUEST",
        `Airtable Request ungueltig: ${JSON.stringify(errBody)}`
      );
    }

    if (!response.ok) {
      throw new AirtableError(
        "UNKNOWN",
        `Airtable HTTP-Fehler: ${response.status} ${response.statusText}`
      );
    }

    return (await response.json()) as T;
  }

  throw new AirtableError("RATE_LIMITED", "Airtable: Max Retries erreicht");
}

/**
 * Airtable Meta API Request (fuer Bases + Tables Discovery).
 */
async function airtableMetaRequest<T>(
  token: string,
  path: string
): Promise<T> {
  const response = await fetch(`${AIRTABLE_META_API}/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new AirtableError(
      "UNAUTHENTICATED",
      "Airtable Auth-Fehler: Token ungueltig oder keine Meta-API Berechtigung"
    );
  }

  if (!response.ok) {
    throw new AirtableError(
      "UNKNOWN",
      `Airtable Meta-API Fehler: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as T;
}

// --- API Functions ---

/**
 * Alle Records einer Table laden (mit Auto-Pagination).
 * Airtable liefert max 100 Records pro Request.
 */
export async function listRecords<T = Record<string, unknown>>(
  config: AirtableConfig,
  tableNameOrId: string,
  options?: {
    filterByFormula?: string;
    sort?: Array<{ field: string; direction?: "asc" | "desc" }>;
    fields?: string[];
    maxRecords?: number;
    view?: string;
  }
): Promise<AirtableRecord<T>[]> {
  const allRecords: AirtableRecord<T>[] = [];
  let offset: string | undefined;

  do {
    const params = new URLSearchParams();
    if (options?.filterByFormula) {
      params.set("filterByFormula", options.filterByFormula);
    }
    if (options?.sort) {
      options.sort.forEach((s, i) => {
        params.set(`sort[${i}][field]`, s.field);
        if (s.direction) params.set(`sort[${i}][direction]`, s.direction);
      });
    }
    if (options?.fields) {
      options.fields.forEach((f) => params.append("fields[]", f));
    }
    if (options?.maxRecords) {
      params.set("maxRecords", String(options.maxRecords));
    }
    if (options?.view) {
      params.set("view", options.view);
    }
    if (offset) {
      params.set("offset", offset);
    }

    const query = params.toString();
    const path = `${config.baseId}/${encodeURIComponent(tableNameOrId)}${query ? `?${query}` : ""}`;

    const response = await airtableRequest<AirtableListResponse<T>>(config, path);
    allRecords.push(...response.records);
    offset = response.offset;
  } while (offset);

  return allRecords;
}

/**
 * Alle Bases auflisten (benoetigt Meta API Scope: schema.bases:read).
 */
export async function listBases(token: string): Promise<AirtableBase[]> {
  const data = await airtableMetaRequest<{ bases: AirtableBase[] }>(
    token,
    "bases"
  );
  return data.bases;
}

/**
 * Tables einer Base auflisten (benoetigt Meta API Scope: schema.bases:read).
 */
export async function listTables(
  token: string,
  baseId: string
): Promise<AirtableTable[]> {
  const data = await airtableMetaRequest<{ tables: AirtableTable[] }>(
    token,
    `bases/${baseId}/tables`
  );
  return data.tables;
}

/**
 * Einzelnen Record laden.
 */
export async function getRecord<T = Record<string, unknown>>(
  config: AirtableConfig,
  tableNameOrId: string,
  recordId: string
): Promise<AirtableRecord<T>> {
  return airtableRequest<AirtableRecord<T>>(
    config,
    `${config.baseId}/${encodeURIComponent(tableNameOrId)}/${recordId}`
  );
}
