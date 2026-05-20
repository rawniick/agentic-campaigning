# Plan: ACE Wingo V1 — Format-Multiplexer

> Source PRD: `docs/PRD-Wingo-V1.md` (2026-05-20)
> Scope: V1.0 = Phasen 0–7. Single Brand Wingo, brand-aware Architektur für spätere Brands.

---

## Architectural decisions

Durable decisions die über alle Phasen gelten:

- **Routes**
  - `/` Dashboard mit Campaign-Liste
  - `/campaigns/new` Brief-Input
  - `/campaigns/[id]` Gate-Flow + Gallery
  - `/admin/products` Produkt-Master-Data CRUD (Phase 1)
  - `/admin/brand-voice` TOV-Matrix-Editor (Phase 2)
  - `/admin/disclaimers` Disclaimer-Library CRUD (Phase 4)
  - `/admin/format-specs/[id]` AI-Label-Position Editor pro Format (Phase 3)
  - `/admin/hero-library` Hero-Library Upload/CRUD (Phase 5)
  - `/admin/ai-label` AI-Label Asset Upload + Global-Defaults (Phase 5)
  - `/api/campaigns/[id]/{generate-copy,generate-hero,render,multiplex,translate,regen}` Server-Actions
  - `/api/admin/*` CRUD pro Admin-Entity

- **Schema** (brand-aware)
  - **Master**: `brands`, `products`, `hero_library`, `format_specs`, `templates`
  - **Brand-Data**: `brand_voice_variants` (Multi-Dim TOV), `disclaimers` (Library)
  - **Workflow**: `campaigns`, `campaign_briefs`, `campaign_copy`, `campaign_hero`, `campaign_layout`, `assets`, `audit_log`
  - Alle Wingo-spezifischen Tables haben `brand_id` FK
  - `format_specs` geseeded aus Excel-Sheet `01_Channel_Spezifikationen`
  - `format_specs.ai_label_position` JSONB für format-spezifische AI-Label-Anker

- **Key Models**
  - `Campaign` mit State-Machine (5 Gates: copy → hero → layout → final → multiplex_done)
  - `Brand` (Wingo seed, multi-brand-ready)
  - `Product` (Produktliste-Master)
  - `HeroAsset` (Library mit Embeddings)
  - `RenderedAsset` (eines pro Format × Sprache, mit position_overrides)

- **Stack**
  - Next.js 16 App Router + React 19 + TS strict + Tailwind 4 + shadcn/ui
  - Supabase Postgres + Storage (`campaign-assets`, `hero-library` Buckets)
  - Anthropic Claude (Sonnet) für Copy/Translate/Edit/Vision-QA
  - Image-Gen-Router: NanoBanana / DALL-E / Imagen
  - Render: Satori (statisch, default) + Puppeteer (Fallback komplex)
  - Vercel Deploy

- **Brand-Assets** (Git-versioniert)
  - `/brand-assets/wingo/tokens.json` (Farben, Fonts, Spacing, Safezones, Logo-Specs)
  - `/brand-assets/wingo/logos/*.svg` (Stern, Schriftlogo, Kombi-Lockup, Co-Branding Swisscom)
  - `/brand-assets/wingo/fonts/*.woff2`
  - `/brand-assets/wingo/samples/*.jpg` (Bildwelt-Referenzen für AI-Style-Anchor)
  - `/brand-assets/wingo/ai-label/*.{svg,png}` (AI-Label-Asset, von Nick hochgeladen)
  - `/brand-assets/wingo/glossar.json` (Wingo-Terms die Translator nicht übersetzt)

- **Auth**
  - Single-User V1 (Supabase Auth-Scaffold vorhanden für Phase 2+)
  - LLM darf Preise **NIE** modifizieren — Preise serverseitig pass-through-validiert

- **Compliance-Regeln** (Pflichtcheck pro Asset)
  - Preise: Input = Output exakt (string-equal)
  - Disclaimer: 1:1, nie AI-modifiziert
  - Glossar (Wingo-Terms): Vorrang vor LLM-Output
  - AI-Bilder: AI-Label-Pflicht
  - 5G-Logo-Pflicht bei 5G-Produkten

---

## Phase 0: Foundation — Cleanup + Schema + Brand-Bible

