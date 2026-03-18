import { google } from "googleapis";
import { JWT } from "google-auth-library";

// Konfiguration fuer Google Drive Service Account
export interface DriveConfig {
  auth: JWT;
  folderId: string;
}

// Write-Config fuer Archivierung (separater Ordner, erweiterte Scopes)
export interface DriveWriteConfig {
  auth: JWT;
  archiveFolderId: string;
}

// Typed Error Codes fuer Drive-Operationen
export type DriveErrorCode =
  | "UNAUTHENTICATED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UNKNOWN";

export class DriveError extends Error {
  constructor(
    public readonly code: DriveErrorCode,
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "DriveError";
  }
}

// Datei-Info aus Drive Folder Listing
export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
}

/**
 * Drive-Konfiguration aus Env-Vars erstellen.
 * Gibt null zurueck wenn nicht konfiguriert (= Filesystem-Fallback nutzen).
 */
export function buildDriveConfig(): DriveConfig | null {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!keyBase64 || !folderId) {
    return null;
  }

  try {
    const keyJson = JSON.parse(
      Buffer.from(keyBase64, "base64").toString("utf-8")
    ) as { client_email: string; private_key: string };

    const auth = new JWT({
      email: keyJson.client_email,
      key: keyJson.private_key,
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    return { auth, folderId };
  } catch (err) {
    console.warn("[Google Drive] Service Account Key konnte nicht gelesen werden:", err);
    return null;
  }
}

/**
 * Alle Dateien im konfigurierten Drive-Ordner auflisten.
 * Gibt Map<filename, DriveFileInfo> zurueck.
 */
export async function listDriveFolder(
  config: DriveConfig
): Promise<Map<string, DriveFileInfo>> {
  const drive = google.drive({ version: "v3", auth: config.auth });

  try {
    const response = await drive.files.list({
      q: `'${config.folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType, modifiedTime)",
      pageSize: 100,
    });

    const files = response.data.files ?? [];
    const fileMap = new Map<string, DriveFileInfo>();

    for (const file of files) {
      if (file.id && file.name && file.mimeType && file.modifiedTime) {
        fileMap.set(file.name, {
          id: file.id,
          name: file.name,
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
        });
      }
    }

    return fileMap;
  } catch (err) {
    throw mapDriveError(err);
  }
}

/**
 * Einzelne Datei aus Drive herunterladen.
 * Native Files (JSON, MD) werden direkt geladen.
 * Google Docs werden als Plain Text exportiert.
 */
export async function fetchDriveFile(
  config: DriveConfig,
  fileId: string,
  mimeType: string
): Promise<string> {
  const drive = google.drive({ version: "v3", auth: config.auth });

  try {
    // Google Docs muessen exportiert werden
    if (mimeType === "application/vnd.google-apps.document") {
      const response = await drive.files.export({
        fileId,
        mimeType: "text/plain",
      });
      return String(response.data);
    }

    // Native Dateien (JSON, MD, TXT) direkt herunterladen
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "text" }
    );
    return String(response.data);
  } catch (err) {
    throw mapDriveError(err);
  }
}

/**
 * Drive-Write-Konfiguration fuer Archivierung.
 * Gibt null zurueck wenn nicht konfiguriert (= Mock-Modus).
 */
export function buildDriveWriteConfig(): DriveWriteConfig | null {
  const keyBase64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const archiveFolderId = process.env.GOOGLE_DRIVE_ARCHIVE_FOLDER_ID;

  if (!keyBase64 || !archiveFolderId) {
    return null;
  }

  try {
    const keyJson = JSON.parse(
      Buffer.from(keyBase64, "base64").toString("utf-8")
    ) as { client_email: string; private_key: string };

    const auth = new JWT({
      email: keyJson.client_email,
      key: keyJson.private_key,
      scopes: [
        "https://www.googleapis.com/auth/drive.readonly",
        "https://www.googleapis.com/auth/drive.file",
      ],
    });

    return { auth, archiveFolderId };
  } catch (err) {
    console.warn("[Google Drive Write] Service Account Key konnte nicht gelesen werden:", err);
    return null;
  }
}

/**
 * Ordner in Drive erstellen.
 * Mock: gibt Placeholder zurueck.
 */
export async function createFolder(
  config: DriveWriteConfig | null,
  name: string,
  parentFolderId?: string
): Promise<{ id: string; url: string }> {
  if (!config) {
    const mockId = `mock_folder_${Date.now()}`;
    return {
      id: mockId,
      url: `https://drive.google.com/drive/folders/${mockId}`,
    };
  }

  const drive = google.drive({ version: "v3", auth: config.auth });

  try {
    const response = await drive.files.create({
      requestBody: {
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentFolderId ?? config.archiveFolderId],
      },
      fields: "id, webViewLink",
    });

    const id = response.data.id ?? "unknown";
    return {
      id,
      url: response.data.webViewLink ?? `https://drive.google.com/drive/folders/${id}`,
    };
  } catch (err) {
    throw mapDriveError(err);
  }
}

/**
 * Datei (Buffer) in Drive hochladen.
 * Mock: gibt Placeholder zurueck.
 */
export async function uploadFile(
  config: DriveWriteConfig | null,
  params: { name: string; content: Buffer | string; mimeType: string; folderId: string }
): Promise<{ id: string; url: string }> {
  if (!config) {
    const mockId = `mock_file_${Date.now()}`;
    return {
      id: mockId,
      url: `https://drive.google.com/file/d/${mockId}`,
    };
  }

  const drive = google.drive({ version: "v3", auth: config.auth });
  const { Readable } = await import("stream");

  try {
    const content = typeof params.content === "string"
      ? Buffer.from(params.content, "utf-8")
      : params.content;

    const response = await drive.files.create({
      requestBody: {
        name: params.name,
        parents: [params.folderId],
      },
      media: {
        mimeType: params.mimeType,
        body: Readable.from(content),
      },
      fields: "id, webViewLink",
    });

    const id = response.data.id ?? "unknown";
    return {
      id,
      url: response.data.webViewLink ?? `https://drive.google.com/file/d/${id}`,
    };
  } catch (err) {
    throw mapDriveError(err);
  }
}

/**
 * Datei per URL in Drive hochladen (Bild/Asset von externer URL).
 * Mock: gibt Placeholder zurueck.
 */
export async function uploadFileFromUrl(
  config: DriveWriteConfig | null,
  params: { name: string; sourceUrl: string; mimeType: string; folderId: string }
): Promise<{ id: string; url: string }> {
  if (!config) {
    const mockId = `mock_file_${Date.now()}`;
    return {
      id: mockId,
      url: `https://drive.google.com/file/d/${mockId}`,
    };
  }

  // Datei herunterladen
  const response = await fetch(params.sourceUrl);
  if (!response.ok) {
    throw new DriveError("UNKNOWN", `Download von ${params.sourceUrl} fehlgeschlagen: HTTP ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  return uploadFile(config, {
    name: params.name,
    content: buffer,
    mimeType: params.mimeType,
    folderId: params.folderId,
  });
}

/**
 * Komplettes Campaign-Archiv auf Drive erstellen.
 * Erstellt Ordnerstruktur und laedt Briefing + Assets hoch.
 */
export async function createCampaignArchive(
  config: DriveWriteConfig | null,
  params: {
    campaignName: string;
    promoId: string;
    briefingJson: string;
    assets: Array<{ name: string; url: string; mimeType: string }>;
  }
): Promise<{ folderId: string; folderUrl: string; fileCount: number }> {
  // Hauptordner: "PROMO-ID - Kampagnenname"
  const folderName = `${params.promoId} - ${params.campaignName}`;
  const folder = await createFolder(config, folderName);

  let fileCount = 0;

  // Briefing als JSON hochladen
  await uploadFile(config, {
    name: "briefing.json",
    content: params.briefingJson,
    mimeType: "application/json",
    folderId: folder.id,
  });
  fileCount++;

  // Assets-Unterordner
  if (params.assets.length > 0) {
    const assetsFolder = await createFolder(config, "assets", folder.id);

    for (const asset of params.assets) {
      await uploadFileFromUrl(config, {
        name: asset.name,
        sourceUrl: asset.url,
        mimeType: asset.mimeType,
        folderId: assetsFolder.id,
      });
      fileCount++;
    }
  }

  return {
    folderId: folder.id,
    folderUrl: folder.url,
    fileCount,
  };
}

// HTTP-Fehler auf typed DriveError mappen
function mapDriveError(err: unknown): DriveError {
  const status = (err as { code?: number })?.code;
  const message =
    (err as { message?: string })?.message ?? "Unbekannter Drive-Fehler";

  if (status === 401 || status === 403) {
    return new DriveError("UNAUTHENTICATED", `Drive Auth-Fehler: ${message}`, err);
  }
  if (status === 404) {
    return new DriveError("NOT_FOUND", `Drive Datei/Ordner nicht gefunden: ${message}`, err);
  }
  if (status === 429) {
    return new DriveError("RATE_LIMITED", `Drive Rate Limit: ${message}`, err);
  }
  return new DriveError("UNKNOWN", `Drive-Fehler: ${message}`, err);
}
