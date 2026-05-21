-- ACE Wingo V1 — Migration 014
-- Tabelle: ai_label_assets
-- Pro Brand ein AI-Label-Asset (SVG/PNG) plus globale Default-Position.
-- format_specs.ai_label_position kann pro Format ueberschreiben, sonst greift
-- der Default hier. Eine Zeile pro Brand reicht — Versionierung kommt via
-- separate Migration falls je noetig.

CREATE TABLE ai_label_assets (
  brand_id          UUID PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  storage_url       TEXT NOT NULL,
  default_position  JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
