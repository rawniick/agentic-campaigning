// Claude API Facade - delegiert an den Provider Router
// Abwaertskompatibel: callClaude() und estimateCostChf() behalten ihre Signatur

import { routeTextTask } from "./providers/router";
import { calculateCostChf } from "./providers/cost";
import { initializeProviders } from "./providers/init";
import type { AITaskType, AIUsage } from "./providers/types";
import { parseJsonResponse } from "./providers/text/claude";

// ---- Bestehende Interfaces (IDENTISCH) ----

export interface ClaudeCallOptions {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  // Neu: optionale Task-Metadaten fuer den Router
  taskType?: AITaskType;
  campaignId?: string;
  brand?: string;
}

export interface ClaudeResponse<T> {
  data: T;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  model: string;
  stopReason: string | null;
}

/**
 * Abwaertskompatibles callClaude.
 * Delegiert intern an routeTextTask.
 * Alle bestehenden API-Routes funktionieren ohne Aenderungen.
 */
export async function callClaude<T = unknown>(
  options: ClaudeCallOptions
): Promise<ClaudeResponse<T>> {
  // Provider-System lazy initialisieren
  await initializeProviders();

  const response = await routeTextTask<T>({
    taskType: options.taskType ?? "concept_generator",
    systemPrompt: options.systemPrompt,
    userMessage: options.userMessage,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    model: options.model,
    campaignId: options.campaignId,
    brand: options.brand,
  });

  return {
    data: response.data.parsed,
    tokensUsed: {
      input: response.usage.inputTokens ?? 0,
      output: response.usage.outputTokens ?? 0,
      total: response.usage.totalTokens ?? 0,
    },
    model: response.model,
    stopReason: response.data.stopReason,
  };
}

/** Abwaertskompatible Kostenschaetzung. Nutzt jetzt Provider-aware Calculator. */
export function estimateCostChf(
  inputTokens: number,
  outputTokens: number
): number {
  const usage: AIUsage = { inputTokens, outputTokens };
  return calculateCostChf("claude", usage);
}

// Re-export fuer Tests und bestehende Imports
export { parseJsonResponse };
