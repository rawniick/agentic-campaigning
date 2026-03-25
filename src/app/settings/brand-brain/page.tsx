"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ExternalLink,
  Database,
  Cloud,
  HardDrive,
  Loader2,
  Plug,
  FileText,
  Palette,
  Type,
  BookOpen,
  Languages,
  Sparkles,
  Upload,
  Trash2,
  Eye,
  X,
  FolderUp,
} from "lucide-react";

// --- Types ---

interface BrandBrainFileStatus {
  key: string;
  label: string;
  fileKey: string;
  cached: boolean;
  source: "manual" | "frontify" | "airtable" | "drive" | "local" | "none";
  manualUpload?: { uploadedAt: string; originalFilename?: string };
}

interface BrandBrainStatus {
  frontify: { configured: boolean; domain: string | null };
  airtable: { configured: boolean; baseId: string | null };
  drive: { configured: boolean; folderId: string | null };
  files: BrandBrainFileStatus[];
}

interface AirtableTestResult {
  success: boolean;
  error?: string;
  bases?: Array<{ id: string; name: string }>;
  selectedBase?: string;
  tables?: Array<{ id: string; name: string; fieldCount: number; fields: Array<{ name: string; type: string }> }>;
  suggestedMappings?: Record<string, string>;
}

interface FrontifyTestResult {
  success: boolean;
  error?: string;
  brands?: Array<{ id: string; name: string }>;
  mappings?: Array<{ pageId: string; pageTitle: string; mappedTo: string }>;
  selectedBrand?: string;
}

// --- Icon + Badge Helpers ---

function getFileIcon(key: string) {
  if (key.startsWith("glossar")) return Languages;
  if (key === "tone-of-voice") return BookOpen;
  if (key === "ci-rules") return Palette;
  if (key === "golden-examples") return Sparkles;
  return FileText;
}