**User stories**: — (Infra-Phase, keine direkten User Stories)

### What to build

Clean Wipe des alten ACE-Codes (Coop-Mobile-Gene raus), Infrastructure behalten (Next.js, Supabase, Claude-Client, shadcn/ui). Neue brand-aware Schema-Migration. Brand-Assets-Ordner für Wingo (Tokens, Logo, Fonts, Sample-Bilder). App bootet mit leerem Dashboard.

### Acceptance criteria

- [ ] Alter Coop-Mobile/n8n/Canva/Frontify/Metrics/Notifications/Distribute/Clone-Code entfernt; Infra (package.json, Next.js-Config, shadcn-Komponenten, Supabase-Client, Claude-Client, Auth-Scaffold) intakt
- [ ] `CLAUDE.md` umgeschrieben auf neue Wingo-Vision (Format-Multiplexer-Mental-Model)
- [ ] Migrations neu aufgesetzt mit allen Tables aus Schema-Section; `brand_id` durchgängig
- [ ] `brands`-Table mit Wingo-Seed (id, slug=`wingo`, is_active=true)
- [ ] `format_specs`-Table aus Excel Sheet 01 geseeded (V1: 11 statische Format-Records mit width/height/dpi/filetype/safezones)
- [ ] `brand_voice_variants`-Table mit min. 1 Default-TOV-Record für Wingo (`is_default=true`)
- [ ] `disclaimers`-Table mit min. 3 Seed-Records (5G-Netz-Pflicht, Standard-Telco-Disclaimer, Vertragsbindung)
- [ ] `/brand-assets/wingo/tokens.json` Skeleton-File vorhanden (ACE generiert, Nick füllt aus Frontify)
- [ ] `/brand-assets/wingo/logos/`, `/fonts/`, `/samples/`, `/ai-label/`, `/glossar.json` Folder-Struktur erstellt (kann leer sein, README erklärt was rein muss)
- [ ] App startet ohne Errors, `/` zeigt leere Campaigns-Liste
- [ ] Smoke-Test: Supabase-Connection ok, Claude-Client ok, Storage-Bucket `campaign-assets` + `hero-library` erstellt
- [ ] OQ-07/08/09 (Logo-Variants, Fonts, Drive-Folder-ID) dokumentiert in `docs/PRD-Wingo-V1.md` Section 10

---

## Phase 1: Tracer Bullet — 1 Format DE end-to-end (no gates)

**User stories**: FR-01..04 (Brief Form), FR-10..14 (Master-Data minimal), FR-20 (Copy-Gen DE), FR-30/31 (Render Satori, 1 Format), FR-43 (minimal Download)

### What to build

Schmaler vertikaler Pfad durch alle Layer für genau **eine** Kombination: Flash Sale × Display Halfpage 300×600 × Deutsch. Brief-Form (alle Pflichtfelder), Produkt-Auswahl aus Admin-Liste, Server-Action generiert Copy via Claude, rendert mit Satori, speichert in Storage, gibt PNG zum Download zurück. Hero-Bild ist hardcoded auf einem Sample aus `/brand-assets/wingo/samples/`. Kein Gate-Flow, kein Approval — beweist nur dass die Architektur greift.

### Acceptance criteria

- [ ] Admin-Page `/admin/products` mit CRUD für Produkt-Master-Data (Read + Create + Update + Delete)
- [ ] Min. 1 Wingo-Produkt in der Datenbank (z.B. "Wingo Mobile Swiss" mit network=`5g_swisscom`, category=`mobile`)
- [ ] Brief-Form `/campaigns/new` mit 6 Sektionen aus Briefing_Struktur.docx, Pflichtfeld-Validation, Produkt-Dropdown
- [ ] Submit erstellt `campaign` + `campaign_brief` Records (Status: `created`)
- [ ] Server-Action lädt: Default-TOV aus `brand_voice_variants` + zutreffende Disclaimer aus `disclaimers` (matched via `conditions_json` gegen Produkt)
- [ ] Claude-Call für Headline + Subline (DE) mit TOV in System-Prompt → speichert in `campaign_copy`
- [ ] Disclaimer-Text wird verbatim aus DB geladen (NICHT von LLM generiert), an `campaign_copy.disclaimer_ids[]` referenziert
- [ ] React-Template `FlashSaleHalfpage300x600.tsx` mit Slots: Logo, Headline, Subline, Preis, CTA, Disclaimer, Hero-Bild
- [ ] Hero-Bild: hardcoded Sample aus `/brand-assets/wingo/samples/`
- [ ] Satori rendert Template → PNG → Supabase Storage Upload
- [ ] `assets`-Record erstellt (campaign_id, format_id, language=`de`, storage_url)
- [ ] Campaign-Detail-Page zeigt das eine Asset + Download-Button
- [ ] Preis ist Input = Output (string-equal Test im Acceptance: `assert pixelTextExtract(asset) contains brief.price_promo`)
- [ ] Disclaimer ist Input = Output (string-equal Test)
- [ ] Audit-Log enthält alle Generation-Steps (brief_submit, copy_generated, disclaimer_loaded, render_complete)

