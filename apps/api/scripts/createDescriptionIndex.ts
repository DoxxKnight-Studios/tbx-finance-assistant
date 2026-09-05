import mysql from "mysql2/promise";
import { env } from "../src/config/env.js";

async function main(): Promise<void> {
  const pool = mysql.createPool(env.databaseUrl);

  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM information_schema.statistics
       WHERE table_schema = DATABASE()
         AND table_name = 'transaction'
         AND index_name = 'idx_transaction_description_fulltext'`,
    );
    const existing = Number((rows as Array<{ count: number }>)[0]?.count ?? 0);
    if (existing === 0) {
      await pool.query(
        "ALTER TABLE `transaction` ADD FULLTEXT INDEX idx_transaction_description_fulltext (description)",
      );
    }
    console.log("MySQL description FULLTEXT index is ready.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
