/** Applies SQL migrations in ./drizzle to DATABASE_URL (Postgres or pglite:). */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { getDb } from "../src/db/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
if (url.startsWith("pglite:")) {
  await getDb(); // the embedded DB migrates itself on connect
} else {
  const pool = new Pool({ connectionString: url, ssl: url.includes("localhost") ? undefined : { rejectUnauthorized: false } });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
}
console.log("Migrations applied.");
process.exit(0);
