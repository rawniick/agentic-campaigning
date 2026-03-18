import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import {
  getManualFile,
  setManualFile,
  deleteManualFile,
  listManualFiles,
} from "@/lib/ai/brand-brain/drive-cache";

// Erlaubte Datei-Keys fuer Upload
const ALLOWED_FILE_KEYS = [
  "tone-of-voice.md",
  "ci-rules.json",
  "glossar-de.json",
  "glossar-fr.json",
  "glossar-it.json",
  "glossar-en.json",
  "golden-examples.json",
];

// GET /api/brand-brain/files — Liste aller manuell hochgeladenen Dateien
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  try {
    const files = await listManualFiles();
    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json(
      { error: "Dateien konnten nicht geladen werden", details: String(err) },
      { status: 500 }
    );
  }
}

// POST /api/brand-brain/files — Datei hochladen
// Body: multipart/form-data mit "file" (File) und "fileKey" (string)
// ODER: application/json mit "fileKey" und "content"
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  let fileKey: string;
  let content: string;
  let originalFilename: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    // File-Upload via FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    fileKey = formData.get("fileKey") as string;

    if (!file || !fileKey) {
      return NextResponse.json(
        { error: "file und fileKey sind erforderlich" },
        { status: 400 }
      );
    }

    content = await file.text();
    originalFilename = file.name;
  } else {
    // JSON-Upload (z.B. aus Editor)
    try {
      const body = (await request.json()) as {
        fileKey: string;
        content: string;
        originalFilename?: string;
      };
      fileKey = body.fileKey;
      content = body.content;
      originalFilename = body.originalFilename;
    } catch {
      return NextResponse.json(
        { error: "Ungueltiger Request Body" },
        { status: 400 }
      );
    }
  }

  if (!fileKey || !content) {
    return NextResponse.json(
      { error: "fileKey und content sind erforderlich" },
      { status: 400 }
    );
  }

  // Validierung: Nur erlaubte Datei-Keys
  if (!ALLOWED_FILE_KEYS.includes(fileKey)) {
    return NextResponse.json(
      {
        error: `Ungueltiger fileKey. Erlaubt: ${ALLOWED_FILE_KEYS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // JSON-Dateien validieren
  if (fileKey.endsWith(".json")) {
    try {
      JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: "Datei ist kein gueltiges JSON" },
        { status: 400 }
      );
    }
  }

  try {
    await setManualFile(fileKey, content, originalFilename);
    return NextResponse.json({
      success: true,
      fileKey,
      size: content.length,
      originalFilename,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Upload fehlgeschlagen", details: String(err) },
      { status: 500 }
    );
  }
}

// DELETE /api/brand-brain/files?fileKey=xxx — Datei loeschen
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const fileKey = request.nextUrl.searchParams.get("fileKey");
  if (!fileKey) {
    return NextResponse.json(
      { error: "fileKey Parameter erforderlich" },
      { status: 400 }
    );
  }

  try {
    await deleteManualFile(fileKey);
    return NextResponse.json({ success: true, deleted: fileKey });
  } catch (err) {
    return NextResponse.json(
      { error: "Loeschen fehlgeschlagen", details: String(err) },
      { status: 500 }
    );
  }
}
