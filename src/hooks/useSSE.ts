"use client";

import { useState, useCallback, useRef } from "react";

export interface SSEMessage {
  type: string;
  data: unknown;
}

export interface UseSSEOptions {
  onMessage?: (msg: SSEMessage) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export interface UseSSEReturn {
  isStreaming: boolean;
  error: string | null;
  startStream: (url: string, body: Record<string, unknown>) => void;
  stopStream: () => void;
  streamedText: string;
}

export function useSSE(options: UseSSEOptions = {}): UseSSEReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamedText, setStreamedText] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const startStream = useCallback((url: string, body: Record<string, unknown>) => {
    // Vorherigen Stream abbrechen
    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;
    setIsStreaming(true);
    setError(null);
    setStreamedText("");

    (async () => {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("Kein ReadableStream verfuegbar");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const jsonStr = line.slice(6).trim();
              if (jsonStr === "[DONE]") {
                options.onComplete?.();
                continue;
              }

              try {
                const msg = JSON.parse(jsonStr) as SSEMessage;
                options.onMessage?.(msg);

                // Text-Chunks akkumulieren
                if (msg.type === "text_delta" && typeof msg.data === "string") {
                  setStreamedText((prev) => prev + msg.data);
                }
              } catch {
                // Ungueltige JSON-Zeile ignorieren
              }
            }
          }
        }

        options.onComplete?.();
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "Stream-Fehler";
        setError(message);
        options.onError?.(err instanceof Error ? err : new Error(message));
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    })();
  }, [options]);

  return { isStreaming, error, startStream, stopStream, streamedText };
}
