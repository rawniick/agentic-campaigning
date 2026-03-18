// DB-backed Provider + Task Configuration mit In-Memory Cache

import type { TaskConfig, ProviderConfig, AIProviderId, AITaskType } from "./types";
import { getServerClient } from "@/lib/db/supabase";

// In-Memory Cache mit TTL
let configCache: {
  providers: ProviderConfig[];
  tasks: TaskConfig[];
  loadedAt: number;
} | null = null;

const CACHE_TTL_MS = 60_000; // 1 Minute

/** DB-Konfigurationen laden (mit Cache) */
async function loadConfigs(): Promise<{
  providers: ProviderConfig[];
  tasks: TaskConfig[];
}> {
  if (configCache && Date.now() - configCache.loadedAt < CACHE_TTL_MS) {
    return configCache;
  }

  try {
    const db = await getServerClient();

    const [providerResult, taskResult] = await Promise.all([
      db.from("ai_provider_configs").select("*").eq("is_enabled", true),
      db.from("ai_task_configs").select("*").eq("is_enabled", true),
    ]);

    const providers: ProviderConfig[] = (providerResult.data ?? []).map(mapProviderRow);
    const tasks: TaskConfig[] = (taskResult.data ?? []).map(mapTaskRow);

    configCache = { providers, tasks, loadedAt: Date.now() };
    return configCache;
  } catch (err) {
    console.warn("[AIConfig] DB-Konfiguration konnte nicht geladen werden:", err);
    // Leere Config zurueckgeben statt Fehler werfen
    return { providers: [], tasks: [] };
  }
}

/** TaskConfig fuer einen bestimmten Task + Brand holen */
export async function getTaskConfig(
  taskType: string,
  brand: string
): Promise<TaskConfig | null> {
  const { tasks } = await loadConfigs();
  return (
    tasks.find(
      (t) => t.taskType === taskType && t.brand === brand
    ) ?? null
  );
}

/** Alle aktiven Provider-Konfigurationen */
export async function getAllProviderConfigs(): Promise<ProviderConfig[]> {
  const { providers } = await loadConfigs();
  return providers;
}

/** Cache invalidieren (z.B. nach Admin-Aenderung) */
export function invalidateConfigCache(): void {
  configCache = null;
}

/** AI-Usage in die ai_usage_log Tabelle schreiben (fire-and-forget) */
export async function logAIUsage(entry: {
  campaignId?: string;
  taskType: string;
  providerId: string;
  model: string;
  usage: Record<string, unknown>;
  costChf: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    const db = await getServerClient();
    await db.from("ai_usage_log").insert({
      campaign_id: entry.campaignId ?? null,
      task_type: entry.taskType,
      provider_id: entry.providerId,
      model: entry.model,
      usage: entry.usage,
      cost_chf: entry.costChf,
      duration_ms: entry.durationMs,
      success: entry.success,
      error_message: entry.errorMessage ?? null,
    });
  } catch (err) {
    console.warn("[AIConfig] Usage-Log fehlgeschlagen:", err);
  }
}

// ---- Row Mapper ----

function mapProviderRow(row: Record<string, unknown>): ProviderConfig {
  return {
    id: row.id as string,
    providerId: row.provider_id as AIProviderId,
    capability: row.capability as ProviderConfig["capability"],
    isEnabled: row.is_enabled as boolean,
    priority: row.priority as number,
    defaultModel: row.default_model as string,
    availableModels: (row.available_models as string[]) ?? [],
    costPerInputToken: row.cost_per_input_token as number | undefined,
    costPerOutputToken: row.cost_per_output_token as number | undefined,
    costPerImage: row.cost_per_image as number | undefined,
    costPerVideoSecond: row.cost_per_video_second as number | undefined,
    costPerAudioSecond: row.cost_per_audio_second as number | undefined,
    maxRequestsPerMinute: row.max_requests_per_minute as number | undefined,
    maxTokensPerRequest: row.max_tokens_per_request as number | undefined,
    updatedAt: row.updated_at as string,
  };
}

function mapTaskRow(row: Record<string, unknown>): TaskConfig {
  return {
    id: row.id as string,
    taskType: row.task_type as AITaskType,
    brand: row.brand as string,
    primaryProviderId: row.primary_provider_id as AIProviderId,
    fallbackProviderIds: (row.fallback_provider_ids as AIProviderId[]) ?? [],
    model: row.model as string | undefined,
    temperature: row.temperature as number | undefined,
    maxTokens: row.max_tokens as number | undefined,
    maxCostPerCallChf: row.max_cost_per_call_chf as number | undefined,
    promptVersion: row.prompt_version as string | undefined,
    isEnabled: row.is_enabled as boolean,
    updatedAt: row.updated_at as string,
  };
}
