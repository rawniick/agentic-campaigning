"use client";

import { useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, AlertCircle, Video } from "lucide-react";
import { usePolling } from "@/hooks/usePolling";

interface PollResult {
  status: string;
  storage_url?: string;
  error?: string;
}

interface VideoPollingProps {
  assetId: string;
  onComplete?: (storageUrl: string) => void;
}

export function VideoPolling({ assetId, onComplete }: VideoPollingProps) {
  const shouldStop = useCallback((data: PollResult) => {
    return data.status === "completed" || data.status === "failed";
  }, []);

  const handleComplete = useCallback((data: PollResult) => {
    if (data.status === "completed" && data.storage_url) {
      onComplete?.(data.storage_url);
    }
  }, [onComplete]);

  const { isPolling, data, error, attempts, startPolling, stopPolling } = usePolling<PollResult>({
    interval: 10000,
    maxAttempts: 60,
    shouldStop,
    onComplete: handleComplete,
  });

  function handleStart() {
    startPolling(`/api/assets/${assetId}/poll`);
  }

  // Video fertig
  if (data?.status === "completed" && data.storage_url) {
    return (
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium">Video fertig</span>
          </div>
          <video
            src={data.storage_url}
            controls
            className="w-full rounded-md"
            playsInline
          />
        </CardContent>
      </Card>
    );
  }

  // Fehler
  if (data?.status === "failed" || error) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium">Video fehlgeschlagen</span>
          </div>
          <p className="text-xs text-red-600">{data?.error ?? error}</p>
        </CardContent>
      </Card>
    );
  }

  // Polling aktiv
  if (isPolling) {
    return (
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="text-sm font-medium">Video wird generiert...</span>
            <Badge variant="outline" className="ml-auto text-xs">
              Versuch {attempts}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Polling alle 10 Sekunden. Kann bis zu 10 Minuten dauern.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Noch nicht gestartet
  return (
    <Card>
      <CardContent className="p-4">
        <button
          onClick={handleStart}
          className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
        >
          <Video className="h-4 w-4" />
          Video-Status pruefen
        </button>
      </CardContent>
    </Card>
  );
}
