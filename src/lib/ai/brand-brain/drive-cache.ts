import { getServerClient } from "@/lib/db/supabase";

const BUCKET = "brand-brain";

// Prefix fuer manuell hochgeladene Dateien (kein TTL, hoechste Prioritaet)
const MANUAL_PREFIX = "manual/";

// Sidecar-Metadaten fuer Cache-Eintraege
interface CacheMeta {
  cachedAt: string; // ISO timestamp
  driveModifiedTime?: string;
  fileKey: string;
  source?: "manual" | "frontify" | "drive";
}

/**
 * TTL in Sekunden aus Env-Var oder Default 3600 (1 Stunde)
 */
function getCacheTtlSeconds(): number {
  const envVal = process.env.BRAND_BRAIN_CACHE_TTL_SECONDS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 3600;
}

/**
 * Gecachte Datei laden falls TTL noch gueltig.
 * Gibt null zurueck wenn Cache leer oder abgelaufen.
 */
export async function getCachedFile(
  fileKey: string
): Promise<string | null> {
  const supabase = await getServerClient();
  const metaPath = `${fileKey}.meta.json`;

  // Meta-Sidecar laden
  const { data: metaBlob, error: metaError } = await supabase.storage
    .from(BUCKET)
    .download(metaPath);

  if (metaError || !metaBlob) {
    return null;
  }

  try {
    const metaText = await metaBlob.text();
    const meta = JSON.parse(metaText) as CacheMeta;

    // TTL pruefen
    const cachedAt = new Date(meta.cachedAt).getTime();
    const ttlMs = getCacheTtlSeconds() * 1000;
    if (Date.now() - cachedAt > ttlMs) {
      return null; // Abgelaufen
    }
  } catch {
    return null; // Korrupte Meta-Datei
  }

  // Content laden
  const { data: contentBlob, error: contentError } = await supabase.storage
    .from(BUCKET)
    .download(fileKey);

  if (contentError || !contentBlob) {
    return null;
  }

  return contentBlob.text();
}

/**
 * Datei + Meta in Supabase Storage Cache schreiben.
 */
export async function setCachedFile(
  fileKey: string,
  content: string,
  driveModifiedTime?: string
): Promise<void> {
  const supabase = await getServerClient();

  const meta: CacheMeta = {
    cachedAt: new Date().toISOString(),
    driveModifiedTime,
    fileKey,
  };

  // Content + Meta parallel schreiben
  const contentPromise = supabase.storage
    .from(BUCKET)
    .upload(fileKey, new Blob([content]), {
      upsert: true,
      contentType: fileKey.endsWith(".json")
        ? "application/json"
        : fileKey.endsWith(".md")
          ? "text/markdown"
          : "text/plain",
    });

  const metaPromise = supabase.storage
    .from(BUCKET)
    .upload(`${fileKey}.meta.json`, new Blob([JSON.stringify(meta)]), {
      upsert: true,
      contentType: "application/json",
    });

  const [contentResult, metaResult] = await Promise.all([
    contentPromise,
    metaPromise,
  ]);

  if (contentResult.error) {
    console.warn(`[Drive-Cache] Content-Upload fehlgeschlagen fuer ${fileKey}:`, contentResult.error);
  }
  if (metaResult.error) {
    console.warn(`[Drive-Cache] Meta-Upload fehlgeschlagen fuer ${fileKey}:`, metaResult.error);
  }
}

/**
 * Cache invalidieren — einzelne Datei oder alle.
 * Manual-Uploads werden NICHT geloescht (nur explizit via deleteManualFile).
 */
export async function invalidateCache(
  fileKey?: string
): Promise<void> {
  const supabase = await getServerClient();

  if (fileKey) {
    // Einzelne Datei + Meta loeschen (nur wenn nicht manual/)
    if (!fileKey.startsWith(MANUAL_PREFIX)) {
      await supabase.storage
        .from(BUCKET)
        .remove([fileKey, `${fileKey}.meta.json`]);
    }
    return;
  }

  // Alle Dateien im Bucket loeschen AUSSER manual/
  const { data: files } = await supabase.storage
    .from(BUCKET)
    .list();

  if (files && files.length > 0) {
    const paths = files
      .map((f) => f.name)
      .filter((name) => !name.startsWith(MANUAL_PREFIX));
    if (paths.length > 0) {
      await supabase.storage.from(BUCKET).remove(paths);
    }
  }
}