function getSourceBadge(source: string, cached: boolean) {
  if (source === "manual") {
    return <Badge variant="default" className="bg-green-600">Hochgeladen</Badge>;
  }
  if (cached && source === "frontify") {
    return <Badge variant="default" className="bg-violet-600">Frontify</Badge>;
  }
  if (cached && source === "airtable") {
    return <Badge variant="default" className="bg-amber-600">Airtable</Badge>;
  }
  if (cached && source === "drive") {
    return <Badge variant="default" className="bg-blue-600">Google Drive</Badge>;
  }
  if (source === "drive") {
    return <Badge variant="secondary">Drive (nicht gecacht)</Badge>;
  }
  if (source === "local") {
    return <Badge variant="outline">Lokal</Badge>;
  }
  return <Badge variant="destructive">Nicht verfuegbar</Badge>;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// Akzeptierte Dateitypen pro fileKey
function getAcceptType(fileKey: string) {
  if (fileKey.endsWith(".json")) return ".json";
  if (fileKey.endsWith(".md")) return ".md,.txt";
  return ".json,.md,.txt";
}

// --- Page Component ---

export default function BrandBrainSettingsPage() {
  // Status
  const [status, setStatus] = useState<BrandBrainStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  // Frontify
  const [frontifyDomain, setFrontifyDomain] = useState("");
  const [frontifyToken, setFrontifyToken] = useState("");
  const [frontifyBrandId, setFrontifyBrandId] = useState("");
  const [testResult, setTestResult] = useState<FrontifyTestResult | null>(null);
  const [testing, setTesting] = useState(false);

  // Airtable
  const [airtableToken, setAirtableToken] = useState("");
  const [airtableBaseId, setAirtableBaseId] = useState("");
  const [airtableTestResult, setAirtableTestResult] = useState<AirtableTestResult | null>(null);
  const [airtableTesting, setAirtableTesting] = useState(false);
  const [airtableTableMappings, setAirtableTableMappings] = useState<Record<string, string>>({
    toneOfVoice: "",
    ciRules: "",
    glossar: "",
    goldenExamples: "",
  });

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  // Upload
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Preview
  const [previewFile, setPreviewFile] = useState<{ fileKey: string; content: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Drag & Drop
  const [dragOver, setDragOver] = useState(false);

  // Status laden
  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/brand-brain/status");
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        if (data.frontify.domain) {
          setFrontifyDomain(data.frontify.domain);
        }
      }
    } catch {
      // Stille Fehlerbehandlung
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  // File Upload
  async function handleFileUpload(fileKey: string, file: File) {
    setUploading(fileKey);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileKey", fileKey);

      const res = await fetch("/api/brand-brain/files", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Upload fehlgeschlagen");
        return;
      }

      // Status neu laden
      await loadStatus();
    } catch {
      setUploadError("Netzwerk-Fehler beim Upload");
    } finally {
      setUploading(null);
    }
  }

  // File Delete
  async function handleFileDelete(fileKey: string) {
    setUploadError(null);
    try {
      const res = await fetch(`/api/brand-brain/files?fileKey=${encodeURIComponent(fileKey)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await loadStatus();
      } else {
        const data = await res.json();
        setUploadError(data.error ?? "Loeschen fehlgeschlagen");
      }
    } catch {
      setUploadError("Netzwerk-Fehler beim Loeschen");
    }
  }

  // File Preview
  async function handlePreview(fileKey: string) {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/brand-brain/files/${encodeURIComponent(fileKey)}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewFile({ fileKey, content: data.content });
      }
    } catch {
      // Stille Fehlerbehandlung
    } finally {
      setPreviewLoading(false);
    }
  }

  // Drag & Drop Handler
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      // fileKey aus Dateinamen ableiten
      const name = file.name.toLowerCase();
      let fileKey: string | null = null;

      if (name.includes("tone") || name.includes("tov") || name.includes("voice")) {
        fileKey = "tone-of-voice.md";
      } else if (name.includes("ci") || name.includes("corporate") || name.includes("identity")) {
        fileKey = "ci-rules.json";
      } else if (name.includes("glossar") || name.includes("glossary") || name.includes("wording")) {
        if (name.includes("fr")) fileKey = "glossar-fr.json";
        else if (name.includes("it")) fileKey = "glossar-it.json";
        else if (name.includes("en")) fileKey = "glossar-en.json";
        else fileKey = "glossar-de.json";
      } else if (name.includes("golden") || name.includes("example")) {
        fileKey = "golden-examples.json";
      }

      if (fileKey) {
        handleFileUpload(fileKey, file);
      } else {
        setUploadError(`"${file.name}" konnte keinem Brand Brain Typ zugeordnet werden. Bitte nutze den Upload-Button bei der entsprechenden Datei.`);
      }
    }
  }

  // Frontify Test
  async function handleTestConnection() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/brand-brain/frontify/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: frontifyDomain,
          token: frontifyToken,
          brandId: frontifyBrandId || undefined,
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: "Netzwerk-Fehler" });
    } finally {
      setTesting(false);
    }
  }

  // Airtable Test
  async function handleAirtableTestConnection() {
    setAirtableTesting(true);
    setAirtableTestResult(null);
    try {
      const res = await fetch("/api/brand-brain/airtable/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: airtableToken,
          baseId: airtableBaseId || undefined,
        }),
      });
      const data = await res.json();
      setAirtableTestResult(data);
      // Auto-fill Table-Mappings wenn vorgeschlagen
      if (data.suggestedMappings) {
        setAirtableTableMappings((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(data.suggestedMappings as Record<string, string>).filter(([, v]) => v)
          ),
        }));
      }
    } catch {
      setAirtableTestResult({ success: false, error: "Netzwerk-Fehler" });
    } finally {
      setAirtableTesting(false);
    }
  }

  // Cache Sync
  async function handleSync(source?: "frontify" | "airtable" | "drive") {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/brand-brain/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_BRAND_BRAIN_REFRESH_SECRET ?? ""}`,
        },
        body: JSON.stringify({ source: source ?? "all" }),
      });
      if (res.ok) {
        setSyncResult(`Cache erfolgreich invalidiert (${source ?? "alle Quellen"})`);
        await loadStatus();
      } else {
        const err = await res.json();
        setSyncResult(`Fehler: ${err.error}`);
      }
    } catch {
      setSyncResult("Netzwerk-Fehler beim Sync");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Brand Brain</h1>
        <p className="text-muted-foreground">
          Verwalte die Datenquellen fuer Tone of Voice, CI-Rules, Glossar und Golden Examples.
        </p>
      </div>

      {/* Quellen-Uebersicht */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Upload className="h-5 w-5 text-green-500" />
            <div>
              <CardTitle className="text-sm font-medium">Dateien</CardTitle>
              <CardDescription>Manuell hochgeladen</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {status?.files.filter((f) => f.source === "manual").length ?? 0} Dateien
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Palette className="h-5 w-5 text-violet-500" />
            <div>
              <CardTitle className="text-sm font-medium">Frontify</CardTitle>
              <CardDescription>CI, Tone of Voice</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {status?.frontify.configured ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">{status.frontify.domain}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Nicht verbunden</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Database className="h-5 w-5 text-amber-500" />
            <div>
              <CardTitle className="text-sm font-medium">Airtable</CardTitle>
              <CardDescription>Brand Brain Daten</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {status?.airtable?.configured ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Base {status.airtable.baseId?.slice(0, 10)}...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Nicht verbunden</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-2">
            <Cloud className="h-5 w-5 text-blue-500" />
            <div>
              <CardTitle className="text-sm font-medium">Google Drive</CardTitle>
              <CardDescription>Glossar, Dokumente</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {status?.drive.configured ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Verbunden</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Nicht konfiguriert</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {(syncResult || uploadError) && (
        <div className={`rounded-md border p-3 text-sm ${uploadError ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" : "bg-muted/50"}`}>
          {uploadError ?? syncResult}
        </div>
      )}

      {/* Dateien-Status mit Upload */}
      <Card
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={dragOver ? "ring-2 ring-primary ring-offset-2" : ""}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Brand Brain Dateien
          </CardTitle>
          <CardDescription>
            Lade Dateien hoch oder ziehe sie per Drag &amp; Drop hierher. Hochgeladene Dateien haben hoechste Prioritaet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dragOver && (
            <div className="mb-4 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/5 py-8">
              <div className="flex items-center gap-2 text-primary">
                <FolderUp className="h-6 w-6" />
                <span className="font-medium">Dateien hier ablegen</span>
              </div>
            </div>
          )}

          {statusLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {status?.files.map((file) => (
                <FileRow
                  key={file.key}
                  file={file}
                  uploading={uploading === file.fileKey}
                  onUpload={(f) => handleFileUpload(file.fileKey, f)}
                  onDelete={() => handleFileDelete(file.fileKey)}
                  onPreview={() => handlePreview(file.fileKey)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="max-h-[80vh] w-full max-w-3xl overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">{previewFile.fileKey}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setPreviewFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="max-h-[60vh] overflow-auto">
              <pre className="whitespace-pre-wrap rounded bg-muted p-4 text-xs font-mono">
                {previewFile.content}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}

      <Separator />

      {/* Frontify Verbindung */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Frontify verbinden
          </CardTitle>
          <CardDescription>
            Verbinde dein Frontify-Konto um CI-Rules und Tone of Voice automatisch zu synchronisieren.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="frontify-domain">Frontify Domain</Label>
              <Input
                id="frontify-domain"
                placeholder="acme.frontify.com"
                value={frontifyDomain}
                onChange={(e) => setFrontifyDomain(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frontify-token">Personal Developer Token</Label>
              <Input
                id="frontify-token"
                type="password"
                placeholder="eyJhbGci..."
                value={frontifyToken}
                onChange={(e) => setFrontifyToken(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="frontify-brand-id">Brand ID (optional)</Label>
            <Input
              id="frontify-brand-id"
              placeholder="Automatische Erkennung wenn leer"
              value={frontifyBrandId}
              onChange={(e) => setFrontifyBrandId(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleTestConnection}
              disabled={testing || !frontifyDomain || !frontifyToken}
            >
              {testing ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Teste Verbindung...</>
              ) : (
                <><Plug className="mr-2 h-4 w-4" />Verbindung testen</>
              )}
            </Button>

            {status?.frontify.configured && (
              <Button variant="outline" onClick={() => handleSync("frontify")} disabled={syncing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                Frontify Sync
              </Button>
            )}
          </div>

          {testResult && (
            <FrontifyTestResultDisplay
              result={testResult}
              domain={frontifyDomain}
              token={frontifyToken}
              brandId={frontifyBrandId}
            />
          )}
        </CardContent>
      </Card>

      {/* Airtable Verbindung */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Airtable verbinden
          </CardTitle>
          <CardDescription>
            Verbinde dein Airtable-Konto um Brand Brain Daten (Glossar, Tone of Voice, CI-Rules, Golden Examples) automatisch zu synchronisieren.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="airtable-token">Personal Access Token</Label>
              <Input
                id="airtable-token"
                type="password"
                placeholder="pat..."
                value={airtableToken}
                onChange={(e) => setAirtableToken(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="airtable-base-id">Base ID</Label>
              <Input
                id="airtable-base-id"
                placeholder="appXXXXXXXXXXXXXX"
                value={airtableBaseId}
                onChange={(e) => setAirtableBaseId(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleAirtableTestConnection}
              disabled={airtableTesting || !airtableToken}
            >
              {airtableTesting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Teste Verbindung...</>
              ) : (
                <><Plug className="mr-2 h-4 w-4" />Verbindung testen</>
              )}
            </Button>

            {status?.airtable?.configured && (
              <Button variant="outline" onClick={() => handleSync("airtable")} disabled={syncing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                Airtable Sync
              </Button>
            )}
          </div>

          {airtableTestResult && (
            <AirtableTestResultDisplay
              result={airtableTestResult}
              token={airtableToken}
              baseId={airtableBaseId}
              tableMappings={airtableTableMappings}
              onMappingChange={(key, value) =>
                setAirtableTableMappings((prev) => ({ ...prev, [key]: value }))
              }
            />
          )}
        </CardContent>
      </Card>

      {/* Google Drive */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Google Drive
          </CardTitle>
          <CardDescription>
            Google Drive fuer Glossar-Dateien, Golden Examples und Kampagnen-Dokumente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status?.drive.configured ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">Verbunden via Service Account</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => handleSync("drive")}>
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
                Drive Cache erneuern
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                Nicht konfiguriert — <code className="text-xs">GOOGLE_SERVICE_ACCOUNT_KEY</code> + <code className="text-xs">GOOGLE_DRIVE_FOLDER_ID</code> in <code className="text-xs">.env.local</code> setzen.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Fallback-Kette */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Fallback-Kette
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="default" className="bg-green-600">1. Upload</Badge>
            <span className="text-muted-foreground">&rarr;</span>
            <Badge variant="default" className="bg-slate-600">2. Cache</Badge>
            <span className="text-muted-foreground">&rarr;</span>
            <Badge variant="default" className="bg-violet-600">3. Frontify</Badge>
            <span className="text-muted-foreground">&rarr;</span>
            <Badge variant="default" className="bg-amber-600">4. Airtable</Badge>
            <span className="text-muted-foreground">&rarr;</span>
            <Badge variant="default" className="bg-blue-600">5. Drive</Badge>
            <span className="text-muted-foreground">&rarr;</span>
            <Badge variant="outline">6. Lokal</Badge>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Hochgeladene Dateien haben immer Vorrang. Cache-Refresh loescht nur Cache-Eintraege, nicht Uploads.
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-4 text-sm text-muted-foreground">
        <a href="https://developer.frontify.com/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground">
          <ExternalLink className="h-3 w-3" />Frontify Docs
        </a>
        <a href="https://airtable.com/developers/web/api/introduction" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-foreground">
          <ExternalLink className="h-3 w-3" />Airtable API Docs
        </a>
      </div>
    </div>
  );
}

// --- Sub-Components ---

function FileRow({
  file,
  uploading,
  onUpload,
  onDelete,
  onPreview,
}: {
  file: BrandBrainFileStatus;
  uploading: boolean;
  onUpload: (f: File) => void;
  onDelete: () => void;
  onPreview: () => void;
}) {
  const Icon = getFileIcon(file.key);
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">{file.label}</p>
          <p className="text-xs text-muted-foreground">
            {file.fileKey}
            {file.manualUpload && (
              <span className="ml-2">
                — hochgeladen {formatDate(file.manualUpload.uploadedAt)}
                {file.manualUpload.originalFilename && ` (${file.manualUpload.originalFilename})`}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {getSourceBadge(file.source, file.cached)}

        {/* Preview Button (nur bei manual uploads) */}
        {file.source === "manual" && (
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onPreview} title="Vorschau">
            <Eye className="h-4 w-4" />
          </Button>
        )}

        {/* Delete Button (nur bei manual uploads) */}
        {file.source === "manual" && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-destructive hover:text-destructive" onClick={onDelete} title="Loeschen">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        {/* Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept={getAcceptType(file.fileKey)}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title={file.source === "manual" ? "Ersetzen" : "Hochladen"}
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}

function FrontifyTestResultDisplay({
  result,
  domain,
  token,
  brandId,
}: {
  result: FrontifyTestResult;
  domain: string;
  token: string;
  brandId: string;
}) {
  if (!result.success) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <XCircle className="h-5 w-5 text-red-600" />
        <span className="text-red-800 dark:text-red-200">{result.error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <span className="font-medium text-green-800 dark:text-green-200">Verbindung erfolgreich!</span>
      </div>

      {result.brands && result.brands.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Brands ({result.brands.length}):</p>
          <div className="flex flex-wrap gap-2">
            {result.brands.map((b) => (
              <Badge key={b.id} variant={b.id === result.selectedBrand ? "default" : "outline"}>
                {b.name}{b.id === result.selectedBrand && " (aktiv)"}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {result.mappings && result.mappings.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Erkannte Pages ({result.mappings.length}):</p>
          <div className="space-y-1">
            {result.mappings.map((m) => (
              <div key={m.pageId} className="flex items-center gap-2 text-sm">
                <Badge variant="secondary" className="text-xs">{m.mappedTo}</Badge>
                <span>&larr; &quot;{m.pageTitle}&quot;</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.mappings && result.mappings.length === 0 && (
        <div className="flex items-center gap-2 text-sm text-amber-600">
          <AlertCircle className="h-4 w-4" />
          Keine Pages erkannt. Titel muessen Keywords wie &quot;Tone of Voice&quot;, &quot;Colors&quot; etc. enthalten.
        </div>
      )}

      <div className="rounded border bg-background p-3 text-sm">
        <p className="mb-1 font-medium">Environment Variables:</p>
        <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
{`FRONTIFY_DOMAIN=${domain}
FRONTIFY_TOKEN=${token.slice(0, 8)}...
${brandId ? `FRONTIFY_BRAND_ID=${brandId}` : "# FRONTIFY_BRAND_ID= (auto-discover)"}`}
        </pre>
      </div>
    </div>
  );
}

function AirtableTestResultDisplay({
  result,
  token,
  baseId,
  tableMappings,
  onMappingChange,
}: {
  result: AirtableTestResult;
  token: string;
  baseId: string;
  tableMappings: Record<string, string>;
  onMappingChange: (key: string, value: string) => void;
}) {
  if (!result.success) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
        <XCircle className="h-5 w-5 text-red-600" />
        <span className="text-red-800 dark:text-red-200">{result.error}</span>
      </div>
    );
  }

  const mappingLabels: Record<string, string> = {
    toneOfVoice: "Tone of Voice",
    ciRules: "CI-Rules",
    glossar: "Glossar",
    goldenExamples: "Golden Examples",
  };

  return (
    <div className="space-y-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-green-600" />
        <span className="font-medium text-green-800 dark:text-green-200">Verbindung erfolgreich!</span>
      </div>

      {result.bases && result.bases.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Bases ({result.bases.length}):</p>
          <div className="flex flex-wrap gap-2">
            {result.bases.map((b) => (
              <Badge key={b.id} variant={b.id === result.selectedBase ? "default" : "outline"}>
                {b.name}{b.id === result.selectedBase && " (aktiv)"}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {result.tables && result.tables.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Tables ({result.tables.length}):</p>
          <div className="flex flex-wrap gap-2">
            {result.tables.map((t) => (
              <Badge key={t.id} variant="outline">
                {t.name} ({t.fieldCount} Felder)
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Table-Mappings */}
      {result.tables && result.tables.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Table-Zuordnung:</p>
          <p className="text-xs text-muted-foreground">
            Ordne deine Airtable-Tables den Brand Brain Kategorien zu. Leere Felder werden uebersprungen.
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {Object.entries(mappingLabels).map(([key, label]) => (
              <div key={key} className="space-y-1">
                <Label className="text-xs">{label}</Label>
                <select
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={tableMappings[key] || ""}
                  onChange={(e) => onMappingChange(key, e.target.value)}
                >
                  <option value="">-- nicht zugeordnet --</option>
                  {result.tables!.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded border bg-background p-3 text-sm">
        <p className="mb-1 font-medium">Environment Variables:</p>
        <pre className="overflow-x-auto rounded bg-muted p-2 text-xs">
{`AIRTABLE_TOKEN=${token.slice(0, 8)}...
AIRTABLE_BASE_ID=${baseId || result.selectedBase || ""}
${tableMappings.toneOfVoice ? `AIRTABLE_TABLE_TONE_OF_VOICE=${tableMappings.toneOfVoice}` : "# AIRTABLE_TABLE_TONE_OF_VOICE="}
${tableMappings.ciRules ? `AIRTABLE_TABLE_CI_RULES=${tableMappings.ciRules}` : "# AIRTABLE_TABLE_CI_RULES="}
${tableMappings.glossar ? `AIRTABLE_TABLE_GLOSSAR=${tableMappings.glossar}` : "# AIRTABLE_TABLE_GLOSSAR="}
${tableMappings.goldenExamples ? `AIRTABLE_TABLE_GOLDEN_EXAMPLES=${tableMappings.goldenExamples}` : "# AIRTABLE_TABLE_GOLDEN_EXAMPLES="}`}
        </pre>
      </div>
    </div>
  );
}
