# HANDOFF — ACE Wingo (Stand 2026-06-25)

> Frische Session: lies `CLAUDE.md` (Projekt) + Memory-Files + **`plans/wingo-v1.2-krea-workspace.md`**
> (Entscheidungs-Log D1–D11, Phasen 0–8, kanonische Flash-Sale-Anatomie). Dieses Doc = aktueller Stand + EINE offene Aktion.

## ⏳ DIE EINE offene Aktion: Migration 017 auf Prod
Der Workspace-UX-Block ist live-deployed, aber die `gate_chat`-Tabelle (Migration 017) muss noch
in die Prod-DB, damit der **Copy-Chat persistiert/schreibt**. Lesen ist abgesichert
(`getGateChat(...).catch(()=>[])` in `page.tsx` → Seite crasht NICHT ohne 017), aber das **Schreiben**
(refine im Chat) braucht die Tabelle.
```
node scripts/apply-migration.mjs 017_gate_chat.sql      # additiv, reversibel (DROP TABLE gate_chat)
```
⚠️ Prod-DB-Writes sind sandbox-gated → braucht Nicks `!`-Ausführung oder eine Permission-Rule für
`node scripts/apply-migration.mjs`. (Hinweis: `supabase/consolidated_001-016.sql` ist veraltet — 017
fehlt dort; für frische Deploys nachziehen.)

## ✅ Diese Session erledigt (committed auf `wingo-v1`)
**Der frühere Blocker (client-side exception) ist GELÖST:** React #31 — `pg` parste `DATE`-Spalten
(`campaigns.datum_von/bis`) zu JS-`Date`, die direkt in JSX gerendert wurden. PGlite (Tests) liefert
strings → unsichtbar. Fix: pg-Type-Parser (OID 1082/1114/1184) in `src/lib/db/server.ts`.

- **Phase 0** (Crashfix-Loop): DATE-Fix + Regression-Test; schlanke Error-Boundaries
  (`src/app/error.tsx`, `global-error.tsx`, Stack nur in Dev); Sourcemaps wieder aus; Temp-Script weg.
- **Phase 1** (Quick Wins): Copy-Prompt erzwingt echte **Umlaute** (`generateCopy.ts` war ASCII-transliteriert);
  „Briefing JSON"-Block raus; **Standard-Preis-Scraper** (`src/lib/pricing/scrapeWingo.ts` matcht wingo.chs
  `data-teaser-card-price` über den Promo-Preis) + Admin-Button auf `/admin/products`.
- **Block-1 Workspace-UX** (via Parallel-**Workflow**, 4 Module + Integration + Verify): **Two-Pane-Shell**
  (`workspace/WorkspaceShell.tsx`: Konsole links / Canvas rechts), **Copy-Chat Gate 1**
  (`workspace/CopyChatPanel.tsx` + `_chat-actions.ts` + `src/lib/copy/refineCopy.ts` + `gate_chat`/017 +
  `src/lib/db/queries/gate-chat.ts`), **Pfeil-Stepper** (`workspace/GateStepper.tsx`), **ProgressBar** +
  **SaveIndicator**. `GateView.tsx` in die Shell umgebaut, alle Gate-Forms in `useTransition`.
- **Halfpage-Tracer** (kanonische Flash-Sale-Anatomie) wurde gebaut, dann **bewusst zurückgerollt**
  (commit `873c077` → `86f1cd2`), weil er 5 Bestands-Tests brach UND flash-only war (zeigte „flash sale"
  fälschlich auf Standard-Kampagnen). **Spec + Preview-Harness bleiben** — Rebuild kommt richtig in Block-2.

Voller Test-Stand: **333 passed, 0 failed** (5 skipped = gated live/E2E). `tsc` clean.