---

## Phase 2: 5-Gate-Flow + Brand-Voice Admin

**User stories**: FR-40 (5 Gates), FR-43 (Gallery), Skip + Re-Open Mechanik, FR-15 (Brand-Voice CRUD)

### What to build

UI-Workflow für die 5 Gates auf dem gleichen schmalen Pfad (1 Format, DE). Gate 1 Copy-Approval (3 Headline-Varianten, Chat-Iteration), Gate 2 Hero-Bild via Upload (noch keine Library/AI), Gate 3 Layout-Komposition mit Variant-Auswahl (2 Varianten z.B. "price-top" / "price-bottom"), Gate 4 Final-Hero-Review, dann Render + Gallery. Skip-Button pro Gate (Smart-Default Auto-Pick), Re-Open jederzeit. Campaign-State-Machine. Plus: Admin-UI für Brand-Voice-Matrix damit unterschiedliche Kampagnentypen × Zielgruppen unterschiedliche Tones bekommen.

### Acceptance criteria

- [ ] Campaign-State-Machine implementiert: `created → copy_pending → hero_pending → layout_pending → final_pending → done`
- [ ] Admin-Page `/admin/brand-voice` mit:
  - Default-TOV-Editor (Markdown-Textarea, brand-scoped)
  - Matrix-View: Rows = Kampagnen-Arten (Flash Sale, Standard), Cols = Zielgruppen (Sozial, Rational, Nativ)
  - Pro Zelle: optionaler Override-TOV (Markdown-Textarea), Fallback-Indicator wenn leer
- [ ] Copy-Generation verwendet TOV-Lookup: `findVoiceVariant(brand, art, zielgruppe) ?? findDefaultVoice(brand)`
- [ ] Gate 1 UI: 3 Headline-Vorschläge mit Tone-Anwendung sichtbar, "Pick this" + "Iterate via Chat" + Skip-Button
- [ ] Gate 1 Skip: Auto-pick Top-Scored Headline, State markiert als "skipped, re-openable"
- [ ] Gate 2 UI: File-Upload für Hero-Bild (V1 Phase 2: nur Upload, kein Library/AI)
- [ ] Gate 3 UI: 2 Layout-Varianten als Preview-Buttons, User pickt eine
- [ ] Gate 4 UI: Final-Hero-Preview, Approve-Button startet Render
- [ ] Re-Open: Aus Gallery kann zu jedem Gate zurückgesprungen werden; nachgelagerte Gates invalidiert
- [ ] Audit-Log enthält Gate-Transitions + TOV-Variant-Used (für Debug-Trace)
- [ ] Asset-Render passiert nach Gate 4 (nicht vorher)

---

## Phase 3: Multi-Format Multiplexer + Format-Specs Admin (11 Formate, DE only)

**User stories**: FR-30..34 (Multiplexer + Position Propagation), FR-24 (Vision-QA), FR-31 (alle 11 V1-Formate), FR-17 partial (AI-Label-Position pro Format)

### What to build

