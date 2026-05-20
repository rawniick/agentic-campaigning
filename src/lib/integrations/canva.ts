// Canva Connect API Integration
// Mock-Modus wenn Env-Vars fehlen oder kein Mapping konfiguriert ist.

export interface CanvaConfig {
  clientId: string;
  clientSecret: string;
}

export interface CanvaTemplate {
  id: string;
  name: string;
  channel: string;
  format: string;
  width: number;
  height: number;
}

export interface CanvaDesign {
  id: string;
  templateId: string;
  status: "rendering" | "completed" | "failed";
  exportUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
}

export type CanvaErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "TEMPLATE_ERROR"
  | "UNKNOWN";

export class CanvaError extends Error {
  constructor(
    public readonly code: CanvaErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "CanvaError";
  }
}

// Format-Matrix: Kanal -> Formate mit Dimensionen
const FORMAT_MATRIX: Record<string, { format: string; width: number; height: number }[]> = {
  social: [
    { format: "feed", width: 1080, height: 1080 },
    { format: "story", width: 1080, height: 1920 },
  ],
  crm: [
    { format: "newsletter", width: 600, height: 400 },
    { format: "hero", width: 600, height: 200 },
  ],
  website: [
    { format: "banner", width: 1920, height: 600 },
    { format: "hero", width: 1440, height: 600 },
  ],
  sea: [
    { format: "text_only", width: 0, height: 0 },
  ],
  print: [
    { format: "poster", width: 2480, height: 3508 }, // A4 @ 300dpi
  ],
};

// Mock-Templates fuer jeden Kanal/Format
const MOCK_TEMPLATES: CanvaTemplate[] = Object.entries(FORMAT_MATRIX).flatMap(
  ([channel, formats]) =>
    formats.map((f) => ({
      id: `tmpl_${channel}_${f.format}`,
      name: `Mock Template ${channel} ${f.format}`,
      channel,
      format: f.format,
      width: f.width,
      height: f.height,
    }))
);

/**
 * Canva-Konfiguration aus Env-Vars erstellen.
 * Gibt null zurueck wenn nicht konfiguriert (= Mock-Modus).
 */
export function buildCanvaConfig(): CanvaConfig | null {
  const clientId = process.env.CANVA_CLIENT_ID;
  const clientSecret = process.env.CANVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
}

/**
 * Verfuegbare Templates auflisten, optional nach Kanal gefiltert.
 * Quelle: User-konfigurierte Mappings in canva_template_mappings (UI: /settings/canva).
 * Fallback: Mock-Templates (fuer Dev ohne Canva-Verbindung).
 */
export async function listTemplates(
  _config: CanvaConfig | null,
  channel?: string,
  brand?: string
): Promise<CanvaTemplate[]> {
  // 1. DB-Mappings: User hat Templates manuell zugeordnet
  if (brand) {
    try {
      const { getMappingsByBrand } = await import("@/lib/db/queries/canva-mappings");
      const mappings = await getMappingsByBrand(brand);
      if (mappings.length > 0) {
        const fromMappings: CanvaTemplate[] = mappings.map((m) => {
          const formatDef = FORMAT_MATRIX[m.channel]?.find((f) => f.format === m.format);
          return {
            id: m.canva_template_id,
            name: m.canva_template_name ?? m.canva_template_id,
            channel: m.channel,
            format: m.format,
            width: formatDef?.width ?? 0,
            height: formatDef?.height ?? 0,
          };
        });
        if (channel) {
          return fromMappings.filter((t) => t.channel === channel);
        }
        return fromMappings;
      }
    } catch {
      // DB nicht erreichbar — weiter mit Mock
    }
  }

  // 2. Mock-Modus
  if (channel) {
    return MOCK_TEMPLATES.filter((t) => t.channel === channel);
  }
  return MOCK_TEMPLATES;
}

/**
 * Template mit Content fuellen und Design erstellen.
 * Delegiert an echte Canva API wenn Brand-Token vorhanden, sonst Mock.
 */
export async function fillTemplate(
  _config: CanvaConfig | null,
  templateId: string,
  content: Record<string, string>,
  brand?: string
): Promise<CanvaDesign> {
  // Echte Canva API versuchen
  if (brand) {
    try {
      const { isCanvaAvailable, createDesignFromTemplate, exportDesign } = await import("./canva-api");
      const available = await isCanvaAvailable(brand);
      if (available) {
        const autofillResult = await createDesignFromTemplate(brand, templateId, content);
        const exportResult = await exportDesign(brand, autofillResult.designId);

        return {
          id: autofillResult.designId,
          templateId,
          status: exportResult.status === "completed" ? "completed" : "rendering",
          exportUrl: exportResult.urls?.[0] ?? null,
          thumbnailUrl: exportResult.urls?.[0] ?? null,
          createdAt: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn("Canva API Fehler, Fallback auf Mock:", err);
    }
  }

  // Mock-Modus
  const designId = `design_${templateId}_${Date.now()}`;
  return {
    id: designId,
    templateId,
    status: "completed",
    exportUrl: `https://mock.canva.com/exports/${designId}.png`,
    thumbnailUrl: `https://mock.canva.com/thumbnails/${designId}_thumb.png`,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Format-Matrix fuer einen Kanal abrufen.
 */
export function getFormatsForChannel(channel: string): { format: string; width: number; height: number }[] {
  return FORMAT_MATRIX[channel] ?? [];
}

/**
 * Alle unterstuetzten Kanaele auflisten.
 */
export function getSupportedChannels(): string[] {
  return Object.keys(FORMAT_MATRIX);
}
