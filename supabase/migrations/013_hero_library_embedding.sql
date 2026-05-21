-- ACE Wingo V1 — Migration 013
-- Erweitert hero_library um Embedding-Spalte fuer Semantic-Search.
-- FLOAT8[] statt pgvector, weil PGlite kein pgvector hat und V1 mit ~20-200
-- Sample-Bildern in-code Cosine vollkommen ausreicht. Wechsel auf pgvector
-- moeglich wenn Library deutlich waechst.

ALTER TABLE hero_library
  ADD COLUMN embedding FLOAT8[];