Alle restlichen 10 V1-Formate als React-Templates: Display Standard (Halfpage, Billboard, Rectangle, Ricchi, Wideboard XL), Google Ads statisch (Pmax, SEA Ad Ext, Discovery), Social statisch (Meta Image, TikTok Bild, Reddit Link). Multiplexer: nach Gate-4-Approval rendert die Engine das Master-Layout parallel über alle 11 Formate. Position-Propagation: relative Koordinaten im Master → format-spezifische Pixel-Positionen unter Brand-Safezone-Constraints. Vision-QA pro gerendertem Asset (Logo-Bounds, Color, Safezone, Style-Consistency) mit Score. Plus: Admin-UI für Format-Spec-Tuning (AI-Label-Position pro Format konfigurierbar — wird in Phase 5 wichtig, aber Schema-Feld hier).

### Acceptance criteria

- [ ] 10 weitere React-Templates implementiert (1 pro V1-Format, Flash Sale Variante)
- [ ] Format-Specs aus DB getrieben (width/height/dpi/filetype)
- [ ] Master-Position → Per-Format-Position Propagation funktioniert (Logo/Preis/CTA scaled korrekt)
- [ ] Safezone-Constraints aus `tokens.json` enforced beim Propagieren
- [ ] Admin-Page `/admin/format-specs/[id]` mit Editor für `ai_label_position` JSONB (Anchor, Offset, Size). Read-Only für andere Felder (kommen aus Excel-Seed).
- [ ] Vision-QA-Server-Action: pro Asset Claude Vision Call mit 4 Checks (Logo-Bounds, Color-Match, Safezone-Eingehalten, Style-Consistency)
- [ ] Vision-QA-Score + Details in `assets.vision_qa_score` + `assets.vision_qa_details_json` gespeichert
- [ ] Gallery zeigt 11 Assets, mit Vision-QA-Badge je Asset (grün ≥ 0.8, gelb 0.5-0.8, rot < 0.5)
- [ ] Render-Performance: 11 Assets in ≤ 90 Sekunden parallel
- [ ] ZIP-Download enthält 11 PNGs mit format-konformen Namen (z.B. `wingo_flashsale_halfpage_300x600_de.png`)

---

## Phase 4: Multi-Sprache + Disclaimer-Library Admin (DE → FR/IT/EN)

**User stories**: FR-25 (Translation), FR-16 (Disclaimer-Library CRUD), Glossar/Compliance-aware

### What to build

Nach Gate-1-Approval (Copy DE final) übersetzt Claude die Copy in FR, IT, EN. Glossar-aware (Wingo-Terms bleiben unverändert). Disclaimer wird NIE übersetzt — Engine lädt aus `disclaimers`-Table direkt die `text_<lang>`-Spalte für jede Zielsprache. Multiplexer rendert dann jedes der 11 Formate × 4 Sprachen = 44 Assets. Gallery gruppiert nach Sprache. Plus: Admin-UI für Disclaimer-Library, damit Nick weitere Disclaimer pflegen kann ohne Code-Änderung.

### Acceptance criteria

- [ ] `languages`-Feld im Brief wird respektiert (default: alle 4 [de, fr, it, en])
- [ ] Admin-Page `/admin/disclaimers` mit CRUD: Slug, Name, Conditions-JSON-Editor, Applies-to-Categories Multi-Select, 4 Sprach-Textfelder (text_de/fr/it/en), is_required Toggle
- [ ] Conditions-Matcher-Funktion: gegeben Product (mit network/category) + Campaign-Brief → returns matching Disclaimer-IDs
- [ ] Übersetzungs-Server-Action: Claude-Call mit Glossar + System-Prompt der explizit untersagt Preise und Disclaimer zu übersetzen
- [ ] Glossar `/brand-assets/wingo/glossar.json` mit min. 10 Wingo-Terms (z.B. "Wingo Mobile Swiss" bleibt unverändert)
- [ ] Disclaimer-Text wird PRO SPRACHE aus DB geladen (`text_de`/`text_fr`/`text_it`/`text_en`), nicht von LLM übersetzt
- [ ] Preise (`price_promo`, `price_standard`, `price_suffix`) string-equal in allen Sprachen
- [ ] Multiplexer rendert 11 × 4 = 44 Assets
- [ ] Gallery hat Sprach-Filter (DE/FR/IT/EN Tabs oder Dropdown)
- [ ] ZIP-Download enthält 44 PNGs mit Sprach-Suffix (z.B. `wingo_flashsale_halfpage_300x600_fr.png`)
- [ ] Compliance-Tests: Preise + Disclaimer-Texte verbatim in allen Outputs vorhanden (PNG OCR-Sample-Check oder Source-String-Comparison)

