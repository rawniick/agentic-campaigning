-- ACE Wingo V1 — Migration 012
-- Tabelle: hero_library
-- Library von Hero-Bildern pro Brand. Quelle fuer Gate-2-Library-Picker und
-- Style-Reference fuer AI-Generation. Tags + Embedding kommen in spaeteren
-- Migrationen wenn die jeweiligen Features dranne sind.

CREATE TABLE hero_library (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  storage_url     TEXT NOT NULL,
  categories      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],   -- 'mobile' / 'tv' / 'internet'
  lifestyles      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],   -- 'sport' / 'familie' / 'junge' / ...
  seasons         TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],   -- 'weihnachten' / 'sommer' / 'always_on' / ...
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX hero_library_brand_idx ON hero_library(brand_id);
CREATE INDEX hero_library_categories_idx ON hero_library USING GIN (categories);
CREATE INDEX hero_library_lifestyles_idx ON hero_library USING GIN (lifestyles);
CREATE INDEX hero_library_seasons_idx ON hero_library USING GIN (seasons);

-- Gate-2-Library-Picker: campaign_hero referenziert optional einen Library-Eintrag
-- damit Re-Open + Provenance-Audit nachvollziehbar bleiben. Set-Null bei Loeschung,
-- weil der Render-Snapshot (storage_url) trotzdem stehen bleibt.
ALTER TABLE campaign_hero
  ADD COLUMN library_id UUID REFERENCES hero_library(id) ON DELETE SET NULL;
