# CLAUDE.md — ACE Wingo V1 (Format-Multiplexer)

## Projekt

ACE ist ein **Format-Multiplexer** fuer Wingo Marketing-Kampagnen. Ein Marketer
gibt ein Briefing ein (Produkt, Preis, Kampagnenart, Botschaft) und bekommt
**11 Formate × 4 Sprachen = 44 Assets brand-konform** als ZIP zurueck. Kein
Konzept-Generator, kein ZIP-Export-als-Endprodukt — der Wert ist die
deterministische, automatisierte Multi-Format-Adaption.

**Brand:** Wingo (Swisscom). Architektur multi-brand-ready (brand_id-Pattern),
V1 launcht single-brand.

**KO-Kriterium:** 100% Brand-Konformitaet. Verzerrte Logos, falsche Farben oder
verletzte Schutzbereiche = Asset wertlos.

## Mental Model

- **Layout = deterministisch** (Code-Templates, kein LLM-halluzinierter Layout)
- **Bild = kreativ** (Library-First, AI als Fallback mit Style-Reference)
- **Copy = LLM mit Brand-Voice-Constraints** (TOV-Matrix Art × Zielgruppe)
- **Compliance = pass-through** (Preise + Disclaimer werden NIE vom LLM modifiziert)

## 5-Gate Flow

```
Brief eingeben
  → Gate 1: Copy-Approval (Headlines, Subline, TOV-aware)
  → Gate 2: Hero-Bild-Approval (Library / AI-Gen / Upload)
  → Gate 3: Layout-Komposition (Master mit Variant-Auswahl + Drag-in-Safezone)
  → Gate 4: Final-Hero-Review
  → AUTO: Multiplex auf 11 Formate × 4 Sprachen
  → Gallery + Per-Asset Chat-Edit + ZIP-Download
```

Skip-Buttons mit Smart-Default + Re-Open-faehig.

## V1 Scope

- Kampagnentypen: **Flash Sale** (V1.0) + Standard (V1.1)
- Formate: **11 statische** — Display Standard 5 + Google Ads statisch 3 + Social statisch 3
- Sprachen: **DE + FR + IT + EN** (Auto-Translate post Copy-Approval)
- User: **1 User** (Single-Login, kein RBAC)

**Out of V1:** Video, Display Spezial Premium (Watson/20Min/Blick/etc.),
HTML5-Animation, Print/OOH F4/F12, Audio Spotify, Multi-User, In-App Notifications,
Auto-Distribution, Performance-Metrics, Cloning, n8n, Canva, Frontify.

Detaillierte Phasen 0–7: siehe `plans/wingo-v1.md`.
Funktionsumfang: siehe `docs/PRD-Wingo-V1.md`.

## Tech Stack

- **Frontend:** Next.js 16 App Router + React 19 + Tailwind 4 + shadcn/ui
- **Backend:** Next.js API Routes + Server Actions (kein n8n)
- **AI:** Anthropic Claude (Sonnet 4.6) fuer Copy/Translate/Edit/Vision-QA
- **Image-Gen:** NanoBanana / DALL-E / Imagen (Provider-Router, Library-First)
- **Render:** Satori (statisch, default) + Puppeteer (Fallback komplex)
- **DB:** Supabase Postgres (brand-aware Schema)
- **Storage:** Supabase Storage (`campaign-assets`, `hero-library` Buckets)
- **Brand-Source:** Git-versioniert in `/brand-assets/wingo/`
- **Hosting:** Vercel

## Projektstruktur (nach Phase 0)

