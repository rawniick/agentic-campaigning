import { getServerClient, type SupabaseClient } from "../supabase";
import type { Campaign, CampaignStatus } from "@/types/database";

async function getClient(client?: SupabaseClient) {
  return client ?? await getServerClient();
}

export async function getCampaigns(
  options?: { status?: CampaignStatus; limit?: number },
  client?: SupabaseClient
) {
  const db = await getClient(client);
  let query = db
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Campaigns laden fehlgeschlagen: ${error.message}`);
  return data as Campaign[];
}

export async function getCampaignById(id: string, client?: SupabaseClient) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(`Campaign ${id} nicht gefunden: ${error.message}`);
  return data as Campaign;
}

export async function getCampaignByPromoId(
  promoId: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("campaigns")
    .select("*")
    .eq("promo_id", promoId)
    .single();

  if (error) throw new Error(`Campaign ${promoId} nicht gefunden: ${error.message}`);
  return data as Campaign;
}

export async function createCampaign(
  campaign: Omit<Campaign, "id" | "created_at" | "updated_at" | "published_at" | "total_tokens_used" | "total_api_cost_chf">,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("campaigns")
    .insert(campaign)
    .select()
    .single();

  if (error) throw new Error(`Campaign erstellen fehlgeschlagen: ${error.message}`);
  return data as Campaign;
}

export async function updateCampaignStatus(
  id: string,
  status: CampaignStatus,
  extraFields?: Partial<Campaign>,
  client?: SupabaseClient
) {
  const db = await getClient(client ?? undefined);
  const updates: Record<string, unknown> = { status, ...extraFields };

  const { data, error } = await db
    .from("campaigns")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Status-Update fehlgeschlagen: ${error.message}`);
  return data as Campaign;
}

export async function updateCampaign(
  id: string,
  updates: Partial<Campaign>,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("campaigns")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Campaign-Update fehlgeschlagen: ${error.message}`);
  return data as Campaign;
}

// Token-Verbrauch und Kosten atomar tracken via SQL
export async function trackApiUsage(
  id: string,
  tokensUsed: number,
  costChf: number,
  client?: SupabaseClient
) {
  const db = await getClient(client);

  // Atomisches Inkrement via RPC
  const { error: rpcError } = await db.rpc("increment_api_usage", {
    campaign_id: id,
    tokens: tokensUsed,
    cost: costChf,
  });

  if (!rpcError) return;

  // Fallback: Read-Merge-Write (nicht atomar, aber korrekt inkrementierend)
  const campaign = await getCampaignById(id, db);
  await updateCampaign(
    id,
    {
      total_tokens_used: (parseFloat(String(campaign.total_tokens_used)) || 0) + tokensUsed,
      total_api_cost_chf: (parseFloat(String(campaign.total_api_cost_chf)) || 0) + costChf,
    },
    db
  );
}
