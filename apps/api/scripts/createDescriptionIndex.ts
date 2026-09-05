import { Pool } from "pg";
import { env } from "../src/config/env.js";

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: env.databaseUrl, max: 1 });

  try {
    await pool.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    await pool.query(`
      CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transaction_description_trgm
      ON "transaction" USING gin (lower(description) gin_trgm_ops)
    `);
    await pool.query('ANALYZE "transaction"');
    console.log("Description similarity index is ready.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
