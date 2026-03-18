import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { getCachedFile, getManualFile, listManualFiles } from "@/lib/ai/brand-brain/drive-cache";
import { buildFrontifyConfig } from "@/lib/integrations/frontify";
import { buildDriveConfig } from "@/lib/integrations/google-drive";

// Brand Brain Dateien und ihre Quellen-Prioritaet
const BRAND_BRAIN_FILES = [
  { key: "tone-of-voice", label: "Tone of Voice", fileKey: "tone-of-voice.md", frontifyKey: "frontify:tone-of-voice", driveKey: "tone-of-voice.md" },
  { key: "ci-rules", label: "CI-Rules (Farben, Typo, Logo)", fileKey: "ci-rules.json", frontifyKey: "frontify:ci-rules", driveKey: "ci-rules.json" },
  { key: "glossar-de", label: "Glossar (DE)", fileKey: "glossar-de.json", frontifyKey: "frontify:glossar-de", driveKey: "glossar-de.json" },
  { key: "glossar-fr", label: "Glossar (FR)", fileKey: "glossar-fr.json", frontifyKey: null, driveKey: "glossar-fr.json" },
  { key: "glossar-it", label: "Glossar (IT)", fileKey: "glossar-it.json", frontifyKey: null, driveKey: "glossar-it.json" },
  { key: "glossar-en", label: "Glossar (EN)", fileKey: "glossar-en.json", frontifyKey: null, driveKey: "glossar-en.json" },
  { key: "golden-examples", label: "Golden Examples", fileKey: "golden-examples.json", frontifyKey: null, driveKey: "golden-examples.json" },
];

export interface BrandBrainFileStatus {
  key: string;
  label: string;
  fileKey: string;
  cached: boolean;
  source: "manual" | "frontify" | "drive" | "local" | "none";
  manualUpload?: { uploadedAt: string; originalFilename?: string };
}

export interface BrandBrainStatus {
  frontify: {
    configured: boolean;
    domain: string | null;
  };
  drive: {
    configured: boolean;
    folderId: string | null;
  };
  files: BrandBrainFileStatus[];
}

// GET /api/brand-brain/status
export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  const frontifyConfig = buildFrontifyConfig();
  const driveConfig = buildDriveConfig();

  // Manual-Uploads laden
  const manualFiles = await listManualFiles();
  const manualMap = new Map(manualFiles.map((f) => [f.fileKey, f]));

  // Status fuer jede Datei pruefen
  const files: BrandBrainFileStatus[] = await Promise.all(
    BRAND_BRAIN_FILES.map(async (file) => {
      // Stufe 0: Manual-Upload pruefen
      const manual = manualMap.get(file.fileKey);
      if (manual) {
        return {
          key: file.key,
          label: file.label,
          fileKey: file.fileKey,
          cached: true,
          source: "manual" as const,
          manualUpload: {
            uploadedAt: manual.uploadedAt,
            originalFilename: manual.originalFilename,
          },
        };
      }

      // Frontify-Cache pruefen
      if (file.frontifyKey) {
        try {
          const cached = await getCachedFile(file.frontifyKey);
          if (cached !== null) {
            return { key: file.key, label: file.label, fileKey: file.fileKey, cached: true, source: "frontify" as const };
          }
        } catch {
          // Weiter
        }
      }

      // Drive-Cache pruefen
      try {
        const cached = await getCachedFile(file.driveKey);
        if (cached !== null) {
          return { key: file.key, label: file.label, fileKey: file.fileKey, cached: true, source: "drive" as const };
        }
      } catch {
        // Weiter
      }

      return {
        key: file.key,
        label: file.label,
        fileKey: file.fileKey,
        cached: false,
        source: (driveConfig ? "drive" : "local") as "drive" | "local" | "none",
      };
    })
  );

  const status: BrandBrainStatus = {
    frontify: {
      configured: !!frontifyConfig,
      domain: frontifyConfig?.domain ?? null,
    },
    drive: {
      configured: !!driveConfig,
      folderId: driveConfig?.folderId ?? null,
    },
    files,
  };

  return NextResponse.json(status);
}
