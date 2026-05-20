import { Pool } from "pg";
import type { Db } from "./types";

let pool: Pool | null = null;

// Singleton-pg-Pool. Verbindet auf DATABASE_URL (Supabase Postgres-URL,
// Session-Mode oder Pooler). Erfuellt das Db-Interface 1:1 — kein Adapter
// noetig, da pg.Pool.query() bereits {rows: T[]} liefert.
export function getDb(): Db {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL ist nicht gesetzt — siehe .env.example fuer Supabase Postgres-URL"
      );
    }
    pool = new Pool({
      connectionString: url,
      // Supabase erzwingt SSL
      ssl: url.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}
