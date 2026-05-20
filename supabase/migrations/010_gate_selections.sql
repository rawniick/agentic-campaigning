-- ACE Wingo V1 — Migration 010
-- Erweitert campaign_copy um selected_headline_idx (Gate 1) und
-- legt campaign_hero + campaign_layout fuer Gate 2 und Gate 3 an.

ALTER TABLE campaign_copy
  ADD COLUMN selected_headline_idx INT;

CREATE TABLE campaign_hero (
  campaign_id    UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  storage_url    TEXT NOT NULL,
  source         TEXT NOT NULL DEFAULT 'upload',     -- 'upload' / 'library' / 'ai'
  file_size_bytes INT,
  mime_type      TEXT,
  is_approved    BOOLEAN NOT NULL DEFAULT false,
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaign_layout (
  campaign_id    UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  master_format  TEXT NOT NULL,
  variant        TEXT NOT NULL DEFAULT 'default',     -- z.B. 'price_top' / 'price_bottom'
  positions_json JSONB,                                -- Master-Positionen (Phase 6 fuer Drag)
  is_approved    BOOLEAN NOT NULL DEFAULT false,
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
