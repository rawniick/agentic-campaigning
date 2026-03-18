-- Nano Banana 2 (Google) + Veo 3.1 (Google) Provider-Konfigurationen

-- Nano Banana 2: Image Provider (Primary, Prioritaet 5 = vor DALL-E)
INSERT INTO ai_provider_configs (provider_id, capability, display_name, default_model, available_models, priority, cost_per_image)
VALUES ('nanobanana', 'image', 'Google Nano Banana 2', 'gemini-3.1-flash-image-preview',
  '["gemini-3.1-flash-image-preview", "gemini-3-pro-image-preview", "gemini-2.5-flash-image"]',
  5, 0.02)
ON CONFLICT (provider_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  default_model = EXCLUDED.default_model,
  available_models = EXCLUDED.available_models,
  priority = EXCLUDED.priority,
  cost_per_image = EXCLUDED.cost_per_image;

-- Veo 3.1: Video Provider (Primary, Prioritaet 5 = vor Runway)
INSERT INTO ai_provider_configs (provider_id, capability, display_name, default_model, available_models, priority, cost_per_video_second)
VALUES ('veo3', 'video', 'Google Veo 3.1', 'veo-3.1-generate-preview',
  '["veo-3.1-generate-preview"]',
  5, 0.06)
ON CONFLICT (provider_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  default_model = EXCLUDED.default_model,
  available_models = EXCLUDED.available_models,
  priority = EXCLUDED.priority,
  cost_per_video_second = EXCLUDED.cost_per_video_second;

-- Task-Configs aktualisieren: Nano Banana als Primary, DALL-E als Fallback
UPDATE ai_task_configs
SET primary_provider_id = 'nanobanana',
    fallback_provider_ids = '["dalle", "flux"]'
WHERE task_type = 'image_generation' AND brand = 'default';

-- Neuer Task: Video-Generierung mit Veo 3 Primary, Runway Fallback
INSERT INTO ai_task_configs (task_type, brand, primary_provider_id, fallback_provider_ids, temperature, max_tokens)
VALUES ('video_generation', 'default', 'veo3', '["runway"]', NULL, NULL)
ON CONFLICT (task_type, brand) DO UPDATE SET
  primary_provider_id = EXCLUDED.primary_provider_id,
  fallback_provider_ids = EXCLUDED.fallback_provider_ids;
