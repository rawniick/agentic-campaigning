import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // TEMPORAER (Debug client-side exception, 2026-06-24): lesbare Browser-Sourcemaps,
  // damit die Prod-Konsole echte Datei:Zeile zeigt statt minifiziert. Nach dem Fix
  // wieder entfernen (exponiert den Client-Source oeffentlich).
  productionBrowserSourceMaps: true,
  // Native bindings duerfen nicht in den Bundle wandern — sie laufen
  // ausschliesslich in der Node-Runtime der Server-Actions / Route Handlers.
  serverExternalPackages: ["@resvg/resvg-js", "pg", "satori"],
  // Brand-Dateien (tokens.json, glossar.json, Logos, Fonts) werden zur Laufzeit
  // per fs aus process.cwd()/brand-assets gelesen. Next traced dynamische
  // fs-Pfade NICHT automatisch — ohne dieses Include fehlen die Files in der
  // Vercel-Serverless-Function (ENOENT). Gilt fuer alle Server-Routen.
  outputFileTracingIncludes: {
    "/**": ["./brand-assets/**/*"],
  },
};

export default nextConfig;
