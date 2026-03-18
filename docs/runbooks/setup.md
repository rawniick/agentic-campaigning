# Setup Guide – Agentic Campaigning

## Voraussetzungen

- Docker & Docker Compose installiert
- Git
- Anthropic API Key (console.anthropic.com)
- Optional: Slack Workspace für Review-Workflow

## 1. Repository klonen

```bash
git clone <repo-url>
cd agentic-campaigning
```

## 2. Environment konfigurieren

```bash
cp .env.example .env
```

Mindestens eintragen:
- `ANTHROPIC_API_KEY` – dein Claude API Key
- `N8N_BASIC_AUTH_PASSWORD` – sicheres Passwort für n8n UI

## 3. n8n starten

```bash
docker compose up -d
```

Prüfen ob alles läuft:
```bash
docker compose ps
# Sollte zeigen: n8n (Up), postgres (Up)
```

n8n UI öffnen: http://localhost:5678

## 4. Credentials in n8n anlegen

In n8n unter Settings → Credentials:

### Claude API (HTTP Header Auth)
- Name: `Anthropic API`
- Header Name: `x-api-key`
- Header Value: `sk-ant-...` (dein API Key)

### Slack (optional, für Review-Workflow)
- Name: `Slack Bot`
- Type: Slack OAuth2
- Bot Token: `xoxb-...`

## 5. Workflows importieren

Reihenfolge (wichtig – Sub-Workflows müssen VOR dem Master existieren):

1. `n8n-workflows/sub-workflows/01-input-validator.json`
2. `n8n-workflows/sub-workflows/02-konzept-generator.json`
3. ... (alle Sub-Workflows)
4. `n8n-workflows/master/00-campaign-orchestrator.json` (zuletzt)

Import: n8n → Workflows → Import from File

## 6. Test-Durchlauf

1. Öffne den `01-input-validator` Workflow
2. Klicke "Test Workflow"
3. Sende den Beispiel-Input aus `data-model/examples/promo-aktionswoche.json`
4. Prüfe ob die Validierung durchläuft

## Bekannte Probleme

| Problem | Lösung |
|---------|--------|
| n8n startet nicht | `docker compose logs n8n` prüfen – oft Port-Konflikt |
| Claude API 429 (Rate Limit) | Retry-Node wartet automatisch, bei Dauerproblem: Tier erhöhen |
| Postgres Connection refused | Warten bis Container ready: `docker compose restart n8n` |
