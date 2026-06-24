"use client";

import { Loader2 } from "lucide-react";

// ProgressBar — Signalisiert "laeuft / haengt nicht". Nur sichtbar wenn active.
// Zeigt einen unbestimmten (indeterminate) Lade-Balken plus Spinner + Label.
export function ProgressBar(props: { active: boolean; label?: string }) {
  const { active, label } = props;

  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full flex-col gap-2"
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>{label ?? "Wird verarbeitet…"}</span>
      </div>

      {/* Indeterminate Bar: ein laufender Streifen, der hin- und herwandert. */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 left-0 w-1/3 animate-[progress-indeterminate_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>

      {/* Keyframes inline, damit das Primitive ohne globale CSS-Aenderung lebt. */}
      <style>{`
        @keyframes progress-indeterminate {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(150%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
