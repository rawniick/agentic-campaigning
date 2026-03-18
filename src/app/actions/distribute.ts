"use server";

import { revalidatePath } from "next/cache";
import { getAuthUser } from "@/lib/auth/get-user";
import type { DistributionPlatform } from "@/types/database";

interface DistributeResult {
  success: boolean;
  error?: string;
}

// Distribution ueber Export-API triggern
export async function triggerDistribution(
  campaignId: string,
  platforms: DistributionPlatform[]
): Promise<DistributeResult> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Nicht authentifiziert" };

    const baseUrl = process.env.NEXTJS_APP_URL ?? "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal": "true" },
      body: JSON.stringify({ campaignId, platforms }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error ?? "Export fehlgeschlagen" };
    }

    revalidatePath(`/campaigns/${campaignId}`);
    return { success: data.success };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}

// Archivierung auf Google Drive triggern
export async function archiveToDrive(
  campaignId: string
): Promise<DistributeResult> {
  try {
    const user = await getAuthUser();
    if (!user) return { success: false, error: "Nicht authentifiziert" };

    const baseUrl = process.env.NEXTJS_APP_URL ?? "http://localhost:3000";

    const response = await fetch(`${baseUrl}/api/export/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal": "true" },
      body: JSON.stringify({ campaignId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error ?? "Archivierung fehlgeschlagen" };
    }

    revalidatePath(`/campaigns/${campaignId}`);
    return { success: data.success };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return { success: false, error: message };
  }
}
