# PRD — ACE Wingo V1 (Format-Multiplexer)

**Status:** Draft
**Owner:** Nick (rawniick)
**Datum:** 2026-05-20
**Quelle:** Requirements Engineering Session via `/grill-me`

---

## 1. Problem & Vision

### Problem
Wingo-Marketing produziert pro Kampagne ein Sujet, das danach von einer externen Agentur in **~50–75 Format-Variationen** (Display, Social, Google Ads, Print, etc.) und **bis zu 4 Sprachen** (DE / FR / IT / EN) adaptiert wird. Die Adaption ist:
- **Teuer**: Jedes Format kostet Agentur-Zeit, obwohl der kreative Kern derselbe bleibt.
- **Langsam**: Time-to-Market mehrere Tage statt Stunden.
- **Drift-anfällig**: Manuelle Wiederholung produziert Brand-Inkonsistenzen (Logo verzerrt, Farben minimal off, falsche Schutzbereiche).
- **Nicht responsive auf Preisänderungen**: Eine Promo-Preisänderung erfordert Re-Production aller Formate.

### Vision
Eine intuitive **Plattform zum Bauen von Wingo-Kampagnen**: Marketing Manager wirft Briefing rein, wählt Kampagnenart + Produkt + Preis, und bekommt **alle verlangten Formate in allen Sprachen brand-konform automatisch generiert**. 100% Brand-Konformität ist KO-Kriterium. Kreativität nur bei neuen Bildmotiven; Layout, Logo, Farben, Fonts, Schutzbereiche sind deterministisch.

**Tagline:** "Instant campaign generation and adaption mit neuesten Preisen, in allen Formaten, im Brand."

### Mental Model
ACE V1 ist **kein Konzept-Generator**, sondern ein **Format-Multiplexer mit Brand-Guard-Rails**.

---

## 2. Target User

| User | Profil |
|---|---|
| **Marketing Manager Wingo** (V1) | Erstellt Kampagnen-Briefings, wählt Produkt + Preis, reviewed Outputs, lädt ZIP. V1 = 1 User (du). |
| **Marketing Manager Coop Mobile / Migros Mobile** (Phase 2+) | Andere Brand-Instanz. Selbe Engine, anderes Brand-Brain. |
| **Brand Manager** (Phase 2) | Pflegt Brand-Tokens, Templates, Hero-Library. V1 = manuell durch Owner. |

---

## 3. Success Criteria — V1.0 MVP

**Definition of Done für V1.0:**

> Ein Marketer kann eine **Flash-Sale-Kampagne** end-to-end durch die Engine fahren und erhält **11 Formate × 4 Sprachen = 44 brand-konforme Assets als ZIP**.

| Akzeptanz-Kriterium | Messbar |
|---|---|
| Brief eingegeben → 44 Assets in ZIP | Manuell durchspielen, ZIP enthält 44 Files |
| Jedes Asset 100% brand-konform | Vision-QA Pass-Rate ≥ 95%, keine verzerrten Logos, keine Farb-Drift, Schutzbereiche eingehalten |
| Preise exakt wie eingegeben | String-Comparison Input vs Output, LLM darf Preis nicht modifizieren |
| Time-to-First-Asset ≤ 5 Minuten | Vom Brief-Submit bis zum ersten gerenderten Asset |
| Brand-Stil "Grauer BG + Roter Stern" recognizable | Vision-Check + Visual-Review |

**V1.1 Stretch:** Standard-Kampagnentyp ebenfalls produzierbar.

---

## 4. Key User Flows

### 4.1 Hauptflow: Kampagne erstellen (5 Gates mit Skip + Re-Open)

