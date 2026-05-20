import { PGlite } from "@electric-sql/pglite";
import fs from "fs";
import path from "path";

// Spannt eine frische PGlite-Instanz auf und wendet alle Migrations aus
// supabase/migrations/ in Filename-Reihenfolge an. Liefert eine Db-kompatible
// Instanz zum Schreiben/Lesen von Tests.
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");

  if (!fs.existsSync(migrationsDir)) {
    return db;
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf-8");
    await db.exec(sql);
  }

  return db;
}
