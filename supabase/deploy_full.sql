-- ACE Wingo — VOLLER Deploy fuer kaqxwjmzavxysxtnkdeo (leere DB).
-- Schema (001-016) + Storage-Buckets + Seed (Brand-Voice inkl. standard, Disclaimer, Sample-Produkt).
-- Im Supabase-SQL-Editor von kaqxwjmzavxysxtnkdeo komplett einfuegen und RUN.

-- ============================================================
-- 1) SCHEMA  (Migrationen 001-016)
-- ============================================================
-- ACE Wingo V1 ? Konsolidiertes Schema (Migrationen 001-016)
-- EINMALIG im Supabase-SQL-Editor des Wingo-Projekts (kaqxwjmzavxysxtnkdeo)
-- ausfuehren. Reihenfolge = Datei-Reihenfolge unten. Frische DB vorausgesetzt.


-- ===================== 001_brands.sql =====================
-- ACE Wingo V1 — Migration 001
-- Tabelle: brands
-- Multi-Brand-Architektur. V1 launcht single-brand mit Seed "wingo".
-- gen_random_uuid() ist seit PG 13 in core / pglite & Supabase Postgres haben es nativ.

CREATE TABLE brands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX brands_slug_idx ON brands(slug) WHERE is_active = true;

-- Seed Wingo (V1 default brand)
INSERT INTO brands (slug, name) VALUES ('wingo', 'Wingo (Swisscom Brand)');


-- ===================== 002_format_specs.sql =====================
-- ACE Wingo V1 — Migration 002
-- Tabelle: format_specs
-- Kanal-agnostische Format-Definitionen aus Excel Sheet 01.
-- V1 = 11 statische Bildformate (Display Standard 5 + Google Ads statisch 3 + Social statisch 3).

CREATE TABLE format_specs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 TEXT UNIQUE NOT NULL,
  channel_kategorie    TEXT NOT NULL,        -- 'Display Standard', 'Google Ads', 'Social Media'
  channel_plattform    TEXT NOT NULL,        -- 'DV360', 'Google Ads', 'Meta', 'TikTok', 'Reddit'
  asset_media_art      TEXT NOT NULL,        -- 'Display Banner', 'Search/Display/Video Ad', 'Social Ad'
  format_bezeichnung   TEXT NOT NULL,        -- Human-readable, z.B. "Halfpage Ad"
  width                INT  NOT NULL,
  height               INT  NOT NULL,
  dpi                  INT  NOT NULL DEFAULT 72,
  max_filesize_kb      INT,
  filetype             TEXT NOT NULL,        -- 'JPEG', 'PNG', 'WebP'
  safezones_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  languages            TEXT[] NOT NULL DEFAULT ARRAY['de','fr','it']::TEXT[],
  ai_label_position    JSONB,                 -- pro-Format Position fuer AI-Label-Embed (null = global default)
  is_v1                BOOLEAN NOT NULL DEFAULT false,
  is_active            BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX format_specs_v1_idx ON format_specs(is_v1) WHERE is_v1 = true AND is_active = true;

-- V1 Seed: 11 statische Bildformate
INSERT INTO format_specs
  (code, channel_kategorie, channel_plattform, asset_media_art, format_bezeichnung, width, height, max_filesize_kb, filetype, languages, is_v1)
