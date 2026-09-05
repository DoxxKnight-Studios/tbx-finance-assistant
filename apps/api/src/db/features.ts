import { pool } from "./client.js";

export type DescriptionSearchMode = "fulltext" | "like";

let descriptionSearchMode: DescriptionSearchMode = "fulltext";

export function getDescriptionSearchMode(): DescriptionSearchMode {
  return descriptionSearchMode;
}

/** Detect optional MySQL indexes without requiring ALTER privileges. */
export async function ensureDatabaseFeatures(): Promise<void> {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS count
     FROM information_schema.statistics
     WHERE table_schema = DATABASE()
       AND table_name = 'transaction'
       AND index_name = 'idx_transaction_description_fulltext'`,
  );

  const count = Number((rows as Array<{ count: number }>)[0]?.count ?? 0);
  descriptionSearchMode = count > 0 ? "fulltext" : "like";

  if (descriptionSearchMode === "like") {
    console.warn(
      "FULLTEXT index idx_transaction_description_fulltext is unavailable; using LIKE fallback for description search.",
    );
  }
}
