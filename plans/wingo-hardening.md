# Plan: ACE Wingo — Härtungs-Runde „ship-safe"

> **Quelle:** `docs/PRD-Wingo-V1.md` + `plans/wingo-v1.md` (v.a. Phase 5b) + elaboratum-Vorstudie
> „Agentic Promo Production" (Juni 2026, Gate **„erst beweisen, dann investieren"**).
> **Runde gewählt vom User (2026-06-16):** DoD-Stufe **„A auf bestehender Supabase `fmfrw…`"**.
> **Kontext:** Engine (Brief → 5-Gate → 44-Asset-Multiplex → ZIP) ist gebaut + grün getestet,
> aber **nicht ship-safe** (Platzhalter-Logo, Hero rendert blank, Compliance-Lücken, nie deployed).
> Diese Runde macht den **bestehenden** Wingo-Pfad auslieferbar — keine neue Breite (kein Coop,
> kein AI-Bildgen). Erst beweisen, dann das nächste Paket.

---

## Ziel / Definition of Done (Runde)

Ein Brief läuft end-to-end durch und liefert **44 Wingo-Assets (11 Formate × DE/FR/IT/EN)**, die
**alle einen erzwungenen, deterministischen Brand-Konformitäts-Gate bestehen** (echtes Logo,
unverzerrt, korrekte Dimensionen/Farben, Hero sichtbar, Compliance vollständig), **deployed auf
`kaqxwjmzavxysxtnkdeo`**, als frisches ZIP — und ist **visuell von Menschenauge bestätigt**.
„Ship-safe" = ein Externer könnte es real benutzen.

---

## Architectural decisions (durable — gelten über alle Phasen)

- **Deploy-DB:** App-Projekt `kaqxwjmzavxysxtnkdeo`. Migrationen werden als **ein** SQL-Skript
  vom User selbst im **Supabase-SQL-Editor** eingespielt (User teilt keine DB-Credentials).
  Projekt `gztkuzqbhhfmabenqgcj` (MCP / Event-App) wird **nicht angefasst**.
- **Konformitäts-Gate:** **deterministisch** (Geometrie/Dimensionen/Farb-Presence/Platzhalter-Erkennung),
  **erzwungen im Export-/Final-Pfad**. Claude-Vision-QA bleibt **advisory daneben** (eine LLM-Meinung
  blockt nie hart). Der deterministische Gate ist das ausführbare KO-Kriterium „100% Brand-Konformität".
- **Hero/Logo im Render:** lokale/Storage-Bytes werden **serverseitig geladen** und als **Data-URL**
  an Satori übergeben (Satori fetcht keine Remote-URLs). Logo-Drop-in: `wingo-lockup@3x.png`.
- **Copy-Ton:** `findVoiceVariant(brand, art, zielgruppe) ?? getDefaultVoice(brand)`.
- **Compliance (STRICT, unverändert):** Preise + Disclaimer **nie** via LLM; **alle** zutreffenden
  Disclaimer (nicht nur der erste); Glossar-Passthrough auch im **DE-Generate** (nicht nur Übersetzung).
- **Auth:** Single-User; kein offenes Signup; Auth-Check in Server-Actions/Export-Route (nicht nur Middleware).
- **Asset-Gating:** Nur **Phase 6** (Deploy) + **Phase 7** (Ship-Proof) hängen am User-Input.
  Phasen 1–5 sind **input-frei** (mit Fixtures gebaut, swappen automatisch auf echte Dateien).

### Cycle-DoD (gilt für JEDE Phase — vom User aktiviert)

1. **KO-Kriterien sind ausführbare Blocking-Tests** (nicht Prosa).
2. **„Wired + real-boundary":** jede Phase endet damit, dass sie aus dem **Live-Flow** erreichbar ist
   **und** mindestens **1 Test gegen die echte Grenze** hat (echter Satori/resvg-Render mit echtem
   Hero/Logo — **nicht** nur Mocks).
3. **Visual-Verify:** `/verify` + `/run` an einem **echten gerenderten Asset** (Augen + Vision-QA).
4. **`/code-review`** vor „done".
5. **Kein CI** (bewusste User-Entscheidung) — Grün = letzter lokaler Lauf + Visual-Verify.

### Out of Scope (vertagt, NICHT in dieser Runde)

Embedding-/Semantic-Hero-Suche · Drag-Positionierung (Gate 3) · Skip-Buttons / 5-Gate-UI-Feinschliff ·
AI-Bildgenerierung (fal.ai) + AI-Label · Coop-Mobile-Brand · Print/Animation · CI.

---

## Phase 0: Sicherung — erledigt ✅

Sicherungs-Commit **`7789f9b`** (lokal, kein Push) hält den kompletten Phase-5b-Sprint fest
(44-Asset-Wiring, Translator, Vision-Client, Logo-Resolver, Export-Route, Migration 015).
Nichts Neues zu bauen.

