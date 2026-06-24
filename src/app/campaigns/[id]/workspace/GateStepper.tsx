"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

// Reihenfolge der Gates im Flow. "done" ist kein eigener Chip, sondern der
// Zustand nach Gate 4 (alle Chips erledigt).
const GATES = ["copy", "hero", "layout", "final"] as const;
type Gate = (typeof GATES)[number];
type Current = Gate | "done";

const LABELS: Record<Gate, string> = {
  copy: "Copy",
  hero: "Hero",
  layout: "Layout",
  final: "Final",
};

// GateStepper — reine Praesentation. Zeigt die 4 Gate-Chips plus Pfeil-Buttons
// links/rechts. Der aktive Schritt ist hervorgehoben; bereits erledigte Schritte
// sind klickbar (onNavigate). Navigation selbst ist Sache des Parents.
export function GateStepper(props: {
  current: Current;
  onNavigate?: (gate: Gate) => void;
}) {
  const { current, onNavigate } = props;

  // Index des aktiven Gates; bei "done" sind alle erledigt (Index hinter dem
  // letzten Chip).
  const currentIdx = current === "done" ? GATES.length : GATES.indexOf(current);

  const prevGate: Gate | null =
    currentIdx > 0 ? GATES[Math.min(currentIdx, GATES.length) - 1] : null;
  const nextGate: Gate | null =
    currentIdx < GATES.length - 1 ? GATES[currentIdx + 1] : null;

  return (
    <nav
      aria-label="Gate-Fortschritt"
      className="flex w-full items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-sm"
    >
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Vorheriger Schritt"
        disabled={!prevGate}
        onClick={() => prevGate && onNavigate?.(prevGate)}
      >
        <ChevronLeft />
      </Button>

      <ol className="flex flex-1 flex-wrap items-center gap-2">
        {GATES.map((gate, i) => {
          const isActive = gate === current;
          const isDone = i < currentIdx;
          const isClickable = isDone && !!onNavigate;

          const cls = isActive
            ? "bg-amber-500 text-white border-amber-500"
            : isDone
              ? "bg-green-600 text-white border-green-600"
              : "bg-muted text-muted-foreground border-input";

          return (
            <li key={gate}>
              <button
                type="button"
                disabled={!isClickable}
                onClick={() => isClickable && onNavigate?.(gate)}
                aria-current={isActive ? "step" : undefined}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${cls} ${
                  isClickable
                    ? "cursor-pointer hover:opacity-90"
                    : "cursor-default"
                }`}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-xs font-semibold">
                  {i + 1}
                </span>
                {LABELS[gate]}
              </button>
            </li>
          );
        })}
      </ol>

      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Naechster Schritt"
        disabled={!nextGate}
        onClick={() => nextGate && onNavigate?.(nextGate)}
      >
        <ChevronRight />
      </Button>
    </nav>
  );
}