VALUES
  -- Display Standard (DV360) - 5 Formate
  ('dv360_halfpage',      'Display Standard', 'DV360',      'Display Banner',          'Halfpage Ad',     300, 600,  150, 'JPEG', ARRAY['de','fr','it'],      true),
  ('dv360_billboard',     'Display Standard', 'DV360',      'Display Banner',          'Billboard',       970, 250,  150, 'JPEG', ARRAY['de','fr','it'],      true),
  ('dv360_rectangle',     'Display Standard', 'DV360',      'Display Banner',          'Rectangle',       300, 250,  150, 'JPEG', ARRAY['de','fr','it'],      true),
  ('dv360_ricchi',        'Display Standard', 'DV360',      'Display Banner',          'Ricchi Ad',       320, 416,  150, 'JPEG', ARRAY['de','fr','it'],      true),
  ('dv360_wideboard_xl',  'Display Standard', 'DV360',      'Display Banner',          'Wideboard XL',    994, 500,  150, 'JPEG', ARRAY['de','fr','it'],      true),
  -- Google Ads statisch - 3 Formate (Primary Size pro Eintrag, weitere Sizes via safezones_json/render-config)
  ('google_pmax_static',  'Google Ads',       'Google Ads', 'Search/Display/Video Ad', 'Performance Max', 1200, 628, 1200, 'JPEG', ARRAY['de','fr','it'],     true),
  ('google_sea_ad_ext',   'Google Ads',       'Google Ads', 'Search/Display/Video Ad', 'SEA Ad Extension Picture', 1200, 1200, 1200, 'JPEG', ARRAY['de','fr','it'], true),
  ('google_discovery',    'Google Ads',       'Google Ads', 'Search/Display/Video Ad', 'Discovery / Demand Gen', 1200, 628, 1200, 'JPEG', ARRAY['de','fr','it'], true),
  -- Social statisch - 3 Formate
  ('meta_image',          'Social Media',     'Meta',       'Social Ad',               'Meta Image Ad',  1080, 1920, 30720, 'JPEG', ARRAY['de','fr','it'],    true),
  ('tiktok_image',        'Social Media',     'TikTok',     'Social Ad',               'TikTok In-Feed Bild', 1080, 1920, 512000, 'JPEG', ARRAY['de','fr','it'], true),
  ('reddit_link_image',   'Social Media',     'Reddit',     'Social Ad',               'Reddit Link Ad Hauptbild', 1200, 628, 3072, 'PNG', ARRAY['de','fr','it'], true);


-- ===================== 003_brand_voice_variants.sql =====================
-- ACE Wingo V1 — Migration 003
-- Tabelle: brand_voice_variants
-- Multi-dimensionale TOV-Matrix: pro (brand, kampagne_art, zielgruppe) eine Variante.
-- Genau eine Zeile pro Brand muss is_default=true sein und (NULL,NULL) als Kombi haben (Fallback).

CREATE TABLE brand_voice_variants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  kampagne_art  TEXT,           -- z.B. 'flash_sale', 'standard', null fuer Default
  zielgruppe    TEXT,           -- z.B. 'sozial', 'rational', 'nativ', null fuer Default
  tov_md        TEXT NOT NULL,  -- Markdown-Tone-of-Voice, eingebettet in Claude System-Prompt
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Eindeutig pro Brand-Kombination (inkl. NULL-NULL fuer Default)
CREATE UNIQUE INDEX brand_voice_variants_brand_combo_idx
  ON brand_voice_variants (brand_id, COALESCE(kampagne_art, ''), COALESCE(zielgruppe, ''));

-- Genau ein Default pro Brand
CREATE UNIQUE INDEX brand_voice_variants_one_default_idx
  ON brand_voice_variants (brand_id)
  WHERE is_default;


-- ===================== 004_disclaimers.sql =====================
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


-- ===================== 005_products.sql =====================
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


-- ===================== 006_campaigns.sql =====================
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


-- ===================== 007_campaign_copy.sql =====================
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


-- ===================== 008_assets.sql =====================
-- ACE Wingo V1 — Migration 008
-- Tabelle: assets
-- Ein Asset pro (campaign, format_spec, language). Storage-URL zeigt auf
-- Supabase Storage (Production) oder den In-Memory-Adapter (Tests).

CREATE TABLE assets (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id              UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  format_id                UUID NOT NULL REFERENCES format_specs(id) ON DELETE RESTRICT,
  language                 TEXT NOT NULL,
  storage_url              TEXT NOT NULL,
  file_size_bytes          INT,
  mime_type                TEXT,
  status                   TEXT NOT NULL DEFAULT 'rendered',
  vision_qa_score          NUMERIC(4, 3),
  vision_qa_details_json   JSONB,
  position_overrides_json  JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (campaign_id, format_id, language)
);

CREATE INDEX assets_campaign_idx ON assets(campaign_id);


-- ===================== 010_gate_selections.sql =====================
-- ACE Wingo V1 — Migration 010
-- Erweitert campaign_copy um selected_headline_idx (Gate 1) und
-- legt campaign_hero + campaign_layout fuer Gate 2 und Gate 3 an.

ALTER TABLE campaign_copy
  ADD COLUMN selected_headline_idx INT;

