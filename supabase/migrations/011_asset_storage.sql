-- Migration 011: Campaign Asset Storage + Canva OAuth Tokens + Hero Image Support
-- P0.1: Supabase Storage fuer Campaign Assets
-- P0.3: Hero-Bild Kandidaten + Auswahl

-- 1. Storage Bucket fuer Campaign Assets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-assets',
  'campaign-assets',
  true,
  52428800, -- 50MB
  ARRAY['image/png','image/jpeg','image/webp','video/mp4','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Authenticated lesen, Service Role schreiben
CREATE POLICY "campaign_assets_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'campaign-assets');

CREATE POLICY "campaign_assets_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'campaign-assets');

CREATE POLICY "campaign_assets_auth_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'campaign-assets');

CREATE POLICY "campaign_assets_auth_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'campaign-assets');

-- 2. Canva OAuth Tokens (pro Brand)
CREATE TABLE IF NOT EXISTS canva_oauth_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS fuer canva_oauth_tokens
ALTER TABLE canva_oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "canva_tokens_auth_select"
  ON canva_oauth_tokens FOR SELECT
  USING (true);

CREATE POLICY "canva_tokens_auth_insert"
  ON canva_oauth_tokens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "canva_tokens_auth_update"
  ON canva_oauth_tokens FOR UPDATE
  USING (true);

-- 3. Asset-Tabelle erweitern: Storage-Metadaten
ALTER TABLE assets ADD COLUMN IF NOT EXISTS storage_url TEXT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS mime_type TEXT;

-- 4. Hero-Bild Kandidaten-System (P0.3)
ALTER TABLE assets ADD COLUMN IF NOT EXISTS candidate_group_id UUID;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS is_selected_candidate BOOLEAN DEFAULT false;

-- 5. Campaign Hero-Bild Referenz
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS hero_image_asset_id UUID REFERENCES assets(id);

-- 6. Index fuer schnelle Kandidaten-Abfrage
CREATE INDEX IF NOT EXISTS idx_assets_candidate_group
  ON assets(candidate_group_id)
  WHERE candidate_group_id IS NOT NULL;

-- 7. Index fuer Storage-URL Lookup
CREATE INDEX IF NOT EXISTS idx_assets_storage_url
  ON assets(storage_url)
  WHERE storage_url IS NOT NULL;
