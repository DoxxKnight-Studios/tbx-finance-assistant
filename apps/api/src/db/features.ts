import { pool } from "./client.js";

/** Enables extensions required by query templates. Index creation stays in the
 * explicit migration command because CREATE INDEX CONCURRENTLY is operational work. */
export async function ensureDatabaseFeatures(): Promise<void> {
  await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
}
