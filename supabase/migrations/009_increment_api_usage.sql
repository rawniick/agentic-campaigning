-- Migration 009: Fehlende increment_api_usage RPC-Funktion
-- trackApiUsage() ruft diese Funktion auf fuer atomisches Inkrement

CREATE OR REPLACE FUNCTION increment_api_usage(
  campaign_id UUID,
  tokens INTEGER,
  cost DECIMAL(10,4)
)
RETURNS VOID AS $$
BEGIN
  UPDATE campaigns
  SET
    total_tokens_used = COALESCE(total_tokens_used, 0) + tokens,
    total_api_cost_chf = COALESCE(total_api_cost_chf, 0) + cost
  WHERE id = campaign_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
