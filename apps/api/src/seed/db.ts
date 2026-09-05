import { pool, type DatabaseConnection } from "../db/client.js";
import type { AccountRow, BankRow, GeneratedSeed, TransactionRow } from "./generator.js";

const BATCH_SIZE = 1000;

function buildValuesClause(rows: readonly unknown[][]): { sql: string; values: unknown[] } {
  const values: unknown[] = [];
  const placeholders = rows.map((row) => {
    const rowPlaceholders = row.map((value) => {
      values.push(value);
      return "?";
    });
    return `(${rowPlaceholders.join(", ")})`;
  });
  return { sql: placeholders.join(", "), values };
}

async function insertBanks(client: DatabaseConnection, banks: BankRow[]): Promise<void> {
  const { sql, values } = buildValuesClause(banks.map((b) => [b.bank_code, b.bank_name]));
  await client.query(
    `INSERT INTO bank (bank_code, bank_name) VALUES ${sql}`,
    values,
  );
}

async function insertAccounts(client: DatabaseConnection, accounts: AccountRow[]): Promise<void> {
  for (let start = 0; start < accounts.length; start += BATCH_SIZE) {
    const batch = accounts.slice(start, start + BATCH_SIZE);
    const { sql, values } = buildValuesClause(
      batch.map((a) => [
        a.account_id,
        a.entity_id,
        a.account_number,
        a.program_id,
        a.available_balance,
        a.bank_code,
      ]),
    );

    await client.query(
      `
      INSERT INTO account (
        account_id, entity_id, account_number, program_id, available_balance, bank_code
      )
      VALUES ${sql}
      `,
      values,
    );
  }
}

async function insertTransactions(client: DatabaseConnection, transactions: TransactionRow[]): Promise<void> {
  for (let start = 0; start < transactions.length; start += BATCH_SIZE) {
    const batch = transactions.slice(start, start + BATCH_SIZE);
    const { sql, values } = buildValuesClause(
      batch.map((t) => [
        t.transaction_id,
        t.account_id,
        t.transaction_date,
        t.transaction_type,
        t.description,
        t.transaction_amount,
        t.transaction_reference_id,
        t.utr_number,
      ]),
    );

    await client.query(
      `
      INSERT INTO \`transaction\` (
        transaction_id, account_id, transaction_date, transaction_type,
        description, transaction_amount, transaction_reference_id, utr_number
      )
      VALUES ${sql}
      `,
      values,
    );
  }
}

/**
 * Wipes and repopulates the three official tables inside one database
 * transaction: if anything fails, ROLLBACK leaves the previous state
 * (or an empty database) untouched rather than a half-seeded one.
 * Running this twice with the same GeneratedSeed is idempotent - it
 * always replaces, never appends.
 */
export async function seedDatabase(seed: GeneratedSeed): Promise<void> {
  const client = await pool.getConnection();

  try {
    await client.beginTransaction();

    await client.query("SET FOREIGN_KEY_CHECKS = 0");
    await client.query("TRUNCATE TABLE `transaction`");
    await client.query("TRUNCATE TABLE account");
    await client.query("TRUNCATE TABLE bank");
    await client.query("SET FOREIGN_KEY_CHECKS = 1");

    await insertBanks(client, seed.banks);
    await insertAccounts(client, seed.accounts);
    await insertTransactions(client, seed.transactions);

    await client.commit();
  } catch (error) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
}
