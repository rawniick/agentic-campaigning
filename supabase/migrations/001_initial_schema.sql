-- Agentic Marketing Engine - Supabase Schema v1.0

CREATE TYPE campaign_status AS ENUM (
  'draft', 'input_complete', 'strategy_proposed', 'strategy_selected',
  'concept_generated', 'concept_approved', 'translating', 'translations_ready',
  'translations_approved', 'rendering_assets', 'assets_ready', 'assets_approved',
  'distributing', 'published', 'archived'
);

CREATE TYPE approval_stage AS ENUM ('concept', 'translations', 'assets');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'revision_requested');

CREATE TABLE campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  promo_id TEXT UNIQUE NOT NULL,
  brand TEXT NOT NULL DEFAULT 'coop_mobile',
  campaign_type TEXT NOT NULL,
  status campaign_status NOT NULL DEFAULT 'draft',
  created_by TEXT,
  product_name TEXT NOT NULL,
  product_type TEXT NOT NULL,
  product_sku TEXT,
  product_features JSONB DEFAULT '[]',
  product_network TEXT,
  price_old DECIMAL(10,2),
  price_new DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'CHF',
  price_suffix TEXT DEFAULT '/Mt.',
  discount_type TEXT,
  discount_value DECIMAL(5,2),
  discount_display TEXT,
  discount_duration TEXT,
  price_conditions TEXT,
  start_date DATE,
  end_date DATE,
  target_audiences JSONB DEFAULT '[]',
  business_goal TEXT,
  kpi_targets JSONB,
  strategy_options JSONB,
  selected_strategy_index INTEGER,
  claim_direction TEXT,
  campaign_narrative TEXT,
  channels JSONB NOT NULL DEFAULT '[]',
  languages JSONB NOT NULL DEFAULT '["de"]',
  disclaimer_text TEXT,
  five_g_badge BOOLEAN DEFAULT false,
  swisscom_netz_hinweis BOOLEAN DEFAULT true,
  legal_review_required BOOLEAN DEFAULT false,
  restrictions JSONB DEFAULT '[]',
  total_tokens_used INTEGER DEFAULT 0,
  total_api_cost_chf DECIMAL(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE TABLE concepts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  variant_label TEXT NOT NULL,
  variant_index INTEGER NOT NULL,
  leitidee TEXT,
  claims JSONB,
  hero_message TEXT,
  key_visual_direction TEXT,
  recommended_claim_index INTEGER,
  channel_adaptations JSONB,
  is_selected BOOLEAN DEFAULT false,
  prompt_version TEXT,
  tokens_used INTEGER,
  generated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE translations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id) ON DELETE CASCADE,
  source_language TEXT NOT NULL DEFAULT 'de',
  target_language TEXT NOT NULL,
  translated_claims JSONB,
  translated_hero_message TEXT,
  translated_channel_adaptations JSONB,
  translated_disclaimer TEXT,
  glossar_terms_used JSONB,
  char_limit_warnings JSONB,
  quality_confidence TEXT,
  approval_status approval_status DEFAULT 'pending',
  reviewer_notes TEXT,
  prompt_version TEXT,
  tokens_used INTEGER,
  generated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  concept_id UUID REFERENCES concepts(id),
  translation_id UUID REFERENCES translations(id),
  format TEXT NOT NULL,
  language TEXT NOT NULL,
  channel TEXT NOT NULL,
  canva_template_id TEXT,
  canva_design_id TEXT,
  storage_path TEXT,
  thumbnail_path TEXT,
  status TEXT DEFAULT 'generating',
  error_message TEXT,
  exported_to JSONB,
  export_ids JSONB,
  generated_at TIMESTAMPTZ DEFAULT now(),
  exported_at TIMESTAMPTZ
);

CREATE TABLE approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  stage approval_stage NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details JSONB,
  performed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_promo_id ON campaigns(promo_id);
CREATE INDEX idx_concepts_campaign ON concepts(campaign_id);
CREATE INDEX idx_translations_campaign ON translations(campaign_id);
CREATE INDEX idx_assets_campaign ON assets(campaign_id);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
