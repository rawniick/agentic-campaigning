"use client";

// Route-Error-Boundary für den App-Subtree (inkl. /campaigns/[id]). Zeigt eine
// freundliche Meldung + Retry. Stack/Message nur in Development sichtbar; in Prod
// nur der digest (zum Abgleich mit Server-Logs), kein Stack-Leak.
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AppError]", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold">Etwas ist schiefgelaufen</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Beim Laden dieser Seite ist ein Fehler aufgetreten. Versuch es nochmal —
        bleibt es bestehen, lade die Seite neu.
      </p>

      {error.digest && (
        <p className="mt-4 text-xs text-muted-foreground">
          Fehler-Referenz: <code>{error.digest}</code>
        </p>
      )}

      {isDev && (
        <pre className="mt-4 max-h-96 overflow-auto rounded-md border bg-muted p-3 text-xs whitespace-pre-wrap">
          {error.message}
          {"\n\n"}
          {error.stack}
        </pre>
      )}

      <button
        onClick={() => reset()}
        className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Erneut versuchen
      </button>
    </div>
  );
}
