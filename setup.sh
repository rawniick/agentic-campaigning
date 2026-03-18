#!/bin/bash
# ============================================
# Agentic Marketing Engine - Project Setup
# Run this FIRST in Claude Code:
#   chmod +x setup.sh && ./setup.sh
# ============================================

set -e
echo "🚀 Setting up Agentic Marketing Engine..."

# 1. Create Next.js project
echo "📦 Creating Next.js project..."
npx create-next-app@latest agentic-campaigning \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-turbo

cd agentic-campaigning

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm install @anthropic-ai/sdk zod @supabase/supabase-js
npm install lucide-react date-fns
npm install -D @types/node

# 3. shadcn/ui setup
echo "🎨 Setting up shadcn/ui..."
npx shadcn@latest init -y
npx shadcn@latest add button card input label select textarea badge tabs dialog alert toast form separator sheet dropdown-menu

# 4. Create directory structure
echo "📁 Creating project structure..."
mkdir -p src/app/campaigns/new
mkdir -p src/app/campaigns/\[id\]/briefing
mkdir -p src/app/campaigns/\[id\]/content
mkdir -p src/app/campaigns/\[id\]/export
mkdir -p src/app/api/generate/concept
mkdir -p src/app/api/generate/translate
mkdir -p src/app/api/generate/content
mkdir -p src/app/api/campaigns
mkdir -p src/app/api/approve
mkdir -p src/app/api/export

mkdir -p src/components/dashboard
mkdir -p src/components/forms
mkdir -p src/components/briefing
mkdir -p src/components/approval
mkdir -p src/components/assets

mkdir -p src/lib/ai/prompts
mkdir -p src/lib/ai/brand-brain
mkdir -p src/lib/ai/validation
mkdir -p src/lib/db/queries
mkdir -p src/lib/integrations
mkdir -p src/lib/schemas
mkdir -p src/lib/utils

mkdir -p src/types

mkdir -p brand-brain
mkdir -p n8n-workflows
mkdir -p supabase/migrations
mkdir -p docs

# 5. Copy CLAUDE.md to project root
echo "📋 CLAUDE.md should be placed in project root"

# 6. Create .env.example
cat > .env.example << 'EOF'
# Anthropic
ANTHROPIC_API_KEY=sk-ant-xxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Google Drive (Brand Brain)
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_DRIVE_FOLDER_ID=xxx

# Canva Connect API
CANVA_API_KEY=xxx
CANVA_BRAND_KIT_ID=xxx

# Meta Marketing API
META_ACCESS_TOKEN=xxx
META_AD_ACCOUNT_ID=xxx

# Google Ads API
GOOGLE_ADS_DEVELOPER_TOKEN=xxx
GOOGLE_ADS_CLIENT_ID=xxx
GOOGLE_ADS_CLIENT_SECRET=xxx
GOOGLE_ADS_CUSTOMER_ID=xxx

# n8n
N8N_WEBHOOK_URL=http://localhost:5678
N8N_API_KEY=xxx
EOF

# 7. Docker Compose for n8n
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  n8n:
    image: n8nio/n8n:latest
    restart: unless-stopped
    ports:
      - "5678:5678"
    environment:
      - N8N_BASIC_AUTH_ACTIVE=true
      - N8N_BASIC_AUTH_USER=admin
      - N8N_BASIC_AUTH_PASSWORD=changeme123
      - DB_TYPE=postgresdb
      - DB_POSTGRESDB_HOST=postgres
      - DB_POSTGRESDB_DATABASE=n8n
      - DB_POSTGRESDB_USER=n8n
      - DB_POSTGRESDB_PASSWORD=n8n_password
      - N8N_SECURE_COOKIE=false
    volumes:
      - n8n_data:/home/node/.n8n
    depends_on:
      - postgres

  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_USER=n8n
      - POSTGRES_PASSWORD=n8n_password
      - POSTGRES_DB=n8n
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  n8n_data:
  postgres_data:
EOF

echo ""
echo "✅ Project scaffolded successfully!"
echo ""
echo "Next steps:"
echo "  1. cp .env.example .env.local"
echo "  2. Fill in API keys in .env.local"
echo "  3. Copy CLAUDE.md to project root"
echo "  4. Open in Claude Code: claude-code ."
echo "  5. Tell Claude Code: 'Read CLAUDE.md and start with Phase 1'"
echo ""
