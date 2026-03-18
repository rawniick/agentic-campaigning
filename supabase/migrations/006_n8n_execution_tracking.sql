-- n8n Execution Tracking: Execution-ID fuer Debugging + Status-Abfragen
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS n8n_execution_id TEXT;

-- Index fuer Execution-ID Lookups
CREATE INDEX IF NOT EXISTS idx_campaigns_n8n_execution ON campaigns(n8n_execution_id) WHERE n8n_execution_id IS NOT NULL;
