"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/server";
import { getActiveBrandConfig } from "@/lib/brand/server";
import {
  resolveLogoSrc,
  logoIsPlaceholder,
  resolveStarBlobSrc,
} from "@/lib/brand/resolveLogoSrc";
import { createSupabaseStorage } from "@/lib/storage/supabaseStorage";
import { approveCopy } from "@/lib/gates/approveCopy";
import { createClaudeTranslator } from "@/lib/copy/claudeTranslator";
import { uploadHero } from "@/lib/gates/uploadHero";
import { selectHeroFromLibrary } from "@/lib/gates/selectHeroFromLibrary";
import { selectLayoutVariant } from "@/lib/gates/selectLayoutVariant";
import { runMultiplex, retryAsset } from "@/lib/orchestrate/runMultiplex";
import { createClaudeVisionClient } from "@/lib/qa/claudeVisionClient";
import { reopenToGate, type ReopenTarget } from "@/lib/gates/reopenToGate";
import { promoteHeroToLibrary } from "@/lib/heroLibrary/promoteHeroToLibrary";
import { writeAudit } from "@/lib/db/queries/audit";

const approveCopySchema = z.object({
  campaignId: z.string().uuid(),
  headlineIndex: z.coerce.number().int().min(0),
});

export async function approveCopyGateAction(formData: FormData) {
  const { campaignId, headlineIndex } = approveCopySchema.parse(
    Object.fromEntries(formData)
  );
  // Gate-1 loest die FR/IT/EN-Uebersetzung best-effort aus (Passthrough-Terms
  // aus dem Brand-Glossar). Schlaegt sie fehl, zieht runMultiplex sie nach.
  const brand = await getActiveBrandConfig();
  await approveCopy(getDb(), {
    campaignId,
    headlineIndex,
    translateOptions: {
      passthroughTerms: brand.glossar.passthrough_terms,
      llm: createClaudeTranslator(),
    },
  });
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
  // Echtes Wingo-Lockup als PNG-Data-URL (Interim-Platzhalter solange das
  // echte File fehlt) — kein placehold.co mehr.
  const logoUrl = resolveLogoSrc(brand.tokens, brand.brand.slug);

  // Gate 4 multiplext jetzt: 11 Formate x 4 Sprachen = 44 Assets. translate
  // sichert fehlende Zielsprachen vor dem Render (translate-if-missing).
  const result = await runMultiplex(getDb(), createSupabaseStorage(), {
    campaignId,
    brandConfig: brand,
    logoUrl,
    // Art-bewusste Logo-Variante: white fuer flash_sale (roter BG), colour fuer standard.
    resolveLogo: (v) => resolveLogoSrc(brand.tokens, brand.brand.slug, { variant: v }),
    resolvePriceBlob: () => resolveStarBlobSrc(brand.brand.slug),
    // Fliesst in den deterministischen Konformitaets-Gate: solange das echte
    // Wingo-Lockup fehlt, sind die Assets nicht brand-konform und werden vom
    // ZIP-Export geblockt (KO-Kriterium).
    logoIsPlaceholder: logoIsPlaceholder(brand.brand.slug),
    translate: {
      passthroughTerms: brand.glossar.passthrough_terms,
      llm: createClaudeTranslator(),
    },
    // Vision-QA misst Brand-Konformitaet pro Asset (best-effort: ein QA-Fehler
    // failt das Asset nicht). Badges/Scores landen in der Gallery.
    visionClient: createClaudeVisionClient(),
  });

  await writeAudit(getDb(), {
    campaignId,
    event: "GATE4_RENDER_COMPLETED",
    payload: { rendered: result.assets.length, failed: result.failures.length },
  });
  revalidatePath(`/campaigns/${campaignId}`);
}

const retryAssetSchema = z.object({
  campaignId: z.string().uuid(),
  formatId: z.string().uuid(),
  language: z.string().min(1),
});

// Einzel-Retry eines fehlgeschlagenen Assets (Partial-success). Re-rendert nur
// diese (Format x Sprache)-Kombination, Campaign bleibt 'done'.
export async function retryAssetGateAction(formData: FormData) {
  const { campaignId, formatId, language } = retryAssetSchema.parse(
    Object.fromEntries(formData)
  );
  const brand = await getActiveBrandConfig();
  const logoUrl = resolveLogoSrc(brand.tokens, brand.brand.slug);
  await retryAsset(getDb(), createSupabaseStorage(), {
    campaignId,
    brandConfig: brand,
    logoUrl,
    resolveLogo: (v) => resolveLogoSrc(brand.tokens, brand.brand.slug, { variant: v }),
    resolvePriceBlob: () => resolveStarBlobSrc(brand.brand.slug),
    logoIsPlaceholder: logoIsPlaceholder(brand.brand.slug),
    formatId,
    language,
    visionClient: createClaudeVisionClient(),
  });
  await writeAudit(getDb(), {
    campaignId,
    event: "ASSET_RETRIED",
    payload: { formatId, language },
  });
  revalidatePath(`/campaigns/${campaignId}`);
}

const promoteSchema = z.object({
  campaignId: z.string().uuid(),
  name: z.string().min(1),
  categories: z.string().optional(),
  lifestyles: z.string().optional(),
  seasons: z.string().optional(),
});

function parseTags(raw: string | undefined): string[] | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export async function promoteHeroToLibraryGateAction(formData: FormData) {
  const data = promoteSchema.parse(Object.fromEntries(formData));
  const entry = await promoteHeroToLibrary(getDb(), {
    campaignId: data.campaignId,
    name: data.name,
    categories: parseTags(data.categories),
    lifestyles: parseTags(data.lifestyles),
    seasons: parseTags(data.seasons),
  });
  await writeAudit(getDb(), {
    campaignId: data.campaignId,
    event: "HERO_PROMOTED_TO_LIBRARY",
    payload: { libraryEntryId: entry.id, name: entry.name },
  });
  revalidatePath(`/campaigns/${data.campaignId}`);
  revalidatePath(`/admin/hero-library`);
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
