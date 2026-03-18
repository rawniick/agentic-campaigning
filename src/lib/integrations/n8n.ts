// n8n Workflow Engine Client

export interface N8nConfig {
  webhookUrl: string;
  apiKey: string;
}

export type N8nErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "TIMEOUT"
  | "UNKNOWN";

export class N8nError extends Error {
  constructor(
    public readonly code: N8nErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "N8nError";
  }
}

// Workflow-IDs als Konstanten (nach Import in n8n anpassen)
export const WORKFLOW_IDS = {
  MASTER_PIPELINE: "campaign-full-pipeline",
  MASTER_PIPELINE_V2: "campaign-v2-pipeline",
  DISTRIBUTE: "distribute",
  BRAND_BRAIN_SYNC: "brand-brain-sync",
} as const;

// n8n Wait-Node Stages (Suffixes im Master-Workflow)
// v2 erweitert um draft_concept + detail_concept
export type N8nWaitStage = "strategy" | "concept" | "translations" | "assets" | "draft_concept" | "detail_concept";

/**
 * n8n-Konfiguration aus Env-Vars erstellen.
 * Gibt null zurueck wenn nicht konfiguriert (= Mock-Modus).
 */
export function buildN8nConfig(): N8nConfig | null {
  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  const apiKey = process.env.N8N_API_KEY;

  if (!webhookUrl || !apiKey) {
    return null;
  }

  return { webhookUrl, apiKey };
}

/**
 * Resume-URL fuer einen n8n Wait-Node berechnen.
 * Format: {webhookUrl}/webhook-waiting/{campaignId}-{stage}
 */
export function computeResumeUrl(
  config: N8nConfig,
  campaignId: string,
  waitStage: N8nWaitStage
): string {
  const suffix = `${campaignId}-${waitStage}`;
  return `${config.webhookUrl}/webhook-waiting/${suffix}`;
}

/**
 * n8n Wait-Node fuer eine bestimmte Stage fortsetzen.
 * Berechnet die Resume-URL automatisch aus Config + Campaign + Stage.
 * Mock-Modus: loggt und returned sofort.
 */
export async function resumeN8nWait(
  campaignId: string,
  waitStage: N8nWaitStage,
  data?: Record<string, unknown>
): Promise<{ resumed: boolean; mock: boolean }> {
  const config = buildN8nConfig();

  if (!config) {
    console.log(`[n8n Mock] Resume Wait-Node: ${campaignId}-${waitStage}`, data);
    return { resumed: true, mock: true };
  }

  const resumeUrl = computeResumeUrl(config, campaignId, waitStage);
  try {
    await resumeWorkflow(resumeUrl, data);
    return { resumed: true, mock: false };
  } catch {
    console.warn(`[n8n] Resume fehlgeschlagen fuer ${campaignId}-${waitStage}`);
    return { resumed: false, mock: false };
  }
}

/**
 * n8n Master-Pipeline fuer eine Kampagne starten.
 * Gibt die Execution-ID zurueck (oder Mock-ID).
 */
export async function startCampaignPipeline(
  campaignId: string
): Promise<{ executionId: string; mock: boolean }> {
  const config = buildN8nConfig();
  const result = await triggerWorkflow(config, WORKFLOW_IDS.MASTER_PIPELINE, {
    campaignId,
  });
  return {
    executionId: result.executionId,
    mock: config === null,
  };
}

/**
 * n8n Workflow per Webhook triggern.
 * Mock: gibt sofort Success zurueck.
 */
export async function triggerWorkflow(
  config: N8nConfig | null,
  workflowId: string,
  data: Record<string, unknown>
): Promise<{ executionId: string }> {
  if (!config) {
    // Mock-Modus
    console.log(`[n8n Mock] Workflow ${workflowId} getriggert mit:`, data);
    return { executionId: `mock_exec_${Date.now()}` };
  }

  const url = `${config.webhookUrl}/webhook/${workflowId}`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 401 || status === 403) {
        throw new N8nError("UNAUTHENTICATED", `n8n Auth-Fehler (HTTP ${status})`);
      }
      if (status === 404) {
        throw new N8nError("NOT_FOUND", `Workflow ${workflowId} nicht gefunden`);
      }
      throw new N8nError("UNKNOWN", `n8n Fehler (HTTP ${status})`);
    }

    const result = await response.json();
    return {
      executionId: result.executionId ?? result.id ?? "unknown",
    };
  } catch (error) {
    if (error instanceof N8nError) throw error;
    throw new N8nError(
      "UNKNOWN",
      `n8n Verbindungsfehler: ${error instanceof Error ? error.message : "Unbekannt"}`,
      error
    );
  }
}

/**
 * n8n Wait-Node per Resume-URL fortsetzen.
 * Wird nach Approval aufgerufen wenn Kampagne eine n8n_resume_url hat.
 */
export async function resumeWorkflow(
  resumeUrl: string,
  data?: Record<string, unknown>
): Promise<void> {
  try {
    const response = await fetch(resumeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data ?? {}),
    });

    if (!response.ok) {
      console.warn(`[n8n] Resume fehlgeschlagen (HTTP ${response.status})`);
    }
  } catch (error) {
    console.warn("[n8n] Resume-Fehler:", error);
  }
}