---

## Phase 5: Hero-Library + AI-Generation + AI-Label

**User stories**: FR-11 (Library CRUD), FR-22 (Embedding-Search), FR-23 (AI-Gen mit Reference), FR-24 (Vision-QA), FR-44 (Library-Aufnahme), FR-17 (AI-Label Asset + Position)

### What to build

Hero-Library als CRUD inkl. Admin-Page mit Tags (Produkt-Kategorie + Lifestyle + Saison). Embedding-Index für Semantic Search (Brief-Beschreibung → Top-K passende Hero-Bilder). Seed mit ~20 Wingo-Sample-Bildern via einmaligem Google-Drive-Import-Script. Gate 2 ersetzt File-Upload durch: Library-Search (Top 3-5) + "Generate New" (3 AI-Kandidaten mit Style-Reference aus Library) + Upload-Fallback. AI-Bilder durchlaufen Vision-QA-Loop (Style-Consistency-Check). AI-Bilder bekommen automatisch das Wingo-AI-Label (Asset wird beim Render an Position aus `format_specs.ai_label_position` eingebettet). Nach Approval optional in Library aufnehmen. Plus: Admin-UI für AI-Label-Asset-Upload + globale Default-Position.

### Acceptance criteria

- [ ] Admin-Page `/admin/hero-library` mit:
  - Upload-Form (Drag-Drop oder File-Picker)
  - Tag-Editor: Produkt-Kategorie (Multi-Select: mobile/tv/internet), Lifestyle (Sport/Familie/Junge/Senioren/etc.), Saison (Weihnachten/Sommer/Black Friday/Always-On)
  - Embedding-Computation on save (via OpenAI Embedding API oder lokales Model)
  - Filter + Search
- [ ] One-Time Drive-Import-Script: liest Google-Drive-Folder-ID (aus OQ-09), lädt Bilder, taggt initial via Filename/Folder-Hierarchie, computed Embeddings → ≥ 20 Library-Records (Wingo-Brand-Scope)
- [ ] Admin-Page `/admin/ai-label` mit Upload für AI-Label-Asset (SVG/PNG) + globale Default-Position (Fallback wenn format-specs.ai_label_position null ist)
- [ ] Embedding-Search Server-Action: Brief-Text (Briefing.strategie + Produkt + Zielgruppe) → Top-5 Library-Matches via Cosine-Distance
- [ ] Gate 2 UI: Top-5 Library-Matches als Cards mit "Pick this" / "Show More" / "Generate New" / "Upload Own"
- [ ] "Generate New" ruft Image-Gen-Router (NanoBanana + DALL-E + Imagen Fallback-Chain) mit Style-Reference-Image aus Library (IP-Adapter wo verfügbar, sonst Prompt-Engineering)
- [ ] 3 AI-Kandidaten gezeigt
- [ ] Vision-QA-Loop: AI-Bild → Claude Vision "ist das stilistisch konsistent mit Reference?" → wenn nein (Score < 0.7), auto-regenerate bis 2x
- [ ] Beim Render: wenn `campaign_hero.source = 'ai'` → AI-Label-Asset wird in Template eingefügt an Position aus `format_specs.ai_label_position` (Fallback `/admin/ai-label` global default)
- [ ] Selected Hero (Library / AI / Upload) wird in `campaign_hero` gespeichert mit `source`-Feld
- [ ] Nach Final-Approval: Toggle "In Library aufnehmen" → neuer `hero_library`-Record mit Embedding + Tags (vom User bestätigt/editiert)
- [ ] Compliance-Test: AI-generierte Assets enthalten visuell das AI-Label (Vision-Check)

---

## Phase 6: Drag-Positionierung + Per-Asset-Regen

**User stories**: FR-33 (Master-Drag Propagation), FR-34 (Per-Asset-Override), FR-41 (Drag-UI Safezones), FR-42 (Chat-Edit)

### What to build

