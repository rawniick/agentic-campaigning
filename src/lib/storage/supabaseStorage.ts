import { createClient } from "@supabase/supabase-js";
import type { AssetStorage, UploadResult } from "./types";

// Produktions-Adapter fuer Supabase Storage. Bucket muss existieren
// (siehe docs/runbooks fuer Setup-Steps).
export function createSupabaseStorage(): AssetStorage {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.ACE_ASSETS_BUCKET ?? "campaign-assets";

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY muessen gesetzt sein"
    );
  }

  const supabase = createClient(url, serviceKey);

  return {
    async upload(key, bytes, contentType): Promise<UploadResult> {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(key, bytes, {
          contentType,
          upsert: true,
        });
      if (error) {
        throw new Error(`Supabase Storage upload failed: ${error.message}`);
      }
      const { data } = supabase.storage.from(bucket).getPublicUrl(key);
      return { url: data.publicUrl };
    },
  };
}
