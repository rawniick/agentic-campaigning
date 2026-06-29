# HANDOFF — ACE Wingo (Stand 2026-06-29)

> Frische Session: lies `CLAUDE.md` + Memory-Files + **`plans/wingo-v1.2-krea-workspace.md`**
> (Entscheidungs-Log D1–D11, Phasen 0–8). Dieses Doc = aktueller Stand, offene Aktionen, nächste Phase.
>
> **Standing-Order (Memory `feedback_parallel_subagents`):** IMMER parallel + mit Subagents/Workflows
> arbeiten wo möglich. Ultracode an. → für jede substanzielle Aufgabe das **Workflow-Tool** nutzen
> (fan-out Build/Verify; geteilte Dateien sequenziell in einer Integrations-Phase).

## ✅ Status: Blöcke 0/1/2 DONE + deployed
Git `wingo-v1` == `origin/wingo-v1` == `main`, alles gepusht. **Live:** https://agentic-campaigning.vercel.app
Full Suite **340 grün / 0 failed** (5 skipped = gated live/manual), `tsc` clean. Deploy: `npx vercel --prod --yes`.

- **Phase 0/1** (commits bis `365a9dc`): React-#31-Crashfix (pg DATE→string, `db/server.ts`); Umlaut-Fix im
  Copy-Prompt; „Briefing JSON" raus; Standard-Preis-Scraper (`src/lib/pricing/scrapeWingo.ts`) + Admin-Button.
- **Block 1 Workspace-UX** (`f71b380`, via Workflow): Two-Pane-Shell + Copy-Chat Gate 1 (DB-persistiert via
  `gate_chat`/Migration 017) + Pfeil-Stepper + ProgressBar + SaveIndicator. Dateien: `src/app/campaigns/[id]/workspace/*`,
  `_chat-actions.ts`, `src/lib/copy/refineCopy.ts`, `src/lib/db/queries/gate-chat.ts`.
- **Block 2 Konformität** (`c0d74a9`, via Workflow + visuelles Review/Fix durch Agent): `CanonicalPortrait` +
  `CanonicalLandscape` (Flex-Flow gegen Text-Overlap, **art-gated** Flash/Standard), alle 8 Format-Wrapper
  delegieren daran; **Doppelpreis-Pipeline** (`runMultiplex` reicht product_name + price_standard); **Vision-QA als
  echter Export-Blocker** (`exportCampaignZip`: Score<0.7 / Safezone<0.6); generischer Aktions-/Preis-Disclaimer
  geseedet. Alle 8 Formate visuell brand-konform (Portrait/Landscape/Square/Compact). Cut-out-Hero = noch Platzhalter-Silhouette.

## ⏳ OFFENE PROD-DATEN-SCHRITTE (sandbox-gated → Nick via `!`, sonst graceful degrade)
Code ist live; diese DB-/Daten-Schritte aktivieren den vollen Effekt. Ohne sie: kanonischer Look + Einzelpreis + nur 5G-Hinweis.
```
node scripts/apply-migration.mjs 017_gate_chat.sql   # Copy-Chat-Write (Lesen ist via .catch(()=>[]) abgesichert)
node scripts/seed-disclaimers.mjs                    # voller Aktions-/Preis-Legal-Text statt nur "5G im Swisscom Netz"
```
+ `/admin/products` → „Standard-Preise von wingo.ch aktualisieren" → füllt `products.price_standard` → aktiviert **Doppelpreis**.
⚠️ Prod-DB-Writes brauchen Nicks `!`-Ausführung oder eine Permission-Rule. (`supabase/consolidated_001-016.sql` ist veraltet —
017 + die Disclaimer-Seed-Daten fehlen dort; für frische Deploys nachziehen.)

## ⏭ NÄCHSTE PHASE — Block 3: Hero-AI-Gen (D6, Hybrid)
**Ziel:** brand-konforme Kampagnenbilder erzeugen — **freigestellte (transparente) Cut-out-Personen** aus
**Referenzbildern** via **fal/nano-banana Multi-Image-Fusion**, chat-iteriert, in Gate 2.

