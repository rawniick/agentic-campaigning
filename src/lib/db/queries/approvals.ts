import { getServerClient, type SupabaseClient } from "../supabase";
import type { Approval, ApprovalStage, ApprovalStatus } from "@/types/database";

async function getClient(client?: SupabaseClient) {
  return client ?? await getServerClient();
}

export async function getApprovalsByCampaign(
  campaignId: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("approvals")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Approvals laden fehlgeschlagen: ${error.message}`);
  return data as Approval[];
}

export async function getPendingApproval(
  campaignId: string,
  stage: ApprovalStage,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("approvals")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("stage", stage)
    .eq("status", "pending")
    .maybeSingle();

  if (error) throw new Error(`Approval laden fehlgeschlagen: ${error.message}`);
  return data as Approval | null;
}

export async function createApproval(
  campaignId: string,
  stage: ApprovalStage,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("approvals")
    .insert({ campaign_id: campaignId, stage, status: "pending" })
    .select()
    .single();

  if (error) throw new Error(`Approval erstellen fehlgeschlagen: ${error.message}`);
  return data as Approval;
}

export async function resolveApproval(
  id: string,
  status: Exclude<ApprovalStatus, "pending">,
  approvedBy: string,
  feedback?: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("approvals")
    .update({
      status,
      approved_by: approvedBy,
      feedback: feedback ?? null,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Approval-Update fehlgeschlagen: ${error.message}`);
  return data as Approval;
}

// Audit-Log Eintrag
export async function logAuditEvent(
  campaignId: string,
  action: string,
  details?: Record<string, unknown>,
  performedBy?: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);
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
