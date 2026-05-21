"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/server";
import { getActiveBrandConfig } from "@/lib/brand/server";
import { createSupabaseStorage } from "@/lib/storage/supabaseStorage";
import { approveCopy } from "@/lib/gates/approveCopy";
import { uploadHero } from "@/lib/gates/uploadHero";
import { selectHeroFromLibrary } from "@/lib/gates/selectHeroFromLibrary";
import { selectLayoutVariant } from "@/lib/gates/selectLayoutVariant";
import { finalRender } from "@/lib/gates/finalRender";
import { reopenToGate, type ReopenTarget } from "@/lib/gates/reopenToGate";
import { writeAudit } from "@/lib/db/queries/audit";

const approveCopySchema = z.object({
  campaignId: z.string().uuid(),
  headlineIndex: z.coerce.number().int().min(0),
});

export async function approveCopyGateAction(formData: FormData) {
  const { campaignId, headlineIndex } = approveCopySchema.parse(
    Object.fromEntries(formData)
  );
  await approveCopy(getDb(), { campaignId, headlineIndex });
  await writeAudit(getDb(), {
    campaignId,
    event: "GATE1_COPY_APPROVED",
    payload: { headlineIndex },
  });
  revalidatePath(`/campaigns/${campaignId}`);
}

const uploadHeroSchema = z.object({
  campaignId: z.string().uuid(),
  hero: z.instanceof(File),
});

export async function uploadHeroGateAction(formData: FormData) {
  const { campaignId, hero } = uploadHeroSchema.parse({
    campaignId: formData.get("campaignId"),
    hero: formData.get("hero"),
  });
  if (hero.size === 0) {
    throw new Error("Bitte eine Bilddatei waehlen");
  }
  const brand = await getActiveBrandConfig();
  const bytes = Buffer.from(await hero.arrayBuffer());
  await uploadHero(getDb(), createSupabaseStorage(), {
    campaignId,
    brandSlug: brand.brand.slug,
    bytes,
    contentType: hero.type || "image/jpeg",
    filename: hero.name,
  });
  await writeAudit(getDb(), {
    campaignId,
    event: "GATE2_HERO_UPLOADED",
    payload: { filename: hero.name, size: bytes.length },
  });
  revalidatePath(`/campaigns/${campaignId}`);
}

const selectFromLibrarySchema = z.object({
  campaignId: z.string().uuid(),
  libraryEntryId: z.string().uuid(),
});

export async function selectHeroFromLibraryGateAction(formData: FormData) {
  const { campaignId, libraryEntryId } = selectFromLibrarySchema.parse(
    Object.fromEntries(formData)
  );
  await selectHeroFromLibrary(getDb(), { campaignId, libraryEntryId });
  await writeAudit(getDb(), {
    campaignId,
    event: "GATE2_HERO_SELECTED_FROM_LIBRARY",
    payload: { libraryEntryId },
  });
  revalidatePath(`/campaigns/${campaignId}`);
}

const layoutSchema = z.object({
  campaignId: z.string().uuid(),
  variant: z.string().min(1),
  masterFormat: z.string().min(1),
});

export async function selectLayoutGateAction(formData: FormData) {
  const data = layoutSchema.parse(Object.fromEntries(formData));
  await selectLayoutVariant(getDb(), data);
  await writeAudit(getDb(), {
    campaignId: data.campaignId,
    event: "GATE3_LAYOUT_SELECTED",
    payload: { variant: data.variant, masterFormat: data.masterFormat },
  });
  revalidatePath(`/campaigns/${data.campaignId}`);
}

const finalRenderSchema = z.object({ campaignId: z.string().uuid() });

export async function finalRenderGateAction(formData: FormData) {
  const { campaignId } = finalRenderSchema.parse(Object.fromEntries(formData));
  const brand = await getActiveBrandConfig();
  const logoUrl =
    "https://placehold.co/80x24/EFEFEF/E61E2A.png?text=wingo";
  await finalRender(getDb(), createSupabaseStorage(), {
    campaignId,
    brandConfig: brand,
    logoUrl,
  });
  await writeAudit(getDb(), {
    campaignId,
    event: "GATE4_RENDER_COMPLETED",
    payload: {},
  });
  revalidatePath(`/campaigns/${campaignId}`);
}

const reopenSchema = z.object({
  campaignId: z.string().uuid(),
  target: z.enum(["copy", "hero", "layout", "final"]),
});

export async function reopenGateAction(formData: FormData) {
  const { campaignId, target } = reopenSchema.parse(
    Object.fromEntries(formData)
  );
  await reopenToGate(getDb(), campaignId, target as ReopenTarget);
  await writeAudit(getDb(), {
    campaignId,
    event: "REOPEN_TO_GATE",
    payload: { target },
  });
  revalidatePath(`/campaigns/${campaignId}`);
}
