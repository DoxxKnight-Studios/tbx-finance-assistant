import type { GeneratedSeed } from "./generator.js";
import { decimalStringToPaise } from "./money.js";
import {
  DATASET_END,
  DATASET_START,
  DEMO_REFERENCE_COUNT,
  RESERVED_MAX_TRANSACTION_PAISE,
} from "./data.js";

export interface SeedReport {
  bankCount: number;
  accountCount: number;
  transactionCount: number;
  debitCount: number;
  creditCount: number;
  julyDebitTotalPaise: number;
  augustDebitTotalPaise: number;
  augustOverJulyRatio: number;
  bankDebitTotals: Array<{ bankCode: string; totalPaise: number }>;
  programDebitTotals: Array<{ programId: number; totalPaise: number }>;
  largestTransaction: { transactionId: string; amountPaise: number };
  utrNullCount: number;
  utrPresentCount: number;
}

function fail(message: string): never {
  throw new Error(`Seed invariant violated: ${message}`);
}

/**
 * Re-checks every business rule from the Phase 3 spec against the
 * in-memory generated dataset before anything is written to the
 * database. Throws with a specific message on the first violation
 * found - a deterministic generator should never actually trip these,
 * but this is the safety net that would catch it if it did.
 */
export function verifyGeneratedSeed(seed: GeneratedSeed): SeedReport {
  const { banks, accounts, transactions, openingBalancePaiseByAccountId } = seed;

  if (banks.length !== 10) fail(`expected 10 banks, got ${banks.length}`);
  if (accounts.length !== 100) fail(`expected 100 accounts, got ${accounts.length}`);
  if (transactions.length !== 50_000) {
    fail(`expected 50000 transactions, got ${transactions.length}`);
  }

  const debits = transactions.filter((t) => t.transaction_type === "debit");
  const credits = transactions.filter((t) => t.transaction_type === "credit");
  if (debits.length !== 35_000) fail(`expected 35000 debits, got ${debits.length}`);
  if (credits.length !== 15_000) fail(`expected 15000 credits, got ${credits.length}`);
  if (debits.length + credits.length !== transactions.length) {
    fail("a transaction has a type other than credit/debit");
  }

  const bankCodes = new Set(banks.map((b) => b.bank_code));
  const accountIds = new Set(accounts.map((a) => a.account_id));

  for (const account of accounts) {
    if (!bankCodes.has(account.bank_code)) {
      fail(`account ${account.account_id} references unknown bank_code ${account.bank_code}`);
    }
  }

  const accountNumbers = new Set(accounts.map((a) => a.account_number));
  if (accountNumbers.size !== accounts.length) fail("duplicate account_number found");

  const last4s = new Set(accounts.map((a) => a.account_number.slice(-4)));
  if (last4s.size !== accounts.length) fail("duplicate account_number last-4 found");

  const transactionIds = new Set<string>();
  const references = new Set<string>();
  const startMs = Date.UTC(DATASET_START.year, DATASET_START.month - 1, DATASET_START.day);
  const endMs = Date.UTC(DATASET_END.year, DATASET_END.month - 1, DATASET_END.day, 23, 59, 59, 999);

  for (const txn of transactions) {
    if (!accountIds.has(txn.account_id)) {
      fail(`transaction ${txn.transaction_id} references unknown account_id ${txn.account_id}`);
    }
    if (transactionIds.has(txn.transaction_id)) {
      fail(`duplicate transaction_id ${txn.transaction_id}`);
    }
    transactionIds.add(txn.transaction_id);

    if (txn.transaction_reference_id) {
      if (references.has(txn.transaction_reference_id)) {
        fail(`duplicate transaction_reference_id ${txn.transaction_reference_id}`);
      }
      references.add(txn.transaction_reference_id);
    }

    const dateMs = Date.parse(`${txn.transaction_date.replace(" ", "T")}Z`);
    if (Number.isNaN(dateMs) || dateMs < startMs || dateMs > endMs) {
      fail(`transaction ${txn.transaction_id} has out-of-range date ${txn.transaction_date}`);
    }

    const amountPaise = decimalStringToPaise(txn.transaction_amount);
    if (amountPaise <= 0) {
      fail(`transaction ${txn.transaction_id} has a non-positive amount`);
    }
    if (!/^\d+\.\d{2}$/.test(txn.transaction_amount)) {
      fail(`transaction ${txn.transaction_id} amount is not 2-decimal: ${txn.transaction_amount}`);
    }
  }

  for (let i = 1; i <= DEMO_REFERENCE_COUNT; i += 1) {
    const ref = `TXN-DEMO-${String(i).padStart(6, "0")}`;
    if (!references.has(ref)) fail(`missing demo reference ${ref}`);
  }

  // Balance identity: available_balance === opening + credits - debits.
  const netByAccount = new Map<string, number>();
  for (const txn of transactions) {
    const amountPaise = decimalStringToPaise(txn.transaction_amount);
    const signed = txn.transaction_type === "credit" ? amountPaise : -amountPaise;
    netByAccount.set(txn.account_id, (netByAccount.get(txn.account_id) ?? 0) + signed);
  }
  for (const account of accounts) {
    const opening = openingBalancePaiseByAccountId[account.account_id];
    const net = netByAccount.get(account.account_id) ?? 0;
    const expected = opening + net;
    const actual = decimalStringToPaise(account.available_balance);
    if (expected !== actual) {
      fail(
        `account ${account.account_id} balance mismatch: expected ${expected}, got ${actual}`,
      );
    }
  }

  // July vs August 2026 debit spend.
  const julyDebitTotalPaise = debits
    .filter((t) => t.transaction_date.startsWith("2026-07"))
    .reduce((s, t) => s + decimalStringToPaise(t.transaction_amount), 0);
  const augustDebitTotalPaise = debits
    .filter((t) => t.transaction_date.startsWith("2026-08"))
    .reduce((s, t) => s + decimalStringToPaise(t.transaction_amount), 0);
  const augustOverJulyRatio = augustDebitTotalPaise / julyDebitTotalPaise;
  if (augustOverJulyRatio < 1.2 || augustOverJulyRatio > 1.3) {
    fail(
      `August/July debit ratio ${augustOverJulyRatio.toFixed(3)} is outside the 1.20-1.30 target band`,
    );
  }

  // Bank and program debit rankings.
  const accountById = new Map(accounts.map((a) => [a.account_id, a]));
  const bankDebitTotalsMap = new Map<string, number>();
  const programDebitTotalsMap = new Map<number, number>();
  for (const txn of debits) {
    const account = accountById.get(txn.account_id)!;
    const amountPaise = decimalStringToPaise(txn.transaction_amount);
    bankDebitTotalsMap.set(
      account.bank_code,
      (bankDebitTotalsMap.get(account.bank_code) ?? 0) + amountPaise,
    );
    programDebitTotalsMap.set(
      account.program_id,
      (programDebitTotalsMap.get(account.program_id) ?? 0) + amountPaise,
    );
  }

  const bankDebitTotals = [...bankDebitTotalsMap.entries()]
    .map(([bankCode, totalPaise]) => ({ bankCode, totalPaise }))
    .sort((a, b) => b.totalPaise - a.totalPaise);
  if (bankDebitTotals[0].bankCode !== "HDFC") {
    fail(`expected HDFC to lead bank debit spend, got ${bankDebitTotals[0].bankCode}`);
  }

  const programDebitTotals = [...programDebitTotalsMap.entries()]
    .map(([programId, totalPaise]) => ({ programId, totalPaise }))
    .sort((a, b) => b.totalPaise - a.totalPaise);
  if (programDebitTotals[0].programId !== 21) {
    fail(`expected program 21 to lead program debit spend, got ${programDebitTotals[0].programId}`);
  }

  // Exactly one largest transaction (no ties).
  const sortedByAmount = transactions
    .map((t) => ({ transactionId: t.transaction_id, amountPaise: decimalStringToPaise(t.transaction_amount) }))
    .sort((a, b) => b.amountPaise - a.amountPaise);
  if (sortedByAmount[0].amountPaise === sortedByAmount[1].amountPaise) {
    fail("largest transaction amount is tied with another transaction");
  }
  if (sortedByAmount[0].amountPaise !== RESERVED_MAX_TRANSACTION_PAISE) {
    fail(
      `the deliberately-reserved transaction is no longer the dataset's largest ` +
        `(actual max ${sortedByAmount[0].amountPaise} paise, reserved ${RESERVED_MAX_TRANSACTION_PAISE} paise)`,
    );
  }

  const utrPresentCount = transactions.filter((t) => t.utr_number !== null).length;
  const utrNullCount = transactions.length - utrPresentCount;
  if (utrPresentCount === 0 || utrNullCount === 0) {
    fail("expected both NULL and non-NULL utr_number values");
  }

  return {
    bankCount: banks.length,
    accountCount: accounts.length,
    transactionCount: transactions.length,
    debitCount: debits.length,
    creditCount: credits.length,
    julyDebitTotalPaise,
    augustDebitTotalPaise,
    augustOverJulyRatio,
    bankDebitTotals,
    programDebitTotals,
    largestTransaction: sortedByAmount[0],
    utrNullCount,
    utrPresentCount,
  };
}
