# Claude Code Starter Kit

## Quick Start
```bash
chmod +x setup.sh && ./setup.sh
cd agentic-campaigning
# CLAUDE.md hierhin kopieren
claude-code .
# Dann: "Lies CLAUDE.md und starte Phase 1"
```

## Paket-Inhalt
1. CLAUDE.md - Zentrale Instruktionsdatei (Struktur, Stack, Features, Regeln)
2. setup.sh - Scaffolding (Next.js + shadcn + Dependencies + Ordner)
3. schema.sql - Supabase DB Schema
4. Brand Brain Dateien (tone-of-voice, glossar, prompts) aus vorherigem Build

## Claude Code Befehle pro Phase

### Phase 1: Foundation
- "Erstelle Claude API Client in src/lib/ai/claude.ts (Retry, JSON-Enforcement, Validation Pipeline)"
- "Erstelle Zod Schema in src/lib/schemas/promo-input.ts (Business-Goal, Pricing mit Rabatt-Check, Channels)"
- "Erstelle Brand Brain Loader in src/lib/ai/brand-brain/loader.ts (lokal laden, modular, Context Builder)"

### Phase 2: Konzept Engine
- "Erstelle Promo-Input Formular src/app/campaigns/new/page.tsx (shadcn/ui, Live-Validierung)"
- "Erstelle Strategy Advisor Prompt (2 Richtungen vorschlagen, rational vs emotional)"
- "Erstelle Concept Generator Prompt (Claims, Kanal-Adaptionen, SEA 30/90 Limit)"
- "Erstelle Translator Prompt (DE->FR/IT/EN, Glossar-Enforcement, Zeichenlimit-Anpassung)"

### Phase 3: Content Engine
- "Erstelle Canva Integration src/lib/integrations/canva.ts (Template-Filling, Varianten-Matrix)"

### Phase 4: Dashboard
- "Erstelle Dashboard Layout + Kampagnen-Uebersicht (Sidebar, Status-Cards)"
- "Erstelle 3-Stufen Approval-Flow (Konzept -> Uebersetzungen -> Assets)"
- "Erstelle Meta + Google Ads Upload nach Approval"

## Checklist
- [ ] Node.js 18+
- [ ] Docker Desktop
- [ ] Anthropic API Key
- [ ] Supabase Projekt + Schema
- [ ] .env.local gefuellt
