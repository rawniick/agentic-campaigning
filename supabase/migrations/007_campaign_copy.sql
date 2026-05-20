-- ACE Wingo V1 — Migration 007
-- Tabelle: campaign_copy
-- LLM-generierte Headlines/Subline/CTA pro Kampagne pro Sprache.
-- Disclaimer-IDs werden referenziert (NICHT LLM-generiert) fuer Compliance-Pass-through.

CREATE TABLE campaign_copy (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  language        TEXT NOT NULL,
  headlines       TEXT[] NOT NULL,
  subline         TEXT NOT NULL,
  cta_label       TEXT NOT NULL,
  disclaimer_ids  UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  is_approved     BOOLEAN NOT NULL DEFAULT false,
  approved_at     TIMESTAMPTZ,
  llm_model       TEXT,
  llm_tokens_in   INT,
  llm_tokens_out  INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (campaign_id, language)
);

CREATE INDEX campaign_copy_campaign_idx ON campaign_copy(campaign_id);
