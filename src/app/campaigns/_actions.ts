"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/server";
import { getActiveBrandConfig } from "@/lib/brand/server";
import {
  callClaude,
  type ClaudeCallOptions,
  type ClaudeResponse,
} from "@/lib/ai/claude";
import { briefSchema, type Brief } from "@/lib/schemas/brief";
import { createCampaign } from "@/lib/db/queries/campaigns";
import { matchDisclaimers } from "@/lib/db/queries/disclaimers";
import { generateCopy, type CopyOutput } from "@/lib/copy/generateCopy";
import { writeAudit } from "@/lib/db/queries/audit";
import { getProductById } from "@/lib/db/queries/products";

// Bind callClaude's generic to CopyOutput fuer generateCopy's llm-Parameter
const claudeForCopy = callClaude as (
  opts: ClaudeCallOptions
) => Promise<ClaudeResponse<CopyOutput>>;

interface SubmitBriefArgs {
  brief: Brief;
  productId?: string;
}

// Phase 2 Submit: createCampaign + generateCopy — danach landet User auf
// /campaigns/[id] und durchlaeuft die 5 Gates manuell.
export async function submitBriefAction(input: SubmitBriefArgs) {
  const brief = briefSchema.parse(input.brief);

  const db = getDb();
  const brandConfig = await getActiveBrandConfig();

  let productContext: {
    category: "mobile" | "tv" | "internet";
    network?: "5g" | "4g" | "other";
  };
  if (input.productId) {
    const product = await getProductById(db, input.productId);
    if (!product) throw new Error(`Produkt ${input.productId} nicht gefunden`);
    productContext = {
      category: product.category,
      network:
        product.network === "5g_swisscom"
          ? "5g"
          : product.network === "4g_swisscom"
            ? "4g"
            : product.network === "other"
              ? "other"
              : undefined,
    };
  } else {
    productContext = { category: brief.kampagne.produkt_kategorie };
  }

  const campaign = await createCampaign(db, {
    brand_id: brandConfig.brand.id,
    product_id: input.productId,
    brief,
  });

  await writeAudit(db, {
    campaignId: campaign.id,
    event: "BRIEF_SUBMITTED",
    payload: { brief },
  });

  // Transition created -> copy_pending (technische Transition, kein Gate)
  await db.query(
    `UPDATE campaigns SET status = 'copy_pending', updated_at = now() WHERE id = $1`,
    [campaign.id]
  );

  // Sofort Copy generieren — User trifft auf /campaigns/[id] mit 3 Headlines
  const disclaimers = await matchDisclaimers(
    db,
    brandConfig.brand.id,
    productContext
  );
  let copy: Awaited<ReturnType<typeof generateCopy>>;
  try {
    copy = await generateCopy(db, {
      campaignId: campaign.id,
      brief,
      brandConfig,
      language: "de",
      disclaimers,
      llm: claudeForCopy,
    });
  } catch (e) {
    // Copy-Generierung (Anthropic) fehlgeschlagen (z.B. 529 Overloaded / 500) —
    // die frisch angelegte Kampagne aufraeumen statt einen Halb-Zustand zu
    // hinterlassen, und eine KLARE Meldung werfen statt eines generischen 500.
    await db.query(`DELETE FROM audit_log WHERE campaign_id = $1`, [campaign.id]);
    await db.query(`DELETE FROM campaign_briefs WHERE campaign_id = $1`, [campaign.id]);
    await db.query(`DELETE FROM campaigns WHERE id = $1`, [campaign.id]);
    const detail = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Copy-Generierung fehlgeschlagen — die Anthropic-API ist momentan ueberlastet oder gestoert. ` +
        `Bitte in ein bis zwei Minuten erneut versuchen. (${detail.slice(0, 160)})`
    );
  }

  await writeAudit(db, {
    campaignId: campaign.id,
    event: "COPY_GENERATED",
    payload: {
      language: "de",
      // Welche TOV-Matrix-Zelle (oder Default) den Ton bestimmt hat — Debug-Trace.
      voiceVariant: {
        id: copy.voiceVariant.id,
        is_default: copy.voiceVariant.is_default,
        kampagne_art: copy.voiceVariant.kampagne_art,
        zielgruppe: copy.voiceVariant.zielgruppe,
      },
    },
  });

  revalidatePath("/");
  redirect(`/campaigns/${campaign.id}`);
}