```
STEP 0  Brief eingeben
          - Form-Fields (6 Sektionen) ODER Doc-Upload (PDF/DOCX) → Vision-Extract → Pre-fill
          - Pflichtfelder: Kampagne-Art, Produkt, Preis, Sprachen, Channel-Auswahl

GATE 1  Copy-Approval                    [Skip-Default: Best-Headline-Score]
          - Claude generiert: 3 Headlines + Subline + Preis-Suffix + Disclaimer
          - Hauptsprache DE
          - Chat-Iteration möglich
          - Skip = Top-Score auto-pick, Re-Open jederzeit möglich

GATE 2  Hero-Bild-Approval               [Skip-Default: Library Top-Match]
          - Library-Search Top 3–5 (Embedding-basiert)
          - "Keine passt" → AI-Gen (3 Kandidaten mit Style-Reference)
          - Optional: Upload own
          - Vision-QA bei AI-Bildern + AI-Label

GATE 3  Layout-Komposition (Master)      [Skip-Default: Default-Variant]
          - Engine baut Master-Composition (z.B. 1080×1080)
          - Logo + Headline + Subline + Preis + CTA + Disclaimer + Hero
          - User wählt Layout-Variante (Preis-oben/unten, etc.)
          - Drag-Positionierung innerhalb Brand-Safezones + Snap-Grid

GATE 4  Final-Hero Review                [Skip-Default: Auto-Approve]
          - Master-Composition gerendert
          - Last-Check before Multiplex

AUTO    Multiplexing
          - 11 Formate gerendert
          - Positions vom Master auto-propagated
          - Vision-QA pro Format
          - Übersetzungen FR/IT/EN

STEP 5  Gallery + Per-Asset-Regen
          - 11 × 4 = 44 Assets in Gallery
          - Per-Asset Chat-Input ("Logo grösser") → Claude editiert nur dieses Asset
          - Per-Asset Drag-Override möglich
          - ZIP-Download
```

### 4.2 Side-Flow: Produktliste pflegen
```
Admin-Page → Liste der Wingo-Produkte (Name, Preis Promo, Preis Standard, Link, Kategorie, Features)
            → CRUD-UI
            → Verfügbar im Brief-Form als Dropdown
```

### 4.3 Side-Flow: Hero-Library wachsen lassen
```
Nach AI-Gen + Approval → Optional: "In Library aufnehmen"
                       → Bild + Metadata (Tags, Sujet-Kategorie) gespeichert
                       → Verfügbar für Folge-Kampagnen via Embedding-Search
```

---

## 5. Functional Requirements

### 5.1 Briefing (Form + OCR)
- **FR-01**: Form mit 6 Sektionen nach Briefing_Struktur.docx (Kampagne, Produktübersicht, Strategie, Vermarktung, Assets/Kanäle, Sonstiges)
- **FR-02**: Doc-Upload (PDF, DOCX, optional Image) → Claude Vision/Text extrahiert → Form pre-filled → User validiert
- **FR-03**: Validation: Pflichtfelder, Preis-Format (CHF 2-Dec), Promo-ID-Schema (auto), Datum-Range
- **FR-04**: Channel-Auswahl gespeist aus Excel-Sheet `01_Channel_Spezifikationen` (DB-Seed)

### 5.2 Master-Data
- **FR-10**: Produktliste-CRUD (Wingo-Produkte mit Preis/Link/Features/Kategorie)
- **FR-11**: Hero-Library-CRUD (Bild + Tags Produkt/Lifestyle/Saison + Embedding-Index). Initial-Seed via Drive-Import.
- **FR-12**: Brand-Tokens-Read (JSON in `/brand-assets/` + Files: Logo SVG, Fonts, Sample-Bilder, AI-Label)
- **FR-13**: Template-Definition (Code-Templates in `src/templates/<campaign-type>/<format-id>/`)
- **FR-14**: Layout-Varianten pro Template (2–3 Varianten, z.B. price-top, price-bottom)
- **FR-15**: Brand-Voice-CRUD (Admin-UI): Multi-dim Matrix `(brand × art × zielgruppe) → tov_md`. Default-TOV pro Brand + Overrides pro Kombination.
- **FR-16**: Disclaimer-Library-CRUD (Admin-UI): brand-scoped, conditions-basiert (z.B. `{network: "5g"}` matched alle 5G-Produkte), Texte in DE/FR/IT/EN.
- **FR-17**: AI-Label-Asset (`/brand-assets/wingo/ai-label/`) + Position-Config pro `format_specs` (`ai_label_position` JSONB).

