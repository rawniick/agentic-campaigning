import type {
  AIProvider,
  TextAIRequest,
  TextResponseData,
  TextProviderId,
} from "../types";

/** Vertrag fuer alle Text/LLM Provider */
export interface TextProvider
  extends AIProvider<TextAIRequest, TextResponseData> {
  readonly id: TextProviderId;
  readonly capability: "text";

  /** JSON aus Provider-Antwort parsen (provider-spezifisch) */
  parseJsonResponse<T>(rawText: string): T;
}
