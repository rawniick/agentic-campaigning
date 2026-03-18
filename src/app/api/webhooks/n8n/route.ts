import { NextResponse } from "next/server";
import { z } from "zod";
import crypto from "crypto";
import { updateCampaignStatus, updateCampaign, getCampaignById } from "@/lib/db/queries/campaigns";
import { logAuditEvent } from "@/lib/db/queries/approvals";
import type { CampaignStatus } from "@/types/database";

const WebhookSchema = z.object({
  action: z.enum([
    "generate_strategy",
    "generate_concept",
    "translate",
    "generate_content",
    "distribute",
    "archive",
    "status_update",
    "register_resume_url",
    "start_pipeline",
  ]),
  campaignId: z.string().uuid(),
  data: z.record(z.string(), z.unknown()).optional(),
});

// Timing-Safe Bearer-Token Validierung
function validateAuth(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.N8N_API_KEY;

  if (!secret || !authHeader) return false;

  const expected = `Bearer ${secret}`;
  if (authHeader.length !== expected.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(authHeader),
    Buffer.from(expected)
  );
}

export async function POST(request: Request) {
  // Auth pruefen
  if (!validateAuth(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const parsed = WebhookSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Ungueltige Eingabe", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, campaignId, data } = parsed.data;

    // Kampagne existiert?
    await getCampaignById(campaignId);

    // Aktion dispatchen
    const result = await dispatchAction(action, campaignId, data);

    await logAuditEvent(campaignId, `n8n_webhook_${action}`, {
      action,
      data,
      result,
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function dispatchAction(
  action: string,
  campaignId: string,
  data?: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const baseUrl = process.env.NEXTJS_APP_URL ?? "http://localhost:3000";

  switch (action) {
    case "generate_strategy": {
      const res = await fetch(`${baseUrl}/api/generate/strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      return await res.json();
    }

    case "generate_concept": {
      const strategyIndex = (data?.strategyIndex as number) ?? 0;
      const res = await fetch(`${baseUrl}/api/generate/concept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, strategyIndex }),
      });
      return await res.json();
    }

    case "translate": {
      const res = await fetch(`${baseUrl}/api/generate/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      return await res.json();
    }

    case "generate_content": {
      const res = await fetch(`${baseUrl}/api/generate/content`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      return await res.json();
    }

    case "distribute": {
      const platforms = (data?.platforms as string[]) ?? ["meta", "google_ads", "google_drive"];
      const res = await fetch(`${baseUrl}/api/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, platforms }),
      });
      return await res.json();
    }

    case "archive": {
      const res = await fetch(`${baseUrl}/api/export/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      return await res.json();
    }

    case "status_update": {
      const VALID_STATUSES: CampaignStatus[] = [
        "draft", "input_complete", "strategy_proposed", "strategy_selected",
        "concept_generated", "concept_approved", "translating", "translations_ready",
        "translations_approved", "rendering_assets", "assets_ready", "assets_approved",
        "distributing", "published", "archived",
      ];
      const newStatus = data?.status as string;
      if (newStatus && VALID_STATUSES.includes(newStatus as CampaignStatus)) {
        await updateCampaignStatus(campaignId, newStatus as CampaignStatus);
        return { status: newStatus };
      }
      return { error: `Ungueltiger Status: ${newStatus}` };
    }

    // Backup-Mechanismus: n8n registriert seine Resume-URL explizit
    case "register_resume_url": {
      const resumeUrl = data?.resumeUrl as string;
      if (!resumeUrl) {
        return { error: "resumeUrl ist Pflicht" };
      }
      await updateCampaign(campaignId, { n8n_resume_url: resumeUrl });
      return { registered: true, resumeUrl };
    }

    // Pipeline ueber Webhook starten (Alternative zu Server Action)
    case "start_pipeline": {
      const res = await fetch(`${baseUrl}/api/generate/strategy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId }),
      });
      return await res.json();
    }

    default:
      return { error: `Unbekannte Aktion: ${action}` };
  }
}
