import { getServerClient, type SupabaseClient } from "../supabase";
import type { FeedbackMessage } from "@/types/database";

async function getClient(client?: SupabaseClient) {
  return client ?? await getServerClient();
}

// Feedback-Nachricht erstellen (User oder Assistant)
export async function createFeedbackMessage(
  campaignId: string,
  phase: FeedbackMessage["phase"],
  role: FeedbackMessage["role"],
  content: string,
  conceptSnapshot?: Record<string, unknown>,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("feedback_messages")
    .insert({
      campaign_id: campaignId,
      phase,
      role,
      content,
      concept_snapshot: conceptSnapshot ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Feedback erstellen fehlgeschlagen: ${error.message}`);
  return data as FeedbackMessage;
}

// Alle Feedback-Nachrichten einer Phase laden (chronologisch)
export async function getFeedbackMessages(
  campaignId: string,
  phase: FeedbackMessage["phase"],
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("feedback_messages")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("phase", phase)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Feedback laden fehlgeschlagen: ${error.message}`);
  return data as FeedbackMessage[];
}

// Letzte Assistant-Nachricht (fuer Konzept-Snapshot Extraktion)
export async function getLatestAssistantMessage(
  campaignId: string,
  phase: FeedbackMessage["phase"],
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("feedback_messages")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("phase", phase)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Letzte Antwort laden fehlgeschlagen: ${error.message}`);
  return data as FeedbackMessage | null;
}
