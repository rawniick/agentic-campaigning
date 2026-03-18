import { getServerClient, type SupabaseClient } from "../supabase";
import type { Distribution, DistributionPlatform, DistributionStatus } from "@/types/database";

async function getClient(client?: SupabaseClient) {
  return client ?? await getServerClient();
}

export async function createDistribution(
  distribution: Pick<Distribution, "campaign_id" | "platform" | "asset_count">,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("distributions")
    .insert(distribution)
    .select()
    .single();

  if (error) throw new Error(`Distribution erstellen fehlgeschlagen: ${error.message}`);
  return data as Distribution;
}

export async function updateDistribution(
  id: string,
  updates: Partial<Pick<Distribution,
    "status" | "success_count" | "error_count" | "platform_campaign_id" |
    "platform_response" | "drive_folder_id" | "drive_folder_url" | "error_message"
  >>,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("distributions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Distribution-Update fehlgeschlagen: ${error.message}`);
  return data as Distribution;
}

export async function getDistributionsByCampaign(
  campaignId: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("distributions")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Distributions laden fehlgeschlagen: ${error.message}`);
  return data as Distribution[];
}

export async function getDistributionByPlatform(
  campaignId: string,
  platform: DistributionPlatform,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("distributions")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("platform", platform)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Distribution laden fehlgeschlagen: ${error.message}`);
  return data as Distribution | null;
}

export async function updateDistributionStatus(
  id: string,
  status: DistributionStatus,
  errorMessage?: string,
  client?: SupabaseClient
) {
  const updates: Partial<Distribution> = { status };
  if (errorMessage) updates.error_message = errorMessage;
  return updateDistribution(id, updates, client);
}
