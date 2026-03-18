// Supabase Storage fuer Campaign Assets
// Bucket: campaign-assets (public, 50MB limit)
// Pfad-Struktur: {campaign_id}/{channel}/{format}_{language}.{ext}

import { getServerClient } from "@/lib/db/supabase";

const BUCKET = "campaign-assets";

export interface UploadResult {
  publicUrl: string;
  storagePath: string;
  fileSize: number;
  mimeType: string;
}

/**
 * Base64-Bild nach Supabase Storage hochladen.
 * Akzeptiert data-URLs (data:image/png;base64,...) oder rohes Base64.
 */
export async function uploadFromBase64(
  campaignId: string,
  channel: string,
  format: string,
  language: string,
  base64Data: string,
  ext: string = "png"
): Promise<UploadResult> {
  // Data-URL oder rohes Base64 parsen
  let mimeType = `image/${ext}`;
  let rawBase64 = base64Data;

  if (base64Data.startsWith("data:")) {
    const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      rawBase64 = match[2];
      // Extension aus MIME ableiten
      const extFromMime = mimeType.split("/")[1];
      if (extFromMime) ext = extFromMime;
    }
  }

  const buffer = Buffer.from(rawBase64, "base64");
  const storagePath = buildPath(campaignId, channel, format, language, ext);

  const client = await getServerClient();
  const { error } = await client.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage-Upload fehlgeschlagen: ${error.message}`);
  }

  const { data: urlData } = client.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  return {
    publicUrl: urlData.publicUrl,
    storagePath,
    fileSize: buffer.length,
    mimeType,
  };
}

/**
 * Bild von externer URL nach Supabase Storage hochladen.
 * Fuer DALL-E (temporaere URLs) und andere externe Quellen.
 */
export async function uploadFromUrl(
  campaignId: string,
  channel: string,
  format: string,
  language: string,
  imageUrl: string,
  ext: string = "png"
): Promise<UploadResult> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Bild-Download fehlgeschlagen: HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? `image/${ext}`;
  const buffer = Buffer.from(await response.arrayBuffer());

  // Extension aus Content-Type ableiten
  const extFromMime = contentType.split("/")[1]?.split(";")[0];
  if (extFromMime) ext = extFromMime;

  const storagePath = buildPath(campaignId, channel, format, language, ext);

  const client = await getServerClient();
  const { error } = await client.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage-Upload fehlgeschlagen: ${error.message}`);
  }

  const { data: urlData } = client.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  return {
    publicUrl: urlData.publicUrl,
    storagePath,
    fileSize: buffer.length,
    mimeType: contentType,
  };
}

/**
 * Buffer direkt nach Supabase Storage hochladen.
 * Fuer Server-Side Compositing Output.
 */
export async function uploadBuffer(
  campaignId: string,
  channel: string,
  format: string,
  language: string,
  buffer: Buffer,
  mimeType: string,
  ext: string = "png"
): Promise<UploadResult> {
  const storagePath = buildPath(campaignId, channel, format, language, ext);

  const client = await getServerClient();
  const { error } = await client.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage-Upload fehlgeschlagen: ${error.message}`);
  }

  const { data: urlData } = client.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  return {
    publicUrl: urlData.publicUrl,
    storagePath,
    fileSize: buffer.length,
    mimeType,
  };
}

/**
 * Hero-Bild-Kandidat hochladen (eigener Pfad).
 */
export async function uploadHeroCandidate(
  campaignId: string,
  candidateIndex: number,
  base64Data: string,
  ext: string = "png"
): Promise<UploadResult> {
  let mimeType = `image/${ext}`;
  let rawBase64 = base64Data;

  if (base64Data.startsWith("data:")) {
    const match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1];
      rawBase64 = match[2];
      const extFromMime = mimeType.split("/")[1];
      if (extFromMime) ext = extFromMime;
    }
  }

  const buffer = Buffer.from(rawBase64, "base64");
  const storagePath = `${campaignId}/hero/candidate_${candidateIndex}.${ext}`;

  const client = await getServerClient();
  const { error } = await client.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Hero-Upload fehlgeschlagen: ${error.message}`);
  }

  const { data: urlData } = client.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);

  return {
    publicUrl: urlData.publicUrl,
    storagePath,
    fileSize: buffer.length,
    mimeType,
  };
}

/**
 * Public URL fuer einen Storage-Pfad abrufen.
 */
export async function getPublicUrl(storagePath: string): Promise<string> {
  const client = await getServerClient();
  const { data } = client.storage
    .from(BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Asset aus Storage loeschen.
 */
export async function deleteFromStorage(storagePath: string): Promise<void> {
  const client = await getServerClient();
  const { error } = await client.storage
    .from(BUCKET)
    .remove([storagePath]);

  if (error) {
    throw new Error(`Storage-Loeschung fehlgeschlagen: ${error.message}`);
  }
}

// Pfad-Struktur: {campaign_id}/{channel}/{format}_{language}.{ext}
function buildPath(
  campaignId: string,
  channel: string,
  format: string,
  language: string,
  ext: string
): string {
  const timestamp = Date.now();
  return `${campaignId}/${channel}/${format}_${language}_${timestamp}.${ext}`;
}
