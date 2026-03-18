// Canva Connect API — Design erstellen, Autofill, Export
// Rate Limit: 100 req/min → Queue mit p-limit

import pLimit from "p-limit";
import { getValidToken } from "./canva-oauth";

const CANVA_API_BASE = "https://api.canva.com/rest/v1";
const RATE_LIMIT_CONCURRENCY = 3;

const limiter = pLimit(RATE_LIMIT_CONCURRENCY);

// Token-Bucket fuer Rate Limiting (80 req/min)
let tokenBucket = 80;
let lastRefill = Date.now();
const REFILL_RATE = 80; // pro Minute
const REFILL_INTERVAL = 60000;

function acquireToken(): boolean {
  const now = Date.now();
  const elapsed = now - lastRefill;
  if (elapsed >= REFILL_INTERVAL) {
    tokenBucket = REFILL_RATE;
    lastRefill = now;
  }
  if (tokenBucket > 0) {
    tokenBucket--;
    return true;
  }
  return false;
}

async function waitForToken(): Promise<void> {
  while (!acquireToken()) {
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function canvaFetch(brand: string, path: string, options: RequestInit = {}): Promise<Response> {
  await waitForToken();

  const accessToken = await getValidToken(brand);
  if (!accessToken) {
    throw new Error(`Kein gueltiger Canva-Token fuer Brand "${brand}"`);
  }

  const response = await fetch(`${CANVA_API_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // Rate Limit Retry
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get("retry-after") ?? "5", 10);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return canvaFetch(brand, path, options);
  }

  return response;
}

export interface CanvaTemplate {
  id: string;
  title: string;
  thumbnail?: { url: string };
}

export interface CanvaAutofillResult {
  designId: string;
  status: string;
}

export interface CanvaExportResult {
  exportId: string;
  status: "completed" | "in_progress" | "failed";
  urls?: string[];
}

// Brand Kit Templates auflisten
export async function listBrandTemplates(brand: string): Promise<CanvaTemplate[]> {
  return limiter(async () => {
    const response = await canvaFetch(brand, "/brand-templates?ownership=owned&sort_by=relevance");
    if (!response.ok) {
      throw new Error(`Canva Templates laden fehlgeschlagen: HTTP ${response.status}`);
    }
    const data = await response.json();
    return (data.items ?? []).map((item: Record<string, unknown>) => ({
      id: item.id as string,
      title: (item.title as string) ?? "Untitled",
      thumbnail: item.thumbnail as { url: string } | undefined,
    }));
  });
}

// Design aus Template mit Autofill erstellen
export async function createDesignFromTemplate(
  brand: string,
  templateId: string,
  content: Record<string, string>
): Promise<CanvaAutofillResult> {
  return limiter(async () => {
    // Autofill-Daten vorbereiten: Text-Felder mapping
    const autofillData: Record<string, { type: string; text: string }> = {};
    for (const [key, value] of Object.entries(content)) {
      if (value) {
        autofillData[key] = { type: "text", text: value };
      }
    }

    const response = await canvaFetch(brand, "/autofills", {
      method: "POST",
      body: JSON.stringify({
        brand_template_id: templateId,
        data: autofillData,
        title: `Generated Design ${Date.now()}`,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Canva Autofill fehlgeschlagen: ${error}`);
    }

    const result = await response.json();
    return {
      designId: result.design?.id ?? result.job?.id,
      status: result.job?.status ?? "completed",
    };
  });
}

// Autofill-Job Status pruefen (polling)
export async function getAutofillStatus(brand: string, jobId: string): Promise<CanvaAutofillResult> {
  return limiter(async () => {
    const response = await canvaFetch(brand, `/autofills/${jobId}`);
    if (!response.ok) throw new Error(`Autofill-Status fehlgeschlagen: HTTP ${response.status}`);
    const data = await response.json();
    return {
      designId: data.result?.design_id ?? jobId,
      status: data.status ?? "unknown",
    };
  });
}

// Design exportieren (PNG/PDF)
export async function exportDesign(
  brand: string,
  designId: string,
  format: "png" | "pdf" | "jpg" = "png"
): Promise<CanvaExportResult> {
  return limiter(async () => {
    // Export starten
    const response = await canvaFetch(brand, "/exports", {
      method: "POST",
      body: JSON.stringify({
        design_id: designId,
        format: { type: format === "jpg" ? "jpg" : format },
      }),
    });

    if (!response.ok) {
      throw new Error(`Canva Export fehlgeschlagen: HTTP ${response.status}`);
    }

    const result = await response.json();
    const exportId = result.job?.id ?? result.id;

    // Polling bis fertig (max 30s)
    for (let i = 0; i < 15; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await canvaFetch(brand, `/exports/${exportId}`);
      if (!statusResponse.ok) continue;

      const statusData = await statusResponse.json();
      if (statusData.status === "completed" || statusData.job?.status === "completed") {
        return {
          exportId,
          status: "completed" as const,
          urls: statusData.urls ?? statusData.job?.result?.urls ?? [],
        };
      }

      if (statusData.status === "failed" || statusData.job?.status === "failed") {
        return { exportId, status: "failed" as const };
      }
    }

    return { exportId, status: "in_progress" as const };
  });
}

// Pruefen ob Canva API verfuegbar ist (Token vorhanden fuer Brand)
export async function isCanvaAvailable(brand: string): Promise<boolean> {
  const token = await getValidToken(brand);
  return token !== null;
}
