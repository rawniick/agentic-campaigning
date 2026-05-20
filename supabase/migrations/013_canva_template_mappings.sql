-- Migration 013: Canva Template Mappings
-- Speichert Zuordnung: Canva Template → Channel/Format pro Brand

CREATE TABLE IF NOT EXISTS canva_template_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand TEXT NOT NULL DEFAULT 'default',
  canva_template_id TEXT NOT NULL,
  canva_template_name TEXT,
  channel TEXT NOT NULL,
  format TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Ein Template pro Brand/Channel/Format
  UNIQUE(brand, channel, format)
);

-- Index fuer schnelles Lookup
CREATE INDEX IF NOT EXISTS idx_canva_mappings_brand_channel ON canva_template_mappings(brand, channel);

-- RLS
ALTER TABLE canva_template_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read mappings" ON canva_template_mappings;
CREATE POLICY "Authenticated users can read mappings"
  ON canva_template_mappings FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage mappings" ON canva_template_mappings;
CREATE POLICY "Authenticated users can manage mappings"
  ON canva_template_mappings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
