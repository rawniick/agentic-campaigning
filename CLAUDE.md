# CLAUDE.md - ACE (Agentic Campaigning Engine)

## Projekt

AI-gestuetztes internes Marketing-Tool. Ein Marketer wirft einen Promo-Brief rein und
bekommt ein Konzept (DE), Uebersetzungen (FR/IT/EN) und visuelle Assets (Canva oder
Compositing-Fallback) zurueck. Output: ZIP zum manuellen Hochladen in Meta / Google
Ads / CRM. Brand-Brain-getrieben (Glossar, Tone-of-Voice, Compliance-Regeln).

**Branch X:** Internes 1-User-Tool. Kein RBAC, keine Auto-Distribution, kein n8n,
keine Multi-Brand-UI, kein Cloning, keine Metrics-Sync.

## V3 Flow (Manueller Trigger pro Stage, 2 Approval-Gates)

```
draft / input_complete
    -> User klickt "Konzept generieren"
concept_generated  ◄ Gate 1
    -> Konzept anzeigen + FeedbackChat fuer Iteration
    -> User klickt "Konzept freigeben" oder iteriert via Chat
concept_approved
    -> User klickt "Uebersetzen"
translating -> translations_ready
    -> User klickt "Assets generieren"
rendering_assets -> assets_ready  ◄ Gate 2
    -> User reviewed Assets, regeneriert einzelne wenn noetig
    -> User klickt "Assets freigeben"
assets_approved
    -> User klickt "ZIP herunterladen" -> manuelles Upload extern
```

## Tech Stack

- Frontend: Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + shadcn/ui
- Backend: Next.js API Routes + Server Actions
- AI: Anthropic Claude (Sonnet) via `src/lib/ai/claude.ts`
- AI Providers: NanoBanana, DALL-E (Bilder), Sora/Veo3 (Video, Stretch)
- Datenbank: Supabase (Postgres + Auth + Storage)
- Integrations: Canva Connect API, Frontify, Google Drive, Airtable
- Language: TypeScript strict

## Projektstruktur

```
src/
  app/
    layout.tsx              # Root Layout mit Sidebar
    page.tsx                # Dashboard
    campaigns/
      page.tsx              # Kampagnen-Liste
      new/page.tsx          # Promo-Input Formular
      [id]/
        page.tsx            # Single-Page Detail (alle V3-Sektionen)
        content/page.tsx    # Detail-Asset-Ansicht (optional)
    settings/
      brand-brain/page.tsx  # Brand Brain Status
      canva/page.tsx        # Canva OAuth + Template-Mapping
    actions/
      approve.ts            # approveStage / rejectStage Server Actions
    api/
      campaigns/            # CRUD
      generate/
        concept/            # Konzept-Generierung
        translate/          # Uebersetzung
        content/            # Asset-Generierung
        hero-images/        # 3 Hero-Kandidaten
        channel-adapt/      # Kanal-Adaptionen (optional)
      feedback/             # Konzept-Iteration via Chat
      assets/[id]/
        select/             # Hero-Kandidat auswaehlen
        regenerate/         # Einzelnes Asset neu generieren
        poll/               # Video-Status Polling
      export/
        download/           # ZIP-Download (Briefing + Assets)
      integrations/canva/   # OAuth, Templates, Mappings, Status
      brand-brain/          # Frontify, Drive, Airtable
  components/
    ui/                     # shadcn/ui
    dashboard/              # Sidebar, CampaignCard, GenerateActions, StatusBadge
    forms/                  # PromoInputForm
    briefing/               # ConceptCard, ChannelPreview, TranslationView
    feedback/               # FeedbackChat (Konzept-Iteration)
    assets/                 # AssetGrid, HeroImagePicker, GenerationProgress
    export/                 # ExportPanel (ZIP-Download)
  lib/
    ai/
      claude.ts             # API Client + Retry
      providers/            # AI Provider Router (Bild/Video)
      prompts/              # concept-generator, translator, channel-adapter,
                            # compliance-checker, concept-feedback-responder
      brand-brain/          # loader, context-builder, frontify-loader
      validation/           # price-validator, char-limit, compliance
    db/
      supabase.ts
      queries/              # campaigns, concepts, translations, assets,
                            # feedback, audit, canva-mappings
    integrations/
      canva.ts              # Template-Filling (Mapping-getrieben)
      canva-api.ts          # Canva Connect REST
      canva-oauth.ts        # OAuth2 PKCE
      storage.ts            # Supabase Storage (campaign-assets bucket)
      google-drive.ts       # Brand Brain (read-only)
      airtable.ts           # Brand Brain Datasource
      frontify.ts           # CI/Tone-of-Voice
    compositing/            # sharp-basierter Fallback wenn Canva fehlt
    schemas/                # Zod: promo-input, campaign
    mappers/                # promo-to-campaign, campaign-to-promo-input
brand-brain/                # Lokaler Fallback fuer Dev
supabase/migrations/        # 001-014
```

## Coding Conventions

- TypeScript strict, keine `any`
- Zod fuer alle Validierungen
- Server Components Default, Client nur mit `'use client'`
- API Routes fuer Webhooks, Server Actions fuer Mutationen
- Tailwind + shadcn/ui
- Deutsche Kommentare fuer Business-Logik
- try/catch mit `{ error: string, details?: unknown }`

## Prompt Engineering

- Jeder Prompt eigene Datei in `src/lib/ai/prompts/`
- Template Literals mit Variablen aus Brand Brain Context
- Alle Calls ueber `src/lib/ai/claude.ts`
- JSON Output erzwingen via System-Prompt
- Post-Call: Preis-Validierung -> Zeichenlimit -> Compliance
- Temperature: 0.3 (Fakten), 0.7 (Kreativ), 0.5 (Iteration)

## Business-Regeln (STRICT)

- Preise NIEMALS runden. Input = Output exakt.
- Disclaimer 1:1, NIE AI-modifiziert
- Glossar hat IMMER Vorrang
- FR ~15-20% laenger als DE -> Limits anpassen
- SEA Headlines: HARD 30 Zeichen, Descriptions: HARD 90
- "5G im Swisscom Netz" = Pflicht bei 5G-Produkten
- Kein Claim ohne Beleg im Input

## Was NICHT mehr im Scope ist (V3 Branch X)

- ~~RBAC (4 Rollen, Profile-Tabelle)~~ - 1 User
- ~~In-App Notifications~~ - 1 User
- ~~Auto-Upload Meta / Google Ads~~ - User laedt manuell hoch
- ~~Campaign Metrics Sync~~ - kommt zurueck wenn Distribute zurueckkommt
- ~~Campaign Cloning / Templates~~ - YAGNI
- ~~n8n Workflows~~ - Manuelle Trigger reichen
- ~~v2 Grobkonzept + Detailkonzept Trennung~~ - 1 Konzept-Stage mit Chat-Iteration
- ~~Strategie-Vorschlag mit 2 Richtungen~~ - claim_direction aus Brief reicht
- ~~Eingabe-Review-Page~~ - Submit ist Bestaetigung
- ~~AI-Video~~ - defer

## Deployment

- Hosting: Vercel (Phase 1), evtl. self-hosted spaeter
- Crons (zukuenftig): Vercel Cron oder Supabase pg_cron fuer Brand-Brain-Sync
