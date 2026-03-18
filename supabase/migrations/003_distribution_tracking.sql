-- Distribution Tracking fuer Phase 4: Export an Ad-Plattformen + Drive-Archiv

CREATE TABLE distributions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('meta', 'google_ads', 'google_drive')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'uploading', 'completed', 'failed', 'partial')),
  asset_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  platform_campaign_id TEXT,
  platform_response JSONB,
  drive_folder_id TEXT,
  drive_folder_url TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- n8n Resume-URL fuer Wait-Nodes
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS n8n_resume_url TEXT;

-- Indexes
CREATE INDEX idx_distributions_campaign ON distributions(campaign_id);
CREATE INDEX idx_distributions_platform ON distributions(platform);

-- Auto-Update Trigger
CREATE TRIGGER distributions_updated_at BEFORE UPDATE ON distributions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