// --- Manual Upload Functions (kein TTL, hoechste Prioritaet) ---

/**
 * Manuell hochgeladene Datei lesen.
 * Manual-Uploads haben kein TTL — sie gelten bis sie explizit geloescht werden.
 */
export async function getManualFile(
  fileKey: string
): Promise<string | null> {
  const supabase = await getServerClient();
  const storagePath = `${MANUAL_PREFIX}${fileKey}`;

  const { data: blob, error } = await supabase.storage
    .from(BUCKET)
    .download(storagePath);

  if (error || !blob) {
    return null;
  }

  return blob.text();
}

/**
 * Datei als Manual-Upload speichern.
 * Ueberschreibt bestehende Datei mit gleichem Key.
 */
export async function setManualFile(
  fileKey: string,
  content: string,
  originalFilename?: string
): Promise<void> {
  const supabase = await getServerClient();
  const storagePath = `${MANUAL_PREFIX}${fileKey}`;
  const metaPath = `${MANUAL_PREFIX}${fileKey}.meta.json`;

  const meta: CacheMeta = {
    cachedAt: new Date().toISOString(),
    fileKey,
    source: "manual",
  };

  const contentType = fileKey.endsWith(".json")
    ? "application/json"
    : fileKey.endsWith(".md")
      ? "text/markdown"
      : "text/plain";

  const [contentResult, metaResult] = await Promise.all([
    supabase.storage.from(BUCKET).upload(storagePath, new Blob([content]), {
      upsert: true,
      contentType,
    }),
    supabase.storage.from(BUCKET).upload(metaPath, new Blob([JSON.stringify({
      ...meta,
      originalFilename,
    })]), {
      upsert: true,
      contentType: "application/json",
    }),
  ]);

  if (contentResult.error) {
    throw new Error(`Manual-Upload fehlgeschlagen: ${contentResult.error.message}`);
  }
  if (metaResult.error) {
    console.warn(`[Brand Brain] Meta-Upload Warnung fuer ${fileKey}:`, metaResult.error);
  }
}

/**
 * Manual-Upload loeschen.
 */
export async function deleteManualFile(
  fileKey: string
): Promise<void> {
  const supabase = await getServerClient();
  await supabase.storage
    .from(BUCKET)
    .remove([
      `${MANUAL_PREFIX}${fileKey}`,
      `${MANUAL_PREFIX}${fileKey}.meta.json`,
    ]);
}

/**
 * Alle Manual-Uploads auflisten.
 * Gibt fileKeys zurueck (ohne manual/ Prefix und ohne .meta.json).
 */
export async function listManualFiles(): Promise<Array<{
  fileKey: string;
  uploadedAt: string;
  originalFilename?: string;
}>> {
  const supabase = await getServerClient();
  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list(MANUAL_PREFIX);

  if (error || !files) return [];

  const results: Array<{
    fileKey: string;
    uploadedAt: string;
    originalFilename?: string;
  }> = [];

  for (const file of files) {
    // Meta-Dateien ueberspringen
    if (file.name.endsWith(".meta.json")) continue;

    // Meta laden fuer uploadedAt
    let uploadedAt = file.created_at ?? new Date().toISOString();
    let originalFilename: string | undefined;

    try {
      const { data: metaBlob } = await supabase.storage
        .from(BUCKET)
        .download(`${MANUAL_PREFIX}${file.name}.meta.json`);

      if (metaBlob) {
        const meta = JSON.parse(await metaBlob.text()) as CacheMeta & { originalFilename?: string };
        uploadedAt = meta.cachedAt;
        originalFilename = meta.originalFilename;
      }
    } catch {
      // Meta nicht verfuegbar
    }

    results.push({ fileKey: file.name, uploadedAt, originalFilename });
  }

  return results;
}