## 🎯 Build-Reihenfolge (Nicks Priorität) + was als Nächstes
1. ✅ **Workspace-UX** (done, deployed; nur 017 pending).
2. ⏭ **Block-2: Konformität** — „finale Outputs unbrauchbar" fixen. Anker = echte Sample-Sujets
   (`brand-assets/wingo/samples/Beispiel Kampagne Flash Sale/`), kanonische Anatomie + D11 (Hybrid) im Plan.
   **TODO:** Halfpage-Rebuild richtig (Flex-Flow gegen Overlap, „flash sale"-Wordmark, kurze Headline,
   **Doppelpreis-Blob** alt-durchgestrichen+neu via `productName`/`priceStandard` durch `runMultiplex` verdrahten,
   Gratis-Badge, Channel-Footer, Legal-Line mehrzeilig); **auf alle 8 Formate** ausrollen; **Art-Gating**
   (flash-Chrome nur für flash_sale, nicht standard); Gate-3-Varianten reconcilen; die 5 Design-Contract-Tests
   updaten (`src/templates/__tests__/FlashSaleHalfpage.test.tsx`, `src/templates/wingo/__tests__/emphasis.test.tsx`,
   `src/lib/render/__tests__/renderToPng.test.tsx`); **Legal-Line** seeden/matchen + lesbar rendern; **Vision-QA als
   echten Export-Blocker** (heute nur advisory; harter Gate `checkBrandConformity.ts` prüft nur Logo/Dims/Primärfarbe).
   Cut-out-Hero-PNGs nötig (Gate-2 AI-Gen / Nick). Review-Loop: `PREVIEW=1 npx vitest run src/lib/render/__tests__/previewSamples.manual.test.ts`.
3. ⏭ **Block-3: Hero-AI-Gen** — fal/**nano-banana** Multi-Image-Fusion aus Referenzbildern, Gate-2-„Bild generieren"-UI,
   AI-Label-Pflicht. Lizenz geklärt + `FAL_KEY` da (Nick). `src/lib/imagegen/` existiert, ist NICHT in Gate 2 verdrahtet.

## ⚙️ Standing-Preference + Infra
- **Immer parallel + Subagents/Workflows** wo möglich (Memory `feedback_parallel_subagents`; Nick „notiere das!!"). Ultracode an.
- **Live:** https://agentic-campaigning.vercel.app (Vercel `agentic-campaigning`, Org `rawniicks-projects`, CLI=`rawniick`).
  Supabase `kaqxwjmzavxysxtnkdeo`. Secrets in gitignored `.env.local`. Prod-Deploy: `npx vercel --prod --yes`.
- **Offen (Nick-Input):** lizenzierte Radikal-Font (aktuell „passt so" = Inter-Interim ok); Scraper auf Prod verifizieren;
  freigestellte Cut-out-Hero-PNGs; Supabase-Access-Token revoken.

## Commands (Ergänzungen zu CLAUDE.md)
```
node scripts/apply-migration.mjs 017_gate_chat.sql        # einzelne Migration auf Prod
PREVIEW=1 npx vitest run src/lib/render/__tests__/previewSamples.manual.test.ts   # alle Formate rendern → scripts/preview/
```

## Schlüssel-Dateien (neu/relevant ggü. CLAUDE.md)
- Workspace-UX: `src/app/campaigns/[id]/workspace/*` (Shell/Stepper/ProgressBar/SaveIndicator/CopyChatPanel),
  `_chat-actions.ts`, `src/lib/copy/refineCopy.ts`, `src/lib/db/queries/gate-chat.ts`, `supabase/migrations/017_gate_chat.sql`.
- Konformität (Block-2): `src/templates/wingo/flash_sale/*`, `campaignStyle.ts`, `src/lib/qa/checkBrandConformity.ts`,
  `src/lib/qa/runVisionQA.ts` + `claudeVisionClient.ts`, `src/lib/render/propagatePositions.ts` (verwaist, für Layer-Editor).
- Scraper: `src/lib/pricing/scrapeWingo.ts`. Migration-Runner: `scripts/apply-migration.mjs`.

## Suggested Skills (nächste Session)
- **Workflow-Tool** (parallel bauen — Nicks Default).
- **prd-to-plan** für Block-2/3 als Tracer-Slices, falls gewünscht.
- **/grill-with-docs** (grill-me) nur wenn neu zu scopen ist — D1–D11 sind bereits entschieden.
- **tdd** für die Konformitäts-/Template-Arbeit (die Design-Contract-Tests treiben).
