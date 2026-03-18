import { getServerClient, type SupabaseClient } from "../supabase";
import type { Translation } from "@/types/database";

async function getClient(client?: SupabaseClient) {
  return client ?? await getServerClient();
}

export async function createTranslation(
  translation: Omit<Translation, "id" | "generated_at">,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("translations")
    .insert(translation)
    .select()
    .single();

  if (error) throw new Error(`Uebersetzung erstellen fehlgeschlagen: ${error.message}`);
  return data as Translation;
}

export async function getTranslationsByCampaign(
  campaignId: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("translations")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("target_language", { ascending: true });

  if (error) throw new Error(`Uebersetzungen laden fehlgeschlagen: ${error.message}`);
  return data as Translation[];
}

export async function getTranslationsByLanguage(
  campaignId: string,
  language: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("translations")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("target_language", language)
    .maybeSingle();

  if (error) throw new Error(`Uebersetzung (${language}) laden fehlgeschlagen: ${error.message}`);
  return data as Translation | null;
}

export async function updateTranslationStatus(
  id: string,
  status: Translation["approval_status"],
  reviewerNotes?: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("translations")
    .update({
      approval_status: status,
      reviewer_notes: reviewerNotes ?? null,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Uebersetzungs-Status Update fehlgeschlagen: ${error.message}`);
  return data as Translation;
}
