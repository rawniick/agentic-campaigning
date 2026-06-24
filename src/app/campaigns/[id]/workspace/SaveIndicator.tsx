"use client";

import { Check, Loader2 } from "lucide-react";

// SaveIndicator — kleines Status-Label fuer Auto-Save. idle = nichts anzeigen,
// saving = Spinner + "Speichert…", saved = Haken + "Gespeichert".
export function SaveIndicator(props: { state: "idle" | "saving" | "saved" }) {
  const { state } = props;

  if (state === "idle") return null;

  if (state === "saving") {
    return (
      <span
        role="status"
        aria-live="polite"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Speichert…
      </span>
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-1 text-xs text-green-600"
    >
      <Check className="h-3 w-3" />
      Gespeichert
    </span>
  );
}
