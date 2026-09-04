import { Pool, type PoolClient } from "pg";

import type {
  AccountSeed,
  ReconciliationSeed,
  TransactionSeed,
  VendorSeed,
} from "./generator";

const BATCH_SIZE = 1000;

export function createPool(): Pool {
  const databaseUrl =
    process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is required.",
    );
  }

  return new Pool({
    connectionString: databaseUrl,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

function buildValues(
  rows: readonly unknown[][],
): {
  sql: string;
  values: unknown[];
} {
  const values: unknown[] = [];

  const placeholders = rows.map(
    (row, rowIndex) => {
      const rowPlaceholders =
        row.map((_, columnIndex) => {
          values.push(
            row[columnIndex],
          );

          return `$${values.length}`;
        });

      return `(${rowPlaceholders.join(", ")})`;
    },
  );

  return {
    sql: placeholders.join(", "),
    values,
  };
}

async function insertVendors(
  client: PoolClient,
  vendors: VendorSeed[],
): Promise<void> {
  for (
    let start = 0;
    start < vendors.length;
    start += BATCH_SIZE
  ) {
    const batch = vendors.slice(
      start,
      start + BATCH_SIZE,
    );

    const { sql, values } =
      buildValues(
        batch.map((vendor) => [
          vendor.id,
          vendor.vendorCode,
          vendor.name,
          vendor.category,
          vendor.status,
          vendor.createdAt,
        ]),
      );

    await client.query(
      `
      INSERT INTO vendors (
        id,
        vendor_code,
        name,
        category,
        status,
        created_at
      )
      VALUES ${sql}
      ON CONFLICT (vendor_code)
      DO UPDATE SET
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        status = EXCLUDED.status
      `,
      values,
    );
  }
}

async function insertAccounts(
  client: PoolClient,
  accounts: AccountSeed[],
): Promise<void> {
  /*
   * Parent accounts must exist before children.
   * ACCOUNTS is already ordered appropriately, but
   * inserting one batch is still safe because all
   * referenced parent IDs are in the same statement.
   */
  const { sql, values } =
    buildValues(
      accounts.map((account) => [
        account.id,
        account.accountCode,
        account.name,
        account.accountType,
        account.parentAccountId,
        account.currency,
        account.status,
      ]),
    );

  await client.query(
    `
    INSERT INTO accounts (
      id,
      account_code,
      name,
      account_type,
      parent_account_id,
      currency,
      status
    )
    VALUES ${sql}
    ON CONFLICT (account_code)
    DO UPDATE SET
      name = EXCLUDED.name,
      account_type = EXCLUDED.account_type,
      parent_account_id = EXCLUDED.parent_account_id,
      currency = EXCLUDED.currency,
      status = EXCLUDED.status
    `,
    values,
  );
}

async function deletePreviousSeedTransactions(
  client: PoolClient,
): Promise<number> {
  const result = await client.query(
    `
    DELETE FROM transactions
    WHERE transaction_reference LIKE 'SEED-%'
       OR transaction_reference LIKE 'TEST-%'
    `,
  );

  return result.rowCount ?? 0;
}

async function insertTransactions(
  client: PoolClient,
  transactions: TransactionSeed[],
  onProgress?: (completed: number) => void,
): Promise<void> {
  for (
    let start = 0;
    start < transactions.length;
    start += BATCH_SIZE
  ) {
    const batch = transactions.slice(
      start,
      start + BATCH_SIZE,
    );

    const { sql, values } =
      buildValues(
        batch.map((transaction) => [
          transaction.id,
          transaction.reference,
          transaction.date,
          transaction.vendorId,
          transaction.accountId,
          transaction.amount,
          transaction.currency,
          transaction.transactionType,
          transaction.category,
          transaction.status,
          transaction.description,
          transaction.createdAt,
        ]),
      );

    await client.query(
      `
      INSERT INTO transactions (
        id,
        transaction_reference,
        transaction_date,
        vendor_id,
        account_id,
        amount,
        currency,
        transaction_type,
        category,
        status,
        description,
        created_at
      )
      VALUES ${sql}
      `,
      values,
    );

    onProgress?.(
      Math.min(
        start + batch.length,
        transactions.length,
      ),
    );
  }
}

async function insertReconciliations(
  client: PoolClient,
  reconciliations: ReconciliationSeed[],
): Promise<void> {
  for (
    let start = 0;
    start < reconciliations.length;
    start += BATCH_SIZE
  ) {
    const batch =
      reconciliations.slice(
        start,
        start + BATCH_SIZE,
      );

    const { sql, values } =
      buildValues(
        batch.map((reconciliation) => [
          reconciliation.id,
          reconciliation.transactionId,
          reconciliation.status,
          reconciliation.reconciledAmount,
          reconciliation.reconciledAt,
          reconciliation.reconciliationRef,
          reconciliation.differenceAmount,
          reconciliation.notes,
        ]),
      );

    await client.query(
      `
      INSERT INTO reconciliations (
        id,
        transaction_id,
        status,
        reconciled_amount,
        reconciled_at,
        reconciliation_ref,
        difference_amount,
        notes
      )
      VALUES ${sql}
      `,
      values,
    );
  }
}

export interface SeedResult {
  deletedPreviousTransactions: number;
  vendorCount: number;
  accountCount: number;
  transactionCount: number;
  reconciliationCount: number;
}

export async function seedDatabase(
  vendors: VendorSeed[],
  accounts: AccountSeed[],
  transactions: TransactionSeed[],
  reconciliations: ReconciliationSeed[],
  onProgress?: (completed: number, total: number) => void,
): Promise<SeedResult> {
  const pool = createPool();

  const client =
    await pool.connect();

  try {
    await client.query("BEGIN");

    const deleted =
      await deletePreviousSeedTransactions(
        client,
      );

    await insertVendors(
      client,
      vendors,
    );

    await insertAccounts(
      client,
      accounts,
    );

    await insertTransactions(
      client,
      transactions,
      (completed) => {
        onProgress?.(
          completed,
          transactions.length,
        );
      },
    );

    await insertReconciliations(
      client,
      reconciliations,
    );

    /*
     * Verify the critical invariant before committing:
     * exactly one reconciliation per generated transaction.
     */
    const invariant =
      await client.query<{
        transaction_count: string;
        reconciliation_count: string;
      }>(
        `
        SELECT
          COUNT(t.id)::text AS transaction_count,
          COUNT(r.id)::text AS reconciliation_count
        FROM transactions t
        LEFT JOIN reconciliations r
          ON r.transaction_id = t.id
        WHERE t.transaction_reference LIKE 'SEED-%'
           OR t.transaction_reference LIKE 'TEST-%'
        `,
      );

    const transactionCount = Number(
      invariant.rows[0].transaction_count,
    );

    const reconciliationCount =
      Number(
        invariant.rows[0]
          .reconciliation_count,
      );

    if (
      transactionCount !==
        transactions.length ||
      reconciliationCount !==
        transactions.length
    ) {
      throw new Error(
        `Seed invariant failed: ${transactionCount} transactions and ${reconciliationCount} reconciliations for ${transactions.length} generated transactions.`,
      );
    }

    await client.query("COMMIT");

    return {
      deletedPreviousTransactions:
        deleted,
      vendorCount: vendors.length,
      accountCount: accounts.length,
      transactionCount,
      reconciliationCount,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}