```
src/
  app/
    layout.tsx              # Minimaler Root Layout
    page.tsx                # Dashboard (Empty State Phase 0)
    login/, signup/, auth/  # Auth-Scaffold
    globals.css
  components/
    ui/                     # shadcn primitives (preserved)
  lib/
    ai/
      claude.ts             # Anthropic SDK Wrapper (minimal)
    auth/
      get-user.ts           # Auth helper
    db/
      supabase.ts           # Service-Role + Server-Client Factories
    supabase/
      client.ts, server.ts, middleware.ts  # SSR Variants
    utils.ts                # cn() helper
  middleware.ts             # Auth-Redirect

brand-assets/wingo/         # Brand source of truth (NICK pflegt)
  tokens.json               # Farben, Fonts, Spacing, Safezones, Logo-Specs
  glossar.json              # Translator-Passthrough-Terms
  logos/, fonts/, samples/, ai-label/  # Files

docs/PRD-Wingo-V1.md        # Product Requirements
plans/wingo-v1.md           # Phasen-Plan
supabase/migrations/        # leer (Phase 0.C bootstraps fresh)
```

Phase 1+ baut hier `src/app/admin/`, `src/app/campaigns/`, `src/lib/brand/`,
`src/lib/render/`, `src/templates/`, `src/lib/db/queries/` schrittweise auf.

## Coding Conventions

- TypeScript strict, keine `any`
- Zod fuer alle Validierungen
- Server Components Default, Client nur mit `'use client'`
- API Routes fuer Webhooks / Streaming, Server Actions fuer Mutationen
- Tailwind + shadcn/ui
- Deutsche Kommentare fuer Business-Logik wo nicht trivial
- try/catch mit `{ error: string, details?: unknown }`

## Business-Regeln (STRICT)

- **Preise NIEMALS via LLM.** Input-String = Output-String pixel-exakt.
- **Disclaimer NIEMALS via LLM.** Aus `disclaimers`-Table pro Zielsprache geladen.
- **Glossar hat Vorrang.** Wingo-Terms (z.B. "Wingo Mobile Swiss") bleiben in jeder
  Sprache identisch.
- **AI-Bilder:** AI-Label-Asset muss visuell eingebettet sein. Pflicht laut Brand Manual.
- **5G-Hinweis "5G im Swisscom Netz"** ist Pflicht bei 5G-Produkten (matched via
  `disclaimers.conditions_json`).
- **Logo-Konformitaet:** Aspect-Ratio darf nicht verzerren (Vision-QA-Check).

## Brand-Source (`/brand-assets/wingo/`)

Single source of truth. `tokens.json` wird beim App-Start mit Zod validiert —
fehlende Pflicht-Tokens fuehren zum Fail-Fast (Absicht: Brand-Drift soll frueh
weh tun).

Pflichtinhalt:
- `tokens.json` mit nicht-leeren Werten in `colors.primary`, `colors.secondary`,
  `colors.background_primary`, `typography.fonts.headline`, `logo.variants.kombi`
- `logos/wingo-lockup.svg` (Default-Variante)
- `fonts/<headline>.woff2` falls Self-Hosting
- `ai-label/wingo-ai-label.svg`
- `glossar.json` mit `passthrough_terms`

## Test-Strategie

- **Unit:** Vitest fuer pure Logik (token-loader, conditions-matcher, position-propagation)
- **Integration:** Server-Actions mit echter Supabase (lokales `supabase start`)
- **E2E:** Playwright (optional ab Phase 2 fuer Gate-Flow)
- **Vision-QA:** in CI gemockt (Claude Vision Mock-Responses), real-call gegated

## Deployment

- Vercel (Frontend + API Routes + Edge-Functions)
- Supabase fuer DB + Storage + Auth
- ENV-Vars fuer ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL/ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
  Image-Gen-Provider-Keys (NANOBANANA, OPENAI etc.) ab Phase 5

## Workflow

Wenn der User mit `/grill-me` Anforderungen klaert: lies `docs/PRD-Wingo-V1.md`
zuerst. Wenn `prd-to-plan` oder Implementation: lies zusaetzlich `plans/wingo-v1.md`.
Memory-Files in `~/.claude/projects/.../memory/` enthalten Nicks Praeferenzen +
Pivot-Kontext.
