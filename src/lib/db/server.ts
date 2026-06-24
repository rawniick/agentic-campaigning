import { Pool, types as pgTypes } from "pg";
import type { Db } from "./types";

let pool: Pool | null = null;

// pg parst DATE/TIMESTAMP/TIMESTAMPTZ standardmaessig zu JS-Date-Objekten.
// Unsere Queries TYPISIEREN diese Spalten aber durchgaengig als `string` (und
// PGlite liefert sie in den Tests bereits als string). Ein Date-Objekt, das
// direkt in JSX landet (z.B. `{campaign.datum_von}` auf /campaigns/[id]), wirft
// React #31 ("Objects are not valid as a React child") — der Prod-Crash nach
// Brief-Submit. Wir zwingen pg, die Roh-Strings zu liefern, damit real-Postgres
// sich wie PGlite + die deklarierten Typen verhaelt. Kein Consumer macht Date-
// Mathematik auf diesen Spalten (nur SQL-seitig now()/ORDER BY) — daher sicher.
const PG_OID_DATE = 1082;
const PG_OID_TIMESTAMP = 1114;
const PG_OID_TIMESTAMPTZ = 1184;
const passthroughString = (v: string | null) => v;

let dateParsersConfigured = false;
export function configurePgDateAsString(): void {
  if (dateParsersConfigured) return;
  pgTypes.setTypeParser(PG_OID_DATE, passthroughString);
  pgTypes.setTypeParser(PG_OID_TIMESTAMP, passthroughString);
  pgTypes.setTypeParser(PG_OID_TIMESTAMPTZ, passthroughString);
  dateParsersConfigured = true;
}

// Singleton-pg-Pool. Verbindet auf DATABASE_URL (Supabase Postgres-URL,
// Session-Mode oder Pooler). Erfuellt das Db-Interface 1:1 — kein Adapter
// noetig, da pg.Pool.query() bereits {rows: T[]} liefert.
export function getDb(): Db {
  if (!pool) {
    // Vor der ersten Query registrieren — Parser sind prozessweit am pg-Modul.
    configurePgDateAsString();
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
