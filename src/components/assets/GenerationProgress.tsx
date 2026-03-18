"use client";

import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, Wand2 } from "lucide-react";
import { useSSE } from "@/hooks/useSSE";
import type { SSEMessage } from "@/hooks/useSSE";

interface GenerationProgressProps {
  campaignId: string;
  onComplete?: () => void;
}

interface ProgressData {
  completed: number;
  total: number;
  current?: {
    channel: string;
    format: string;
    language: string;
  };
}

interface CompleteData {
  completed: number;
  failed: number;
  total: number;
}

export function GenerationProgress({ campaignId, onComplete }: GenerationProgressProps) {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [result, setResult] = useState<CompleteData | null>(null);
  const [started, setStarted] = useState(false);

  const handleMessage = useCallback((msg: SSEMessage) => {
    if (msg.type === "progress") {
      setProgress(msg.data as ProgressData);
    } else if (msg.type === "complete") {
      setResult(msg.data as CompleteData);
      onComplete?.();
    } else if (msg.type === "start") {
      const d = msg.data as { total: number };
      setProgress({ completed: 0, total: d.total });
    }
  }, [onComplete]);

  const handleComplete = useCallback(() => {
    // Stream beendet
  }, []);

  const { isStreaming, error, startStream } = useSSE({
    onMessage: handleMessage,
    onComplete: handleComplete,
  });

  function handleStart() {
    setStarted(true);
    setProgress(null);
    setResult(null);
    startStream("/api/generate/content/stream", { campaignId });
  }

  // Ergebnis
  if (result) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div>
              <p className="font-semibold">Asset-Generierung abgeschlossen</p>
              <p className="text-sm text-muted-foreground">
                {result.completed} erfolgreich, {result.failed} fehlgeschlagen von {result.total} total
              </p>
            </div>
          </div>
          <Progress value={100} className="h-2" />
        </CardContent>
      </Card>
    );
  }

  // Streaming aktiv
  if (isStreaming && progress) {
    const percentage = progress.total > 0
      ? Math.round((progress.completed / progress.total) * 100)
      : 0;

    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <div className="flex-1">
              <p className="font-semibold">Assets werden generiert...</p>
              <p className="text-sm text-muted-foreground">
                {progress.completed} von {progress.total} Assets
              </p>
            </div>
            <span className="text-sm font-medium">{percentage}%</span>
          </div>

          <Progress value={percentage} className="h-2" />

          {progress.current && (
            <div className="flex gap-2">
              <Badge variant="outline" className="capitalize">{progress.current.channel}</Badge>
              <Badge variant="secondary">{progress.current.format}</Badge>
              <Badge variant="outline">{progress.current.language.toUpperCase()}</Badge>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // Fehler
  if (error) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="font-semibold text-red-600">Fehler bei der Generierung</p>
          </div>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={handleStart}>
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Start-Button
  if (!started) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <Wand2 className="h-12 w-12 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-semibold">Assets generieren</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Generiert AI-Bilder fuer alle Kanaele, Formate und Sprachen mit Echtzeit-Fortschritt.
            </p>
          </div>
          <Button onClick={handleStart}>
            <Wand2 className="mr-2 h-4 w-4" />
            Generierung starten (Streaming)
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Initialisierung
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-sm">Initialisiere Asset-Generierung...</p>
        </div>
      </CardContent>
    </Card>
  );
}
