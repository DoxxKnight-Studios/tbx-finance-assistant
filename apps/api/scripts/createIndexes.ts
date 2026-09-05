import { Pool } from "pg";
import { env } from "../src/config/env.js";

const INDEX_STATEMENTS = [
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_amount
   ON transactions (amount)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_date
   ON transactions (transaction_date)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_vendor
   ON transactions (vendor_id)`,
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_category
   ON transactions (category)`,
] as const;

async function main(): Promise<void> {
  const pool = new Pool({
    connectionString: env.databaseUrl,
    max: 1,
  });

  try {
    for (const statement of INDEX_STATEMENTS) {
      console.log(`Applying ${statement.split("\n")[0].trim()}...`);
      await pool.query(statement);
    }

    await pool.query("ANALYZE transactions");
    console.log("Transaction indexes are ready and statistics were refreshed.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
