import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
export type { PoolClient } from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: '-c timezone=UTC',
  connectionTimeoutMillis: 2000, query_timeout: 6000 });
// Idle-client failures must not crash the process or disclose connection details.
// Request errors and /readyz still report the database as unavailable.
pool.on("error", () => { console.error("Database connection unavailable"); });
export const db = drizzle(pool, { schema });

export * from "./schema";