---

## Phase 1: Bild & Logo erscheinen wirklich

**User stories:** FR-23 (Hero), FR-30/31 (Render Satori), KO-Kriterium (Logo)

### What to build

Der Render zeigt **tatsächlich** Hero-Bild + Logo + korrekte Schrift. Hero-Blank-Bug beheben: der
Renderer lädt Hero-Bytes **serverseitig** (über `fetchAssetBytes`) und übergibt sie als Data-URL an
Satori statt einer Remote-URL im `<img src>`. Echtes Logo-PNG (`resolveLogoSrc`, vorhanden) +
Headline-Font werden in den Satori/resvg-Fontset geladen. Dev-Seed: `brand-assets/wingo/samples/*`
werden als Hero-Library-Records eingespielt, damit Gate 2 echte Bilder anbietet.

### Acceptance criteria

- [ ] **Real-boundary:** ein echter Satori/resvg-Render mit echtem JPG-Hero erzeugt ein PNG, dessen
  Hero-Bereich **nicht leer/transparent** ist (Pixel-Stichprobe ≠ Hintergrundfarbe). Test gegen den
  **echten** Renderer, kein Mock.
- [ ] Logo-PNG (Fixture `wingo-lockup@3x.png`) erscheint in der Logo-Zone; fehlt das PNG → sichtbarer
  Interim **und** `logoIsPlaceholder=true`.
- [ ] Headline-Font wird in resvg/Satori geladen → Text rendert mit Schrift (nicht leer/Fallback-blank).
- [ ] `samples/*.{jpg,png}` werden per Dev-Seed zu `hero_library`-Records; Gate 2 zeigt sie wählbar.
- [ ] **Visual-Verify:** 1 gerendertes Asset geöffnet → Hero + Logo + Schrift sichtbar bestätigt.
- [ ] `/code-review` grün.

---

## Phase 2: Konformitäts-Gate (erzwungen)

**User stories:** FR-24 (Vision-QA → ergänzt um deterministischen Gate), KO-Kriterium

### What to build

Ein **deterministischer Brand-Konformitäts-Check** pro Asset, der hart blockt: Logo ist **kein**
Platzhalter (`logoIsPlaceholder=false`), Logo-Aspect-Ratio-Abweichung ≤
`tokens.validation_rules.max_aspect_ratio_deviation`, Asset-Dimensionen == `format_spec`,
Brand-Primärfarbe im Asset vorhanden, Disclaimer-Zone nicht leer. Ergebnis pro Asset persistiert
(`conformity_pass` + Details). **Export-Route + ZIP blocken** nicht-konforme Assets als „final";
Gallery zeigt **Hard-Fail-Badge** mit Grund. Vision-QA-Score läuft weiter advisory daneben.

### Acceptance criteria

- [ ] **KO ausführbar:** Asset mit Platzhalter-Logo ⇒ `conformity_pass=false` ⇒ **nicht** im ZIP /
  nicht als final exportierbar (Test).
- [ ] Verzerrtes Logo (Aspect-Ratio > Toleranz) ⇒ fail (Test).
- [ ] Falsche Dimensionen / fehlende Brand-Farbe ⇒ fail (Test).
- [ ] Korrektes Asset ⇒ pass (Test).
- [ ] **Wired:** der Gate greift im **Export-/Final-Pfad** (live erreichbar), nicht nur in einem Lib-Test.
- [ ] Gallery-Badge rot bei Fail, mit Grund; konforme Assets grün.
- [ ] **Visual-Verify** + `/code-review`.

---

## Phase 3: Compliance vollständig

**User stories:** FR-16 (Disclaimer-Library), FR-25 (Translation), Compliance-Regeln (STRICT)

### What to build

Pro Asset werden **alle** zutreffenden Disclaimer gerendert (nicht nur `disclaimer_ids[0]`). Der
**DE-Generate-Prompt** bekommt die Glossar-Passthrough-Liste injiziert **und** Preise/Konditionen
werden vor dem LLM-Call entfernt (kein Preis/keine Kondition erreicht je das Modell — auch nicht in
der Original-DE-Generierung).

### Acceptance criteria

- [ ] **KO ausführbar:** Kampagne mit 2 erforderlichen Disclaimern ⇒ **beide** in allen 44 Assets
  (Source-String-Check pro Sprache).
- [ ] Preise (`price_promo`/`price_standard`/`price_suffix`) **string-equal** Input=Output in DE/FR/IT/EN.
- [ ] DE-Generate-Prompt enthält **keinen** Preis / keine Konditionen (Test am Prompt-Builder).
- [ ] Glossar-Terms bleiben 1:1 im DE-Output (nicht paraphrasiert) (Test).
- [ ] **Real-boundary:** echter Render eines Multi-Disclaimer-Assets zeigt **beide** Legal-Lines.
- [ ] **Visual-Verify** + `/code-review`.

---