CREATE TABLE campaign_hero (
  campaign_id    UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  storage_url    TEXT NOT NULL,
  source         TEXT NOT NULL DEFAULT 'upload',     -- 'upload' / 'library' / 'ai'
  file_size_bytes INT,
  mime_type      TEXT,
  is_approved    BOOLEAN NOT NULL DEFAULT false,
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaign_layout (
  campaign_id    UUID PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  master_format  TEXT NOT NULL,
  variant        TEXT NOT NULL DEFAULT 'default',     -- z.B. 'price_top' / 'price_bottom'
  positions_json JSONB,                                -- Master-Positionen (Phase 6 fuer Drag)
  is_approved    BOOLEAN NOT NULL DEFAULT false,
  approved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ===================== 011_audit_log.sql =====================
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


-- ===================== 012_hero_library.sql =====================
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


-- ===================== 013_hero_library_embedding.sql =====================
-- ACE Wingo V1 — Migration 013
-- Erweitert hero_library um Embedding-Spalte fuer Semantic-Search.
-- FLOAT8[] statt pgvector, weil PGlite kein pgvector hat und V1 mit ~20-200
-- Sample-Bildern in-code Cosine vollkommen ausreicht. Wechsel auf pgvector
-- moeglich wenn Library deutlich waechst.

ALTER TABLE hero_library
  ADD COLUMN embedding FLOAT8[];


-- ===================== 014_ai_label_assets.sql =====================
-- ACE Wingo V1 — Migration 014
-- Tabelle: ai_label_assets
-- Pro Brand ein AI-Label-Asset (SVG/PNG) plus globale Default-Position.
-- format_specs.ai_label_position kann pro Format ueberschreiben, sonst greift
-- der Default hier. Eine Zeile pro Brand reicht — Versionierung kommt via
-- separate Migration falls je noetig.

CREATE TABLE ai_label_assets (
  brand_id          UUID PRIMARY KEY REFERENCES brands(id) ON DELETE CASCADE,
  storage_url       TEXT NOT NULL,
  default_position  JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ===================== 015_assets_partial_success.sql =====================
-- ACE Wingo V1 — Migration 015
-- Partial-success Multiplex: ein einzelner fehlgeschlagener Render darf nicht
-- alle 44 Assets killen. Fehlgeschlagene (Format x Sprache)-Kombinationen werden
-- als Asset-Zeile mit status='failed' persistiert, damit die Gallery ein
-- Fehler-Badge + Einzel-Retry anzeigen kann.
--
--   - storage_url wird nullable (ein failed Asset hat keine URL)
--   - render_error haelt die Fehlermeldung fuer die UI

ALTER TABLE assets ALTER COLUMN storage_url DROP NOT NULL;
ALTER TABLE assets ADD COLUMN render_error TEXT;


-- ===================== 016_assets_conformity.sql =====================
-- ACE Wingo V1 — Migration 016
-- Deterministischer Brand-Konformitaets-Gate pro Asset. Anders als der advisory
-- Vision-QA-Score (eine LLM-Meinung) ist dies der harte, reproduzierbare Gate, der
-- das KO-Kriterium "100% Brand-Konformitaet" durchsetzt:
--
--   - conformity_pass = false  -> Asset wird NICHT in den finalen ZIP-Export
--                                 aufgenommen (z.B. Platzhalter-Logo, falsche
--                                 Dimensionen, Brand-Farbe fehlt)
--   - conformity_pass = NULL   -> noch nicht geprueft (Legacy-Zeilen)
--   - conformity_details_json  -> die Einzel-Checks fuer das Gallery-Badge

ALTER TABLE assets ADD COLUMN IF NOT EXISTS conformity_pass boolean;
ALTER TABLE assets ADD COLUMN IF NOT EXISTS conformity_details_json jsonb;


-- ============================================================
-- 2) STORAGE-BUCKETS  (public; Service-Role-Uploads umgehen RLS)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('campaign-assets','campaign-assets', true),
       ('hero-library','hero-library', true)
on conflict (id) do nothing;

-- ============================================================
-- 3) SEED  (Brand-Voice inkl. standard, Disclaimer, Sample-Produkt)
-- ============================================================
-- ACE Wingo V1 — Migration 009
-- Dev-Seed fuer Wingo: Default-TOV, 5G-Disclaimer, ein Sample-Produkt.
-- Idempotent via ON CONFLICT, sicher fuer Re-Run.

DO $$
DECLARE
  v_wingo_id UUID;
BEGIN
  SELECT id INTO v_wingo_id FROM brands WHERE slug = 'wingo' LIMIT 1;
  IF v_wingo_id IS NULL THEN
    RAISE EXCEPTION 'Wingo brand not seeded — Migration 001 fehlt';
  END IF;

  -- Default-TOV (Pflicht damit findVoiceVariant einen Fallback hat)
  INSERT INTO brand_voice_variants (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
    VALUES (
      v_wingo_id, NULL, NULL,
      '# Wingo Default Voice' || chr(10) ||
      chr(10) ||
      '- Direkt, klar, schweizerisch.' || chr(10) ||
      '- Du-Form, kein Kompliziertes.' || chr(10) ||
      '- Preisvorteil zuerst, dann Produktwert.' || chr(10) ||
      '- Kein Telco-Jargon.',
      true
    )
  ON CONFLICT DO NOTHING;

  -- Standard-Kampagnen (V1.1): markengerechter NEUTRALER Ton pro Zielgruppe.
  -- Bewusst KEIN Flash-Dringlichkeitston — Produktwert statt Preisdruck. So
  -- faellt eine Standard-Kampagne nicht still auf den preis-getriebenen Default
  -- zurueck. Die visuelle De-Akzentuierung des Preises macht der Renderer
  -- (emphasis='neutral'); hier nur der Copy-Ton.
  INSERT INTO brand_voice_variants (brand_id, kampagne_art, zielgruppe, tov_md, is_default)
    VALUES
      (v_wingo_id, 'standard', 'sozial',
        '# Wingo Standard — Sozial' || chr(10) || chr(10) ||
        '- Nahbar, frisch, Du-Form.' || chr(10) ||
        '- Produktnutzen zuerst, kein Zeitdruck, keine Dringlichkeit.' || chr(10) ||
        '- Schweizer Netz als Vertrauensanker.' || chr(10) ||
        '- Kein Telco-Jargon.',
        false),
      (v_wingo_id, 'standard', 'rational',
        '# Wingo Standard — Rational' || chr(10) || chr(10) ||
        '- Sachlich, klar, vertrauenswuerdig, Du-Form.' || chr(10) ||
        '- Fakten und Produktwert vor Preis; kein Countdown, keine Dringlichkeit.' || chr(10) ||
        '- Schweizer Netz und Verlaesslichkeit betonen.' || chr(10) ||
        '- Kein Telco-Jargon.',
        false),
      (v_wingo_id, 'standard', 'nativ',
        '# Wingo Standard — Nativ' || chr(10) || chr(10) ||
        '- Redaktionell, ruhig erzaehlend, Du-Form.' || chr(10) ||
        '- Mehrwert und Kontext statt Aktionsdruck; keine Dringlichkeit.' || chr(10) ||
        '- Schweizer Netz beilaeufig als Qualitaetszeichen.' || chr(10) ||
        '- Kein Telco-Jargon.',
        false)
  ON CONFLICT DO NOTHING;

  -- 5G-Swisscom-Netz Disclaimer (Pflicht bei 5G-Mobile-Produkten)
  INSERT INTO disclaimers
    (brand_id, slug, name, conditions_json, applies_to_categories,
     text_de, text_fr, text_it, text_en, is_required)
    VALUES (
      v_wingo_id, '5g_swisscom_netz', '5G im Swisscom Netz',
      '{"network": "5g"}'::jsonb, ARRAY['mobile'],
      '5G im Swisscom Netz',
      '5G dans le reseau Swisscom',
      'Rete 5G di Swisscom',
      '5G in Swisscom network',
      true
    )
  ON CONFLICT (brand_id, slug) DO NOTHING;

  -- Sample-Produkt fuer Tracer-Bullet-Demo
  INSERT INTO products (brand_id, name, category, price_promo, price_standard, price_suffix, link, features, sku, network)
    VALUES (
      v_wingo_id, 'Wingo Mobile Swiss', 'mobile', 19.95, 29.95, '/Mt.',
      'https://wingo.ch/de/mobile-abos/wingo-mobile-swiss',
      ARRAY['Unlimitiert telefonieren', '5G im Swisscom Netz', '30 GB Daten'],
      'WMS-2026', '5g_swisscom'
    );
END $$;
