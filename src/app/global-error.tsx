"use client";

// Global-Error-Boundary: fängt Fehler im Root-Layout und alles, was eine nähere
// error.tsx nicht abfängt. Muss eigene <html>/<body> rendern (ersetzt das Root-
// Layout). Stack nur in Development; in Prod nur digest, kein Leak.
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  const isDev = process.env.NODE_ENV === "development";

  return (
    <html lang="de">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "4rem 1.5rem" }}>
          <h1 style={{ fontSize: 24, fontWeight: 700 }}>Etwas ist schiefgelaufen</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#666" }}>
            Ein unerwarteter Fehler ist aufgetreten. Versuch es nochmal oder lade
            die Seite neu.
          </p>

          {error.digest && (
            <p style={{ marginTop: 16, fontSize: 12, color: "#888" }}>
              Fehler-Referenz: <code>{error.digest}</code>
            </p>
          )}

          {isDev && (
            <pre
              style={{
                marginTop: 16,
                maxHeight: 384,
                overflow: "auto",
                background: "#f4f4f5",
                border: "1px solid #e4e4e7",
                borderRadius: 6,
                padding: 12,
                fontSize: 12,
                whiteSpace: "pre-wrap",
              }}
            >
              {error.message}
              {"\n\n"}
              {error.stack}
            </pre>
          )}

          <button
            onClick={() => reset()}
            style={{
              marginTop: 24,
              padding: "8px 16px",
              border: "none",
              borderRadius: 6,
              background: "#FF5759",
              color: "white",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Erneut versuchen
          </button>
        </div>
      </body>
    </html>
  );
}
