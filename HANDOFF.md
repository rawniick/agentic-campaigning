# HANDOFF — ACE Wingo (Stand 2026-06-24)

> Für eine frische Session. Lies zuerst `CLAUDE.md` (Projekt) + die Memory-Files.
> Dieses Dokument ist der aktuelle Übergabe-Stand inkl. dem EINEN offenen Blocker.

## 🔴 OFFENER BLOCKER: client-side exception nach Brief-Submit

**Symptom (Nick, in Prod):** „Application error: a client-side exception has
occurred while loading agentic-campaigning.vercel.app (see the browser console)."
Tritt beim Smoke-Test auf — vermutlich nach dem Brief-Submit (Navigation zur
Kampagnen-Seite `/campaigns/[id]`) oder beim Laden einer authed Seite.

**Was bereits AUSGESCHLOSSEN ist** (via temporärer `/api/debug`-Route + Tests):
- Server-seitig ALLES grün auf Vercel: DB-Connection, Env-Vars (neue Instanz),
  brand-assets-Bundle, `getActiveBrandConfig`, Produkte, Kampagnen, **Copy-Gen
  (Anthropic)** — alles funktioniert. Es ist KEIN Server-Fehler.
- `GateView` rendert in allen Zuständen (copy_pending / hero_pending / done)
  sauber — isolierter Client-Render-Test grün.
- `BriefForm` sieht robust aus.
- Bereits gefixt (hat NICHT geholfen): verschluckter `redirect()` im BriefForm-
  try/catch (commit f34213c), `encType`-Warning am Gate-2-Upload-Form.

**Warum schwer:** Production versteckt die echte Fehlermeldung. Der reale Fehler
steckt nur in Nicks Browser-Konsole.

### ➡️ Nächster Schritt (so wird's gelöst)
1. **Sourcemaps sind jetzt AN** (`next.config.ts` → `productionBrowserSourceMaps`,
   deployed 2026-06-24). Nick: **Hard-Reload (Strg+Shift+R)** auf der crashenden
   Seite → **F12 → Console** → die rote Fehlermeldung zeigt jetzt **echte
   Datei:Zeile + Message**. Diese (+ Stack + URL) holen → exakte Zeile fixen.
   *(Nach dem Fix `productionBrowserSourceMaps` wieder entfernen.)*
2. Falls Nick die Konsole nicht liefern kann: headless reproduzieren. Kein
   Playwright installiert. Auth ist der Haken (Login braucht Passwort/Session) —
   Session-Cookie via Supabase-Admin (SERVICE_ROLE_KEY) generieren, dann mit
   headless Chromium die Seite laden + `page.on('pageerror')` capturen.
3. Verdächtige, falls Sourcemaps-Fehler unklar: Hydration-Mismatch auf
   `/campaigns/[id]`; ein Client-Component in einer noch nicht getroffenen Route;
   ein prod-spezifischer React-19-Fall.

## ✅ Was steht (live + verifiziert)

- **Live:** https://agentic-campaigning.vercel.app (Vercel-Projekt
  `agentic-campaigning`, Org `rawniicks-projects`). CLI ist als `rawniick`
  eingeloggt → `npx vercel --prod --yes` deployt. Build OK, Auth-Redirect greift.
- **DB/Auth/Storage:** Supabase `kaqxwjmzavxysxtnkdeo` (eu-west-1). Secrets in
  gitignored `.env.local` (DATABASE_URL Pooler :6543, SUPABASE_*, ANTHROPIC_API_KEY).
  **Vercel-Env-Vars sind gesetzt** (5 Stück, neue Instanz — waren vorher 96 Tage
  alt + zeigten auf die ALTE Instanz; DATABASE_URL fehlte ganz → gefixt).
- **Git:** Branch `wingo-v1`, alles auf `origin/wingo-v1` + `main` gepusht.
- **3 Auth-Accounts** existieren, u.a. `events@epyk.ch` (Nick). Keine Signup-Seite
  (Account im Supabase-Dashboard provisionieren). PW-Reset: Supabase → Auth → Users.
