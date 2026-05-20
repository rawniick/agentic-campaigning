// ACE AI Provider Router - Shared Types

// ---- Capability Categories ----

export type AICapability = "text" | "image" | "video" | "voice" | "template";

export type AITaskType =
  // Text
  | "concept_generator"
  | "channel_adapter"
  | "translator"
  | "compliance_checker"
  | "concept_feedback"
  // Bild
  | "image_generation"
  | "image_variation"
  | "image_upscale"
  // Video
  | "video_generation"
  // Voice (stretch)
  | "voice_tts"
  // Template (Canva)
  | "template_fill";

// ---- Provider Identity ----

export type TextProviderId = "claude" | "openai" | "gemini";
export type ImageProviderId = "dalle" | "flux" | "stable_diffusion" | "nanobanana";
export type VideoProviderId = "runway" | "sora" | "kling" | "veo3";
export type VoiceProviderId = "elevenlabs";
export type TemplateProviderId = "canva";

export type AIProviderId =
  | TextProviderId
  | ImageProviderId
  | VideoProviderId
  | VoiceProviderId
  | TemplateProviderId;

// ---- Unified Request ----

export interface AIRequest {
  taskType: AITaskType;
  campaignId?: string;
  brand?: string;
  language?: string;
  metadata?: Record<string, unknown>;
}

export interface TextAIRequest extends AIRequest {
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  responseFormat?: "json" | "text";
}

export interface ImageAIRequest extends AIRequest {
  prompt: string;
  negativePrompt?: string;
  width: number;
  height: number;
  style?: string;
  referenceImageUrl?: string;
  count?: number;
  model?: string;
}

export interface VideoAIRequest extends AIRequest {
  prompt: string;
  referenceImageUrl?: string;
  durationSeconds?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  model?: string;
}

export interface VoiceAIRequest extends AIRequest {
  text: string;
  voiceId?: string;
  language: string;
  speed?: number;
}

export interface TemplateAIRequest extends AIRequest {
  templateId: string;
  content: Record<string, string>;
  format?: "png" | "pdf" | "jpg";
}

// ---- Unified Response ----

export interface AIResponse<T = unknown> {
  success: boolean;
  data: T;
  provider: AIProviderId;
  model: string;
  usage: AIUsage;
  costChf: number;
  durationMs: number;
  confidence?: number;
}

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  imagesGenerated?: number;
  videoSecondsGenerated?: number;
  audioSecondsGenerated?: number;
  templatesRendered?: number;
}

// ---- Capability-specific Response Data ----

export interface TextResponseData<T = unknown> {
  parsed: T;
  rawText: string;
  stopReason: string | null;
}

export interface ImageResponseData {
  images: GeneratedImage[];
}

export interface GeneratedImage {
  url: string;
  width: number;
  height: number;
  format: string;
  revisedPrompt?: string;
}

export interface VideoResponseData {
  videoUrl: string;
  thumbnailUrl: string;
  durationSeconds: number;
  status: "completed" | "processing";
  pollUrl?: string;
}

export interface VoiceResponseData {
  audioUrl: string;
  durationSeconds: number;
  format: string;
}

export interface TemplateResponseData {
  designId: string;
  exportUrl: string | null;
  thumbnailUrl: string | null;
}

// ---- Provider Interface ----

export interface AIProvider<TReq extends AIRequest = AIRequest, TRes = unknown> {
  readonly id: AIProviderId;
  readonly capability: AICapability;
  readonly displayName: string;

  /** Pruefen ob Provider konfiguriert ist (Env-Vars vorhanden) */
  isAvailable(): boolean;

  /** AI-Task ausfuehren */
  execute(request: TReq): Promise<AIResponse<TRes>>;

  /** Kosten vor Ausfuehrung schaetzen (optional) */
  estimateCost?(request: TReq): number;
}

// ---- Provider Configuration (aus DB) ----

export interface ProviderConfig {
  id: string;
  providerId: AIProviderId;
  capability: AICapability;
  isEnabled: boolean;
  priority: number;
  defaultModel: string;
  availableModels: string[];
  costPerInputToken?: number;
  costPerOutputToken?: number;
  costPerImage?: number;
  costPerVideoSecond?: number;
  costPerAudioSecond?: number;
  maxRequestsPerMinute?: number;
  maxTokensPerRequest?: number;
  updatedAt: string;
}

// ---- Task Configuration (aus DB) ----

export interface TaskConfig {
  id: string;
  taskType: AITaskType;
  brand: string;
  primaryProviderId: AIProviderId;
  fallbackProviderIds: AIProviderId[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxCostPerCallChf?: number;
  promptVersion?: string;
  isEnabled: boolean;
  updatedAt: string;
}

// ---- Router Decision ----

export interface RouteDecision {
  providerId: AIProviderId;
  model: string;
  temperature: number;
  maxTokens: number;
  fallbackProviderIds: AIProviderId[];
  isFallback: boolean;
  reason: string;
}

// ---- Task -> Capability Mapping ----

export const TASK_CAPABILITY_MAP: Record<AITaskType, AICapability> = {
  concept_generator: "text",
  channel_adapter: "text",
  translator: "text",
  compliance_checker: "text",
  concept_feedback: "text",
  image_generation: "image",
  image_variation: "image",
  image_upscale: "image",
  video_generation: "video",
  voice_tts: "voice",
  template_fill: "template",
};

// Default-Einstellungen pro Task (falls kein DB-Config)
export const TASK_DEFAULTS: Record<AITaskType, { temperature: number; maxTokens: number }> = {
  concept_generator: { temperature: 0.7, maxTokens: 4096 },
  channel_adapter: { temperature: 0.7, maxTokens: 4096 },
  translator: { temperature: 0.3, maxTokens: 4096 },
  compliance_checker: { temperature: 0.3, maxTokens: 2048 },
  concept_feedback: { temperature: 0.5, maxTokens: 4096 },
  image_generation: { temperature: 0, maxTokens: 0 },
  image_variation: { temperature: 0, maxTokens: 0 },
  image_upscale: { temperature: 0, maxTokens: 0 },
  video_generation: { temperature: 0, maxTokens: 0 },
  voice_tts: { temperature: 0, maxTokens: 0 },
  template_fill: { temperature: 0, maxTokens: 0 },
};