### 5.3 Generation Engine
- **FR-20**: Copy-Generation in DE via Claude (3 Headline-Variants + Subline + CTA + Disclaimer-Hint)
- **FR-21**: Tone-of-Voice aus `brand_voice_variants` (Lookup `brand × art × zielgruppe`, Fallback default), in Claude System-Prompt eingebettet. Brief-Override pro Kampagne optional.
- **FR-22**: Library-Search via Embedding (Brief-Vektor → Top-K Hero-Matches)
- **FR-23**: AI-Bild-Generation mit Style-Reference + AI-Label-Pflicht (NanoBanana/DALL-E/Imagen)
- **FR-24**: Vision-QA Pipeline: Logo-Bounds-Check, Color-Check, Safezone-Check, Style-Consistency-Check
- **FR-25**: Multi-Sprache: Auto-Übersetzung DE → FR/IT/EN via Claude. Glossar-aware (Wingo-Terms pass-through), Disclaimer-aware (aus `disclaimers`-Table verbatim in Zielsprache geladen, nie via LLM übersetzt).

### 5.4 Rendering
- **FR-30**: Render-Engine Satori (statisch, schnell) als Default, Puppeteer als Fallback für komplexe Layouts
- **FR-31**: 11 Format-Configs in V1: Display Standard 5 + Google Ads statisch 3 + Social statisch 3
- **FR-32**: Output-Filetypes: JPEG/PNG je nach Format-Spec
- **FR-33**: Master-Position → Auto-Propagation auf alle Formate (relative Coordinates + Safezone-Constraints)
- **FR-34**: Per-Asset-Override: User-Drag oder Chat-Edit nur dieses Asset

### 5.5 UI / UX
- **FR-40**: 5-Gate-Flow mit Skip-Buttons (Smart-Default + Re-Open-fähig)
- **FR-41**: Master-Drag-UI mit Brand-Safezone-Overlay + Snap-Grid
- **FR-42**: Per-Asset-Chat: User schreibt natürliche Anweisung → Claude editiert Template-State
- **FR-43**: Gallery-View mit 44 Assets, Preview/Download je Asset, ZIP-Download gesamt
- **FR-44**: Library-Aufnahme-Toggle nach Hero-Approval

### 5.6 Brand-Awareness (Multi-Brand-Ready)
- **FR-50**: Alle brand-spezifischen Tabellen haben `brand_id`
- **FR-51**: V1 Seed: brand_id = "wingo"
- **FR-52**: Brand-Switch via UI-Selector (V1 hidden, Phase 2 visible)
- **FR-53**: Brand-Tokens und Templates lazy-loaded basierend auf aktivem brand_id

---

## 6. Non-Functional Requirements

| Bereich | Anforderung |
|---|---|
| **Performance** | Time-to-First-Asset ≤ 5 min (Brief → erstes gerendertes Format) |
| **Render-Throughput** | 44 Assets in ≤ 3 min (parallelisiert) |
| **Brand-Konformität** | Vision-QA Pass-Rate ≥ 95% Auto; Rest manuell |
| **Verfügbarkeit** | Best-Effort (internes Tool), Vercel-deployed |
| **Sicherheit** | Single-Login V1; Preise serverseitig validiert; LLM darf Preise nicht editieren |
| **Audit** | Jede Generation gelogged (Brief, Gates, Vision-QA, Renders) für Debug |

---

## 7. System Architecture (High-Level)

