import type { FetchAssetBytesFn } from "./exportCampaignZip";

// Laedt Asset-Bytes von der (oeffentlichen) Supabase-Storage-URL.
// exportCampaignZip ruft das pro Asset parallel (Promise.all) — hier also nur
// ein einzelner Fetch, frisch bei jedem ZIP-Download (nie stale).
//
// Timeout pro Asset: ein haengender Storage-URL darf nicht den ganzen
// ZIP-Download blockieren (sonst Platform-504 statt sauberem Fehler, weil
// Promise.all auf den langsamsten Fetch wartet).
const FETCH_TIMEOUT_MS = 15_000;

export const fetchAssetBytesFromUrl: FetchAssetBytesFn = async (storageUrl) => {
  let res: Response;
  try {
    res = await fetch(storageUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new Error(
        `Asset-Download Timeout (${FETCH_TIMEOUT_MS}ms) fuer ${storageUrl}`
      );
    }
    throw e;
  }
  if (!res.ok) {
    throw new Error(
      `Asset-Download fehlgeschlagen (${res.status}) fuer ${storageUrl}`
    );
  }
  return Buffer.from(await res.arrayBuffer());
};