**Was existiert** (`src/lib/imagegen/`, gebaut, aber NICHT in Gate 2 verdrahtet):
- `types.ts` (ImageProvider, GenerateInput{prompt, styleReferenceUrls?[], n?, aspectRatio?, modelParams?}, ModelEntry).
- `falProvider.ts` — REST POST `fal.run/{providerModelId}`, mappt `styleReferenceUrls` → `image_urls` (nur wenn
  `model.supportsStyleRef`). nano-banana `image_urls` IST das Multi-Image-Compositing. Für echtes img2img/Init-Image
  ggf. Feld ergänzen.
- `registry.ts` — `nano-banana-2` (fal-ai/nano-banana-2, supportsStyleRef, **enabled**); imagen-4 (disabled);
  seedance = image-to-VIDEO (out-of-V1). `engine.ts` (generateHeroCandidates + Fallback), `mockImageProvider.ts`.
- `campaign_hero.source` unterstützt bereits `'ai'`. Env `FAL_KEY` (Lizenz Gemini/ByteDance laut Nick **geklärt**).

**Gap (zu bauen):** `generateHeroGateAction` + Gate-2-„Bild generieren"-UI (mehrere Komponenten-Uploads + Library-Refs +
Prompt) → nano-banana → 3 Kandidaten; **Chat-Iteration** (gewählte Variante = Referenz für nächsten Turn, analog
`gate_chat`/`refineCopy`-Muster aus Block 1); **QA-Loop** (Style-Consistency via `claudeVisionClient`); `source='ai'`;
**AI-Label-Pflicht** im Render — ⚠️ AI-Label-Asset fehlt (`brand-assets/wingo/ai-label/` nur `.gitkeep`).
Gate-2-Flow heute: nur Upload + Library (`src/app/campaigns/[id]/GateView.tsx` inHero-Block, `src/lib/gates/uploadHero.ts`,
`selectHeroFromLibrary.ts`). Resolver: `src/lib/render/resolveHeroSrc.ts`.

## Offen (Nick-Input)
- Die 3 Prod-Daten-Schritte oben. - Lizenzierte Radikal-Font (aktuell „passt so" = Inter-Interim ok).
- Freigestellte Cut-out-Hero-PNGs (oder via Block-3 AI-Gen erzeugen). - AI-Label-Asset. - Supabase-Access-Token revoken.

## Commands (Ergänzung zu CLAUDE.md)
```
PREVIEW=1 npx vitest run src/lib/render/__tests__/previewSamples.manual.test.ts   # alle 8 Formate rendern → scripts/preview/ (gitignored)
node scripts/apply-migration.mjs <datei.sql>   # einzelne Migration auf Prod (sandbox-gated)
```

## Schlüssel-Dateien (Block 3 relevant)
- Image-Gen: `src/lib/imagegen/*` (types/falProvider/registry/engine/mock). Gate 2: `src/app/campaigns/[id]/GateView.tsx`
  (inHero), `_gate-actions.ts`, `src/lib/gates/uploadHero.ts` + `selectHeroFromLibrary.ts`, `src/lib/render/resolveHeroSrc.ts`.
- Chat-Muster (für Hero-Chat wiederverwendbar): `src/app/campaigns/[id]/_chat-actions.ts`, `workspace/CopyChatPanel.tsx`,
  `src/lib/db/queries/gate-chat.ts` (gate-Spalte unterstützt schon 'hero').
- Templates/Konformität: `src/templates/wingo/flash_sale/CanonicalPortrait.tsx` + `CanonicalLandscape.tsx`.

## Suggested Skills (nächste Session)
- **Workflow-Tool** — Nicks Default für jede substanzielle Aufgabe (Block 3 fan-out: gate_hero-data / fal-adapter-extension / Gate-2-UI / chat-iteration / QA-loop parallel, dann Integration).
- **tdd** für die imagegen-/Gate-2-Arbeit. **claude-api** falls Claude-Vision-QA auf generierten Heroes verfeinert wird (fal-Gen selbst ist nicht Anthropic).
