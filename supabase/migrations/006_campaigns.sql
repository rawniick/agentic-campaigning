-- ACE Wingo V1 — Migration 006
-- Tabelle: campaigns + campaign_briefs
-- campaigns = denormalisierte Workflow-Zeile pro Kampagne (Status-Machine).
-- campaign_briefs = vollstaendiges Briefing als JSON-Blob (Source of Truth fuer Audit).

CREATE TABLE campaigns (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            UUID NOT NULL REFERENCES brands(id) ON DELETE RESTRICT,
  product_id          UUID REFERENCES products(id) ON DELETE SET NULL,
  name                TEXT NOT NULL,
  art                 TEXT NOT NULL,
  datum_von           DATE NOT NULL,
  datum_bis           DATE NOT NULL,
  produkt_kategorie   TEXT NOT NULL,
  price_promo         NUMERIC(10, 2) NOT NULL,
  price_standard      NUMERIC(10, 2),
  price_suffix        TEXT NOT NULL DEFAULT '/Mt.',
  zielgruppe          TEXT NOT NULL,
  zielgebiet          TEXT NOT NULL,
  languages           TEXT[] NOT NULL DEFAULT ARRAY['de','fr','it','en']::TEXT[],
  status              TEXT NOT NULL DEFAULT 'created',
  current_gate        TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX campaigns_brand_idx ON campaigns(brand_id);
CREATE INDEX campaigns_status_idx ON campaigns(status);

CREATE TABLE campaign_briefs (
  campaign_id   UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  brief_json    JSONB NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
