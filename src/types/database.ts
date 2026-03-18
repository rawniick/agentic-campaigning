// Typen abgeleitet aus Supabase Schema (001_initial_schema.sql.sql)

export type CampaignStatus =
  | "draft"
  | "input_complete"
  | "strategy_proposed"
  | "strategy_selected"
  | "concept_generated"
  | "concept_approved"
  | "translating"
  | "translations_ready"
  | "translations_approved"
  | "rendering_assets"
  | "assets_ready"
  | "assets_approved"
  | "distributing"
  | "published"
  | "archived"
  // v2 Flow
  | "input_review"
  | "input_confirmed"
  | "strategies_generated"
  | "draft_concept_generated"
  | "draft_concept_feedback"
  | "draft_concept_approved"
  | "detail_concept_generated"
  | "detail_concept_feedback"
  | "detail_concept_approved";

export type ApprovalStage = "concept" | "translations" | "assets" | "draft_concept" | "detail_concept";
export type ConceptType = "draft" | "detail" | "legacy";
export type ApprovalStatus = "pending" | "approved" | "rejected" | "revision_requested";

export interface Campaign {
  id: string;
  promo_id: string;
  brand: string;
  campaign_type: string;
  status: CampaignStatus;
  created_by: string | null;

  // Flow Version (1 = legacy, 2 = iterativer Feedback-Flow)
  flow_version: number;
  input_confirmed_at: string | null;
  input_confirmed_by: string | null;

  // Produkt
  product_name: string;
  product_type: string;
  product_sku: string | null;
  product_features: string[];
  product_network: string | null;

  // Pricing (DECIMAL-Spalten kommen als string von Supabase)
  price_old: number | string | null;
  price_new: number | string;
  currency: string;
  price_suffix: string;
  discount_type: string | null;
  discount_value: number | string | null;
  discount_display: string | null;
  discount_duration: string | null;
  price_conditions: string | null;

  // Kampagne
  start_date: string | null;
  end_date: string | null;
  target_audiences: string[];
  business_goal: string | null;
  kpi_targets: Record<string, unknown> | null;
  strategy_options: StrategyOption[] | null;
  selected_strategy_index: number | null;
  claim_direction: string | null;
  campaign_narrative: string | null;

  // Kanaele
  channels: string[];
  languages: string[];

  // Compliance
  disclaimer_text: string | null;
  five_g_badge: boolean;
  swisscom_netz_hinweis: boolean;
  legal_review_required: boolean;
  restrictions: string[];

  // Tracking (DECIMAL-Spalten kommen als string von Supabase)
  total_tokens_used: number | string;
  total_api_cost_chf: number | string;

  // Briefing-Restructure (008)
  campaign_name: string | null;
  krea_nr: string | null;
  produkt_kategorie: string | null;
  product_link: string | null;
  nebenbotschaft: string | null;
  zielgebiet: string | null;
  budget: string | null;
  order_ziel: string | null;
  ads_description: string | null;
  website_bilder: boolean;
  sonstiges_sujet: string | null;
  infos_umsetzung: string | null;
  umsetzung: string | null;
  auftraggeber: string | null;
  freigabe: string | null;
  at_nummer: string | null;
  bereich: string | null;
  timeline: TimelineEntry[] | null;

  // n8n Orchestrierung
  n8n_resume_url: string | null;
  n8n_execution_id: string | null;

  // P0.3: Hero-Bild Referenz
  hero_image_asset_id: string | null;

  // P3.1: Templates + Klonen
  is_template: boolean;
  cloned_from_id: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

// P2.1: RBAC
export type UserRole = "marketing" | "creative" | "legal" | "admin";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

// P2.2: Notifications
export type NotificationType =
  | "approval_request"
  | "approved"
  | "rejected"
  | "revision_requested"
  | "distribution_complete"
  | "assets_ready"
  | "pipeline_started";

export interface Notification {
  id: string;
  user_id: string;
  campaign_id: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  is_read: boolean;
  created_at: string;
}

// P3.3: Campaign Metrics
export interface CampaignMetric {
  id: string;
  campaign_id: string;
  platform: string;
  date: string;
  impressions: number;
  clicks: number;
  spend_chf: number | string;
  conversions: number;
  ctr: number | string | null;
  cpc_chf: number | string | null;
}

export interface TimelineEntry {
  datum: string;
  beschreibung: string;
}

export interface StrategyOption {
  label: string;
  direction: string;
  rationale: string;
  leitidee_preview?: string;
  claim_preview?: string;
  tone?: string;
  strength?: string;
  risk?: string;
}

export interface Concept {
  id: string;
  campaign_id: string;
  variant_label: string;
  variant_index: number;
  leitidee: string | null;
  claims: ClaimSet | null;
  hero_message: string | null;
  key_visual_direction: string | null;
  recommended_claim_index: number | null;
  channel_adaptations: ChannelAdaptations | null;
  is_selected: boolean;
  prompt_version: string | null;
  tokens_used: number | null;
  generated_at: string;

