-- Campaign Flow v2: Iterativer Feedback-basierter Workflow
-- Input → Editable Overview → AI Strategy → Grobkonzept ↔ Feedback → Detailkonzept ↔ Feedback → Translations → Assets

-- 1. Neue Status-Werte fuer v2 Flow
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'input_review';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'input_confirmed';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'strategies_generated';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'draft_concept_generated';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'draft_concept_feedback';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'draft_concept_approved';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'detail_concept_generated';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'detail_concept_feedback';
ALTER TYPE campaign_status ADD VALUE IF NOT EXISTS 'detail_concept_approved';

-- 2. Neue Approval-Stages fuer v2 Flow
ALTER TYPE approval_stage ADD VALUE IF NOT EXISTS 'draft_concept';
ALTER TYPE approval_stage ADD VALUE IF NOT EXISTS 'detail_concept';

-- 3. Neue Spalten auf campaigns
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS flow_version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS input_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS input_confirmed_by UUID;

-- 4. Neue Spalten auf concepts
ALTER TABLE concepts
  ADD COLUMN IF NOT EXISTS concept_type TEXT DEFAULT 'legacy'
    CHECK (concept_type IN ('draft', 'detail', 'legacy')),
  ADD COLUMN IF NOT EXISTS iteration INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_concept_id UUID REFERENCES concepts(id),
  ADD COLUMN IF NOT EXISTS positionierung TEXT,
  ADD COLUMN IF NOT EXISTS kreativ_richtung TEXT,
  ADD COLUMN IF NOT EXISTS begruendung TEXT;

-- 5. Feedback-Messages Tabelle (Chat-Stil Feedback-Loop)
CREATE TABLE IF NOT EXISTS feedback_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  phase TEXT NOT NULL CHECK (phase IN ('draft_concept', 'detail_concept')),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  concept_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_campaign_phase
  ON feedback_messages(campaign_id, phase);

-- 6. Index fuer concept_type Abfragen
CREATE INDEX IF NOT EXISTS idx_concepts_type
  ON concepts(campaign_id, concept_type);
