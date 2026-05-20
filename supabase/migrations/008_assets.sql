-- ACE Wingo V1 — Migration 008
-- Tabelle: assets
-- Ein Asset pro (campaign, format_spec, language). Storage-URL zeigt auf
-- Supabase Storage (Production) oder den In-Memory-Adapter (Tests).

CREATE TABLE assets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id              UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  format_id                UUID NOT NULL REFERENCES format_specs(id) ON DELETE RESTRICT,
  language                 TEXT NOT NULL,
  storage_url              TEXT NOT NULL,
  file_size_bytes          INT,
  mime_type                TEXT,
  status                   TEXT NOT NULL DEFAULT 'rendered',
  vision_qa_score          NUMERIC(4, 3),
  vision_qa_details_json   JSONB,
  position_overrides_json  JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (campaign_id, format_id, language)
);

CREATE INDEX assets_campaign_idx ON assets(campaign_id);
