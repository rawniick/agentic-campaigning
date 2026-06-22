DROP TABLE IF EXISTS
  audit_log, ai_label_assets, assets, campaign_layout, campaign_hero,
  campaign_copy, campaign_briefs, campaigns, hero_library, products,
  disclaimers, brand_voice_variants, format_specs, brands
CASCADE;

CREATE TABLE brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX brands_slug_idx ON brands(slug) WHERE is_active = true;
INSERT INTO brands (slug, name) VALUES ('wingo', 'Wingo (Swisscom Brand)');

CREATE TABLE format_specs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT UNIQUE NOT NULL,
  channel_kategorie    TEXT NOT NULL,
  channel_plattform    TEXT NOT NULL,
  asset_media_art      TEXT NOT NULL,
  format_bezeichnung   TEXT NOT NULL,
  width                INT  NOT NULL,
  height               INT  NOT NULL,
  dpi                  INT  NOT NULL DEFAULT 72,
  max_filesize_kb      INT,
  filetype             TEXT NOT NULL,
  safezones_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  languages            TEXT[] NOT NULL DEFAULT ARRAY['de','fr','it']::TEXT[],
  ai_label_position    JSONB,
  is_v1                BOOLEAN NOT NULL DEFAULT false,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX format_specs_v1_idx ON format_specs(is_v1) WHERE is_v1 = true AND is_active = true;
INSERT INTO format_specs
  (code, channel_kategorie, channel_plattform, asset_media_art, format_bezeichnung, width, height, max_filesize_kb, filetype, languages, is_v1)
VALUES
  ('dv360_halfpage',      'Display Standard', 'DV360',      'Display Banner',          'Halfpage Ad',     300, 600,  150, 'JPEG', ARRAY['de','fr','it'], true),
  ('dv360_billboard',     'Display Standard', 'DV360',      'Display Banner',          'Billboard',       970, 250,  150, 'JPEG', ARRAY['de','fr','it'], true),
  ('dv360_rectangle',     'Display Standard', 'DV360',      'Display Banner',          'Rectangle',       300, 250,  150, 'JPEG', ARRAY['de','fr','it'], true),
  ('dv360_ricchi',        'Display Standard', 'DV360',      'Display Banner',          'Ricchi Ad',       320, 416,  150, 'JPEG', ARRAY['de','fr','it'], true),
  ('dv360_wideboard_xl',  'Display Standard', 'DV360',      'Display Banner',          'Wideboard XL',    994, 500,  150, 'JPEG', ARRAY['de','fr','it'], true),
  ('google_pmax_static',  'Google Ads',       'Google Ads', 'Search/Display/Video Ad', 'Performance Max', 1200, 628, 1200, 'JPEG', ARRAY['de','fr','it'], true),
  ('google_sea_ad_ext',   'Google Ads',       'Google Ads', 'Search/Display/Video Ad', 'SEA Ad Extension Picture', 1200, 1200, 1200, 'JPEG', ARRAY['de','fr','it'], true),
  ('google_discovery',    'Google Ads',       'Google Ads', 'Search/Display/Video Ad', 'Discovery / Demand Gen', 1200, 628, 1200, 'JPEG', ARRAY['de','fr','it'], true),
  ('meta_image',          'Social Media',     'Meta',       'Social Ad',               'Meta Image Ad',  1080, 1920, 30720, 'JPEG', ARRAY['de','fr','it'], true),
  ('tiktok_image',        'Social Media',     'TikTok',     'Social Ad',               'TikTok In-Feed Bild', 1080, 1920, 512000, 'JPEG', ARRAY['de','fr','it'], true),
  ('reddit_link_image',   'Social Media',     'Reddit',     'Social Ad',               'Reddit Link Ad Hauptbild', 1200, 628, 3072, 'PNG', ARRAY['de','fr','it'], true);

CREATE TABLE brand_voice_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  kampagne_art  TEXT,
  zielgruppe    TEXT,
  tov_md        TEXT NOT NULL,
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX brand_voice_variants_brand_combo_idx
  ON brand_voice_variants (brand_id, COALESCE(kampagne_art, ''), COALESCE(zielgruppe, ''));
CREATE UNIQUE INDEX brand_voice_variants_one_default_idx
  ON brand_voice_variants (brand_id) WHERE is_default;

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

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id        UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT NOT NULL,
  price_promo     NUMERIC(10, 2) NOT NULL,
  price_standard  NUMERIC(10, 2),
  price_suffix    TEXT NOT NULL DEFAULT '/Mt.',
  link            TEXT,
  features        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  sku             TEXT,
  network         TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT products_category_chk CHECK (category IN ('mobile', 'internet', 'tv'))
);
CREATE INDEX products_brand_idx ON products(brand_id) WHERE is_active = true;

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
  selected_headline_idx INT,
  llm_model       TEXT,
  llm_tokens_in   INT,
  llm_tokens_out  INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, language)
);
CREATE INDEX campaign_copy_campaign_idx ON campaign_copy(campaign_id);

