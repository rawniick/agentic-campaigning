// Task Router - routet AI-Tasks an den richtigen Provider

import type {
  AIProviderId,
  AIResponse,
  AITaskType,
  ImageAIRequest,
  ImageResponseData,
  RouteDecision,
  TextAIRequest,
  TextResponseData,
  VideoAIRequest,
  VideoResponseData,
  TASK_CAPABILITY_MAP,
  TASK_DEFAULTS,
} from "./types";
import {
  TASK_CAPABILITY_MAP as taskCapMap,
  TASK_DEFAULTS as taskDefaults,
} from "./types";
import type { TextProvider } from "./text/types";
import type { ImageProvider } from "./image/types";
import type { VideoProvider } from "./video/types";
import { providerRegistry } from "./registry";
import { getTaskConfig, logAIUsage } from "./config";
import { calculateCostChf } from "./cost";

/**
 * Text-Task routen und ausfuehren.
 * Haupt-Einstiegspunkt fuer alle Text-AI-Calls.
 */
export async function routeTextTask<T = unknown>(
  request: TextAIRequest
): Promise<AIResponse<TextResponseData<T>>> {
  const decision = await resolveRoute(request.taskType, request.brand);

  // Config-Overrides anwenden
  const enrichedRequest: TextAIRequest = {
    ...request,
    temperature: request.temperature ?? decision.temperature,
    maxTokens: request.maxTokens ?? decision.maxTokens,
    model: request.model ?? decision.model,
  };

  // Primary Provider, dann Fallbacks
  const providersToTry = [
    decision.providerId,
    ...decision.fallbackProviderIds,
  ];
  let lastError: Error | null = null;

  for (const providerId of providersToTry) {
    const provider = providerRegistry.get<TextProvider>(providerId);
    if (!provider) continue;

    try {
      const startMs = Date.now();
      const response = await provider.execute(enrichedRequest);
      const durationMs = Date.now() - startMs;

      // JSON aus Text parsen
      const typedData: TextResponseData<T> = {
        parsed: provider.parseJsonResponse<T>(response.data.rawText),
        rawText: response.data.rawText,
        stopReason: response.data.stopReason,
      };

      const costChf = calculateCostChf(providerId, response.usage);

      // Usage loggen (non-blocking)
      logAIUsage({
        campaignId: request.campaignId,
        taskType: request.taskType,
        providerId,
        model: response.model,
        usage: response.usage as unknown as Record<string, unknown>,
        costChf,
        durationMs,
        success: true,
      }).catch((err) =>
        console.warn("[TaskRouter] Usage-Logging fehlgeschlagen:", err)
      );

      return {
        ...response,
        data: typedData,
        costChf,
        durationMs,
      };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[TaskRouter] Provider ${providerId} fehlgeschlagen fuer ${request.taskType}: ${lastError.message}`
      );
    }
  }

  throw new Error(
    `Alle Provider fehlgeschlagen fuer Task ${request.taskType}: ${lastError?.message}`
  );
}

/**
 * Image-Task routen und ausfuehren.
 */
export async function routeImageTask(
  request: ImageAIRequest
): Promise<AIResponse<ImageResponseData>> {
  const decision = await resolveRoute(request.taskType, request.brand);
  const providersToTry = [
    decision.providerId,
    ...decision.fallbackProviderIds,
  ];
  let lastError: Error | null = null;

  for (const providerId of providersToTry) {
    const provider = providerRegistry.get<ImageProvider>(providerId);
    if (!provider) continue;

    try {
      const startMs = Date.now();
      const response = await provider.execute(request);
      const durationMs = Date.now() - startMs;
      const costChf = calculateCostChf(providerId, response.usage);

      logAIUsage({
        campaignId: request.campaignId,
        taskType: request.taskType,
        providerId,
        model: response.model,
        usage: response.usage as unknown as Record<string, unknown>,
        costChf,
        durationMs,
        success: true,
      }).catch(console.warn);

      return { ...response, costChf, durationMs };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[TaskRouter] Image Provider ${providerId} fehlgeschlagen: ${lastError.message}`
      );
    }
  }

  throw new Error(
    `Alle Image-Provider fehlgeschlagen fuer ${request.taskType}: ${lastError?.message}`
  );
}

/**
 * Video-Task routen und ausfuehren.
 */
export async function routeVideoTask(
  request: VideoAIRequest
): Promise<AIResponse<VideoResponseData>> {
  const decision = await resolveRoute(request.taskType, request.brand);
  const providersToTry = [
    decision.providerId,
    ...decision.fallbackProviderIds,
  ];
  let lastError: Error | null = null;

  for (const providerId of providersToTry) {
    const provider = providerRegistry.get<VideoProvider>(providerId);
    if (!provider) continue;

    try {
      const startMs = Date.now();
      const response = await provider.execute(request);
      const durationMs = Date.now() - startMs;
      const costChf = calculateCostChf(providerId, response.usage);

      logAIUsage({
        campaignId: request.campaignId,
        taskType: request.taskType,
        providerId,
        model: response.model,
        usage: response.usage as unknown as Record<string, unknown>,
        costChf,
        durationMs,
        success: true,
      }).catch(console.warn);

      return { ...response, costChf, durationMs };
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error(String(error));
      console.warn(
        `[TaskRouter] Video Provider ${providerId} fehlgeschlagen: ${lastError.message}`
      );
    }
  }

  throw new Error(
    `Alle Video-Provider fehlgeschlagen fuer ${request.taskType}: ${lastError?.message}`
  );
}

/**
 * Route-Entscheidung: welcher Provider fuer einen Task.
 * Prioritaet: DB brand-spezifisch -> DB default -> Hardcoded Default
 */
async function resolveRoute(
  taskType: AITaskType,
  brand?: string
): Promise<RouteDecision> {
  // Brand-spezifische Config versuchen, dann default
  const config =
    (brand && brand !== "default"
      ? await getTaskConfig(taskType, brand)
      : null) ?? (await getTaskConfig(taskType, "default"));

  if (config) {
    return {
      providerId: config.primaryProviderId,
      model: config.model ?? "default",
      temperature:
        config.temperature ?? taskDefaults[taskType].temperature,
      maxTokens: config.maxTokens ?? taskDefaults[taskType].maxTokens,
      fallbackProviderIds: config.fallbackProviderIds,
      isFallback: false,
      reason: `TaskConfig: ${config.id} (brand=${config.brand})`,
    };
  }

  // Hardcoded Default: erster verfuegbarer Provider fuer diese Capability
  const capability = taskCapMap[taskType];
  const providers = providerRegistry.getByCapability(capability);
  if (providers.length === 0) {
    throw new Error(`Kein Provider verfuegbar fuer ${capability}`);
  }

  return {
    providerId: providers[0].id,
    model: "default",
    temperature: taskDefaults[taskType].temperature,
    maxTokens: taskDefaults[taskType].maxTokens,
    fallbackProviderIds: providers.slice(1).map((p) => p.id),
    isFallback: false,
    reason: "Hardcoded default (kein TaskConfig in DB)",
  };
}
