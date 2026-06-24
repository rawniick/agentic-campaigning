# Plan — Wingo V1.2: Krea-Workspace (Chat-Loop · Konformität · Hero-Gen · Layer-Editor)

**Status:** Draft (aus Grilling 2026-06-24, nach Smoke-Test der V1-Pipeline)
**Owner:** Nick (rawniick)
**Vorgänger:** `plans/wingo-v1.md`, `plans/wingo-v1.1-styles-genai.md`
**Quelle:** `/grill-with-docs`-Session — Feedback nach erstem grünen End-to-End-Durchlauf.

> Kontext: Nach dem DATE→Date-Crashfix (React #31) läuft die Pipeline durch bis
> Gate 1. Dieses Dokument bündelt das Smoke-Test-Feedback in eine dependency-
> geordnete Phasenfolge.

---

## Entscheidungs-Log (Grilling-Ergebnisse)

| # | Thema | Entscheidung |
|---|---|---|
| D1 | **UI-Frame** `/campaigns/[id]` | **Two-Pane**: links Input-Konsole (~40%, Gate-Controls + Claude-Chat), rechts Canvas/Preview (~60%, kontextuell pro Gate). |
| D2 | **Copy-Chat (Gate 1)** | **Refinement-Loop mit Live-Kandidaten**: pro Turn 1 Satz Begründung (Chat) + frisches 3er-Headline-Set (Canvas) → picken + freigeben. |
| D3 | **Chat-Persistenz** | **DB-persistiert**: generische `gate_chat`-Tabelle (Turns + erzeugte Kandidaten-Sets) pro Kampagne/Gate/Sprache. Re-Open behält Dialog, Sprung zu früheren Sets, Audit. |
| D4 | **Chat-Scope** | **Alle Gates** (generische Infra). Copy zuerst voll, Hero via fal (D6), Layout/Done danach. |
| D5 | **Konformität + Positionierung** | **Quick-Härtung jetzt** (Font/Umlaute, Logo-Check, Vision-QA als echter Export-Blocker) **+ daten-getriebene Positionen als Fundament** (relative Coords + `propagatePositions` Safezone-Clamp). |
| D6 | **Hero-Gen (Gate 2)** | **Komponenten-Upload + Library-Referenzen → nano-banana Multi-Image-Fusion, chat-iteriert**. Gewählte Variante = Referenz für nächsten Turn. **fal LIVE** (Lizenz geklärt, FAL_KEY vorhanden). `source='ai'` + AI-Label-Pflicht im Render. |
| D7 | **Layer-Editor** | **Drag-on-Canvas + Safezone-Overlay + Snap-Grid (8px)** für Brand-Elemente (Logo/Headline/Subline/Preis-Stern/CTA/Disclaimer), Master (Gate 3) + Per-Asset. = PRD FR-41. |
| D8 | **Standard-Preis (Brief)** | **Scrape-assistiert**: Admin-Action „Preise von wingo.ch aktualisieren" → `products.price_standard`, danach manuell kuratierbar. Preise compliance-sensibel → Review-Pflicht nach Scrape. |
| D9 | **Umlaute (DE/FR/IT)** | Copy-Gen-Prompt auf korrekte Orthografie zwingen (ä ö ü ß, à é è …), NIE Transliteration (ae/oe/ue). Ursache: Prompt selbst ist ASCII-transliteriert. |
| D10 | **„Briefing JSON"-Block** | Entfernen (`<details>` in `page.tsx`). |

---

## Mentales Modell (geschärft)

- **Hero = flaches Raster** (nano-banana-Output). Inhalt ändert sich via Chat-Re-Gen, nicht per Drag.
- **Brand-Elemente = Layer** (Logo/Text/Stern/CTA/Disclaimer), vom Render ÜBER den Hero komponiert → **daten-getrieben positioniert + draggbar** innerhalb Safezones.
- **Konformität** = harte deterministische Gates + Vision-QA-Schwelle, die den Export wirklich blockt (nicht nur badged).

---

## Befund-Zusammenfassung (Code-Mapping 2026-06-24)

- **Guidelines** liegen in `brand-assets/wingo/tokens.json` (inkl. Safezones!), `format_specs`-Tabelle, `src/lib/brand/loadTokens.ts`. **Safezones werden im Render NIE konsumiert** — Templates haben hartcodierte Pixel-Paddings.
- **`propagatePositions()`** (relativ→absolut + Safezone-Clamp) ist gebaut + getestet, aber **verwaist** (`src/lib/render/propagatePositions.ts`).
- **Hartes Konformitäts-Gate** (`checkBrandConformity.ts`) prüft nur Logo-Präsenz, exakte Maße, Primärfarbe. Rest (Safezone/Font/Logo-Bounds/Stil) = **Vision-QA ohne Export-Block**, Fehler `.catch`-verschluckt.
- **imagegen-Layer** (`src/lib/imagegen/`) komplett, aber **nicht in Gate 2 verdrahtet**. fal-Adapter kann `image_urls`-Array; Multi-Komponenten-Fusion via nano-banana ist Zielmodell.
- **Positions-Scaffolding** vorhanden, unverdrahtet: `campaign_layout.positions_json`, `assets.position_overrides_json`.

---

## Phasen (dependency-geordnet)

### Phase 0 — Housekeeping (Crashfix-Loop schließen) · klein
- DATE-Parser-Fix (`src/lib/db/server.ts`) + Regression-Test committen.
- Debug-Error-Boundaries (`src/app/error.tsx`, `global-error.tsx`) auf schlanke User-Variante zurückbauen (keine Stack-Exposition in Prod).
- `productionBrowserSourceMaps` aus `next.config.ts` entfernen.
- Temp-Script `scripts/_debug-inspect.mjs` löschen.
- Deploy + Verify.

### Phase 1 — Quick Wins · klein, unabhängig
- **D9 Umlaute:** `generateCopy.ts` System-Prompt um Orthografie-Regel ergänzen (+ Test: Output enthält keine `ae|oe|ue`-Transliteration bei DE).
- **D10:** „Briefing JSON"-`<details>` aus `page.tsx` raus.
- **D8 Standard-Preis:** Admin-Action „Preise aktualisieren" (Scraper `src/lib/pricing/scrapeWingo.ts` + `/admin/products` Button) → `products.price_standard`; Brief-Form pre-fill verifizieren.

### Phase 2 — Konformitäts-Härtung (KO-Kriterium) · mittel
- Font/Umlaut-Renderpfad verifizieren (Inter-Glyph-Coverage; Radikal sobald lizenziert) — `renderToPng.ts`.
- Vision-QA als **echter Export-Blocker**: Score-Schwelle (z.B. ≥0.75) + Safezone-Score ins harte Gate (`checkBrandConformity.ts` / `exportCampaignZip.ts`); QA-Fehler nicht mehr verschlucken (`runMultiplex.ts`); QA-Modell-ID prüfen.
- Logo-Platzhalter-Logik empirisch verifizieren (`resolveLogoSrc.ts`).

### Phase 3 — Daten-getriebene Positionen (Fundament) · mittel-gross
- `positions_json` (Master) + `position_overrides_json` (Per-Asset) in `runMultiplex.ts` laden → an Templates durchreichen.
- Templates auf `positionOverrides`-Prop + `propagatePositions`-Safezone-Clamp umstellen. **Tracer: 1 Format** (Halfpage), dann auf alle 8 Templates ausrollen.
- Safezones aus tokens.json/format_specs in den Renderpfad ziehen → strukturelle Enforcement (schließt Phase-2-Lücke „Overflow lange DE-Texte").

### Phase 4 — Two-Pane-Workspace-Shell (D1) · mittel
- `/campaigns/[id]` in Two-Pane umbauen: Konsole links (Gate-Controls + Chat-Slot), Canvas rechts (Gate1 Headline-Preview · Gate2 Hero-Grid · Gate3 Layout/Drag · Done Galerie).
- `GateView.tsx` zerlegen in Konsolen- + Canvas-Komponenten.

### Phase 5 — Copy-Chat (Gate 1) (D2/D3/D4) · mittel
- Generische `gate_chat`-Tabelle (Migration) + Queries.
- Chat-API (Multi-Turn `callClaude`, gleiche `CopyOutput`-Struktur, Compliance-Constraints) + Server-Action.
- Konsolen-Chat-Component: Feedback → neues Kandidaten-Set (persistiert) → Canvas; picken + freigeben.

### Phase 6 — Layer-Editor (Drag-on-Canvas) (D7) · gross
- Drag-UI im Canvas: Safezone-Overlay + 8px-Snap; schreibt `positions_json` (Master) / `position_overrides_json` (Per-Asset). Baut auf Phase 3 + 4.
- Brand-Lock: kein Drehen/Verzerren, kein Safezone-Verlassen.

### Phase 7 — Hero-Gen via fal LIVE (D6) · gross
- `generateHeroGateAction` + Gate-2-UI: Komponenten-Upload (mehrere) + Library-Picks + Prompt → nano-banana Multi-Image-Fusion → 3 Kandidaten.
- Chat-Iteration (gewählte Variante = Referenz für nächsten Turn), QA-Loop (Style-Consistency-Score), `source='ai'`, AI-Label-Embedding im Render.
- fal-Adapter ggf. um Multi-Input/Init-Image erweitern; Multi-Fusion-Verhalten live verifizieren.

### Phase 8 — Chat auf Hero/Layout/Done + Per-Asset-Edit · mittel
- Generischen Chat auf restliche Gates ausrollen; Per-Asset-Chat-Edit (PRD FR-42).

---

## Offene Risiken / zu verifizieren
- **fal Multi-Image-Fusion**: tatsächliches Blending-Verhalten von nano-banana (`image_urls`) live testen (Style-Lock vs. echtes Komponenten-Compositing).
- **Scraper-Brittleness** wingo.ch (DOM-Änderungen) → Preise nach Scrape immer reviewen (Compliance).
- **Satori + absolute Positionen**: Umstellung auf `position:absolute` darf Flex-Layout-Annahmen der Templates nicht brechen → Format-für-Format mit Render-Snapshot testen.
- **Lizenzierte Radikal-Font** weiterhin offen (Interim Inter).

---

## Reihenfolge-Logik
Phase 0/1 = sofortige Wertschöpfung + Crashfix-Loop schließen. Phase 2 = KO-Kriterium (konforme Assets). Phase 3 = Linchpin (entkoppelt Konformität-Enforcement UND Layer-Editor). Phase 4 = UI-Rahmen für Chat + Editor. 5/6/7 = die drei grossen Features auf dem Fundament. 8 = Ausbau. Reihenfolge kann nach Nick-Priorität flexen.

---

## Konformitäts-Anker: kanonische Flash-Sale-Anatomie (2026-06-24)

**Anker (D-Konform):** Konformität wird an den echten Wingo-Sample-Sujets gemessen
(`brand-assets/wingo/samples/Beispiel Kampagne Flash Sale/Flash_1.png`, `Flash_2.png`).
**D11 — Hybrid:** kanonische Mechanik + kurze generierte Headline als Zusatz-Claim.

**Kanonische Flash-Sale-Anatomie (aus Flash_1/Flash_2 extrahiert):**
- Roter Vollflächen-BG (#FF5759)
- Wingo-Logo oben-links (weiss)
- **„flash sale"-Wordmark** gross, weiss, lowercase — fixe Brand-Chrome
- **Kurze generierte Headline** als Zusatz-Claim (Hybrid D11)
- **Freigestellte Cut-out-Person** (transparent, blutet an den Rand) — ⚠️ ASSET-DEP
- **„Gratis Aktivierung"-Burst-Badge** (schwarz)
- **Weisser Stern-Blob mit DOPPELPREIS:** Produktname + alter Preis (durchgestrichen)
  + neuer Preis („nur X.XX/Mt.") — braucht `price_standard` (Scraper ✓ Phase 1c)
- CTA-Button („Hol's dir")
- Channel-Footer („mobile tv internet")
- Legal-Line klein unten (Compliance-Pflicht, auch wenn Samples sie kaum zeigen)

**Befund:** Aktuelle Templates haben fixe Element-Höhen (Hero 200px, Blob 168px) →
bei langem Text Cramming/Clipping (Overlap-Bug). UND die Anatomie weicht vom echten
Sujet ab (kein Wordmark, kein Doppelpreis, kein Badge/Footer, Foto-Hero statt Cut-out).

**Neue Template-Props nötig:** `productName`, `priceStandard`.
**Asset-Deps für volle Fidelity:** freigestellte transparente Hero-PNGs (Gate-2 AI-Gen
oder Nick), „Gratis Aktivierung"-Badge-Asset, „flash sale"-Wordmark-Treatment.

**Methode:** Tracer-first (Halfpage) → Sign-off → auf die 7 anderen Format-Klassen
propagieren → messbare Checks (kein Overlap, Safezone-Ränder, Legal-Line vorhanden) in
den Konformitäts-Gate locken. Regression-Loop via `previewSamples.manual.test.ts`
(`PREVIEW=1`, Output `scripts/preview/`).
