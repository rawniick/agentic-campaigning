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
