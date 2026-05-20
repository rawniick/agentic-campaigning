-- ACE Wingo V1 — Migration 005
-- Tabelle: products
-- Master-Data fuer das Brand-Produkt-Portfolio. Pro Brand. Marketer waehlt im Brief
-- aus dieser Liste oder traegt manuell ein.

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,                                  -- 'mobile' / 'internet' / 'tv'
  price_promo     NUMERIC(10, 2) NOT NULL,
  price_standard  NUMERIC(10, 2),
  price_suffix    TEXT NOT NULL DEFAULT '/Mt.',
  link            TEXT,
  features        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  sku             TEXT,
  network         TEXT,                                            -- '5g_swisscom' / '4g_swisscom' / 'other'
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT products_category_chk CHECK (category IN ('mobile', 'internet', 'tv'))
);

CREATE INDEX products_brand_idx ON products(brand_id) WHERE is_active = true;
