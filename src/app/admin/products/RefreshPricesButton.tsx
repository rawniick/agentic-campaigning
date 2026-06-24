"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  refreshStandardPricesAction,
  type PriceRefreshRow,
} from "./_actions";

const STATUS_LABEL: Record<PriceRefreshRow["status"], string> = {
  updated: "aktualisiert",
  unchanged: "unverändert",
  no_link: "kein Link",
  not_found: "kein Match",
  error: "Fehler",
};

const STATUS_CLASS: Record<PriceRefreshRow["status"], string> = {
  updated: "text-green-700",
  unchanged: "text-muted-foreground",
  no_link: "text-amber-700",
  not_found: "text-amber-700",
  error: "text-red-700",
};

export function RefreshPricesButton() {
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState<PriceRefreshRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await refreshStandardPricesAction();
        setRows(res.rows);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  }

  const updatedCount = rows?.filter((r) => r.status === "updated").length ?? 0;

  return (
    <div>
      <Button variant="outline" onClick={onClick} disabled={isPending}>
        {isPending ? "Scrape läuft …" : "Standard-Preise von wingo.ch aktualisieren"}
      </Button>

      {error && (
        <p className="mt-2 text-sm text-red-700">Fehler: {error}</p>
      )}

      {rows && (
        <div className="mt-4 rounded-md border bg-card p-4">
          <p className="mb-3 text-sm">
            <strong>{updatedCount}</strong> aktualisiert. Preise sind
            compliance-sensibel — bitte die Änderungen prüfen.
          </p>
          <div className="space-y-1 text-xs">
            {rows.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-3 border-b py-1 last:border-0"
              >
                <span className="font-medium">{r.name}</span>
                <span className="text-muted-foreground">
                  {r.oldStandard !== null ? r.oldStandard.toFixed(2) : "—"}
                  {" → "}
                  {r.newStandard !== null ? r.newStandard.toFixed(2) : "—"}
                </span>
                <span className={`w-28 text-right ${STATUS_CLASS[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