- **Produkte:** 13 aktuelle Wingo-Abos geseedet (`scripts/seed-wingo-products.mjs`):
  8 Mobile (5G), 4 Internet, 1 TV — im Briefing-Dropdown.
- **hero_library ist LEER** → Gate 2 zeigt nur Upload (kein Library-Pick).

## Was diese Session gebaut hat (committed + deployed)

- **Härtung + Deploy** auf eigene Instanz (Schema/Bucket/DATABASE_URL live).
- **Phase 0** echte Brand-Assets: Logo `wingo-lockup@3x.png`, Farben (Rot **#FF5759**,
  Anthrazit #292B2D, Grau #E7E7E7), Font Radikal → aber **RadikalTrial ist
  beschnitten** (keine Umlaute/Slash/%) → liegt unter `fonts/radikal-trial-unusable/`,
  interim rendert **Inter** unter dem Radikal-Slot. **TODO Nick: lizenzierte Radikal.**
- **Phase 1** Ship-Proof: 44/44 brand-konform live (`shipProof.live.test.ts`,
  gated `SHIP_PROOF=1`; Output → `scripts/ship-proof/`).
- **Phase 2** Zwei-Style-System: flash_sale = roter BG + weisses Logo, standard =
  grau. `src/templates/wingo/campaignStyle.ts` (`styleForArt`/`resolveTemplateStyle`),
  art-getrieben, Frontend-Selektor in BriefForm.
- **Phase 2b** Stern-Blob-Preiscontainer (`wingo-stern-white@3x.png`), in Formaten
  mit Platz; Square/Ricchi zu eng → plain.
- **Phase 3** AI-Gen Provider-Fundament `src/lib/imagegen/` (ImageProvider +
  config-getriebene Modell-Registry = Dropdown-Quelle + fal-Adapter REST +
  mock + engine; 13 Tests). **OFFEN: Gate-2-„Generate New"-UI + Live** (braucht
  `FAL_KEY` + **Lizenz-Freigabe** Gemini/ByteDance für kommerzielle Werbung).
- **Bugfixes diese Session:** Auth-Middleware crasht nicht mehr bei defektem
  Cookie (`getUser().catch`); Copy-Gen fängt Anthropic-529/500 ab (4 Retries +
  klare Meldung + Cleanup); `maxDuration=60` auf /campaigns/new.

## Offene Punkte (Nick-Input)
- 🔴 **Client-side exception fixen** (oben) — der aktuelle Blocker.
- 🔴 **Access-Token revoken** (Supabase Account-Tokens — Deploy ist durch).
- **Lizenzierte Radikal-Font** für Production.
- **Phase 3 Teil 2:** Gate-2-„Generate New"-UI + `FAL_KEY` + Lizenz-Klärung.
- **Cutout-Person-Hero** (2b Teil 2): braucht freigestellte transparente Hero-PNGs.

## Commands
```
npm run dev                        # lokal (verbindet Live-DB via .env.local)
npx tsc --noEmit                   # Typecheck
npx vitest run                     # Tests (PGlite in-memory)
SHIP_PROOF=1 npx vitest run src/lib/orchestrate/__tests__/shipProof.live.test.ts
node scripts/seed-wingo-products.mjs   # Produkte (re-)seeden
npx vercel --prod --yes            # Prod-Deploy (CLI = rawniick)
```

## Schlüssel-Dateien
- 5-Gate-UI: `src/app/campaigns/[id]/GateView.tsx` (client), `page.tsx` (server),
  `_gate-actions.ts` (server actions); Brief: `src/app/campaigns/new/BriefForm.tsx`
  (client), `src/app/campaigns/_actions.ts` (`submitBriefAction`).
- Auth: `src/lib/supabase/middleware.ts`, `src/middleware.ts`.
- Render: `src/lib/orchestrate/runMultiplex.ts`, `src/lib/render/`, `src/templates/wingo/`.
- Brand: `src/lib/brand/`, `brand-assets/wingo/` (+ `imagery/` gitignored, ~25MB).