CREATE TABLE assets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id              UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  format_id                UUID NOT NULL REFERENCES format_specs(id) ON DELETE RESTRICT,
  language                 TEXT NOT NULL,
  storage_url              TEXT,
  file_size_bytes          INT,
  mime_type                TEXT,
  status                   TEXT NOT NULL DEFAULT 'rendered',
  vision_qa_score          NUMERIC(4, 3),
  vision_qa_details_json   JSONB,
  position_overrides_json  JSONB,
  render_error             TEXT,
  conformity_pass          BOOLEAN,
  conformity_details_json  JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, format_id, language)
);
CREATE INDEX assets_campaign_idx ON assets(campaign_id);

CREATE TABLE campaign_hero (
  campaign_id     UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  storage_url     TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'upload',
  file_size_bytes INT,
  mime_type       TEXT,
  library_id      UUID,
  is_approved     BOOLEAN NOT NULL DEFAULT false,
  approved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaign_layout (
  campaign_id    UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  master_format  TEXT NOT NULL,
  variant        TEXT NOT NULL DEFAULT 'default',
  positions_json JSONB,
  is_approved    BOOLEAN NOT NULL DEFAULT false,
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id  UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  event        TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ts           TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX audit_log_campaign_ts_idx ON audit_log(campaign_id, ts);

CREATE TABLE hero_library (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id    UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  categories  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  lifestyles  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  seasons     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  embedding   FLOAT8[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX hero_library_brand_idx ON hero_library(brand_id);
CREATE INDEX hero_library_categories_idx ON hero_library USING GIN (categories);
CREATE INDEX hero_library_lifestyles_idx ON hero_library USING GIN (lifestyles);
CREATE INDEX hero_library_seasons_idx ON hero_library USING GIN (seasons);

CREATE TABLE ai_label_assets (
  brand_id         UUID PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  storage_url      TEXT NOT NULL,
  default_position JSONB NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

insert into storage.buckets (id, name, public)
values ('campaign-assets','campaign-assets', true),
       ('hero-library','hero-library', true)
on conflict (id) do nothing;

INSERT INTO brand_voice_variants (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
SELECT id, NULL, NULL,
  '# Wingo Default Voice' || chr(10) || chr(10) ||
  '- Direkt, klar, schweizerisch.' || chr(10) ||
  '- Du-Form, kein Kompliziertes.' || chr(10) ||
  '- Preisvorteil zuerst, dann Produktwert.' || chr(10) ||
  '- Kein Telco-Jargon.', true
FROM brands WHERE slug = 'wingo';

INSERT INTO brand_voice_variants (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
SELECT id, 'standard', 'sozial',
  '# Wingo Standard Sozial' || chr(10) || chr(10) ||
  '- Nahbar, frisch, Du-Form.' || chr(10) ||
  '- Produktnutzen zuerst, kein Zeitdruck, keine Dringlichkeit.' || chr(10) ||
  '- Schweizer Netz als Vertrauensanker.' || chr(10) ||
  '- Kein Telco-Jargon.', false
FROM brands WHERE slug = 'wingo';

INSERT INTO brand_voice_variants (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
SELECT id, 'standard', 'rational',
  '# Wingo Standard Rational' || chr(10) || chr(10) ||
  '- Sachlich, klar, vertrauenswuerdig, Du-Form.' || chr(10) ||
  '- Fakten und Produktwert vor Preis; keine Dringlichkeit.' || chr(10) ||
  '- Schweizer Netz und Verlaesslichkeit betonen.' || chr(10) ||
  '- Kein Telco-Jargon.', false
FROM brands WHERE slug = 'wingo';

INSERT INTO brand_voice_variants (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
SELECT id, 'standard', 'nativ',
  '# Wingo Standard Nativ' || chr(10) || chr(10) ||
  '- Redaktionell, ruhig erzaehlend, Du-Form.' || chr(10) ||
  '- Mehrwert und Kontext statt Aktionsdruck; keine Dringlichkeit.' || chr(10) ||
  '- Schweizer Netz beilaeufig als Qualitaetszeichen.' || chr(10) ||
  '- Kein Telco-Jargon.', false
FROM brands WHERE slug = 'wingo';

INSERT INTO disclaimers (brand_id, slug, name, conditions_json, applies_to_categories, text_de, text_fr, text_it, text_en, is_required)
SELECT id, '5g_swisscom_netz', '5G im Swisscom Netz', '{"network": "5g"}'::jsonb, ARRAY['mobile'],
  '5G im Swisscom Netz', '5G dans le reseau Swisscom', 'Rete 5G di Swisscom', '5G in Swisscom network', true
FROM brands WHERE slug = 'wingo';

INSERT INTO products (brand_id, name, category, price_promo, price_standard, price_suffix, link, features, sku, network)
SELECT id, 'Wingo Mobile Swiss', 'mobile', 19.95, 29.95, '/Mt.',
  'https://wingo.ch/de/mobile-abos/wingo-mobile-swiss',
  ARRAY['Unlimitiert telefonieren', '5G im Swisscom Netz', '30 GB Daten'], 'WMS-2026', '5g_swisscom'
FROM brands WHERE slug = 'wingo';
