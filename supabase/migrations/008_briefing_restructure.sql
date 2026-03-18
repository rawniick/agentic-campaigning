-- Migration 008: Briefing-Vorlage Restructure
-- Neue Spalten fuer die 6-Sektionen-Struktur (alle nullable fuer Rueckwaertskompatibilitaet)

-- Sektion 0: Kampagne
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_name TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS krea_nr TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS produkt_kategorie TEXT;

-- Sektion 1: Produktuebersicht
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS product_link TEXT;

-- Sektion 2: Vermarktung
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS nebenbotschaft TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS zielgebiet TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS budget TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS order_ziel TEXT;

-- Sektion 3: Sujets
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ads_description TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS website_bilder BOOLEAN DEFAULT FALSE;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS sonstiges_sujet TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS infos_umsetzung TEXT;

-- Sektion 4: Sonstiges
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS umsetzung TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS auftraggeber TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS freigabe TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS at_nummer TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS bereich TEXT;

-- Sektion 5: Timeline
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb;
