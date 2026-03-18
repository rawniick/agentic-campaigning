# CLAUDE.md - ACE (Agentic Campaigning Engine)

## Projekt

AI-gesteuerte, brand-agnostische Marketing-Engine. Automatisiert: Input, Konzept, Claims, Uebersetzungen (DE/FR/IT/EN), visuelle Assets via Canva, Upload in Ad-Plattformen. Multi-Brand-faehig – Brand-Daten werden dynamisch aus dem Brand Brain geladen.

## Tech Stack

- Frontend: Next.js 14 (App Router) + React + Tailwind CSS + shadcn/ui
- Backend: Next.js API Routes + Server Actions
- AI: Claude API (claude-sonnet-4-20250514)
- Orchestrierung: n8n (Docker) fuer async Workflows
- Datenbank: Supabase (Postgres + Auth + Storage + Realtime)
- Integrations: Canva Connect API, Meta Marketing API, Google Ads API, Google Drive API
- Language: TypeScript strict

## Projektstruktur

```
src/
  app/                       # Next.js App Router
    layout.tsx               # Root Layout mit Sidebar
    page.tsx                 # Dashboard Home
    campaigns/
      page.tsx               # Kampagnen-Uebersicht
      new/page.tsx           # Promo-Input Formular
      [id]/
        page.tsx             # Detail + Approval
        briefing/page.tsx    # Generiertes Briefing
        content/page.tsx     # Assets
        export/page.tsx      # Distribution
    api/
      generate/
        concept/route.ts     # Konzept-Generierung
        translate/route.ts   # Uebersetzung
        content/route.ts     # Content-Generierung
      campaigns/route.ts     # CRUD
      approve/route.ts       # Approval-Actions
      export/route.ts        # Upload Meta/Google
  components/
    ui/                      # shadcn/ui
    dashboard/               # Sidebar, CampaignCard, StatusBadge
    forms/                   # PromoInputForm, PricingInput, ChannelSelector
    briefing/                # ConceptCard, ChannelPreview, TranslationView, ABVariantToggle
    approval/                # ApprovalFlow, ApprovalButton, FeedbackInput
    assets/                  # AssetGrid, AssetPreview, FormatBadge
  lib/
    ai/
      claude.ts              # API Client + Retry + Validation Pipeline
      prompts/               # Alle Prompts als eigene Dateien
        strategy-advisor.ts  # 2 strategische Richtungen vorschlagen
        concept-generator.ts # Leitidee, Claims, Hero Message
        channel-adapter.ts   # Kanal-spezifische Adaptionen
        translator.ts        # DE->FR/IT/EN mit Glossar
        compliance-checker.ts
      brand-brain/
        loader.ts            # Brand Brain aus Google Drive / lokal laden
        context-builder.ts   # Modularen Kontext zusammenbauen
      validation/
        price-validator.ts   # Preise MUESSEN exakt Input matchen
        char-limit.ts        # SEA 30/90, CRM 50 etc.
        compliance.ts
    db/
      supabase.ts
      queries/campaigns.ts
      queries/assets.ts
      queries/approvals.ts
    integrations/
      canva.ts               # Template-Filling via Canva Connect API
      meta-ads.ts            # Auto-Upload nach Approval
      google-ads.ts
      google-drive.ts
    schemas/
      promo-input.ts         # Zod Schema
      campaign.ts
brand-brain/                 # Lokaler Fallback fuer Dev
  tone-of-voice.md
  glossar-de.json
  glossar-fr.json
  glossar-it.json
  glossar-en.json
  ci-rules.json
  golden-examples.json
n8n-workflows/               # Import-JSONs
supabase/migrations/
```

## Features

### F0: Brand Brain
- Google Drive als Source of Truth, lokal als Fallback
- Modular: Shared (Compliance, Pricing) + Brand (Tone, Glossar) + Campaign
- 4 Sprachen: DE/FR/IT/EN
- Golden Examples in Prompts einarbeiten
- Brand-agnostisch (Multi-Brand vorbereitet)

### F1: Konzept und Briefing
- Web-Formular (React) fuer Promo-Input
- Mix-Modus: Engine schlaegt 2 Strategie-Richtungen vor, Marketing waehlt
- A/B-Test: 2 Richtungen mit je eigenem Claim-Set
- Online-Kanaele: Social, CRM, Website, SEA
- Uebersetzung DE -> FR/IT/EN mit Glossar-Enforcement
- Preis-Validierung nach JEDER Generierung

### F2: Content / Media Engine
- Canva Connect API fuer Template-Rendering
- Nutzt bestehende Canva Brand Kit Templates
- Generiert KEINE Texte (uebernimmt aus F1)
- Formate: Social Feed, Stories, Banner, Newsletter, Hero
- Varianten-Matrix: 1 Template x 4 Sprachen x N Formate
- AI-Video (Sora/Runway) = Stretch Goal

### F3: Campaign Asset Package
- Dashboard = Single Pane of Glass
- 3-Stufen-Approval: DE-Konzept, Uebersetzungen, Visual-Set
- Auto-Upload: Meta Business Suite + Google Ads
- Google Drive Archiv

## Coding Conventions

- TypeScript strict, keine any
- Zod fuer alle Validierungen
- Server Components Default, Client nur mit 'use client'
- API Routes fuer Webhooks, Server Actions fuer Mutationen
- Tailwind + shadcn/ui
- Deutsche Kommentare fuer Business-Logik
- try/catch mit { error: string, details?: unknown }
- async/await ueberall

## Prompt Engineering

- Jeder Prompt eigene Datei in src/lib/ai/prompts/
- Template Literals mit Variablen: ${brandName}, ${glossar}
- Alle Calls ueber src/lib/ai/claude.ts
- JSON Output erzwingen via System-Prompt
- Post-Call: Preis-Validierung -> Zeichenlimit -> Compliance
- Temperature: 0.3 (Fakten), 0.7 (Kreativ)

## Business-Regeln (STRICT)

- Preise NIEMALS runden. Input = Output exakt.
- Disclaimer 1:1, NIE AI-modifiziert
- Glossar hat IMMER Vorrang
- FR ~15-20% laenger als DE -> Limits anpassen
- SEA Headlines: HARD 30 Zeichen, Descriptions: HARD 90
- "5G im Swisscom Netz" = Pflicht bei 5G-Produkten
- Kein Claim ohne Beleg im Input

## Build-Reihenfolge

Phase 1 - Foundation:
1. Next.js + Tailwind + shadcn/ui Setup
2. Supabase Schema (campaigns, assets, approvals, translations)
3. Brand Brain Loader
4. Claude API Client mit Retry + Validation
5. Docker-Compose (n8n)

Phase 2 - Konzept Engine:
6. Promo-Input Zod Schema
7. Web-Formular
8. Strategy Advisor (2 Richtungen)
9. Concept Generator (Claims + Kanaladaptionen)
10. Translator (4 Sprachen)
11. Preis-Validierung + Compliance

Phase 3 - Content Engine:
12. Canva Connect API
13. Template-Discovery + Filling
14. Format-Adaptionen
15. Asset Storage

Phase 4 - Orchestrierung:
16. Dashboard + Kampagnen-Uebersicht
17. Approval-Flow (3 Stufen)
18. Meta + Google Ads Upload
19. Google Drive Export
20. n8n Workflows
