# Solution Architecture Review & Optimierter Plan
## Agentic Promo Production System – Coop Mobile

**Autor:** Lead Solution Architect  
**Datum:** 02. März 2026  
**Basis:** elaboratum-Angebot vom 25.02.2026 (CHF 78'152 netto)  
**Status:** Analyse & Optimierung

---

## 1. Executive Summary

Das elaboratum-Angebot beschreibt einen soliden PoC-Ansatz mit klarem Scope. Nach technischer Analyse identifiziere ich **5 architektonische Optimierungen**, die den ROI signifikant steigern und die Skalierungsfähigkeit ab Tag 1 sicherstellen – ohne den Budget-Rahmen zu sprengen.

**Kernthese:** Das Angebot fokussiert korrekt auf Briefing & Konzept als Startpunkt, unterschätzt aber die Bedeutung der **Datenarchitektur** und des **Prompt Engineering Frameworks**. Wer hier früh investiert, spart in Phase 2-4 massiv.

---

## 2. Analyse des elaboratum-Vorgehens

### 2.1 Was gut ist (beibehalten)

- **PoC statt Big Bang** – Absolut richtig. Der schrittweise Aufbau reduziert Risiken.
- **Human-in-the-Loop** – Für Compliance-kritische Assets (Preise, Disclaimer) unverzichtbar.
- **Level 2 als Zielbild** (Modular Visual System) – Pragmatisch. Level 3 (Fully Generative) ist tatsächlich zu riskant für regelgebundene Promo-Assets.
- **Briefing zuerst, Visuals danach** – Die richtige Reihenfolge, da Textqualität vor Bildqualität validiert werden muss.
- **2 Monate Pilotbetrieb** – Genug Zeit für 4-6 reale Kampagnen-Durchläufe.

### 2.2 Was fehlt oder zu kurz kommt

| Gap | Risiko | Empfehlung |
|-----|--------|------------|
| **Kein Datenmodell spezifiziert** | Promo-Input-Schema wird ad-hoc definiert, spätere Änderungen sind teuer | Promo-Datenmodell als erstes Deliverable definieren (vor dem Kickoff-Workshop) |
| **Prompt Engineering als Black Box** | Textqualität hängt von nicht-dokumentierten Prompts ab, keine Reproduzierbarkeit | Prompt Library mit versionierten System-Prompts aufbauen |
| **Keine Error-Handling-Strategie** | API-Ausfälle, Halluzinationen, Token-Limits nicht adressiert | Retry-Logik, Fallback-Prompts, Output-Validierung einplanen |
| **Keine Metriken definiert** | "50% Zeitersparnis" nicht messbar ohne Baseline | KPIs vor Pilotstart definieren und automatisch tracken |
| **Übersetzungsqualität unklar** | FR/IT-Übersetzungen ohne Fachvalidierung riskant | Native Speaker Review-Loop + Glossar-Enforcement |
| **Keine Governance für Prompt-Änderungen** | Wer darf Prompts ändern? Wie wird getestet? | Prompt-Versioning + A/B-Test-Framework |

### 2.3 Budgetverteilung – Analyse

Die aktuelle Verteilung (Konzeption 23%, Entwicklung 46%, Pilot 23%, PM 8%) ist vernünftig. Meine Optimierung verschiebt ~2 BT von Pilotbetrieb zu Datenmodell/Prompt-Framework, da ein sauberes Fundament den Pilotbetrieb verkürzt.

---

## 3. Optimierte Architektur

### 3.1 System-Architektur (Target State)

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ n8n Form UI  │  │ Slack Bot    │  │ Google Sheets Input    │ │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬────────────┘ │
└─────────┼─────────────────┼──────────────────────┼──────────────┘
          │                 │                      │
┌─────────▼─────────────────▼──────────────────────▼──────────────┐
│                     ORCHESTRATION LAYER (n8n)                     │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              Workflow Router (Master Orchestrator)         │    │
│  │  • Validiert Input gegen Schema                          │    │
│  │  • Routet zu Sub-Workflows                               │    │
│  │  • Error Handling & Retry Logic                          │    │
│  │  • Audit Logging                                         │    │
│  └──────────────────────────────────────────────────────────┘    │
│           │              │              │              │          │
│  ┌────────▼───┐  ┌───────▼──────┐  ┌──▼──────────┐  ┌▼───────┐ │
│  │ Konzept-WF │  │ Briefing-WF  │  │ Translate-WF│  │Asset-WF│ │
│  └────────────┘  └──────────────┘  └─────────────┘  └────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │                                │
┌─────────▼────────────────────────────────▼──────────────────────┐
│                     AI AGENT LAYER                                │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │              Prompt Library (Versioniert)                  │    │
│  │  v1.0 konzept_system.md    v1.0 translate_de_fr.md       │    │
│  │  v1.0 claims_generator.md  v1.0 briefing_media.md        │    │
│  │  v1.0 compliance_check.md  v1.0 quality_scorer.md        │    │
│  └──────────────────────────────────────────────────────────┘    │
│           │                                                       │
│  ┌────────▼─────────────────────────────────────────────────┐    │
│  │              Claude API (sonnet-4)                         │    │
│  │  • System Prompt aus Prompt Library                       │    │
│  │  • Structured Output (JSON Mode)                         │    │
│  │  • Output Validation Layer                                │    │
│  │  • Fallback: Retry mit alternativem Prompt               │    │
│  └──────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
          │
┌─────────▼───────────────────────────────────────────────────────┐
│                       DATA LAYER                                  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Supabase     │  │ Brand Assets │  │ Audit Log              │ │
│  │ • Promos     │  │ • Glossar    │  │ • Alle API Calls       │ │
│  │ • Campaigns  │  │ • Tone Guide │  │ • Alle Approvals       │ │
│  │ • Assets     │  │ • CI Rules   │  │ • Alle Änderungen      │ │
│  │ • Templates  │  │ • Templates  │  │ • Token Usage          │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Promo-Datenmodell (Kritisch – muss ZUERST stehen)

```json
{
  "promo_id": "CM-2026-W23-001",
  "meta": {
    "brand": "coop_mobile",
    "created_by": "marketing_team",
    "created_at": "2026-05-15T10:00:00Z",
    "status": "draft|in_review|approved|published",
    "campaign_type": "aktionswoche|themenpromo|standardpromo"
  },
  "product": {
    "name": "Coop Mobile Basic",
    "type": "abo|prepaid|hardware|bundle",
    "sku": "CM-BASIC-5G",
    "features": ["5G im Swisscom Netz", "Unlimitiert telefonieren"]
  },
  "pricing": {
    "price_old": 29.90,
    "price_new": 11.95,
    "currency": "CHF",
    "price_suffix": "/Mt.",
    "discount_type": "percentage|absolute|special",
    "discount_value": 60,
    "discount_display": "60%",
    "duration": "lebenslang|12_monate|6_monate|einmalig",
    "conditions": "Nur für Neukunden. Mindestvertragsdauer 24 Monate."
  },
  "campaign": {
    "start_date": "2026-06-01",
    "end_date": "2026-06-14",
    "laufzeit_wochen": 2,
    "target_audience": "neukunden|bestandskunden|jugendliche|familien",
    "key_message": "Der günstigste 5G-Tarif der Schweiz",
    "claim_direction": "preis_fokus|feature_fokus|emotional"
  },
  "channels": {
    "print": {
      "enabled": true,
      "formats": ["fust_inserat", "id_inserat", "pos_plakat", "flyer"],
      "requires_bleed": true
    },
    "digital": {
      "enabled": true,
      "formats": ["display_banner", "social_feed", "social_story", "newsletter", "website_teaser"],
      "sizes": {
        "display_banner": ["300x250", "728x90", "160x600", "320x50"],
        "social_feed": ["1080x1080", "1200x628"],
        "social_story": ["1080x1920"]
      }
    },
    "sea": {
      "enabled": true,
      "platforms": ["google", "bing"]
    },
    "ooh": {
      "enabled": false
    }
  },
  "compliance": {
    "disclaimer_required": true,
    "disclaimer_text": "Aktion gültig vom 01.06. bis 14.06.2026. Nur für Neukunden.",
    "five_g_badge": true,
    "swisscom_netz_hinweis": true,
    "legal_review_required": false
  },
  "languages": ["de", "fr", "it"],
  "restrictions": ["Nicht kombinierbar mit anderen Aktionen"]
}
```

### 3.3 Prompt Engineering Framework

Dies ist der grösste blinde Fleck im Angebot. Die Textqualität steht und fällt mit den Prompts.

**Prinzip: Jeder Prompt ist ein versioniertes, testbares Artefakt.**

Struktur pro Prompt:
```
prompts/
├── system/
│   ├── konzept_generator_v1.0.md
│   ├── claim_generator_v1.0.md
│   ├── kanal_adapter_v1.0.md
│   ├── translate_de_fr_v1.0.md
│   ├── translate_de_it_v1.0.md
│   ├── compliance_checker_v1.0.md
│   └── quality_scorer_v1.0.md
├── examples/
│   ├── golden_examples.json    (5-10 ideale Outputs)
│   └── negative_examples.json  (Was NICHT rauskommen soll)
├── brand/
│   ├── tone_of_voice.md
│   ├── glossar_de.json
│   ├── glossar_fr.json
│   ├── glossar_it.json
│   └── ci_rules.md
└── tests/
    ├── test_cases.json
    └── eval_results/
```

**Beispiel System-Prompt (Konzept-Generator):**

```markdown
Du bist ein Senior Marketing Strategist für Coop Mobile, eine Schweizer Mobilfunkmarke.

## Deine Aufgabe
Erstelle basierend auf dem Promo-Input einen vollständigen Kampagnensteckbrief.

## Brand Guidelines
- Tonalität: Freundlich, direkt, nicht übertrieben. Schweizer Understatement.
- Sprache: Einfach und klar. Keine Anglizismen wo es deutsche Alternativen gibt.
- Claim-Stil: Kurz (max 8 Wörter), einprägsam, Preisvorteil muss spürbar sein.
- IMMER erwähnen: "5G im Swisscom Netz" (bei 5G-Produkten)

## Output-Format (STRICT JSON)
{
  "kampagnensteckbrief": {
    "leitidee": "string (1 Satz, max 20 Wörter)",
    "claims": ["string (3-5 Varianten, je max 8 Wörter)"],
    "hero_message": "string (Hauptbotschaft für alle Kanäle)",
    "key_visuals_direction": "string (Beschreibung der visuellen Richtung)"
  },
  "kanaladaptionen": {
    "social": { "hook": "string", "body": "string", "cta": "string" },
    "crm": { "subject": "string", "preview": "string", "body": "string" },
    "website": { "headline": "string", "subline": "string", "cta": "string" },
    "sea": { "headlines": ["string (max 30 Zeichen, 3-5 Varianten)"], "descriptions": ["string (max 90 Zeichen, 2-3 Varianten)"] },
    "print": { "headline": "string", "subline": "string", "body": "string (max 40 Wörter)" }
  },
  "compliance_notes": ["string (Pflichthinweise die inkludiert werden müssen)"]
}

## Regeln
1. Preise IMMER exakt aus dem Input übernehmen – NIEMALS runden oder ändern.
2. Rabatt-Prozente müssen mathematisch korrekt sein.
3. Alle Pflichthinweise aus dem Input müssen im Output erscheinen.
4. SEA Headlines: Max 30 Zeichen (hart), Descriptions: Max 90 Zeichen (hart).
5. Kein Claim darf ein Versprechen machen, das nicht im Input belegt ist.
```

### 3.4 Error Handling & Resilience

```
┌─────────────────────────────────────────────────┐
│              Error Handling Matrix                │
├─────────────────┬───────────────────────────────┤
│ Fehler          │ Handling                       │
├─────────────────┼───────────────────────────────┤
│ API Timeout     │ Retry 3x mit Backoff           │
│ Rate Limit      │ Queue + Retry nach Wait-Time    │
│ Invalid JSON    │ Retry mit expliziterem Prompt   │
│ Preis falsch    │ Regex-Validation → BLOCK        │
│ Halluzination   │ Facts-Check gegen Input-Daten   │
│ Token Limit     │ Chunking / Summarize first      │
│ Sprache falsch  │ Language Detection → Retry       │
│ CI-Verstoss     │ Compliance-Check Node → Flag     │
└─────────────────┴───────────────────────────────┘
```

**Kritisch: Output-Validierung NACH jedem Claude-Call:**
```javascript
// Validation Node nach jedem Claude API Call
function validateOutput(input, output) {
  const errors = [];
  
  // Preis-Check: Output-Preise müssen Input-Preise matchen
  if (output.includes(input.pricing.price_old)) { /* ok */ }
  else { errors.push("CRITICAL: Alter Preis nicht im Output"); }
  
  // Rabatt-Check: Mathematische Korrektheit
  const expectedDiscount = Math.round((1 - input.pricing.price_new / input.pricing.price_old) * 100);
  if (!output.includes(`${expectedDiscount}%`)) {
    errors.push("CRITICAL: Rabatt-Prozent inkorrekt");
  }
  
  // Zeichenlimit-Check für SEA
  output.sea?.headlines?.forEach((h, i) => {
    if (h.length > 30) errors.push(`SEA Headline ${i} zu lang: ${h.length}/30`);
  });
  
  // Pflichthinweise-Check
  if (input.compliance.five_g_badge && !output.includes("5G")) {
    errors.push("WARNING: 5G-Hinweis fehlt");
  }
  
  return { valid: errors.filter(e => e.startsWith("CRITICAL")).length === 0, errors };
}
```

---

## 4. Optimierter Projektplan

### 4.1 Sprint-Planung (statt Wasserfall)

Das elaboratum-Vorgehen ist leicht wasserfallig (Konzeption → Entwicklung → Pilot). Ich empfehle **2-Wochen-Sprints** innerhalb der gleichen Phasen:

```
Sprint 0 (Woche 0)    : Datenmodell + Tech-Setup + Prompt Framework Skeleton
Sprint 1 (Woche 1-2)  : Promo-Input Workflow + Validierung (E2E testbar)
Sprint 2 (Woche 3-4)  : Konzept-Engine + Claim-Generator (Core)
Sprint 3 (Woche 5-6)  : Kanal-Adaptionen + Briefing-Generator
Sprint 4 (Woche 7-8)  : Mehrsprachigkeit + Compliance-Check
Sprint 5 (Woche 9-10) : Quality Scoring + Review-Loop
Sprint 6 (Woche 11-12): Alpha Release + erste reale Promo
Sprint 7 (Woche 13-14): Optimierung basierend auf Alpha-Feedback
Sprint 8 (Woche 15-16): Beta Release
Sprint 9-12 (W 17-24) : Pilotbetrieb (4-6 reale Kampagnen)
```

### 4.2 n8n Workflow-Architektur (optimiert)

**Vorher (elaboratum-Implizit):** Monolithische Workflows
**Nachher (optimiert):** Sub-Workflow-Architektur mit Master Orchestrator

```
Master Workflow: "Promo Campaign Orchestrator"
├── Sub-WF 1: "Input Validator" (Schema + Business Rules)
├── Sub-WF 2: "Konzept Generator" (Leitidee, Claims)
├── Sub-WF 3: "Kanal Adapter" (Social, CRM, Web, SEA, Print)
├── Sub-WF 4: "Translator" (DE → FR, DE → IT)
├── Sub-WF 5: "Compliance Checker" (Preise, Disclaimer, CI)
├── Sub-WF 6: "Briefing Assembler" (Docs generieren)
├── Sub-WF 7: "Review Router" (Slack/Email Approval)
└── Sub-WF 8: "Quality Monitor" (Metrics + Logging)
```

**Warum Sub-Workflows?**
- Einzeln testbar und debugbar
- Unabhängig skalierbar (Translator kann separat laufen)
- Wiederverwendbar (Translator für Wingo/M-Budget)
- Einzelne Fehler crashen nicht den ganzen Flow

### 4.3 Kritische Metriken (VOR Pilotstart definieren)

| Metrik | Baseline (IST) | Ziel (PoC) | Messmethode |
|--------|----------------|------------|-------------|
| Time-to-Briefing | ~3 Tage | < 2 Stunden | Timestamp Diff |
| Anzahl Korrekturschleifen | ~4 pro Asset | < 2 | Counter im Review-WF |
| Übersetzungsqualität | Manuell 100% | >90% "gut" Rating | Native Speaker Score |
| Claim-Akzeptanzrate | N/A | >60% first-try | Approval Rate |
| Preis-Korrektheit | 100% (manuell) | 100% (automatisch) | Validation Score |
| Token-Kosten pro Promo | N/A | < CHF 5 | API Usage Tracking |
| Compliance-Pass-Rate | N/A | 100% | Auto-Check |

---

## 5. Technologie-Entscheidungen

### 5.1 Stack-Empfehlung

| Komponente | Empfehlung | Begründung |
|-----------|-----------|------------|
| Orchestrierung | n8n (self-hosted) | Wie im Angebot – richtige Wahl für Workflow-Komplexität |
| AI Model | Claude Sonnet 4 | Bestes Preis/Leistung für Text-Generation. Opus nur für Compliance-Edge-Cases |
| Datenbank | Supabase (Postgres) | Structured Data + Row Level Security + REST API gratis |
| Prompt Storage | Git Repo | Versionierung, Diff, Review-Prozess |
| Document Gen | docx-js / Puppeteer | Briefings als DOCX, Assets als PDF via HTML→PDF |
| Monitoring | n8n + Google Sheets | Einfach, sichtbar für alle Stakeholder |
| Review/Approval | Slack + n8n Wait | Asynchron, mobiltauglich, nachvollziehbar |

### 5.2 Claude API Konfiguration

```javascript
// Empfohlene Basis-Konfiguration für alle Calls
const baseConfig = {
  model: "claude-sonnet-4-20250514",
  max_tokens: 4096,
  temperature: 0.3,  // Niedrig für konsistente, faktenbasierte Outputs
  // Für kreative Claims: temperature 0.7 in separatem Call
};

// Structured Output erzwingen
const systemPromptSuffix = `
CRITICAL: Antworte AUSSCHLIESSLICH mit validem JSON. 
Kein Markdown, keine Backticks, kein Präambel-Text.
Beginne direkt mit { und ende mit }.
`;
```

---

## 6. Risiken & Mitigationen

| # | Risiko | Impact | Wahrsch. | Mitigation |
|---|--------|--------|----------|------------|
| R1 | Textqualität genügt nicht für Coop-CI | Hoch | Mittel | Golden Examples + iteratives Prompt Engineering + Native Review |
| R2 | Übersetzungen FR/IT fehlerhaft | Hoch | Hoch | Glossar-Enforcement + parallele Validierung durch Muttersprachler |
| R3 | API-Kosten höher als erwartet | Mittel | Niedrig | Token-Monitoring + Caching von wiederkehrenden Patterns |
| R4 | n8n-Instabilität bei komplexen Flows | Mittel | Mittel | Sub-Workflow-Architektur + Error Recovery + Retry Logic |
| R5 | Akzeptanz im Team gering | Hoch | Mittel | Früh einbeziehen, Quick Wins zeigen, "Augmentation not Replacement" |
| R6 | Skalierung auf Wingo/M-Budget scheitert | Mittel | Niedrig | Brand-agnostisches Datenmodell von Anfang an |

---

## 7. Quick Wins (sofort umsetzbar, ausserhalb des PoC)

1. **SEA-Text-Generator** – Claude generiert Google Ads Headlines/Descriptions direkt aus Promo-Daten. Kaum Risiko, sofort messbar.
2. **Newsletter-Subject-Line-Tester** – 5 Varianten generieren, A/B-Test automatisieren.
3. **Disclaimer-Assembler** – Regelbasiert (kein AI nötig), spart aber sofort Fehler.

---

## 8. Empfehlung

Das elaboratum-Angebot ist eine solide Grundlage. Mit den hier beschriebenen Optimierungen wird aus einem guten PoC ein **produktionsfähiges System**:

1. **Datenmodell zuerst** – Investiere 2 Tage vor dem Kickoff in ein sauberes JSON-Schema.
2. **Prompt Library aufbauen** – Prompts sind Code. Versionieren, testen, reviewen.
3. **Sub-Workflow-Architektur** – Einzeln testbar, wiederverwendbar, resilient.
4. **Output-Validierung** – Jeder Claude-Call wird automatisch auf Korrektheit geprüft.
5. **Metriken vor Pilot** – Nur was gemessen wird, kann optimiert werden.

**Nächster Schritt:** Sprint 0 starten – Datenmodell finalisieren, n8n aufsetzen, Prompt Library Skeleton erstellen. Ich kann alle n8n-Workflows als importierbare JSON-Dateien generieren.