  // v2 Flow
  concept_type: ConceptType;
  iteration: number;
  parent_concept_id: string | null;
  positionierung: string | null;
  kreativ_richtung: string | null;
  begruendung: string | null;
}

// v2 Flow: Feedback-Message (Chat-Stil)
export interface FeedbackMessage {
  id: string;
  campaign_id: string;
  phase: "draft_concept" | "detail_concept";
  role: "user" | "assistant";
  content: string;
  concept_snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface ClaimSet {
  variants: string[];
  recommended_index: number;
}

export interface ChannelAdaptations {
  social?: SocialAdaptation;
  crm?: CrmAdaptation;
  website?: WebsiteAdaptation;
  sea?: SeaAdaptation;
  print?: PrintAdaptation;
}

export interface SocialAdaptation {
  hook: string;
  body: string;
  cta: string;
  hashtags: string[];
}

export interface CrmAdaptation {
  subject_line: string;
  preview_text: string;
  headline: string;
  body: string;
  cta: string;
}

export interface WebsiteAdaptation {
  hero_headline: string;
  hero_subline: string;
  cta_primary: string;
  cta_secondary?: string;
}

export interface SeaAdaptation {
  headlines: string[];
  descriptions: string[];
}

export interface PrintAdaptation {
  headline: string;
  subline: string;
  body: string;
  pflichttext: string;
}

export interface Translation {
  id: string;
  campaign_id: string;
  concept_id: string;
  source_language: string;
  target_language: string;
  translated_claims: ClaimSet | null;
  translated_hero_message: string | null;
  translated_channel_adaptations: ChannelAdaptations | null;
  translated_disclaimer: string | null;
  glossar_terms_used: Record<string, string>[] | null;
  char_limit_warnings: CharLimitWarning[] | null;
  quality_confidence: string | null;
  approval_status: ApprovalStatus;
  reviewer_notes: string | null;
  prompt_version: string | null;
  tokens_used: number | null;
  generated_at: string;
}

export interface CharLimitWarning {
  field: string;
  limit: number;
  actual: number;
  text: string;
}

export interface Asset {
  id: string;
  campaign_id: string;
  concept_id: string | null;
  translation_id: string | null;
  format: string;
  language: string;
  channel: string;
  canva_template_id: string | null;
  canva_design_id: string | null;
  storage_path: string | null;
  thumbnail_path: string | null;
  status: string;
  error_message: string | null;
  exported_to: Record<string, unknown> | null;
  export_ids: Record<string, unknown> | null;
  generation_mode: AssetGenerationMode;
  ai_prompt: string | null;
  ai_provider: string | null;
  generated_at: string;
  exported_at: string | null;

  // P0.1: Storage-Metadaten
  storage_url: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;

  // P0.3: Hero-Bild Kandidaten
  candidate_group_id: string | null;
  is_selected_candidate: boolean;
}

export interface Approval {
  id: string;
  campaign_id: string;
  stage: ApprovalStage;
  status: ApprovalStatus;
  approved_by: string | null;
  feedback: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AuditLogEntry {
  id: string;
  campaign_id: string;
  action: string;
  details: Record<string, unknown> | null;
  performed_by: string | null;
  created_at: string;
}

// Phase 6: AI Provider Router
export type AssetGenerationMode = "template" | "ai_image" | "ai_video" | "text_only";

export interface AIProviderConfig {
  id: string;
  provider_id: string;
  capability: string;
  display_name: string;
  is_enabled: boolean;
  priority: number;
  default_model: string;
  available_models: string[];
  cost_per_input_token: number | null;
  cost_per_output_token: number | null;
  cost_per_image: number | null;
  cost_per_video_second: number | null;
  cost_per_audio_second: number | null;
  max_requests_per_minute: number | null;
  max_tokens_per_request: number | null;
  created_at: string;
  updated_at: string;
}

export interface AITaskConfig {
  id: string;
  task_type: string;
  brand: string;
  primary_provider_id: string;
  fallback_provider_ids: string[];
  model: string | null;
  temperature: number | null;
  max_tokens: number | null;
  max_cost_per_call_chf: number | null;
  prompt_version: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIUsageLog {
  id: string;
  campaign_id: string | null;
  task_type: string;
  provider_id: string;
  model: string;
  usage: Record<string, unknown>;
  cost_chf: number | string;
  duration_ms: number;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

export interface AIPromptVersion {
  id: string;
  task_type: string;
  version: string;
  system_prompt: string;
  is_active: boolean;
  total_uses: number;
  avg_quality_score: number | null;
  created_by: string | null;
  created_at: string;
}

// P0.1: Canva OAuth Tokens
export interface CanvaOAuthToken {
  id: string;
  brand: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scopes: string[];
  created_at: string;
  updated_at: string;
}

// Phase 4: Distribution Tracking
export type DistributionPlatform = "meta" | "google_ads" | "google_drive";
export type DistributionStatus = "pending" | "uploading" | "completed" | "failed" | "partial";

export interface Distribution {
  id: string;
  campaign_id: string;
  platform: DistributionPlatform;
  status: DistributionStatus;
  asset_count: number;
  success_count: number;
  error_count: number;
  platform_campaign_id: string | null;
  platform_response: Record<string, unknown> | null;
  drive_folder_id: string | null;
  drive_folder_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
