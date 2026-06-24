"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/lib/db/server";
import { getActiveBrandConfig } from "@/lib/brand/server";
import {
  callClaude,
  type ClaudeCallOptions,
  type ClaudeResponse,
} from "@/lib/ai/claude";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { findVoiceVariant } from "@/lib/db/queries/brand-voice";
import { refineCopy } from "@/lib/copy/refineCopy";
import type { CopyOutput } from "@/lib/copy/generateCopy";
import {
  getGateChat,
  appendGateChatTurn,
} from "@/lib/db/queries/gate-chat";

// callClaude liefert generisch ClaudeResponse<unknown> — wir binden den Generic
// auf das Refine-Output-Schema (rationale + copy-felder), genau wie _actions.ts
// claudeForCopy auf CopyOutput bindet. Cast statt Wrapper, da callClaude die
// Struktur per parseJsonResponse zur Laufzeit erzeugt.
const llmForRefine = callClaude as (
  opts: ClaudeCallOptions
) => Promise<
  ClaudeResponse<{
    rationale: string;
    headlines: string[];
    subline: string;
    cta_label: string;
  }>
>;

const refineSchema = z.object({
  campaignId: z.string().uuid(),
  userMessage: z.string().min(1, "Feedback darf nicht leer sein"),
});

// Gate-1 Chat-Refinement: nimmt das Marketer-Feedback, laedt den aktuellen
// de-Copy-Stand + bisherigen Dialog und laesst Claude die Kandidaten verfeinern.
// Persistiert User- und Assistant-Turn in gate_chat (Audit + Wiederaufnahme).
export async function refineCopyChatAction(input: {
  campaignId: string;
  userMessage: string;
}): Promise<{ rationale: string; candidates: CopyOutput }> {
  const { campaignId, userMessage } = refineSchema.parse(input);

  const db = getDb();
  const brand = await getActiveBrandConfig();

  const campaign = await getCampaignById(db, campaignId);
  if (!campaign) {
    throw new Error(`Kampagne ${campaignId} nicht gefunden`);
  }

  // Aktuellen de-Copy-Stand laden (der Kandidaten-Ausgangspunkt fuers Refinement).
  const copyRes = await db.query<{
    headlines: string[];
    subline: string;
    cta_label: string;
  }>(
    `SELECT headlines, subline, cta_label
       FROM campaign_copy
      WHERE campaign_id = $1 AND language = 'de'
      LIMIT 1`,
    [campaignId]
  );
  const copyRow = copyRes.rows[0];
  if (!copyRow) {
    throw new Error(
      `Keine de-Copy fuer Kampagne ${campaignId} — Gate 1 noch nicht durchlaufen`
    );
  }
  const current: CopyOutput = {
    headlines: copyRow.headlines,
    subline: copyRow.subline,
    cta_label: copyRow.cta_label,
  };

  // Bisherigen Dialog (de, Gate copy) als History fuer den LLM-Kontext laden.
  const priorTurns = await getGateChat(db, campaignId, "copy", "de");
  const history = priorTurns.map((t) => ({ role: t.role, content: t.content }));

  // TOV wie in generateCopy: art-/zielgruppen-spezifische Matrix-Zelle, sonst Default.
  const voiceVariant = await findVoiceVariant(
    db,
    brand.brand.id,
    campaign.brief.kampagne.art,
    campaign.brief.vermarktung.zielgruppe
  );

  // User-Turn ZUERST persistieren — so bleibt das Feedback erhalten, auch wenn
  // der LLM-Call scheitert (kein verlorener Marketer-Input).
  await appendGateChatTurn(db, {
    campaignId,
    gate: "copy",
    language: "de",
    role: "user",
    content: userMessage,
  });

  const result = await refineCopy({
    brief: campaign.brief,
    tovMd: voiceVariant.tov_md,
    passthroughTerms: brand.glossar.passthrough_terms,
    current,
    history,
    userMessage,
    language: "de",
    llm: llmForRefine,
  });

  // Assistant-Turn mit Begruendung + erzeugtem Kandidaten-Set persistieren.
  await appendGateChatTurn(db, {
    campaignId,
    gate: "copy",
    language: "de",
    role: "assistant",
    content: result.rationale,
    candidates: result.candidates,
  });

  revalidatePath(`/campaigns/${campaignId}`);
  return { rationale: result.rationale, candidates: result.candidates };
}

const applySchema = z.object({
  campaignId: z.string().uuid(),
  candidates: z.object({
    headlines: z.array(z.string()),
    subline: z.string(),
    cta_label: z.string(),
  }),
});

// Uebernimmt ein Kandidaten-Set als neuen de-Copy-Stand. Setzt
// selected_headline_idx zurueck (NULL), weil die Headlines neu sind und die
// Gate-1-Auswahl damit ungueltig wird — der Marketer waehlt erneut.
export async function applyCopyCandidatesAction(input: {
  campaignId: string;
  candidates: CopyOutput;
}): Promise<void> {
  const { campaignId, candidates } = applySchema.parse(input);

  const db = getDb();
  await db.query(
    `UPDATE campaign_copy
        SET headlines = $2,
            subline = $3,
            cta_label = $4,
            selected_headline_idx = NULL,
            updated_at = now()
      WHERE campaign_id = $1 AND language = 'de'`,
    [campaignId, candidates.headlines, candidates.subline, candidates.cta_label]
  );

  revalidatePath(`/campaigns/${campaignId}`);
}