```
┌─────────────────────────────────────────────────────────────────┐
│ Next.js 16 App (Vercel)                                         │
│                                                                 │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│ │  UI Pages    │  │  API Routes  │  │  Server      │            │
│ │  (5 Gates,   │  │  (Gen, Save, │  │  Actions     │            │
│ │   Gallery)   │  │   Render)    │  │              │            │
│ └──────┬───────┘  └──────┬───────┘  └──────┬───────┘            │
└────────┼─────────────────┼─────────────────┼────────────────────┘
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Engine Layer                                                    │
│                                                                 │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│ │ Copy Gen    │  │ Image Gen   │  │ Render Eng. │               │
│ │ (Claude)    │  │ (Library +  │  │ (Satori +   │               │
│ │             │  │  AI + QA)   │  │  Puppeteer) │               │
│ └─────────────┘  └─────────────┘  └─────────────┘               │
│                                                                 │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│ │ Translation │  │ Vision QA   │  │ Multiplexer │               │
│ │ (Claude)    │  │ (Claude     │  │ (Format     │               │
│ │             │  │  Vision)    │  │  Propagator)│               │
│ └─────────────┘  └─────────────┘  └─────────────┘               │
└────────┬──────────────────┬─────────────────┬───────────────────┘
         │                  │                 │
         ▼                  ▼                 ▼
┌─────────────────────────────────────────────────────────────────┐
│ Data Layer                                                      │
│                                                                 │
│ ┌────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│ │ Supabase DB    │  │ Supabase        │  │ /brand-assets/  │    │
│ │ - brands       │  │ Storage         │  │ (Git)           │    │
│ │ - products     │  │ - campaign-     │  │ - logos         │    │
│ │ - campaigns    │  │   assets        │  │ - fonts         │    │
│ │ - assets       │  │ - hero-library  │  │ - sample-imgs   │    │
│ │ - hero_library │  │                 │  │ - tokens.json   │    │
│ │ - templates    │  │                 │  │                 │    │
│ └────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Tech-Stack
- **Frontend**: Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui
- **Backend**: Next.js API Routes + Server Actions
- **Render**: Satori (statisch) + Puppeteer (komplex)
- **AI**: Anthropic Claude (Sonnet 4.6/4.7) für Copy/Translate/Edit + Claude Vision für QA
- **Image-Gen**: NanoBanana / DALL-E 3 / Imagen 4 (Provider-Router)
- **DB**: Supabase Postgres
- **Storage**: Supabase Storage + Git (`/brand-assets/`)
- **Hosting**: Vercel

---

## 8. Data Model (V1, brand-aware)

```sql
-- Master-Data
brands                (id, slug, name, is_active)
products              (id, brand_id, name, category, price_promo, price_standard, link,
                       features, sku, network)
hero_library          (id, brand_id, storage_url, embedding, tags_produkt[], tags_lifestyle[],
                       tags_saison[], sujet_category, ai_generated, ai_label_added,
                       source: drive_import/admin_upload/campaign_promotion)

-- Brand-Voice (Multi-dim Matrix)
brand_voice_variants  (id, brand_id, kampagne_art, zielgruppe, tov_md, is_default)
                      -- unique(brand_id, kampagne_art, zielgruppe)
                      -- mind. 1 Record pro brand mit is_default=true (Fallback)

-- Disclaimers (Library)
disclaimers           (id, brand_id, slug, name, conditions_json,
                       applies_to_categories[],  -- ['mobile', 'tv', 'internet']
                       text_de, text_fr, text_it, text_en,
                       is_required boolean)
                      -- conditions_json examples:
                      --   {"network": "5g"}   matched alle 5G-Produkte
                      --   {"hardware": true}  matched Hardware-Promos
                      --   {}                  matched alle

-- Format Specs (geseeded aus Excel)
format_specs          (id, code, channel_kategorie, channel_plattform, asset_media_art,
                       format_bezeichnung, width, height, dpi, max_filesize, filetype,
                       safezones_json, languages[], ai_label_position JSONB)
                      -- ai_label_position: {anchor, offset_x_pct, offset_y_pct, size_pct}

-- Templates (Code in Git, Metadata in DB)
templates             (id, brand_id, campaign_type, format_id, file_path, variants[],
                       master_format, active_version)

-- Workflow
campaigns             (id, brand_id, name, art, datum_von, datum_bis, produkt_kategorie,
                       product_id, price_promo, price_standard, languages, zielgruppe,
                       zielgebiet, status, current_gate, created_at)
campaign_briefs       (campaign_id, brief_json)  -- 6 Sektionen aus Briefing_Struktur.docx
campaign_copy         (campaign_id, language, headlines[], subline, cta, disclaimer_ids[],
                       approved_at)
campaign_hero         (campaign_id, asset_id, source, approved_at)
campaign_layout       (campaign_id, master_format, variant, positions_json, approved_at)
assets                (id, campaign_id, format_id, language, storage_url, status,
                       vision_qa_score, vision_qa_details_json, position_overrides_json)
