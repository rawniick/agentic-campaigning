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
