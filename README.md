# ACE – Agentic Campaigning Engine

AI-gesteuerte, brand-agnostische Marketing-Engine basierend auf **Next.js** + **Claude API** + **n8n**.

## Quickstart

```bash
# 1. Repo klonen
git clone <repo-url>
cd agentic-campaigning

# 2. Environment konfigurieren
cp .env.example .env
# → API Keys eintragen (siehe unten)

# 3. n8n + Postgres starten
docker compose up -d

# 4. n8n öffnen
open http://localhost:5678

# 5. Workflows importieren
# Settings → Import Workflow → Dateien aus n8n-workflows/ auswählen
```

## API Keys (.env)

```
ANTHROPIC_API_KEY=sk-ant-...
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=<sicheres-passwort>
POSTGRES_PASSWORD=<sicheres-passwort>
```

## Projektstruktur

```
docs/              Architektur, Angebot, Runbooks
data-model/        Promo-Input JSON Schema + Beispiele
prompts/           Versionierte System-Prompts + Brand-Assets
n8n-workflows/     Alle n8n Workflows (Master + Sub-Workflows)
templates/         Briefing-Vorlagen + Asset-Templates
scripts/           Setup & Utility Scripts
dashboards/        React Dashboards (Plan, Architektur)
pilot/             Pilot-Kampagnen Tracking
```

## Workflow-Architektur

```
Master Orchestrator
├── 01 Input Validator
├── 02 Konzept Generator
├── 03 Kanal Adapter
├── 04 Briefing Assembler
├── 05 Translator (DE→FR/IT)
├── 06 Compliance Checker
├── 07 Review Router
└── 08 Quality Monitor
```

## Sprint-Plan

| Sprint | Wochen | Fokus |
|--------|--------|-------|
| S0 | W0 | Foundation: Datenmodell, Setup, Prompt Skeleton |
| S1 | W1-2 | Input Validator Workflow |
| S2 | W3-4 | Konzept Generator |
| S3 | W5-6 | Kanal Adapter + Briefing Assembler |
| S4 | W7-8 | Translator + Compliance Checker |
| S5 | W9-10 | Review Router + Quality Monitor |
| S6 | W11-12 | Alpha Release |
| S7 | W13-14 | Optimierung → Beta |
| S8-12 | W15-24 | Pilotbetrieb |

## Docs

- [Solution Architecture Review](docs/architecture/solution-architecture-review.md)
- [Promo Input Schema](data-model/promo-input-schema.json)
- [Setup Guide](docs/runbooks/setup.md)
