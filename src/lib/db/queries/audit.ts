import { getServerClient, type SupabaseClient } from "../supabase";

// Audit-Log Eintrag fuer Status-Uebergaenge und wichtige Ereignisse.
// Tabelle: audit_log (siehe Migration 001).
export async function logAuditEvent(
  campaignId: string,
  action: string,
  details?: Record<string, unknown>,
  performedBy?: string,
  client?: SupabaseClient
) {
  const db = client ?? await getServerClient();
  const { error } = await db.from("audit_log").insert({
    campaign_id: campaignId,
    action,
    details: details ?? null,
    performed_by: performedBy ?? null,
  });

  if (error) {
    console.error(`Audit-Log fehlgeschlagen: ${error.message}`);
  }
}
