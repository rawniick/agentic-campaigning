# Wingo AI-Label (Pflicht-Asset)

Auf **jedem AI-generierten Sujet** muss laut Brand Manual das AI-Kennzeichnungs-Label
sichtbar eingebettet sein (KO-Kriterium, gleiche Klasse wie das Logo).

## Drop-in (offizielles Asset)

Lege das offizielle „Mit KI erstellt"-Label hier ab — der Render zieht es automatisch:

```
brand-assets/wingo/ai-label/wingo-ai-label@3x.png   (bevorzugt)
brand-assets/wingo/ai-label/wingo-ai-label.png
```

`resolveAiLabelSrc()` (`src/lib/render/resolveAiLabelSrc.ts`) löst es zu einer
PNG-Data-URL auf (Satori/resvg fetchen keine Remote-URLs). Solange kein PNG vorliegt,
wird ein **font-freier Interim-Badge** rasterisiert — klar als Platzhalter erkennbar,
**nicht final auslieferbar** (`aiLabelIsPlaceholder()` = true).

## DB-Registrierung

Damit der Render das Label überhaupt einbettet, braucht die Brand eine Zeile in
`ai_label_assets` (Präsenz + Default-Position). Einmalig seeden:

```
node scripts/seed-ai-label-wingo.mjs
```

Pro Format lässt sich die Position via `format_specs.ai_label_position` überschreiben.
