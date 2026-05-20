# /brand-assets/wingo/

Source of Truth für Wingo-Brand. Diese Files sind Pflicht — ohne sie kann die Render-Engine nicht produzieren.

## Struktur

```
brand-assets/wingo/
├── README.md               # diese Datei
├── tokens.json             # Brand-Tokens (Farben, Fonts, Spacing, Safezones, Logo-Specs)
├── glossar.json            # Wingo-Terms die Translator NICHT übersetzt
├── tone-of-voice.md        # optional - Default-TOV als Markdown (Admin-UI kann später überschreiben)
├── logos/
│   ├── wingo-stern.svg
│   ├── wingo-wordmark.svg
│   ├── wingo-lockup.svg            # ← Default-Variante
│   ├── wingo-lockup-white.svg      # für dunkle Hintergründe
│   └── wingo-swisscom-lockup.svg   # Co-Branding (optional)
├── fonts/
│   ├── <wingo-headline>.woff2
│   └── <wingo-body>.woff2
├── samples/                # 5-10 Sample-Bilder als Style-Reference für AI-Generation
│   ├── sport-szene-01.jpg
│   ├── familie-mobil-01.jpg
│   └── ...
└── ai-label/
    └── wingo-ai-label.svg  # AI-Generated-Hinweis-Badge
```

## Quelle: brand.wingo.ch

Alle Inhalte stammen aus dem Frontify Brand Hub:
- Brand Manual: https://brand.wingo.ch/document/596
- Tone of Voice: https://brand.wingo.ch/document/597

## Ausfüll-Anleitung tokens.json

### 1. Colors
Öffne https://brand.wingo.ch/document/596#/design-elements/colours.
- `primary.hex` → "Wingo Rot" Hex-Code
- `secondary.hex` → "Wingo Schwarz"
- `background_primary.hex` → "Wingo Grau" (das Standard-BG aus der Mechanik)
- `neutral.scale.*` → komplette Graustufen-Palette
- `semantic.price_old.hex` / `price_new.hex` → falls Brand Manual eigene Preis-Farben definiert
- `forbidden_combinations` → aus Brand Manual abschreiben

### 2. Typography
Öffne https://brand.wingo.ch/document/596#/design-elements/typography/typeface.
- `fonts.headline.family` → z.B. "WingoSans-Bold" - exakt wie im Manual
- `fonts.headline.file_woff2` → relativer Pfad in `fonts/` Ordner (Datei selbst hochladen)
- `scale.*.size_px` → konkrete Pixel-Werte aus Type-Scale-Definition

**Wichtig:** Wenn Wingo-Font keine Web-Lizenz hat (Self-Hosting) → schreibe in `license_note` welche Open-Source-Alternative wir nehmen (z.B. Inter, IBM Plex Sans).

### 3. Logo
Öffne https://brand.wingo.ch/document/596#/design-elements/logo.
- Lade alle Logo-Varianten als SVG in `/logos/`
- `min_size_px` aus Manual-Vorgaben übernehmen
- `clear_space.factor_of_height` typisch 1.0 (Schutzraum = Logohöhe)

### 4. Safezones
Eigene Erhebung — schreibe für jedes Format-Cluster die Edge-Clear-Prozent. Default 5% ist Wingo-konservativ.

### 5. Brand-Mechanik
Aus Excel Sheet 02 (Brand-Vorgaben): "Mechanik Grauer Hintergrund + Roter Stern in Wingo Welt"
- `default_background_token`, `default_accent_element` bereits gesetzt
- `image_treatment_rule` aus Brand Manual ergänzen

### 6. CTA
`default_labels.de` etc. — Standard-CTA-Texte aus Manual oder Best-Practice.

### 7. AI-Label
Lade Wingo-AI-Label als SVG nach `ai-label/`. `wingo-ai-label.svg` ist der Default-Filename.

## glossar.json

Liste der Wingo-Terms die der LLM-Translator nicht antastet (1:1 in jeder Sprache):

```json
{
  "passthrough_terms": [
    "Wingo",
    "Wingo Mobile",
    "Wingo Internet",
    "Wingo TV",
    "Wingo Mobile Swiss",
    "Swisscom Netz",
    "5G im Swisscom Netz"
  ],
  "translation_overrides": {
    "DE": {
      "Term DE": "spezifische DE-Übersetzung"
    },
    "FR": {
      "Term DE": "spezifische FR-Übersetzung"
    }
  }
}
```

## Validation

`tokens.json` wird via Zod-Schema beim App-Start validiert. Wenn ein Pflicht-Token fehlt (z.B. `primary.hex` leer), startet die App nicht. Das ist Absicht — Brand-Drift soll früh weh tun.

## Updates

Brand-Änderungen → tokens.json/Logo/Font commit + PR. CI validiert Schema-Form.
