-- ACE AI Provider Router: Konfiguration + Usage Tracking

-- Provider-Konfigurationen (welche Provider aktiv, Modelle, Kosten)
CREATE TABLE ai_provider_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_id TEXT NOT NULL UNIQUE,
  capability TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 100,

  default_model TEXT NOT NULL,
  available_models JSONB DEFAULT '[]',

  cost_per_input_token DECIMAL(12,8),
  cost_per_output_token DECIMAL(12,8),
  cost_per_image DECIMAL(8,4),
  cost_per_video_second DECIMAL(8,4),
  cost_per_audio_second DECIMAL(8,6),

  max_requests_per_minute INTEGER,
  max_tokens_per_request INTEGER,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Task-Konfigurationen (welcher Provider fuer welchen Task, pro Brand)
CREATE TABLE ai_task_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'default',

  primary_provider_id TEXT NOT NULL REFERENCES ai_provider_configs(provider_id),
  fallback_provider_ids JSONB DEFAULT '[]',

  model TEXT,
  temperature DECIMAL(3,2),
  max_tokens INTEGER,

  max_cost_per_call_chf DECIMAL(8,4),
  prompt_version TEXT,

  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(task_type, brand)
);

-- AI Usage Log (jeder AI-Call wird geloggt)
CREATE TABLE ai_usage_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  model TEXT NOT NULL,

  usage JSONB NOT NULL DEFAULT '{}',
  cost_chf DECIMAL(10,6) NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,

  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Prompt-Versionen (A/B Testing ohne Deploy)
CREATE TABLE ai_prompt_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type TEXT NOT NULL,
  version TEXT NOT NULL,

  system_prompt TEXT NOT NULL,
  is_active BOOLEAN DEFAULT false,

  total_uses INTEGER DEFAULT 0,
  avg_quality_score DECIMAL(3,2),

  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(task_type, version)
);

-- Assets: neue Spalten fuer AI-Generierung
ALTER TABLE assets ADD COLUMN generation_mode TEXT DEFAULT 'template';
ALTER TABLE assets ADD COLUMN ai_prompt TEXT;
ALTER TABLE assets ADD COLUMN ai_provider TEXT;

-- Indices
CREATE INDEX idx_ai_usage_log_campaign ON ai_usage_log(campaign_id);
CREATE INDEX idx_ai_usage_log_created ON ai_usage_log(created_at);
CREATE INDEX idx_ai_usage_log_provider ON ai_usage_log(provider_id);
CREATE INDEX idx_ai_task_configs_lookup ON ai_task_configs(task_type, brand);
CREATE INDEX idx_ai_prompt_versions_active ON ai_prompt_versions(task_type, is_active) WHERE is_active = true;

-- Trigger fuer updated_at
CREATE TRIGGER ai_provider_configs_updated_at BEFORE UPDATE ON ai_provider_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER ai_task_configs_updated_at BEFORE UPDATE ON ai_task_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed: Default Provider-Konfigurationen
INSERT INTO ai_provider_configs (provider_id, capability, display_name, default_model, available_models, priority, cost_per_input_token, cost_per_output_token) VALUES
  ('claude', 'text', 'Anthropic Claude', 'claude-sonnet-4-20250514', '["claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"]', 10, 0.000003, 0.000015),
  ('openai', 'text', 'OpenAI GPT', 'gpt-4o', '["gpt-4o", "gpt-4o-mini"]', 20, 0.0000025, 0.00001);

INSERT INTO ai_provider_configs (provider_id, capability, display_name, default_model, available_models, priority, cost_per_image) VALUES
  ('dalle', 'image', 'DALL-E 3', 'dall-e-3', '["dall-e-3"]', 10, 0.04),
  ('flux', 'image', 'Flux (Replicate)', 'flux-1.1-pro', '["flux-1.1-pro", "flux-schnell"]', 20, 0.03);

INSERT INTO ai_provider_configs (provider_id, capability, display_name, default_model, available_models, priority, cost_per_video_second) VALUES
  ('runway', 'video', 'Runway ML', 'gen-3-alpha', '["gen-3-alpha"]', 10, 0.05);

INSERT INTO ai_provider_configs (provider_id, capability, display_name, default_model, available_models, priority) VALUES
  ('canva', 'template', 'Canva Connect', 'template-fill', '["template-fill"]', 10);

-- Seed: Default Task-Konfigurationen (Text auf Claude, Bild auf DALL-E)
INSERT INTO ai_task_configs (task_type, brand, primary_provider_id, fallback_provider_ids, temperature, max_tokens) VALUES
  ('strategy_advisor', 'default', 'claude', '["openai"]', 0.7, 2048),
  ('concept_generator', 'default', 'claude', '["openai"]', 0.7, 4096),
  ('channel_adapter', 'default', 'claude', '["openai"]', 0.7, 4096),
  ('translator', 'default', 'claude', '["openai"]', 0.3, 4096),
  ('compliance_checker', 'default', 'claude', '["openai"]', 0.3, 2048),
  ('image_generation', 'default', 'dalle', '["flux"]', NULL, NULL),
  ('template_fill', 'default', 'canva', '[]', NULL, NULL);

-- RLS
ALTER TABLE ai_provider_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_task_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompt_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ai_provider_configs" ON ai_provider_configs FOR ALL USING (true);
CREATE POLICY "Service role full access on ai_task_configs" ON ai_task_configs FOR ALL USING (true);
CREATE POLICY "Service role full access on ai_usage_log" ON ai_usage_log FOR ALL USING (true);
CREATE POLICY "Service role full access on ai_prompt_versions" ON ai_prompt_versions FOR ALL USING (true);
