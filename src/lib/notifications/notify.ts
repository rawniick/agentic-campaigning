// In-App Notifications — Erstellen + Email-Versand (optional)

import { getServerClient } from "@/lib/db/supabase";

export type NotificationType =
  | "approval_request"
  | "approved"
  | "rejected"
  | "revision_requested"
  | "distribution_complete"
  | "assets_ready"
  | "pipeline_started";

export interface CreateNotificationInput {
  userId: string;
  campaignId?: string;
  type: NotificationType;
  title: string;
  body?: string;
}

// Einzelne Notification erstellen
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const db = await getServerClient();
  const { error } = await db
    .from("notifications")
    .insert({
      user_id: input.userId,
      campaign_id: input.campaignId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
    });

  if (error) {
    console.error("Notification erstellen fehlgeschlagen:", error.message);
  }
}

// Notification an alle User mit bestimmter Rolle senden
export async function notifyByRole(
  role: string,
  campaignId: string,
  type: NotificationType,
  title: string,
  body?: string
): Promise<void> {
  const db = await getServerClient();
  const { data: profiles } = await db
    .from("profiles")
    .select("id")
    .eq("role", role);

  if (!profiles?.length) return;

  const notifications = profiles.map((p: { id: string }) => ({
    user_id: p.id,
    campaign_id: campaignId,
    type,
    title,
    body: body ?? null,
  }));

  await db.from("notifications").insert(notifications);
}

// Ungelesene Notifications zaehlen
export async function getUnreadCount(userId: string): Promise<number> {
  const db = await getServerClient();
  const { count } = await db
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  return count ?? 0;
}

// Notifications fuer User laden
export async function getNotifications(userId: string, limit: number = 20): Promise<unknown[]> {
  const db = await getServerClient();
  const { data } = await db
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

// Als gelesen markieren
export async function markAsRead(notificationId: string): Promise<void> {
  const db = await getServerClient();
  await db
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
}

// Alle Notifications als gelesen markieren
export async function markAllAsRead(userId: string): Promise<void> {
  const db = await getServerClient();
  await db
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);
}

// Approval-Request Notification an zustaendige Reviewer senden
export async function notifyApprovalRequest(
  campaignId: string,
  stage: string,
  campaignName?: string
): Promise<void> {
  const stageLabels: Record<string, string> = {
    concept: "Konzept",
    draft_concept: "Grobkonzept",
    detail_concept: "Detailkonzept",
    translations: "Uebersetzungen",
    assets: "Assets",
  };

  const reviewerRoles: Record<string, string> = {
    concept: "legal",
    draft_concept: "legal",
    detail_concept: "legal",
    translations: "legal",
    assets: "creative",
  };

  const label = stageLabels[stage] ?? stage;
  const role = reviewerRoles[stage] ?? "admin";

  await notifyByRole(
    role,
    campaignId,
    "approval_request",
    `${label}-Review angefordert`,
    `Kampagne ${campaignName ?? campaignId}: ${label} wartet auf Freigabe.`
  );
}
