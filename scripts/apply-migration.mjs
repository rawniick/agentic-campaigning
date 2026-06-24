// Wendet EINE Migration aus supabase/migrations/ auf die Wingo-Prod-DB (kaqxw…) an.
// Liest DATABASE_URL aus .env.local zur Laufzeit (nie geloggt). Tolerant gegen
// "schon angelegt" (42P07 duplicate_table / 42701 duplicate_column), damit ein
// versehentlicher Re-Run nicht crasht.
//   Aufruf:  node scripts/apply-migration.mjs 017_gate_chat.sql
import fs from "fs";
import path from "path";
import pg from "pg";

const ROOT = process.cwd();
const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/apply-migration.mjs <migration-file.sql>");
  process.exit(1);
}

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
if (!DATABASE_URL || /PASTE_|YOUR-|xxxx|<.*>/i.test(DATABASE_URL)) {
  console.error("DATABASE_URL fehlt/Platzhalter in .env.local.");
  process.exit(1);
}

const sqlPath = path.join(ROOT, "supabase", "migrations", file);
const sql = fs.readFileSync(sqlPath, "utf-8");

const client = new pg.Client({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  await client.query(sql);
  console.log(`✅ Migration ${file} angewendet.`);
} catch (e) {
  if (e.code === "42P07" || e.code === "42701") {
    console.log(`✅ Migration ${file} bereits vorhanden (${e.code}) — übersprungen.`);
  } else {
    console.log(`❌ ${file} fehlgeschlagen: ${e.code ?? ""} ${String(e.message).split("\n")[0]}`);
    process.exitCode = 1;
  }
} finally {
  await client.end().catch(() => {});
}
