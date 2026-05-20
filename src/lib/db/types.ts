// Minimaler Postgres-Adapter-Contract. Erfuellbar von:
// - `pg` Pool/Client (Production via Supabase Postgres connection string)
// - `@electric-sql/pglite` PGlite (Tests, In-Memory-Postgres)

export interface QueryResult<T> {
  rows: T[];
}

export interface Db {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
  ): Promise<QueryResult<T>>;
}
