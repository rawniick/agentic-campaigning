"use server";

import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/server";
import { getActiveBrandConfig } from "@/lib/brand/server";
import { createSupabaseStorage } from "@/lib/storage/supabaseStorage";
import { uploadToHeroLibrary } from "@/lib/heroLibrary/uploadToHeroLibrary";
import { seedHeroLibraryFromSamples } from "@/lib/heroLibrary/seedHeroLibraryFromSamples";
import { deleteHeroLibraryEntry } from "@/lib/db/queries/hero-library";

function parseTags(input: FormDataEntryValue | null): string[] {
  if (typeof input !== "string" || input.trim() === "") return [];
  return input
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

const uploadSchema = z.object({
  name: z.string().min(1),
  hero: z.instanceof(File),
});

export async function uploadHeroToLibraryAction(formData: FormData) {
  const { name, hero } = uploadSchema.parse({
    name: formData.get("name"),
    hero: formData.get("hero"),
  });
  if (hero.size === 0) {
    throw new Error("Bitte eine Bilddatei waehlen");
  }

  const categories = parseTags(formData.get("categories"));
  const lifestyles = parseTags(formData.get("lifestyles"));
  const seasons = parseTags(formData.get("seasons"));

  const brand = await getActiveBrandConfig();
  const bytes = Buffer.from(await hero.arrayBuffer());

  await uploadToHeroLibrary(getDb(), createSupabaseStorage(), {
    brand_id: brand.brand.id,
    brandSlug: brand.brand.slug,
    name,
    bytes,
    contentType: hero.type || "image/jpeg",
    filename: hero.name,
    categories,
    lifestyles,
    seasons,
  });

  revalidatePath("/admin/hero-library");
}

// Importiert die in brand-assets/<slug>/samples/ abgelegten Bildwelt-Bilder als
// Hero-Library-Eintraege (idempotent). Marketer-Trigger fuer den Bootstrap, ohne
// jedes Bild einzeln hochladen zu muessen.
export async function seedHeroLibraryFromSamplesAction() {
  const brand = await getActiveBrandConfig();
  const samplesDir = path.join(
    process.cwd(),
    "brand-assets",
    brand.brand.slug,
    "samples"
  );
  await seedHeroLibraryFromSamples(getDb(), createSupabaseStorage(), {
    brand_id: brand.brand.id,
    brandSlug: brand.brand.slug,
    samplesDir,
  });
  revalidatePath("/admin/hero-library");
}

const deleteSchema = z.object({ id: z.string().uuid() });

export async function deleteHeroLibraryEntryAction(formData: FormData) {
  const { id } = deleteSchema.parse(Object.fromEntries(formData));
  await deleteHeroLibraryEntry(getDb(), id);
  revalidatePath("/admin/hero-library");
}
