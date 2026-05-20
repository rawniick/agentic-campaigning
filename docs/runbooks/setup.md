# Setup Guide — ACE Wingo V1

## Voraussetzungen

- Node 20+
- Supabase-Projekt (Postgres + Storage)
- Anthropic API Key (`console.anthropic.com`)

## 1. Environment konfigurieren

```bash
cp .env.example .env.local
```

Mindestens setzen:
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` (Supabase → Settings → Database → Connection String, Session-Mode)
- `ACE_ACTIVE_BRAND=wingo`
- `ACE_ASSETS_BUCKET=campaign-assets`

## 2. Migrations anwenden

Wenn Supabase CLI lokal:
```bash
supabase db push
```

Oder via psql:
```bash
psql "$DATABASE_URL" -f supabase/migrations/001_brands.sql
psql "$DATABASE_URL" -f supabase/migrations/002_format_specs.sql
psql "$DATABASE_URL" -f supabase/migrations/003_brand_voice_variants.sql
psql "$DATABASE_URL" -f supabase/migrations/004_disclaimers.sql
psql "$DATABASE_URL" -f supabase/migrations/005_products.sql
psql "$DATABASE_URL" -f supabase/migrations/006_campaigns.sql
psql "$DATABASE_URL" -f supabase/migrations/007_campaign_copy.sql
psql "$DATABASE_URL" -f supabase/migrations/008_assets.sql
```

## 3. Dev-Seed (optional, fuer Phase 1 Demo)

Pflichtdaten anlegen: 1 Default-TOV, 1 Disclaimer, 1 Sample-Produkt.

```bash
psql "$DATABASE_URL" -f supabase/seeds/dev.sql
```

**Achtung:** Default-TOV ist Pflicht — ohne wirft `loadBrand()` einen Fehler.

## 4. Storage-Bucket anlegen

Im Supabase Dashboard:
1. Storage → New Bucket
2. Name: `campaign-assets` (oder Wert aus `ACE_ASSETS_BUCKET`)
3. Public: **ja** (V1 — Phase 2 + RLS spaeter)
4. File-Size-Limit: 50 MB

Oder via SQL:
```sql
INSERT INTO storage.buckets (id, name, public) 
VALUES ('campaign-assets', 'campaign-assets', true)
ON CONFLICT (id) DO NOTHING;
```

## 5. Brand-Tokens checken

`/brand-assets/wingo/tokens.json` enthaelt PLACEHOLDER-Defaults (Wingo Rot, Schwarz, Grau, Inter).
- App startet auch ohne Frontify-Anpassung
- Vor V1.0-Release aus echtem Brand Manual ueberschreiben (siehe `brand-assets/wingo/README.md`)
- Logos `brand-assets/wingo/logos/*.svg` einlegen sobald aus Frontify exportiert

## 6. Dev-Server starten

```bash
npm run dev
```

Öffnen: http://localhost:3000

### Phase-1-Smoke-Test

1. `/` → Dashboard
2. `/admin/products` → 1 Produkt sichtbar (aus Dev-Seed)
3. `/campaigns/new` → Brief-Form ausfuellen
4. Submit → ruft Claude (real), rendert Halfpage, lädt in Storage
5. Redirect zu `/campaigns/[id]` → 1 Asset sichtbar mit Download-Button

## Tests

```bash
npm test          # vitest run, sequenziell (PGlite WASM-Init)
npm run build     # Next-Build smoke
```

## Bekannte Probleme

| Problem | Lösung |
|---------|--------|
| `loadBrand` wirft "No default brand voice" | Dev-Seed nicht angewendet — Schritt 3 |
| `tokens.json` Zod-Fehler | Skeleton noch leer — `brand-assets/wingo/tokens.json` befuellen |
| Storage 403 beim Upload | Bucket nicht public oder Service-Role-Key falsch |
| Satori "Unsupported OpenType signature" | TTFs in `brand-assets/wingo/fonts/` fehlen oder beschädigt |
