"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface UsePollingOptions<T> {
  interval?: number;         // Polling-Intervall in ms (default 10000)
  maxAttempts?: number;      // Max Versuche (default 60)
  shouldStop?: (data: T) => boolean;  // Bedingung zum Stoppen
  onUpdate?: (data: T) => void;
  onComplete?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UsePollingReturn<T> {
  isPolling: boolean;
  data: T | null;
  error: string | null;
  attempts: number;
  startPolling: (url: string) => void;
  stopPolling: () => void;
}

export function usePolling<T>(options: UsePollingOptions<T> = {}): UsePollingReturn<T> {
  const {
    interval = 10000,
    maxAttempts = 60,
    shouldStop,
    onUpdate,
    onComplete,
    onError,
  } = options;

  const [isPolling, setIsPolling] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const urlRef = useRef<string | null>(null);
  const attemptsRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsPolling(false);
  }, []);

  const poll = useCallback(async () => {
    if (!urlRef.current) return;

    attemptsRef.current++;
    setAttempts(attemptsRef.current);

    if (attemptsRef.current > maxAttempts) {
      setError("Maximale Polling-Versuche erreicht");
      stopPolling();
      return;
    }

    try {
      const response = await fetch(urlRef.current);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json() as T;
      setData(result);
      onUpdate?.(result);

      if (shouldStop?.(result)) {
        onComplete?.(result);
        stopPolling();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Polling-Fehler";
      setError(message);
      onError?.(err instanceof Error ? err : new Error(message));
    }
  }, [maxAttempts, shouldStop, onUpdate, onComplete, onError, stopPolling]);

  const startPolling = useCallback((url: string) => {
    stopPolling();
    urlRef.current = url;
    attemptsRef.current = 0;
    setAttempts(0);
    setError(null);
    setData(null);
    setIsPolling(true);

    // Sofort ersten Poll
    poll();

    // Dann periodisch
    timerRef.current = setInterval(poll, interval);
  }, [stopPolling, poll, interval]);

  // Cleanup bei Unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return { isPolling, data, error, attempts, startPolling, stopPolling };
}
