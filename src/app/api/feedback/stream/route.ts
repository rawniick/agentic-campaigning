import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCampaignById } from "@/lib/db/queries/campaigns";
import { getSelectedConcept } from "@/lib/db/queries/concepts";
import { createFeedbackMessage } from "@/lib/db/queries/feedback";

// POST /api/feedback/stream — SSE-Streaming fuer Konzept-Feedback
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Nicht authentifiziert" }), { status: 401 });
  }

  const { campaignId, message, phase } = await request.json() as {
    campaignId: string;
    message: string;
    phase: "draft_concept" | "detail_concept";
  };

  if (!campaignId || !message || !phase) {
    return new Response(JSON.stringify({ error: "campaignId, message und phase sind Pflicht" }), { status: 400 });
  }

  // User-Message speichern
  await createFeedbackMessage(campaignId, phase, "user", message);

  // Kampagne + Konzept laden
  const campaign = await getCampaignById(campaignId);
  const concept = await getSelectedConcept(campaignId);

  // Streaming Response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const client = new Anthropic();
        let fullResponse = "";

        const anthropicStream = client.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: buildFeedbackSystemPrompt(campaign, concept, phase),
          messages: [{ role: "user", content: message }],
        });

        anthropicStream.on("text", (text) => {
          fullResponse += text;
          const event = `data: ${JSON.stringify({ type: "text_delta", data: text })}\n\n`;
          controller.enqueue(encoder.encode(event));
        });

        await anthropicStream.finalMessage();

        // Vollstaendige Antwort als Assistant-Message speichern
        await createFeedbackMessage(
          campaignId,
          phase,
          "assistant",
          fullResponse,
          concept ? {
            leitidee: concept.leitidee,
            claims: concept.claims,
            hero_message: concept.hero_message,
          } : undefined
        );

        // Done-Signal
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Stream-Fehler";
        const event = `data: ${JSON.stringify({ type: "error", data: errorMsg })}\n\n`;
        controller.enqueue(encoder.encode(event));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

function buildFeedbackSystemPrompt(campaign: unknown, concept: unknown, phase: string): string {
  const c = campaign as Record<string, unknown>;
  const co = concept as Record<string, unknown> | null;

  return `Du bist ein Marketing-Strategie-Berater fuer die Marke "${c.brand}".
Du hilfst beim Verfeinern des ${phase === "draft_concept" ? "Grobkonzepts" : "Detailkonzepts"}.

Aktuelles Konzept:
- Leitidee: ${co?.leitidee ?? "Noch nicht definiert"}
- Claims: ${JSON.stringify(co?.claims ?? {})}
- Hero Message: ${co?.hero_message ?? "Noch nicht definiert"}

Produkt: ${c.product_name} (${c.product_type})
Preis: ${c.currency} ${c.price_new}

Antworte auf Deutsch. Sei konkret und praxisorientiert.
Schlage konkrete Textaenderungen vor wenn moeglich.`;
}
