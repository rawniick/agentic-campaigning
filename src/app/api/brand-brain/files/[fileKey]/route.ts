import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { getManualFile } from "@/lib/ai/brand-brain/drive-cache";

// GET /api/brand-brain/files/[fileKey] — Datei-Inhalt lesen
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileKey: string }> }
) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const { fileKey } = await params;

  try {
    const content = await getManualFile(fileKey);
    if (content === null) {
      return NextResponse.json(
        { error: "Datei nicht gefunden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ fileKey, content, size: content.length });
  } catch (err) {
    return NextResponse.json(
      { error: "Datei konnte nicht geladen werden", details: String(err) },
      { status: 500 }
    );
  }
}
