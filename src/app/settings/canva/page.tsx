"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Link2,
  Image,
  RefreshCw,
  Trash2,
} from "lucide-react";

// Alle Channel/Format-Slots die Templates brauchen
const TEMPLATE_SLOTS = [
  { channel: "social", format: "feed", label: "Social Feed", size: "1080x1080" },
  { channel: "social", format: "story", label: "Social Story", size: "1080x1920" },
  { channel: "crm", format: "newsletter", label: "CRM Newsletter", size: "600x400" },
  { channel: "crm", format: "hero", label: "CRM Hero", size: "600x200" },
  { channel: "website", format: "banner", label: "Website Banner", size: "1920x600" },
  { channel: "website", format: "hero", label: "Website Hero", size: "1440x600" },
  { channel: "print", format: "poster", label: "Print Poster", size: "A4 @ 300dpi" },
];

interface CanvaTemplate {
  id: string;
  title: string;
  thumbnail?: { url: string };
}

interface TemplateMapping {
  canva_template_id: string;
  canva_template_name: string | null;
  channel: string;
  format: string;
}

interface CanvaStatus {
  configured: boolean;
  connected: boolean;
  authenticated: boolean;
  brand: string;
}

export default function CanvaSettingsPage() {
  const [status, setStatus] = useState<CanvaStatus | null>(null);
  const [templates, setTemplates] = useState<CanvaTemplate[]>([]);
  const [mappings, setMappings] = useState<TemplateMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSlot, setActiveSlot] = useState<string | null>(null);

  const brand = "default";

  // OAuth-Flow ueber /authorize starten (setzt HTTPOnly-Cookies, redirected zu Canva)
  const connectCanva = () => {
    window.location.href = `/api/integrations/canva/authorize?brand=${brand}`;
  };

  // Status laden
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/canva/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus({ configured: false, connected: false, authenticated: false, brand: "default" });
    }
  }, []);

  // Templates laden
  const fetchTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch(`/api/integrations/canva/templates?brand=${brand}`);
      const data = await res.json();
      setTemplates(data.templates ?? []);
    } catch {
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  }, [brand]);

  // Mappings laden
  const fetchMappings = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/canva/mappings?brand=${brand}`);
      const data = await res.json();
      setMappings(
        (data.mappings ?? []).map((m: TemplateMapping) => ({
          canva_template_id: m.canva_template_id,
          canva_template_name: m.canva_template_name,
          channel: m.channel,
          format: m.format,
        }))
      );
    } catch {
      setMappings([]);
    }
  }, [brand]);

  // Initialer Load
  useEffect(() => {
    Promise.all([fetchStatus(), fetchMappings()]).finally(() => setLoading(false));
  }, [fetchStatus, fetchMappings]);

  // Templates laden wenn connected
  useEffect(() => {
    if (status?.connected) {
      fetchTemplates();
    }
  }, [status?.connected, fetchTemplates]);

  // URL-Param pruefen (nach OAuth Callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("canva") === "connected") {
      fetchStatus();
      fetchTemplates();
      window.history.replaceState({}, "", "/settings/canva");
    }
  }, [fetchStatus, fetchTemplates]);

  // Template einem Slot zuordnen
  const assignTemplate = async (
    channel: string,
    format: string,
    template: CanvaTemplate
  ) => {
    setSaving(true);
    try {
      await fetch("/api/integrations/canva/mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          canva_template_id: template.id,
          canva_template_name: template.title,
          channel,
          format,
        }),
      });
      setMappings((prev) => {
        const filtered = prev.filter(
          (m) => !(m.channel === channel && m.format === format)
        );
        return [
          ...filtered,
          {
            canva_template_id: template.id,
            canva_template_name: template.title,
            channel,
            format,
          },
        ];
      });
      setActiveSlot(null);
    } finally {
      setSaving(false);
    }
  };

  // Mapping entfernen
  const removeMapping = async (channel: string, format: string) => {
    try {
      await fetch("/api/integrations/canva/mappings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, channel, format }),
      });
      setMappings((prev) =>
        prev.filter((m) => !(m.channel === channel && m.format === format))
      );
    } catch {
      // Ignorieren
    }
  };

  // Mapping fuer einen Slot finden
  const getMappingForSlot = (channel: string, format: string) =>
    mappings.find((m) => m.channel === channel && m.format === format);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Canva Integration</h1>
        <p className="text-muted-foreground">
          Verbinde dein Canva-Konto und ordne Brand Templates den Kanaelen zu.
        </p>
      </div>

      {/* Verbindungsstatus */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Verbindung
          </CardTitle>
          <CardDescription>
            Canva OAuth2 Verbindung fuer Template-Zugriff
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!status?.configured ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-900 dark:bg-amber-950">
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Canva ist noch nicht konfiguriert
              </p>
              <p className="mt-1 text-amber-700 dark:text-amber-300">
                Setze <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">CANVA_CLIENT_ID</code> und{" "}
                <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">CANVA_CLIENT_SECRET</code> in deiner{" "}
                <code className="rounded bg-amber-100 px-1 dark:bg-amber-900">.env.local</code> Datei.
              </p>
            </div>
          ) : status.connected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400">
                  Verbunden
                </span>
                <Badge variant="outline">{status.brand}</Badge>
              </div>
              <Button variant="outline" size="sm" onClick={connectCanva}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Neu verbinden
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground">Nicht verbunden</span>
              </div>
              <Button onClick={connectCanva}>
                <Link2 className="mr-2 h-4 w-4" />
                Mit Canva verbinden
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Template-Zuordnung — nur wenn verbunden */}
      {status?.connected && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Image className="h-5 w-5" />
                  Template-Zuordnung
                </CardTitle>
                <CardDescription>
                  Ordne deine Canva Brand Templates den Kanaelen und Formaten zu.
                  Bei der Asset-Generierung wird automatisch das richtige Template verwendet.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchTemplates}
                disabled={loadingTemplates}
              >
                {loadingTemplates ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Templates neu laden
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {templates.length === 0 && !loadingTemplates && (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Keine Brand Templates in Canva gefunden. Erstelle Templates in deinem
                Canva Brand Kit, dann erscheinen sie hier.
              </div>
            )}

            {loadingTemplates && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Templates werden geladen...
                </span>
              </div>
            )}

            {!loadingTemplates && templates.length > 0 && (
              <div className="space-y-3">
                {TEMPLATE_SLOTS.map((slot) => {
                  const mapping = getMappingForSlot(slot.channel, slot.format);
                  const slotKey = `${slot.channel}_${slot.format}`;
                  const isActive = activeSlot === slotKey;

                  return (
                    <div key={slotKey}>
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-3">
                          <div className="min-w-[140px]">
                            <p className="text-sm font-medium">{slot.label}</p>
                            <p className="text-xs text-muted-foreground">{slot.size}</p>
                          </div>

                          {mapping ? (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="text-sm">
                                {mapping.canva_template_name ?? mapping.canva_template_id}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              Kein Template zugeordnet
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {mapping && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeMapping(slot.channel, slot.format)}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
                          <Button
                            variant={isActive ? "secondary" : "outline"}
                            size="sm"
                            onClick={() =>
                              setActiveSlot(isActive ? null : slotKey)
                            }
                          >
                            {mapping ? "Aendern" : "Zuordnen"}
                          </Button>
                        </div>
                      </div>

                      {/* Template-Picker Dropdown */}
                      {isActive && (
                        <div className="mt-2 ml-4 max-h-60 overflow-y-auto rounded-lg border bg-muted/30 p-2">
                          {templates.map((template) => (
                            <button
                              key={template.id}
                              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
                              disabled={saving}
                              onClick={() =>
                                assignTemplate(slot.channel, slot.format, template)
                              }
                            >
                              {template.thumbnail?.url ? (
                                <img
                                  src={template.thumbnail.url}
                                  alt={template.title}
                                  className="h-10 w-14 rounded border object-cover"
                                />
                              ) : (
                                <div className="flex h-10 w-14 items-center justify-center rounded border bg-muted">
                                  <Image className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium">{template.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {template.id}
                                </p>
                              </div>
                              {mapping?.canva_template_id === template.id && (
                                <CheckCircle2 className="ml-auto h-4 w-4 text-green-600" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <Separator />

            <div className="text-xs text-muted-foreground">
              <p className="font-medium">Hinweis zu Autofill-Feldern</p>
              <p className="mt-1">
                Damit ACE deine Templates automatisch befuellen kann, muessen die
                Textfelder in Canva bestimmte Namen haben. Je nach Kanal:
              </p>
              <ul className="mt-1 list-inside list-disc space-y-0.5">
                <li>
                  <strong>Alle:</strong> claim, hero_message
                </li>
                <li>
                  <strong>Social:</strong> hook, body, cta, hashtags
                </li>
                <li>
                  <strong>CRM:</strong> subject_line, preview_text, headline, body, cta
                </li>
                <li>
                  <strong>Website:</strong> hero_headline, hero_subline, cta_primary, cta_secondary
                </li>
                <li>
                  <strong>Print:</strong> headline, subline, body, pflichttext
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fallback-Info wenn nicht verbunden */}
      {status?.configured && !status?.connected && (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">
              Ohne Canva-Verbindung werden Assets ueber den Server-Side Compositing Fallback (sharp)
              generiert. Verbinde Canva fuer echte Brand Templates.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
