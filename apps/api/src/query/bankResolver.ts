import { query } from "../db/client.js";

export interface ResolvedBank {
  code: string;
  name: string;
}

export type BankResolution =
  | {
      status: "resolved";
      bank: ResolvedBank;
    }
  | {
      status: "not_found";
      input: string;
    }
  | {
      status: "ambiguous";
      input: string;
      candidates: ResolvedBank[];
    };

interface BankRow extends Record<string, unknown> {
  bank_code: string;
  bank_name: string;
}

function normalizeBankInput(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function mapBank(row: BankRow): ResolvedBank {
  return {
    code: row.bank_code,
    name: row.bank_name,
  };
}

/**
 * Resolves a natural-language bank reference (a code like "HDFC" or a
 * name like "HDFC Bank Limited") against the `bank` table - the runtime
 * source of truth. Never fuzzy-picks a "closest" bank: exactly one match
 * resolves, zero matches is not_found, more than one is ambiguous and
 * left for the caller to clarify.
 */
export async function resolveBank(input: string): Promise<BankResolution> {
  const normalizedInput = normalizeBankInput(input);

  if (!normalizedInput) {
    return {
      status: "not_found",
      input,
    };
  }

  /*
   * Step 1:
   * Exact bank_code match. bank_code is the table's primary key, so this
   * can only ever return 0 or 1 rows.
   */
  const codeRows = await query<BankRow>(
    `
    SELECT bank_code, bank_name
    FROM bank
    WHERE LOWER(TRIM(bank_code)) = $1
    LIMIT 1
    `,
    [normalizedInput],
  );

  if (codeRows.length === 1) {
    return {
      status: "resolved",
      bank: mapBank(codeRows[0]),
    };
  }

  /*
   * Step 2:
   * Exact case-insensitive bank_name match.
   *
   * Example:
   * "hdfc bank limited" should resolve to "HDFC BANK LIMITED".
   */
  const exactNameRows = await query<BankRow>(
    `
    SELECT bank_code, bank_name
    FROM bank
    WHERE LOWER(TRIM(bank_name)) = $1
    ORDER BY bank_name
    LIMIT 10
    `,
    [normalizedInput],
  );

  if (exactNameRows.length === 1) {
    return {
      status: "resolved",
      bank: mapBank(exactNameRows[0]),
    };
  }

  if (exactNameRows.length > 1) {
    return {
      status: "ambiguous",
      input,
      candidates: exactNameRows.map(mapBank),
    };
  }

  /*
   * Step 3:
   * Conservative prefix matching on bank_name.
   *
   * Example:
   * "HDFC BANK" should resolve to "HDFC BANK LIMITED".
   *
   * This is intentionally NOT a fuzzy "pick the closest bank" strategy -
   * it returns every plausible candidate and lets the caller ask for
   * clarification when there's more than one.
   */
  const prefixRows = await query<BankRow>(
    `
    SELECT bank_code, bank_name
    FROM bank
    WHERE LOWER(bank_name) LIKE $1
    ORDER BY bank_name
    LIMIT 10
    `,
    [`${normalizedInput}%`],
  );

  if (prefixRows.length === 1) {
    return {
      status: "resolved",
      bank: mapBank(prefixRows[0]),
    };
  }

  if (prefixRows.length > 1) {
    return {
      status: "ambiguous",
      input,
      candidates: prefixRows.map(mapBank),
    };
  }

  return {
    status: "not_found",
    input,
  };
}
