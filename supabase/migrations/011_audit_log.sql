-- ACE Wingo V1 — Migration 011
-- Tabelle: audit_log
-- Append-only Event-Log pro Kampagne. Wird ab Phase 2 von allen Gate-Actions
-- befuellt (writeAudit). Phase 3 nutzt es fuer Vision-QA-Spuren, Phase 5 fuer
-- AI-Gen-Versuche etc.

CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  event        TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ts           TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX audit_log_campaign_ts_idx ON audit_log(campaign_id, ts);
