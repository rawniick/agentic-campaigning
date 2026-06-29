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
import { selectGeneratedHero } from "@/lib/gates/selectGeneratedHero";
import { runHeroGenTurn } from "@/lib/gates/runHeroGenTurn";
import { createFalImageProvider } from "@/lib/imagegen/falProvider";
import { selectLayoutVariant } from "@/lib/gates/selectLayoutVariant";
import { runMultiplex, retryAsset } from "@/lib/orchestrate/runMultiplex";
import {
  createClaudeVisionClient,
  defaultVisionLLM,
  type VisionLLMFn,
} from "@/lib/qa/claudeVisionClient";
import { scoreHeroStyle } from "@/lib/qa/heroStyleQA";
import {
  callClaude,
  type ClaudeCallOptions,
  type ClaudeResponse,
} from "@/lib/ai/claude";
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

// ---- Gate 2: AI-Hero-Generierung (nano-banana Multi-Image-Fusion, chat-iteriert) ----

// callClaude generisch auf das Hero-Refine-Schema binden (gleiches Cast-Muster
// wie der Copy-Chat). Nur die Iteration nutzt die LLM (Prompt-Verfeinerung).
const llmForHeroRefine = callClaude as (
  opts: ClaudeCallOptions
) => Promise<ClaudeResponse<{ rationale: string; prompt: string }>>;

const heroRefsSchema = z.object({ campaignId: z.string().uuid() });

// Komponenten-Referenzbilder hochladen (mehrere). Liefert die public Storage-URLs,
// die der Client als referenceUrls in generateHeroAction weiterreicht (fal fetcht
// sie als image_urls). Eigene Action, damit Upload + Prompt entkoppelt sind.
export async function uploadHeroReferencesAction(
  formData: FormData
): Promise<{ urls: string[] }> {
  const { campaignId } = heroRefsSchema.parse({
    campaignId: formData.get("campaignId"),
  });
  const files = formData
    .getAll("refs")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    throw new Error("Bitte mindestens ein Referenzbild waehlen");
  }
  const brand = await getActiveBrandConfig();
  const storage = createSupabaseStorage();
  const urls: string[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const bytes = Buffer.from(await file.arrayBuffer());
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `${brand.brand.slug}/${campaignId}/hero-ref-${Date.now()}-${i}-${safe}`;
    const { url } = await storage.upload(key, bytes, file.type || "image/jpeg");
    urls.push(url);
  }
  await writeAudit(getDb(), {
    campaignId,
    event: "GATE2_HERO_REFS_UPLOADED",
    payload: { count: urls.length },
  });
  return { urls };
}

export interface HeroCandidateView {
  storage_url: string;
  contentType: string;
  seed?: number;
  // best-effort Style-Konsistenz-Score (0..1); null wenn QA nicht lief.
  qaScore: number | null;
}

const generateHeroSchema = z.object({
  campaignId: z.string().uuid(),
  basePrompt: z.string().optional(),
  currentPrompt: z.string().optional(),
  userMessage: z.string().optional(),
  referenceUrls: z.array(z.string()).optional(),
  selectedReferenceUrl: z.string().optional(),
});

// Ein Hero-Gen-Turn: Erstgenerierung (basePrompt) oder Chat-Iteration
// (userMessage -> refineHeroPrompt). Persistiert die Turns in gate_chat(hero) und
// liefert 3 Kandidaten (best-effort QA-Score je Kandidat). fal LIVE via FAL_KEY.
export async function generateHeroAction(input: {
  campaignId: string;
  basePrompt?: string;
  currentPrompt?: string;
  userMessage?: string;
  referenceUrls?: string[];
  selectedReferenceUrl?: string;
}): Promise<{
  rationale: string;
  prompt: string;
  candidates: HeroCandidateView[];
}> {
  const data = generateHeroSchema.parse(input);
  const brand = await getActiveBrandConfig();

  const result = await runHeroGenTurn(
    getDb(),
    createSupabaseStorage(),
    createFalImageProvider(),
    {
      campaignId: data.campaignId,
      brandSlug: brand.brand.slug,
      brandName: brand.brand.name,
      basePrompt: data.basePrompt,
      currentPrompt: data.currentPrompt,
      userMessage: data.userMessage,
      referenceUrls: data.referenceUrls,
      selectedReferenceUrl: data.selectedReferenceUrl,
      llm: llmForHeroRefine,
    }
  );

  // QA-Loop: Style-Konsistenz je Kandidat (best-effort, kein Blocker — ein Fehler
  // oder fehlender ANTHROPIC_API_KEY liefert null statt die Generierung zu failen).
  const candidates: HeroCandidateView[] = await Promise.all(
    result.candidates.map(async (c) => ({
      storage_url: c.storage_url,
      contentType: c.contentType,
      seed: c.seed,
      qaScore: await scoreHeroCandidateBestEffort(
        c.storage_url,
        brand.tokens.colors.primary.hex
      ),
    }))
  );

  await writeAudit(getDb(), {
    campaignId: data.campaignId,
    event: "GATE2_HERO_GENERATED",
    payload: { count: candidates.length, iteration: Boolean(data.userMessage) },
  });
  revalidatePath(`/campaigns/${data.campaignId}`);
  return { rationale: result.rationale, prompt: result.prompt, candidates };
}

// Adaptiert defaultVisionLLM (erwartet base64) auf eine Kandidaten-URL: laedt das
// Bild, base64-kodiert es, und laesst scoreHeroStyle die Style-Konsistenz bewerten.
async function scoreHeroCandidateBestEffort(
  url: string,
  brandPrimaryHex: string
): Promise<number | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    const vision: VisionLLMFn = (req) =>
      defaultVisionLLM({
        ...req,
        imageBase64: base64,
        imageMediaType: "image/png",
      });
    const r = await scoreHeroStyle({
      imageUrl: url,
      brandStyleNotes: `Wingo-Marke, Primaerfarbe ${brandPrimaryHex}, professioneller, stimmiger Look; freigestellte Person.`,
      vision,
    });
    return r.score;
  } catch {
    return null;
  }
}

const selectGeneratedHeroSchema = z.object({
  campaignId: z.string().uuid(),
  storageUrl: z.string().min(1),
});

// Marketer waehlt einen generierten Kandidaten -> persistiert als campaign_hero
// (source='ai') und transitioniert hero_pending -> layout_pending.
export async function selectGeneratedHeroGateAction(formData: FormData) {
  const { campaignId, storageUrl } = selectGeneratedHeroSchema.parse(
    Object.fromEntries(formData)
  );
  await selectGeneratedHero(getDb(), { campaignId, storageUrl });
  await writeAudit(getDb(), {
    campaignId,
    event: "GATE2_HERO_SELECTED_FROM_AI",
    payload: { storageUrl },
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