audit_log             (id, campaign_id, event, payload_json, ts)
```

---

## 9. Out of Scope (Phase 2+)

| Feature | Phase |
|---|---|
| Video Ads (Goldbach, YouTube, Meta Video, TikTok Video) | Phase 2 |
| Display Spezial Premium (Watson, 20Min, Blick, Doodle, Nau, Bluewin, Tamedia, Audienzz Welcome Ads) | Phase 3 |
| HTML5-Animation für DV360 und Premium | Phase 4 |
| Print/OOH F4/F12 (CMYK PDF/X Pipeline) | Phase 5 |
| Audio Ads (Spotify, YouTube Audio) | Out (extern) |
| Kampagnentypen: Regio, FTTH, ATL, Black November | Phase 2 |
| Multi-User + RBAC | Phase 2 |
| In-App Notifications | Phase 2 |
| Auto-Distribution Meta/Google Ads | Out (User lädt manuell hoch) |
| Performance-Metrics-Loop | Phase 3 |
| Campaign Cloning / Templates | Phase 2 |
| Frontify-Sync für Brand-Brain | Phase 3 |
| n8n-Workflows | Out (durch native Server-Actions ersetzt) |
| POS-Assets | Out (Wingo D2C, keine eigenen Shops) |

---

## 10. Open Questions & Risks

### Resolved (Grilling 2026-05-20)
- **OQ-01** ✅ Brand-Tokens: Nick hat vollen Frontify-Zugriff, schreibt Tokens manuell einmalig in `tokens.json` (Skeleton von ACE bereitgestellt).
- **OQ-02** ✅ Library-Seed: Wingo-Bilder liegen in Google Drive Folder, ~20-50 Sample-Bilder werden via einmaligem Import-Script in Phase 5 geseeded. Tags: Produkt-Kategorie + Lifestyle + Saison.
- **OQ-03** ✅ TOV: Nicht statisch im Git, sondern Admin-UI editierbar. Multi-dim Matrix `art × zielgruppe → tov_md`, Default-Fallback pro Brand. Neue Tabelle `brand_voice_variants`.
- **OQ-04** ✅ Reuse-Quote: Egal für V1, Library wächst organisch, post-launch messen.
- **OQ-05** ✅ Disclaimer: Admin-UI Library (`/admin/disclaimers`), Nick pflegt initial. Conditions-basiert (z.B. `{network: "5g"}`), brand-scoped, alle 4 Sprachen verbatim.
- **OQ-06** ✅ AI-Label: Wingo-eigenes Label-Asset wird hochgeladen, Position pro Format konfigurierbar (`format_specs.ai_label_position`).

### New Open Items (für Phase 0 zu klären)
- **OQ-07**: Wingo-Logo SVG-Variants (Stern allein, Schriftlogo, Kombi) — welche Variante als Default in `/brand-assets/wingo/logos/`?
- **OQ-08**: Fonts: Welcher Wingo-Font, mit Web-Lizenz für Self-Hosting? Bei Lizenzfrage: Fallback auf vergleichbaren Open-Source-Font?
- **OQ-09**: Google Drive Folder ID für Hero-Library-Seed (alte ACE Drive-Integration ist gewipt, brauchen Service-Account oder einmaligen OAuth-Export)

### Risks
| Risk | Wahrscheinlichkeit | Impact | Mitigation |
|---|---|---|---|
| AI-Bilder treffen Wingo-Stil nicht | Hoch | Hoch | Library-First (80%+ Cases), AI nur als Fallback, Vision-QA Loop |
| Drag-Positionierung bricht Brand-Konformität | Mittel | Hoch | Safezone-Constraints, Snap-Grid, Post-Drag Vision-QA |
| Render-Performance bei 44 Assets nicht eingehalten | Mittel | Mittel | Parallelisierung, Satori (ms-Bereich), CDN-Cache |
| Übersetzungen brechen Wingo-Glossar | Mittel | Mittel | Glossar in Claude-Prompt verankern, Post-Translate-Validation |
| Schema-Änderungen brechen V1.1 (Standard-Type) | Niedrig | Mittel | Brand-aware Design von Start, Template-System flexibel |

---

## 11. Next Steps

1. **Clean Wipe** des alten ACE-Codes (Infra behalten)
2. **Brand-Bible aufbauen**: `/brand-assets/` mit Wingo-Tokens, Logo, Fonts, Sample-Bilder
3. **Schema bauen** (brand-aware) + Migrations
4. **1 Template** end-to-end (Flash Sale × Display Halfpage 300×600) als Tracer-Bullet
5. **5-Gate-Flow UI** für diesen einen Pfad
6. **Multiplexer** für die anderen 10 V1-Formate
7. **Multi-Sprache** Generation
8. **Library + AI-Gen** für Hero-Bilder
9. **Per-Asset-Regen** + Drag-Positionierung

Detaillierter Phasen-Plan: siehe `/loop /prd-to-plan` über dieses Dokument.
