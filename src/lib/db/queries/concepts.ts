import { getServerClient, type SupabaseClient } from "../supabase";
import type { Concept } from "@/types/database";

async function getClient(client?: SupabaseClient) {
  return client ?? await getServerClient();
}

export async function createConcept(
  concept: Omit<Concept, "id" | "generated_at">,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("concepts")
    .insert(concept)
    .select()
    .single();

  if (error) throw new Error(`Konzept erstellen fehlgeschlagen: ${error.message}`);
  return data as Concept;
}

export async function getConceptsByCampaign(
  campaignId: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("concepts")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("variant_index", { ascending: true });

  if (error) throw new Error(`Konzepte laden fehlgeschlagen: ${error.message}`);
  return data as Concept[];
}

export async function getSelectedConcept(
  campaignId: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("concepts")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("is_selected", true)
    .maybeSingle();

  if (error) throw new Error(`Ausgewaehltes Konzept laden fehlgeschlagen: ${error.message}`);
  return data as Concept | null;
}

export async function updateConcept(
  id: string,
  updates: Partial<Omit<Concept, "id" | "generated_at">>,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("concepts")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Konzept-Update fehlgeschlagen: ${error.message}`);
  return data as Concept;
}

export async function selectConcept(
  conceptId: string,
  campaignId: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);

  // Alle ANDEREN Konzepte deselektieren + gewaehltes selektieren
  // Reihenfolge: erst selektieren, dann deselektieren = kein 0-selected Zustand
  const { data, error: selectError } = await db
    .from("concepts")
    .update({ is_selected: true })
    .eq("id", conceptId)
    .select()
    .single();

  if (selectError) throw new Error(`Konzept-Auswahl fehlgeschlagen: ${selectError.message}`);

  // Alle anderen Konzepte dieser Kampagne deselektieren
  const { error: deselectError } = await db
    .from("concepts")
    .update({ is_selected: false })
    .eq("campaign_id", campaignId)
    .neq("id", conceptId);

  if (deselectError) throw new Error(`Konzept-Deselektierung fehlgeschlagen: ${deselectError.message}`);

  return data as Concept;
}
