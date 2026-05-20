import type { Db } from "../types";

export interface AuditEntry {
  id: string;
  campaign_id: string;
  event: string;
  payload: Record<string, unknown>;
  ts: string;
}

export interface WriteAuditInput {
  campaignId: string;
  event: string;
  payload: Record<string, unknown>;
}

export async function writeAudit(db: Db, input: WriteAuditInput): Promise<void> {
  await db.query(
    `INSERT INTO audit_log (campaign_id, event, payload) VALUES ($1, $2, $3::jsonb)`,
    [input.campaignId, input.event, JSON.stringify(input.payload)]
  );
}

export async function getAuditForCampaign(
  db: Db,
  campaignId: string
): Promise<AuditEntry[]> {
  const res = await db.query<AuditEntry>(
    `SELECT id, campaign_id, event, payload, ts
       FROM audit_log
      WHERE campaign_id = $1
      ORDER BY ts ASC, id ASC`,
    [campaignId]
  );
  return res.rows.map((r) => ({
    ...r,
    payload: typeof r.payload === "string" ? JSON.parse(r.payload) : r.payload,
  }));
}
