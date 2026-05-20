-- ACE Wingo V1 — Migration 004
-- Tabelle: disclaimers
-- Library der Wingo-Pflichttexte, conditions-basiert auf Produkt-Kontext gematched.
-- Beispiele:
--   - "5G im Swisscom Netz" → conditions {"network": "5g"}, applies_to ['mobile']
--   - Standard-Telco-Disclaimer → conditions {}, applies_to alle Kategorien
--   - Hardware-Activation-Fee → conditions {"has_hardware": true}, applies_to alle

CREATE TABLE disclaimers (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id               UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  slug                   TEXT NOT NULL,
  name                   TEXT NOT NULL,
  conditions_json        JSONB NOT NULL DEFAULT '{}'::jsonb,
  applies_to_categories  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  text_de                TEXT NOT NULL,
  text_fr                TEXT NOT NULL,
  text_it                TEXT NOT NULL,
  text_en                TEXT NOT NULL,
  is_required            BOOLEAN NOT NULL DEFAULT true,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (brand_id, slug)
);

CREATE INDEX disclaimers_brand_idx ON disclaimers(brand_id) WHERE is_active = true;
