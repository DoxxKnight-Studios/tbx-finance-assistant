import { query } from "../db/client.js";

export interface ResolvedAccount {
  accountId: string;
  last4: string;
  bankCode: string;
  programId: number;
}

export type AccountResolution =
  | {
      status: "resolved";
      account: ResolvedAccount;
    }
  | {
      status: "not_found";
      input: string;
    }
  | {
      status: "ambiguous";
      input: string;
      candidates: ResolvedAccount[];
    };

interface AccountLast4Row extends Record<string, unknown> {
  account_id: string;
  last4: string;
  bank_code: string;
  program_id: number;
}

const LAST4_PATTERN = /^\d{4}$/;

function mapAccount(row: AccountLast4Row): ResolvedAccount {
  return {
    accountId: row.account_id,
    last4: row.last4,
    bankCode: row.bank_code,
    programId: row.program_id,
  };
}

/**
 * Resolves an account by the last 4 digits of its account_number -
 * account_number itself is sensitive and must never be exposed. The
 * query selects RIGHT(account_number, 4) rather than account_number
 * itself, so the full number never leaves Postgres, let alone this
 * function; utr_number isn't selected either (it lives on "transaction",
 * which this query never joins).
 *
 * The synthetic dataset's last4 values are unique by construction, so a
 * normal lookup resolves to exactly one account - but the schema doesn't
 * enforce that uniqueness, so ambiguous is still a real, handled outcome
 * rather than an assumption.
 */
export async function resolveAccountByLast4(last4: string): Promise<AccountResolution> {
  const normalized = last4.trim();

  if (!LAST4_PATTERN.test(normalized)) {
    return {
      status: "not_found",
      input: last4,
    };
  }

  const rows = await query<AccountLast4Row>(
    `
    SELECT
      account_id,
      RIGHT(account_number, 4) AS last4,
      bank_code,
      program_id
    FROM account
    WHERE account_number LIKE $1
    ORDER BY account_id
    LIMIT 10
    `,
    [`%${normalized}`],
  );

  if (rows.length === 0) {
    return {
      status: "not_found",
      input: last4,
    };
  }

  if (rows.length === 1) {
    return {
      status: "resolved",
      account: mapAccount(rows[0]),
    };
  }

  return {
    status: "ambiguous",
    input: last4,
    candidates: rows.map(mapAccount),
  };
}
