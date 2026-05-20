"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/server";
import { getActiveBrandConfig, clearBrandConfigCache } from "@/lib/brand/server";
import {
  setDefaultVoice,
  upsertVoiceVariant,
  deleteVoiceVariant,
} from "@/lib/db/queries/brand-voice";

const setDefaultSchema = z.object({ tov_md: z.string().min(1) });

export async function setDefaultVoiceAction(formData: FormData) {
  const { tov_md } = setDefaultSchema.parse(Object.fromEntries(formData));
  const brand = await getActiveBrandConfig();
  await setDefaultVoice(getDb(), brand.brand.id, tov_md);
  clearBrandConfigCache();
  revalidatePath("/admin/brand-voice");
}

const upsertSchema = z.object({
  kampagne_art: z.string().min(1),
  zielgruppe: z.string().min(1),
  tov_md: z.string(),
});

export async function upsertVoiceVariantAction(formData: FormData) {
  const data = upsertSchema.parse(Object.fromEntries(formData));
  const brand = await getActiveBrandConfig();
  if (data.tov_md.trim() === "") {
    // leeres Feld bedeutet: keine spezifische Variante mehr — Default greift
    // (kein impliziter Delete falls Eintrag existiert; das geht ueber Delete-Action)
    revalidatePath("/admin/brand-voice");
    return;
  }
  await upsertVoiceVariant(getDb(), {
    brand_id: brand.brand.id,
    ...data,
  });
  revalidatePath("/admin/brand-voice");
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteVoiceVariantAction(formData: FormData) {
  const { id } = deleteSchema.parse(Object.fromEntries(formData));
  await deleteVoiceVariant(getDb(), id);
  revalidatePath("/admin/brand-voice");
}
