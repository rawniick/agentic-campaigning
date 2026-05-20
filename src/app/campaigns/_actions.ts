"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/server";
import { getActiveBrandConfig } from "@/lib/brand/server";
import { createSupabaseStorage } from "@/lib/storage/supabaseStorage";
import { callClaude } from "@/lib/ai/claude";
import { runCampaignTracerBullet } from "@/lib/orchestrate/runCampaignTracerBullet";
import { briefSchema, type Brief } from "@/lib/schemas/brief";
import { getProductById } from "@/lib/db/queries/products";

interface SubmitBriefArgs {
  brief: Brief;
  productId?: string;
}

// Server-Action fuer Phase 1 Tracer Bullet: nimmt das Brief entgegen,
// faehrt die Pipeline einmal durch (1 Format, DE) und redirect zur
// Campaign-Detail-Page.
export async function submitBriefAction(input: SubmitBriefArgs) {
  const brief = briefSchema.parse(input.brief);

  const db = getDb();
  const brandConfig = await getActiveBrandConfig();
  const storage = createSupabaseStorage();

  // Format-Spec fuer die Halfpage suchen (V1 Tracer = dv360_halfpage)
  const format = brandConfig.formats.find((f) => f.code === "dv360_halfpage");
  if (!format) {
    throw new Error("V1-Format dv360_halfpage nicht in format_specs geseeded");
  }

  // Produkt-Context fuer Disclaimer-Matching aus Produkt-Master oder Brief
  let productContext: { category: "mobile" | "tv" | "internet"; network?: "5g" | "4g" | "other" };
  if (input.productId) {
    const product = await getProductById(db, input.productId);
    if (!product) {
      throw new Error(`Produkt ${input.productId} nicht gefunden`);
    }
    productContext = {
      category: product.category,
      network: product.network === "5g_swisscom" ? "5g" : product.network === "4g_swisscom" ? "4g" : product.network === "other" ? "other" : undefined,
    };
  } else {
    productContext = { category: brief.kampagne.produkt_kategorie };
  }

  // Phase 1: Hero-Bild und Logo als externe Sample-URLs (Placeholder).
  // Wird in Phase 5 durch Library + AI ersetzt.
  const heroImageUrl =
    "https://placehold.co/300x200/EFEFEF/E61E2A/png?text=Wingo+Hero";
  const logoUrl =
    "https://placehold.co/80x24/EFEFEF/E61E2A/png?text=wingo";

  const result = await runCampaignTracerBullet({
    db,
    storage,
    brandConfig,
    brief,
    language: "de",
    format,
    productContext,
    heroImageUrl,
    logoUrl,
    llm: callClaude,
  });

  revalidatePath("/");
  redirect(`/campaigns/${result.campaign.id}`);
}
