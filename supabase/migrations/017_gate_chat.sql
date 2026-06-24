-- ACE Wingo V1 — Migration 017
-- Tabelle: gate_chat
-- Persistenter Chat-Verlauf pro Gate (copy/hero/layout/final) pro Sprache.
-- User-Turns = Feedback; Assistant-Turns = 1-Satz-Begruendung + erzeugtes
-- CopyOutput-Set (candidates JSONB). Compliance: candidates enthaelt NIE
-- LLM-erfundene Preise/Disclaimer (das stellt das Refine-Modul sicher).

CREATE TABLE gate_chat (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  gate         TEXT NOT NULL,                 -- 'copy' | 'hero' | 'layout' | 'final'
  language     TEXT NOT NULL DEFAULT 'de',
  role         TEXT NOT NULL,                 -- 'user' | 'assistant'
  content      TEXT NOT NULL,                 -- User-Feedback bzw. Assistant-Begruendung (1 Satz)
  candidates   JSONB,                         -- nur Assistant-Turns: das erzeugte CopyOutput-Set
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX gate_chat_lookup_idx ON gate_chat(campaign_id, gate, language, created_at);