Gate 3 (Layout-Komposition) bekommt Drag-Capability: User kann Logo, Preis-Element, CTA innerhalb sichtbarer Brand-Safezones verschieben. Snap-Grid (8px). Drag im Master propagiert auto auf alle Formate. In der Gallery (Step 5) kann User per Asset einzeln draggen ODER via Chat-Input editieren ("mach das Logo grösser", "Preis nach links"). Claude übersetzt Chat-Input in Position/Style-Overrides für nur dieses Asset.

### Acceptance criteria

- [ ] Gate 3 zeigt Master-Composition mit drag-baren Elementen (Logo, Preis, CTA)
- [ ] Safezone-Overlay sichtbar (gestrichelte Outlines)
- [ ] Snap-Grid 8px enforced
- [ ] Drag-Constraints: Element kann nicht aus Safezone bewegt werden
- [ ] Drag im Master speichert `campaign_layout.positions_json` als relative Koordinaten
- [ ] Multiplexer respektiert Master-Positions beim Propagieren
- [ ] Post-Drag Vision-QA neu berechnet
- [ ] Gallery: pro Asset Hover-Card mit "Drag" + "Chat-Edit" Optionen
- [ ] Chat-Edit Server-Action: Claude-Call mit Asset-Context → Position/Style-Override → Re-Render nur dieses Asset
- [ ] `assets.position_overrides_json` speichert Per-Asset-Abweichungen vom Master

---

## Phase 7: V1.1 — Standard-Kampagnentyp + OCR-Brief-Upload

**User stories**: FR-02 (OCR Doc-Upload), Standard Templates für alle 11 Formate

### What to build

(a) **Standard-Kampagnentyp**: 11 zusätzliche React-Templates für Standard-Type (anderer Vibe: weniger Urgency, mehr Produkt-Story). Brief-Form-Logik wählt Template-Set basierend auf `kampagne.art`. (b) **OCR-Brief-Upload**: Brief-Form bekommt "Briefing-Dok hochladen" (PDF/DOCX/Image). Claude Vision/Text extrahiert die 6 Sektionen, pre-filled die Form. User validiert + submitted.

### Acceptance criteria

- [ ] 11 neue React-Templates für Standard-Kampagnentyp (gleiche Format-Specs, anderes Layout/Tone)
- [ ] Template-Routing: `templates`-DB-Table mappt `(brand_id, campaign_type, format_id) → file_path`
- [ ] Brief-Form-Submit für Standard-Type produziert 44 Standard-Assets (alle 4 Sprachen)
- [ ] Brief-Form hat "Briefing-Dok hochladen"-Button
- [ ] Upload akzeptiert PDF, DOCX, JPG, PNG (max 10MB)
- [ ] Server-Action ruft Claude (Vision für Images, Text-Extract für PDF/DOCX)
- [ ] Extrahierte Felder werden in Form pre-filled (mit Highlight als "AI-extracted, please verify")
- [ ] User kann Pre-fills editieren bevor Submit
- [ ] V1.0 Definition-of-Done erreicht: 1 Marketer kann Flash-Sale-Kampagne (oder Standard) end-to-end fahren, 44 Assets als ZIP

---

## Notes / Open Items

OQ-01..06 aufgelöst im Grilling 2026-05-20 (siehe `docs/PRD-Wingo-V1.md` Section 10). Neue Open Items:

- **OQ-07** Wingo-Logo SVG-Variants (Stern, Schriftlogo, Kombi, Co-Branding Swisscom) — welche Variante als Default? Phase 0 Blocker.
- **OQ-08** Wingo-Fonts: Web-Lizenz verfügbar? Sonst Open-Source-Fallback (z.B. Inter, IBM Plex). Phase 0 Blocker.
- **OQ-09** Google-Drive-Folder-ID + Auth (Service-Account oder einmaliger OAuth-Export) für Hero-Library-Seed. Phase 5 Blocker.

**Deliverables Phase 0 (von ACE generiert für Nick):**
- `/brand-assets/wingo/tokens.json` Skeleton mit allen Token-Kategorien zum Ausfüllen aus Frontify
- `/brand-assets/wingo/README.md` mit Anleitung was in welchen Ordner gehört
- `/brand-assets/wingo/glossar.json` Skeleton

**Test-Strategie:** Vitest für Server-Actions + Schema-Validation. Playwright optional für Gate-Flow E2E in Phase 2+. Vision-QA-Mocks für Tests (Claude Vision nicht in CI).
