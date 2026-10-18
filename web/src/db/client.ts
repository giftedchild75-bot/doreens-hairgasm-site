/**
 * Database connection.
 *
 * - Production: DATABASE_URL=postgres://… (Supabase / Neon / any Postgres).
 * - Local dev without Postgres installed: DATABASE_URL=pglite:./.data/dev
 *   runs a real embedded Postgres (WASM) on disk.
 * - Tests: createTestDb() gives a fresh in-memory Postgres per suite.
 */
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { Pool } from "pg";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export { schema };

const MIGRATIONS = path.join(process.cwd(), "drizzle");

let dbPromise: Promise<Db> | null = null;

async function connect(url: string): Promise<Db> {
  if (url.startsWith("pglite:")) {
    const dir = url.slice("pglite:".length) || undefined;
    if (dir) fs.mkdirSync(path.dirname(path.resolve(dir)), { recursive: true });
    const client = new PGlite(dir);
    const db = drizzlePglite(client, { schema });
    // Local embedded DB: keep it migrated automatically.
    await migratePglite(db, { migrationsFolder: MIGRATIONS });
    // The PGlite and node-postgres drivers expose the same query builder API.
    return db as unknown as Db;
  }
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    ssl: url.includes("sslmode=disable") || url.includes("localhost") ? undefined : { rejectUnauthorized: false },
  });
  return drizzlePg(pool, { schema });
}

export function getDb(): Promise<Db> {
  if (!dbPromise) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");
    // Survive Next.js dev hot reloads without opening a new connection each time.
    const g = globalThis as unknown as { __dhDb?: Promise<Db> };
    dbPromise = g.__dhDb ??= connect(url);
  }
  return dbPromise;
}

/** Fresh, migrated in-memory Postgres — used by the test suite. */
export async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  const db = drizzlePglite(client, { schema });
  await migratePglite(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as Db;
}

/** Test hook: route getDb() to a specific database instance. */
export function setDbForTesting(db: Db) {
  dbPromise = Promise.resolve(db);
  (globalThis as unknown as { __dhDb?: Promise<Db> }).__dhDb = dbPromise;
}
