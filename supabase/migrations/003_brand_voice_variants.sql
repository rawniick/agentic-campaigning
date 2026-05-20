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
