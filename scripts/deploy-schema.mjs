// One-Shot-Deploy-Runner fuer das Wingo-Supabase-Projekt (kaqxw...).
// Liest Secrets aus .env.local ZUR LAUFZEIT (nie geloggt) und:
//   1. spielt supabase/consolidated_001-016.sql via pg ein (idempotent genug fuer
//      eine frische DB; ADD COLUMN IF NOT EXISTS deckt Re-Runs der letzten Migrationen),
//   2. legt den public Storage-Bucket "campaign-assets" an (falls fehlt).
// Aufruf:  node scripts/deploy-schema.mjs
import fs from "fs";
import path from "path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();

// .env.local selbst parsen (KEY=VALUE), damit das Skript ohne extra Tooling laeuft.
function loadEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  const env = {};
  if (!fs.existsSync(p)) return env;
  for (const line of fs.readFileSync(p, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...loadEnvLocal(), ...process.env };
const DATABASE_URL = env.DATABASE_URL;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const PLACEHOLDER = (v) => !v || /PASTE_|YOUR-|xxxx|<.*>/i.test(v);

let ok = true;

// ---- 1. Schema via pg ----
if (PLACEHOLDER(DATABASE_URL)) {
  console.log("⏭  DATABASE_URL fehlt/Platzhalter in .env.local — Schema-Deploy uebersprungen.");
  console.log("    Setze DATABASE_URL (Supabase → Settings → Database → Connection string, Transaction pooler).");
  ok = false;
} else {
  const sqlPath = path.join(ROOT, "supabase", "consolidated_001-016.sql");
  const sql = fs.readFileSync(sqlPath, "utf-8");
  const client = new pg.Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  try {
    await client.connect();
    await client.query(sql);
    const t = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public'`
    );
    const a = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='assets' AND column_name='conformity_pass'`
    );
    const b = await client.query(`SELECT count(*)::int AS n FROM brands WHERE slug='wingo'`);
    console.log(`✅ Schema eingespielt: ${t.rows[0].n} Tabellen, conformity_pass=${a.rows[0].n === 1 ? "ok" : "FEHLT"}, wingo-seed=${b.rows[0].n === 1 ? "ok" : "FEHLT"}.`);
  } catch (e) {
    // Host/Code loggen, aber NIE die volle Connection-URL (enthaelt Passwort).
    console.log(`❌ Schema-Deploy fehlgeschlagen: ${e.code ?? ""} ${String(e.message).split("\n")[0]}`);
    ok = false;
  } finally {
    await client.end().catch(() => {});
  }
}

// ---- 2. Storage-Bucket ----
if (PLACEHOLDER(SUPABASE_URL) || PLACEHOLDER(SERVICE_KEY)) {
  console.log("⏭  NEXT_PUBLIC_SUPABASE_URL oder SUPABASE_SERVICE_ROLE_KEY fehlt — Bucket-Anlage uebersprungen.");
  ok = false;
} else {
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);
  const { error } = await supa.storage.createBucket("campaign-assets", { public: true });
  if (!error) {
    console.log('✅ Storage-Bucket "campaign-assets" (public) angelegt.');
  } else if (/already exists/i.test(error.message)) {
    console.log('✅ Storage-Bucket "campaign-assets" existiert bereits.');
  } else {
    console.log(`❌ Bucket-Anlage fehlgeschlagen: ${error.message}`);
    ok = false;
  }
}

console.log(ok ? "\n🎉 Deploy-Schritt fertig." : "\nℹ️  Unvollstaendig — fehlende Werte oben in .env.local setzen, dann erneut: node scripts/deploy-schema.mjs");
process.exit(ok ? 0 : 1);
