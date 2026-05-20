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