## Phase 4: Markengerechter Ton (TOV-Matrix verdrahtet)

**User stories:** FR-15/FR-21 (Brand-Voice-Matrix)

### What to build

`generateCopy` nutzt `findVoiceVariant(brand, art, zielgruppe) ?? getDefaultVoice(brand)` statt immer
Brand-Default. Der bisher tote Pfad wird Live-Pfad.

### Acceptance criteria

- [ ] Flash-Sale × Sozial wählt einen **anderen** Voice-Variant als Default; fehlt die Matrix-Zelle →
  Default-Fallback (Test).
- [ ] **Wired:** Copy-Generierung an Gate 1 verwendet den Lookup (nicht nur ein Lib-Test).
- [ ] Audit-Log hält den genutzten TOV-Variant fest (Debug-Trace).
- [ ] `/code-review`.

---

## Phase 5: Single-User-Lockdown

**User stories:** Auth (V1 = 1 User, kein RBAC)

### What to build

Öffentliches Signup sperren/entfernen; nur der erlaubte User (Env-Allowlist oder erster User) erreicht
die App; `getAuthUser` tatsächlich in Server-Actions + Export-Route prüfen (nicht nur Middleware-Redirect).

### Acceptance criteria

- [ ] `/signup` ist **nicht** öffentlich nutzbar (Test/Verify).
- [ ] Server-Actions + Export-Route prüfen Auth serverseitig (nicht nur Middleware).
- [ ] **Visual-Verify:** ausgeloggt ⇒ kein Zugang; eingeloggt (erlaubter User) ⇒ Zugang.
- [ ] `/code-review`.

---

## Phase 6: Live-Deploy auf `fmfrw…` + Go-Live-Beweis

**User stories:** Infra / Deployment (DoD „A")

### What to build

Ein konsolidiertes SQL-Skript aller Migrationen **001–015** generieren (für den SQL-Editor),
plus Env-Checkliste (`DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`) für lokal +
Vercel. Nach dem Einspielen verifizieren, dass der **Live-Flow** gegen `fmfrw…` verbindet und ein
Brief 44 Assets schreibt.

### Acceptance criteria

- [ ] `supabase/consolidated_001-015.sql` erzeugt (1× im SQL-Editor lauffähig) + dokumentierte Schritte.
- [ ] 🔑 **User:** SQL im `fmfrw…`-SQL-Editor eingespielt; Tabellen 001–015 vorhanden (Dashboard-Check).
- [ ] 🔑 **User:** Env gesetzt (lokal `.env.local` + Vercel).
- [ ] **Verify:** echter Brief gegen `fmfrw…` ⇒ 44 `assets`-Records + Storage-Uploads; ZIP lädt.
- [ ] `gztku…` nachweislich **unangetastet**.
- [ ] `/code-review`.

---

## Phase 7: Ship-Proof — „erst-beweisen"-Meilenstein

**User stories:** FR-40 (Gate-Flow), FR-43 (ZIP), DoD-Runde

### What to build

Mit **echten Brand-Dateien** (Logo/Hero/Font): voller Durchlauf Brief → 44 Assets, **alle** bestehen
den Konformitäts-Gate aus Phase 2 ⇒ ZIP; visuell verifiziert. Damit ist das Konzept-Gate
„erst beweisen" erreicht.

### Acceptance criteria

- [ ] 🔑 **User:** echtes `logos/wingo-lockup@3x.png` + ≥2 Hero-Bilder (`samples/`) + (optional Font) liegen.
- [ ] Konformitäts-Gate **aller 44** Assets = **pass** (kein Platzhalter, kein Fail).
- [ ] **Visual-Verify:** Stichprobe je Format/Sprache ist brand-konform (echtes Logo, Hero, Farben,
  Disclaimer, Preis korrekt).
- [ ] ZIP mit **44 konformen**, korrekt benannten PNGs (`wingo_flashsale_<format>_<lang>.png`).
- [ ] **DoD-Runde erreicht:** „A auf `fmfrw…`" — dokumentiert.
- [ ] **`/code-review` (high/ultra)** als Schluss-Pass.

---

## Gated auf User-Input (Zusammenfassung)

| Item | Wohin | Blockt Phase |
|---|---|---|
| `wingo-lockup@3x.png` (transparent, ≥720px) | `brand-assets/wingo/logos/` | 7 (Gate grün) |
| 2–3 Hero-Bilder `.jpg/.png` | `brand-assets/wingo/samples/` | 7 |
| Headline-Font `.woff2/.ttf` (optional, sonst Inter) | `brand-assets/wingo/fonts/` | 7 (Qualität) |
| Exakte Brand-Hex (optional) | mir nennen | 7 (Qualität) |
| Migration-SQL einspielen + Env setzen | Supabase-SQL-Editor + Vercel | 6 |

Phasen **1–5 laufen sofort & parallel** zum Datei-Sammeln.
