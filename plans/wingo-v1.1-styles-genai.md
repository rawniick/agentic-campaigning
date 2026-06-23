# Plan — Wingo V1.1: Zwei Kampagnen-Styles + AI-Gen-Provider

Status-Stand: 2026-06-23. Entstanden aus `/grill-with-docs` nachdem Nick die echten
Brand-Materialien (Logo, Farben, Radikal-Font, Bildwelt, Beispiel-Kampagnen) geliefert
hat. Vorlauf: Ship-Härtung + Deploy siehe [`wingo-hardening.md`](./wingo-hardening.md).

## Kontext / Entdeckungen

- **Echte Brand-Farben** (aus den offiziellen Logo-Dateien extrahiert, ersetzen die
  Platzhalter): Wingo-Rot/Stern = **`#FF5759`** (Koralle, NICHT das alte `#E61E2A`),
  Anthrazit = **`#292B2D`**, Grau = **`#E7E7E7`**.
- **Logo**: `wingo_logo_colour_rgb.png` (Wortmarke + roter Stern, transparent, ~3:1) =
  Default-Lockup → liegt als `logos/wingo-lockup@3x.png`. White-Variante für rote BGs da.
- **Font**: Brand-Font = **Radikal**. Gelieferte `RadikalTrial` ist beschnittener Demo
  (keine Umlaute/Slash/%) → unbrauchbar, nach `fonts/radikal-trial-unusable/` verschoben.
  Interim rendert **Inter** unter dem „Radikal"-Slot; `loadFonts` schaltet automatisch um,
  sobald die LIZENZIERTE Radikal in `fonts/` liegt. **TODO Nick: lizenzierte Radikal.**
- **Zwei Kampagnen-Styles** (aus den Beispiel-Kampagnen): **Flash Sale = roter Vollbild-BG
  + weisses Logo + weisser „Blob"-Preiscontainer + Person-Hero**; **Standard/ATL = grauer
  BG + dunkles Logo + rote Akzente**. Beide sollen umgesetzt werden, **Frontend wählt
  Kampagnentyp → Style**. Mappt auf die bestehende `CampaignArt` (flash_sale | standard).
- **AI-Bildgen** ist im Code GAR NICHT gebaut (Gate 2 = Library/Upload live). Architektur-
  Entscheid: **fal.ai-Aggregator + `ImageProvider`-Interface + config-getriebene Modell-
  Registry** (Dropdown rendert die Registry; neues Modell = ein Eintrag). V1 nur Bild
  (Nano Banana 2); Video/Seedance = Out-of-V1. Vollanalyse: Workflow-Output dieser Session.

## Phasen

### Phase 0 — Brand-Assets verdrahten ✅ (2026-06-23)
- Logos auf erwartete Namen (`wingo-lockup@3x.png` etc.); `tokens.json` echte Farben +
  Family „Radikal"; `loadFonts` robust auf Radikal (Glob, Inter-Interim); 8 Templates
  `secondary`/`background` auf echte Werte. Verifiziert: deutscher Text + Preis + echtes
  Logo + Koralle-Rot rendern sauber; volle Suite grün.

### Phase 1 — Ship-Proof (aktuelle Templates) ✅ (2026-06-23)
- Headless-Runner `src/lib/orchestrate/__tests__/shipProof.live.test.ts` (gated SHIP_PROOF=1):
  Brief → Claude-Translate → 44 Assets gegen **Live-DB** `kaqxwjmzavxysxtnkdeo` + Live-Storage,
  Hero Homeoffice+Hund. Erster Lauf: 44/44 konform, ZIP 13 MB. Bewiesen end-to-end.

### Phase 2 — Zwei-Style-System ✅ (2026-06-23, commits 6be2263 + 70662e5)
- `campaignStyle.ts`: `styleForArt(art, tokens)` → Flash Sale = roter BG + weisses Logo
  (`wingo-lockup-white@3x.png`) + weisser Text/Preis + weisser CTA-Button; Standard = grauer
  BG + dunkel + Rot-Akzent. 8 Templates via `resolveTemplateStyle(props)` (Farben aus dem
  Style, nicht mehr hardcoded). `resolveLogoSrc`-Varianten (white/colour). Orchestrator +
  Gate-Actions art-getrieben. Frontend-Kampagnentyp-Selektor steuert den Look (BriefForm).
  Schema um `secondary`/`background_primary` erweitert. Live-verifiziert (flash 44/44 konform,
  weisses Logo). NICHT umgesetzt: Blob-Preiscontainer + Person-Hero-Cutout (Refinement 2b).

### Phase 3 — AI-Gen fal-Provider-Layer (Bild-only, hinter Flag)
- `src/lib/imagegen/`: `types.ts` (`ImageProvider`, analog `EmbeddingProvider`),
  `registry.ts` (Modell-Katalog fürs Dropdown), `falProvider.ts` + `mockImageProvider.ts`,
  `engine.ts` (Library-First + Fallback + Style-Ref-Injection aus `samples/`).
- Gate: `aiGenerateHero.ts` (Vorbild `uploadHero.ts`, schreibt `source='ai'`), Action in
  `_gate-actions.ts`, „Generate New"-Panel + Kandidaten-Galerie + Modell-Dropdown in
  `GateView.tsx`. AI-Label-Pflicht greift beim Render via `source='ai'` (Resolver existiert).
- V1: ein Modell aktiv (Nano Banana 2), Video-Capability-Tag vorbereitet aber inaktiv.
- **Offen rechtlich (Nick/Legal):** Lizenz von Gemini-/ByteDance-Modellen für kommerzielle
  Swisscom/Wingo-Werbung — vor Live-Schaltung klären.

## Bekanntes Rest-Risiko (aus Härtung übernommen)
- Lange Disclaimer-Ketten können in kleinen Formaten still abgeschnitten werden (Edge-Case).
