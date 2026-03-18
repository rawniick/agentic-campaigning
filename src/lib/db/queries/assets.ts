import { getServerClient, type SupabaseClient } from "../supabase";
import type { Asset } from "@/types/database";

async function getClient(client?: SupabaseClient) {
  return client ?? await getServerClient();
}

export async function getAssetsByCampaign(
  campaignId: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("assets")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("generated_at", { ascending: false });

  if (error) throw new Error(`Assets laden fehlgeschlagen: ${error.message}`);
  return data as Asset[];
}

export async function getAssetsByChannel(
  campaignId: string,
  channel: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("assets")
    .select("*")
    .eq("campaign_id", campaignId)
    .eq("channel", channel);

  if (error) throw new Error(`Assets laden fehlgeschlagen: ${error.message}`);
  return data as Asset[];
}

export async function createAsset(
  asset: Omit<Asset, "id" | "generated_at" | "exported_at">,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const { data, error } = await db
    .from("assets")
    .insert(asset)
    .select()
    .single();

  if (error) throw new Error(`Asset erstellen fehlgeschlagen: ${error.message}`);
  return data as Asset;
}

export async function updateAssetStatus(
  id: string,
  status: string,
  errorMessage?: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);
  const updates: Partial<Asset> = { status };
  if (errorMessage) updates.error_message = errorMessage;

  const { data, error } = await db
    .from("assets")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Asset-Update fehlgeschlagen: ${error.message}`);
  return data as Asset;
}

export async function markAssetExported(
  id: string,
  platform: string,
  exportId: string,
  client?: SupabaseClient
) {
  const db = await getClient(client);

  // Atomisches JSONB-Merge via RPC, Fallback auf Read-Merge-Write
  const { data: rpcData, error: rpcError } = await db.rpc("merge_asset_export", {
    asset_id: id,
    platform_key: platform,
    export_id: exportId,
  });

  if (!rpcError && rpcData) return rpcData as Asset;

  // Fallback: Read-Merge-Write (nicht atomar, aber funktioniert ohne RPC)
  const asset = await db
    .from("assets")
    .select("exported_to, export_ids")
    .eq("id", id)
    .single();

  if (asset.error) throw new Error(`Asset nicht gefunden: ${asset.error.message}`);

  const exportedTo = { ...(asset.data.exported_to as Record<string, unknown> ?? {}), [platform]: true };
  const exportIds = { ...(asset.data.export_ids as Record<string, unknown> ?? {}), [platform]: exportId };

  const { data, error } = await db
    .from("assets")
    .update({
      exported_to: exportedTo,
      export_ids: exportIds,
      exported_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Export-Markierung fehlgeschlagen: ${error.message}`);
  return data as Asset;
}
