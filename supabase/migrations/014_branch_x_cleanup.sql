-- Migration 014: Branch X Cleanup
-- Reduziert ACE auf das interne Marketer-Tool: 1 User, 2 Approval-Gates,
-- ZIP-Download als Output. Keine RBAC, keine Auto-Distribution, kein n8n,
-- keine Metrics, kein Cloning.

-- Auth-Trigger entfernen (war Profile-Auto-Create bei Signup)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Tote Tabellen entfernen (CASCADE wegen FKs auf campaigns)
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS campaign_metrics CASCADE;
DROP TABLE IF EXISTS distributions CASCADE;
DROP TABLE IF EXISTS approvals CASCADE;

-- Tote Custom Types entfernen
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS approval_stage CASCADE;
DROP TYPE IF EXISTS approval_status CASCADE;

-- Tote Spalten aus campaigns entfernen
ALTER TABLE campaigns DROP COLUMN IF EXISTS n8n_resume_url;
ALTER TABLE campaigns DROP COLUMN IF EXISTS n8n_execution_id;
ALTER TABLE campaigns DROP COLUMN IF EXISTS is_template;
ALTER TABLE campaigns DROP COLUMN IF EXISTS cloned_from_id;
ALTER TABLE campaigns DROP COLUMN IF EXISTS legal_review_required;
ALTER TABLE campaigns DROP COLUMN IF EXISTS flow_version;
ALTER TABLE campaigns DROP COLUMN IF EXISTS input_confirmed_at;
ALTER TABLE campaigns DROP COLUMN IF EXISTS input_confirmed_by;

-- Tote v2-Concept-Spalten entfernen (Grobkonzept/Detailkonzept-Trennung)
ALTER TABLE concepts DROP COLUMN IF EXISTS concept_type;
ALTER TABLE concepts DROP COLUMN IF EXISTS positionierung;
ALTER TABLE concepts DROP COLUMN IF EXISTS kreativ_richtung;
ALTER TABLE concepts DROP COLUMN IF EXISTS begruendung;
-- iteration + parent_concept_id bleiben fuer FeedbackChat-Iterationen

-- Hinweis: campaign_status Enum behaelt alle alten Werte (Postgres-Enum-Werte
-- nicht trivial entfernbar). Ungenutzte Werte sind harmlos. Nicht mehr verwendet:
-- strategy_proposed, strategy_selected, input_review, input_confirmed,
-- strategies_generated, draft_concept_*, detail_concept_*, distributing,
-- published, archived
