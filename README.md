# ACE – Wingo Format-Multiplexer

ACE adaptiert ein Marketing-Briefing **deterministisch** in **11 Formate × 4
Sprachen = 44 brand-konforme Assets** als ZIP. Ein Marketer gibt Produkt, Preis,
Kampagnenart und Botschaft ein; die Engine erzeugt Copy (Claude mit
Brand-Voice-Constraints), wählt/generiert ein Hero-Bild, komponiert je Format ein
deterministisches Code-Layout (Satori → PNG) und prüft jedes Asset gegen einen
Brand-Konformitäts-Gate.

**Brand:** Wingo (Swisscom). Architektur multi-brand-ready (`brand_id`-Pattern),
V1 launcht single-brand. **KO-Kriterium:** 100 % Brand-Konformität — verzerrte
Logos, falsche Farben oder verletzte Schutzbereiche machen ein Asset wertlos.

## Stack

- **Frontend:** Next.js 16 (App Router) + React 19 + Tailwind 4 + shadcn/ui
- **Backend:** Next.js API Routes + Server Actions (**kein n8n**)
- **AI:** Anthropic Claude (Copy / Translate / Edit / Vision-QA)
- **Render:** Satori (JSX → SVG) + `@resvg/resvg-js` (SVG → PNG), `sharp` zur Bild-Normalisierung
- **DB / Storage / Auth:** Supabase — Postgres (via `pg.Pool`), Buckets `campaign-assets` + `hero-library`
- **Brand-Source:** git-versioniert in `brand-assets/wingo/`
- **Hosting:** Vercel

## Quickstart

```bash
npm install

# Environment anlegen + Keys eintragen (alle Variablen sind dort dokumentiert)
cp .env.example .env.local

npm run dev        # http://localhost:3000
```

Pflicht-Env: `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`
(Pooler `:6543` oder Session-Mode `:5432`). Details: siehe `.env.example`.

### Datenbank-Schema

Migrationen liegen in `supabase/migrations/`. Schema + Seeds (Brand, 11
Format-Specs, Brand-Voices, Disclaimer) deployst du via Supabase-SQL-Editor oder:

```bash
node scripts/deploy-schema.mjs   # liest DATABASE_URL + SUPABASE_SERVICE_ROLE_KEY aus .env.local
```

## 5-Gate-Flow

```
Brief → Gate 1 Copy-Approval  (Headlines/Subline, TOV-aware)
      → Gate 2 Hero-Bild       (Library / AI-Gen / Upload)
      → Gate 3 Layout          (Master-Komposition + Variant-Auswahl)
      → Gate 4 Final-Hero-Review
      → AUTO: Multiplex auf 11 Formate × 4 Sprachen
      → Gallery + Per-Asset Chat-Edit + ZIP-Download
```

Layout = deterministisch (Code-Templates). Bild = kreativ (Library-First, AI als
Fallback). Copy = LLM mit Brand-Voice-Constraints. Compliance = pass-through
(Preise + Disclaimer werden **nie** vom LLM verändert).

## Projektstruktur

```
src/
  app/            App Router — Dashboard, /campaigns, /admin, Auth
  components/     UI (shadcn primitives + Feature-Komponenten)
  lib/
    ai/           Claude-Wrapper
    brand/        Token-Loader (Zod-validiert, fail-fast bei Brand-Drift)
    db/           pg-Queries + Migrations-Helfer
    render/       Satori→PNG, Hero-/AI-Label-Auflösung
    orchestrate/  44-Asset-Multiplexer
    qa/           Deterministischer Brand-Konformitäts-Gate
    export/       ZIP-Bundling
  templates/      Format-Layouts (deterministisch, kein LLM-Layout)
brand-assets/wingo/   Brand source of truth (tokens.json, logos, fonts, glossar)
supabase/migrations/  DB-Schema
docs/PRD-Wingo-V1.md  Product Requirements
plans/                Phasen-Pläne
```

## Business-Regeln (STRICT)

- **Preise** + **Disclaimer** werden NIE vom LLM modifiziert (verbatim aus Brief
  bzw. `disclaimers`-Table pro Zielsprache).
- **Glossar** (`brand-assets/wingo/glossar.json`) hat in jeder Sprache Vorrang.
- **Logo + AI-Label** dürfen nicht verzerren (`objectFit:contain`, per Test-Invariante erzwungen).
- **5G-Hinweis** „5G im Swisscom Netz" ist Pflicht bei 5G-Produkten (conditions-basiertes Matching).

## Tests

```bash
npm test                  # Vitest: Unit + Integration (PGlite in-memory Postgres)
npm run lint              # ESLint
npx tsc --noEmit          # Typecheck

# Voller End-to-End-Render (Brief → 44 echte PNG-Assets), gegated:
E2E_FULL=1 npx vitest run src/lib/orchestrate/__tests__/fullPipeline.e2e.test.ts
```

## Docs

- [PRD](docs/PRD-Wingo-V1.md) · [Phasen-Plan](plans/wingo-v1.md) · [CLAUDE.md](CLAUDE.md) (Architektur + Konventionen)
