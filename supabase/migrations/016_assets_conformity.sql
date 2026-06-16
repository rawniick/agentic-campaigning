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
