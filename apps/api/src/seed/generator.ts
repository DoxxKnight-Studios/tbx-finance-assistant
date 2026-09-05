import {
  BALANCE_SHOWCASE,
  BANKS,
  BASELINE_OPENING_BALANCE_PAISE,
  CREDIT_AMOUNT_TIERS,
  CREDIT_DESCRIPTIONS,
  DATASET_END,
  DATASET_START,
  DEBIT_AMOUNT_TIERS,
  DEBIT_DESCRIPTIONS,
  DEMO_REFERENCE_COUNT,
  ENTITY_ID,
  PROGRAMS,
  RESERVED_MAX_TRANSACTION_PAISE,
  SEED,
  TOTAL_ACCOUNTS,
  TOTAL_CREDITS,
  TOTAL_DEBITS,
  AUGUST_SPIKE_TARGET_RATIO,
  type AmountTier,
} from "./data.js";
import {
  enumerateDays,
  enumerateMonths,
  formatTimestamp,
  QUARTER_END_MONTHS,
  type CalendarDay,
} from "./dates.js";
import { deterministicUuid } from "./ids.js";
import { paiseToDecimalString } from "./money.js";
import { apportion, createRng, nextInt, weightedIndex, shuffled, type Rng } from "./rng.js";

export interface BankRow {
  bank_code: string;
  bank_name: string;
}

export interface AccountRow {
  account_id: string;
  entity_id: string;
  account_number: string;
  program_id: number;
  available_balance: string;
  bank_code: string;
}

export interface TransactionRow {
  transaction_id: string;
  account_id: string;
  transaction_date: string;
  transaction_type: "credit" | "debit";
  description: string | null;
  transaction_amount: string;
  transaction_reference_id: string | null;
  utr_number: string | null;
}

export interface GeneratedSeed {
  banks: BankRow[];
  accounts: AccountRow[];
  transactions: TransactionRow[];
  /**
   * Opening balance (paise) used per account_id, kept only for
   * in-process verification (verify.ts) - never persisted, since the
   * official schema has no opening_balance column.
   */
  openingBalancePaiseByAccountId: Record<string, number>;
}

interface AccountPlan {
  index: number;
  accountId: string;
  bankCode: string;
  programId: number;
  accountNumber: string;
  activityWeight: number;
}

interface DraftTransaction {
  index: number;
  transactionId: string;
  accountIndex: number;
  bankCode: string;
  day: CalendarDay;
  hour: number;
  minute: number;
  second: number;
  microseconds: number;
  type: "credit" | "debit";
  amountPaise: number;
  description: string;
  referenceId: string;
  utrNumber: string | null;
}

const TRANSFER_PREFIXES = ["NEFT", "RTGS", "IMPS"];

function buildAccountPlans(rng: Rng): AccountPlan[] {
  // Bank assignment: sequential fill in the listed order (deterministic,
  // no randomness needed - the order of account creation is arbitrary).
  const bankOfIndex: string[] = [];
  const bankWeightOfIndex: number[] = [];
  for (const bank of BANKS) {
    for (let i = 0; i < bank.accountCount; i += 1) {
      bankOfIndex.push(bank.code);
      bankWeightOfIndex.push(bank.activityWeight);
    }
  }

  // Program assignment: walk a seeded shuffle of account indices so
  // program membership doesn't line up with the bank blocks above -
  // otherwise "HDFC" and "Program 21" could trivially become the same
  // subset of accounts instead of two independently-earned rankings.
  const shuffledIndices = shuffled(
    rng,
    Array.from({ length: TOTAL_ACCOUNTS }, (_, i) => i),
  );
  const programOfIndex: number[] = new Array(TOTAL_ACCOUNTS);
  const programWeightOfIndex: number[] = new Array(TOTAL_ACCOUNTS);
  let cursor = 0;
  for (const program of PROGRAMS) {
    for (let i = 0; i < program.accountCount; i += 1) {
      const accountIndex = shuffledIndices[cursor];
      programOfIndex[accountIndex] = program.id;
      programWeightOfIndex[accountIndex] = program.activityWeight;
      cursor += 1;
    }
  }

  // Account numbers: 14 digits total. A 10-digit index-derived prefix
  // already guarantees full-number uniqueness on its own; the last four
  // digits are additionally drawn without replacement from a shuffled
  // 0-9999 pool so they are ALSO guaranteed unique on their own, per the
  // "account ending 9069" lookup requirement.
  const last4Pool = shuffled(
    rng,
    Array.from({ length: 10_000 }, (_, i) => i),
  ).slice(0, TOTAL_ACCOUNTS);

  const plans: AccountPlan[] = [];
  for (let index = 0; index < TOTAL_ACCOUNTS; index += 1) {
    const prefix = `40${String(index).padStart(8, "0")}`;
    const last4 = String(last4Pool[index]).padStart(4, "0");

    plans.push({
      index,
      accountId: deterministicUuid(`account:${SEED}:${index}`),
      bankCode: bankOfIndex[index],
      programId: programOfIndex[index],
      accountNumber: `${prefix}${last4}`,
      activityWeight: bankWeightOfIndex[index] * programWeightOfIndex[index],
    });
  }

  return plans;
}

interface MonthWeight {
  key: { year: number; month: number };
  weight: number;
  days: CalendarDay[];
}

function buildMonthWeights(): MonthWeight[] {
  const months = enumerateMonths(
    { year: DATASET_START.year, month: DATASET_START.month },
    { year: DATASET_END.year, month: DATASET_END.month },
  );

  return months.map((key) => {
    const days = enumerateDays(
      key,
      { year: DATASET_END.year, month: DATASET_END.month, day: DATASET_END.day },
    );

    let weight = 0;
    for (const day of days) {
      let dayWeight = day.isWeekend ? 1 / 9 : 1; // ~90% weekday / ~10% weekend
      if (day.isMonthEndWindow) {
        dayWeight *= 1.5; // slightly elevated month-end activity
        if (QUARTER_END_MONTHS.has(key.month)) {
          dayWeight *= 1.25; // additional lift for quarter-end months
        }
      }
      weight += dayWeight;
    }

    return { key, weight, days };
  });
}

function pickDay(rng: Rng, months: MonthWeight[]): { month: MonthWeight; day: CalendarDay } {
  const monthIndex = weightedIndex(
    rng,
    months.map((m) => m.weight),
  );
  const month = months[monthIndex];

  const dayWeights = month.days.map((d) => {
    let w = d.isWeekend ? 1 / 9 : 1;
    if (d.isMonthEndWindow) {
      w *= 1.5;
      if (QUARTER_END_MONTHS.has(month.key.month)) w *= 1.25;
    }
    return w;
  });

  const day = month.days[weightedIndex(rng, dayWeights)];
  return { month, day };
}

function pickAmountPaise(rng: Rng, tiers: readonly AmountTier[]): number {
  const tier = tiers[weightedIndex(rng, tiers.map((t) => t.weight))];
  return nextInt(rng, tier.minPaise, tier.maxPaise);
}

function buildDescription(rng: Rng, type: "credit" | "debit", day: CalendarDay): string {
  const base = type === "debit"
    ? DEBIT_DESCRIPTIONS[nextInt(rng, 0, DEBIT_DESCRIPTIONS.length - 1)]
    : CREDIT_DESCRIPTIONS[nextInt(rng, 0, CREDIT_DESCRIPTIONS.length - 1)];

  const MONTH_ABBR = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];

  switch (nextInt(rng, 0, 2)) {
    case 0:
      return `${base} - ${MONTH_ABBR[day.month - 1]}${String(day.year).slice(2)}`;
    case 1:
      return `${base} REF${nextInt(rng, 100000, 999999)}`;
    default:
      return base;
  }
}

function isTransferDescription(description: string): boolean {
  return TRANSFER_PREFIXES.some((prefix) => description.startsWith(prefix));
}

function buildUtr(rng: Rng, bankCode: string, description: string): string | null {
  if (!isTransferDescription(description)) return null;
  // A meaningful subset gets a UTR; the rest legitimately stay NULL, even
  // among transfer-shaped descriptions - matching real-world statements
  // where not every NEFT/RTGS/IMPS line has a captured UTR.
  if (rng() >= 0.7) return null;

  let digits = "";
  for (let i = 0; i < 16; i += 1) digits += String(nextInt(rng, 0, 9));
  return `${bankCode}${digits}`;
}

function buildReference(index: number, day: CalendarDay, bankCode: string): string {
  const datePart = `${day.year}${String(day.month).padStart(2, "0")}${String(day.day).padStart(2, "0")}`;
  const seq = String(index + 1).padStart(6, "0");
  return `${bankCode}${datePart}${seq}`;
}

function generateOrdinaryTransactions(
  rng: Rng,
  accountPlans: AccountPlan[],
  months: MonthWeight[],
  type: "credit" | "debit",
  count: number,
  startIndex: number,
): DraftTransaction[] {
  const weights = accountPlans.map((a) => a.activityWeight);
  const perAccountCount = apportion(weights, count);
  const tiers = type === "debit" ? DEBIT_AMOUNT_TIERS : CREDIT_AMOUNT_TIERS;

  const drafts: DraftTransaction[] = [];
  let globalIndex = startIndex;

  for (const account of accountPlans) {
    const n = perAccountCount[account.index];
    for (let i = 0; i < n; i += 1) {
      const { day } = pickDay(rng, months);
      const hour = nextInt(rng, 8, 20);
      const minute = nextInt(rng, 0, 59);
      const second = nextInt(rng, 0, 59);
      const microseconds = nextInt(rng, 0, 999_999);
      const amountPaise = pickAmountPaise(rng, tiers);
      const description = buildDescription(rng, type, day);
      const utrNumber = buildUtr(rng, account.bankCode, description);
      const referenceId = buildReference(globalIndex, day, account.bankCode);

      drafts.push({
        index: globalIndex,
        transactionId: deterministicUuid(`transaction:${SEED}:${globalIndex}`),
        accountIndex: account.index,
        bankCode: account.bankCode,
        day,
        hour,
        minute,
        second,
        microseconds,
        type,
        amountPaise,
        description,
        referenceId,
        utrNumber,
      });

      globalIndex += 1;
    }
  }

  return drafts;
}

/**
 * Applies a deterministic, exact-by-construction correction so August
 * 2026's total debit spend lands within the approved "roughly 20-30%
 * higher than July 2026" band, rather than merely hoping realistic date
 * weighting happens to land there. Only August debit amounts are
 * rescaled; counts, dates, and every other month are untouched.
 *
 * Only tier-1/2/3 ("scalable") amounts are rescaled - tier-4 amounts are
 * left untouched, so a large already-near-the-cap August transaction can
 * never be inflated past RESERVED_MAX_TRANSACTION_PAISE and accidentally
 * overtake the one deliberately-reserved largest transaction.
 */
const SCALABLE_TIER_CEILING_PAISE = 50_000_000; // top of debit tier 3 (Rs 5,00,000)

function applyAugustSpikeCorrection(drafts: DraftTransaction[]): void {
  const isJuly2026Debit = (d: DraftTransaction) =>
    d.type === "debit" && d.day.year === 2026 && d.day.month === 7;
  const isAugust2026Debit = (d: DraftTransaction) =>
    d.type === "debit" && d.day.year === 2026 && d.day.month === 8;

  const julyTotal = drafts.filter(isJuly2026Debit).reduce((s, d) => s + d.amountPaise, 0);
  const augustDrafts = drafts.filter(isAugust2026Debit);
  if (augustDrafts.length === 0) {
    throw new Error("August 2026 has no debit transactions to apply the spike correction to.");
  }

  const scalable = augustDrafts.filter((d) => d.amountPaise <= SCALABLE_TIER_CEILING_PAISE);
  const fixed = augustDrafts.filter((d) => d.amountPaise > SCALABLE_TIER_CEILING_PAISE);
  const fixedSum = fixed.reduce((s, d) => s + d.amountPaise, 0);
  const scalableSum = scalable.reduce((s, d) => s + d.amountPaise, 0);

  const target = Math.round(julyTotal * AUGUST_SPIKE_TARGET_RATIO);
  const neededScalableSum = target - fixedSum;
  if (neededScalableSum <= 0 || scalableSum === 0) {
    throw new Error(
      "August spike correction has no room to scale into (tier-4 debits alone already meet the target).",
    );
  }
  const scale = neededScalableSum / scalableSum;

  for (const draft of scalable) {
    draft.amountPaise = Math.max(1, Math.round(draft.amountPaise * scale));
    if (draft.amountPaise > SCALABLE_TIER_CEILING_PAISE * 2) {
      throw new Error(
        `August spike correction scaled a transaction to an implausible amount (scale=${scale.toFixed(3)}).`,
      );
    }
  }
}

/** The one deliberately-largest transaction in the entire dataset. */
function buildReservedMaxTransaction(
  accountPlans: AccountPlan[],
  globalIndex: number,
): DraftTransaction {
  const hdfcAccount = accountPlans.find((a) => a.bankCode === "HDFC");
  if (!hdfcAccount) throw new Error("No HDFC account found for the reserved max transaction.");

  const day: CalendarDay = { year: 2026, month: 8, day: 14, isWeekend: false, isMonthEndWindow: false };
  const description = "NEFT - TAX PAYMENT";

  return {
    index: globalIndex,
    transactionId: deterministicUuid(`transaction:${SEED}:${globalIndex}`),
    accountIndex: hdfcAccount.index,
    bankCode: hdfcAccount.bankCode,
    day,
    hour: 11,
    minute: 15,
    second: 0,
    microseconds: 0,
    type: "debit",
    amountPaise: RESERVED_MAX_TRANSACTION_PAISE,
    description,
    referenceId: buildReference(globalIndex, day, hdfcAccount.bankCode),
    utrNumber: `${hdfcAccount.bankCode}0000000000000001`,
  };
}

function assignDemoReferences(drafts: DraftTransaction[]): void {
  const sortedByDate = drafts
    .slice()
    .sort((a, b) => {
      if (a.day.year !== b.day.year) return a.day.year - b.day.year;
      if (a.day.month !== b.day.month) return a.day.month - b.day.month;
      return a.day.day - b.day.day;
    });

  for (let i = 0; i < DEMO_REFERENCE_COUNT; i += 1) {
    const pos = Math.round((i * (sortedByDate.length - 1)) / (DEMO_REFERENCE_COUNT - 1));
    sortedByDate[pos].referenceId = `TXN-DEMO-${String(i + 1).padStart(6, "0")}`;
  }
}

export function generateSeed(): GeneratedSeed {
  const rng = createRng(SEED);

  const banks: BankRow[] = BANKS.map((b) => ({ bank_code: b.code, bank_name: b.name }));
  const accountPlans = buildAccountPlans(rng);
  const months = buildMonthWeights();

  // Reserve one debit slot for the deliberate dataset-wide-max transaction.
  const ordinaryDebits = generateOrdinaryTransactions(
    rng,
    accountPlans,
    months,
    "debit",
    TOTAL_DEBITS - 1,
    0,
  );
  const reservedMax = buildReservedMaxTransaction(accountPlans, ordinaryDebits.length);

  const credits = generateOrdinaryTransactions(
    rng,
    accountPlans,
    months,
    "credit",
    TOTAL_CREDITS,
    ordinaryDebits.length + 1,
  );

  const allDrafts = [...ordinaryDebits, reservedMax, ...credits];

  applyAugustSpikeCorrection(allDrafts);
  assignDemoReferences(allDrafts);

  // Per-account net effect (credits - debits, in paise) drives the final
  // available_balance; opening balances are back-solved against it below
  // and are never persisted (no such column exists in the official schema).
  const netEffectByAccount = new Array(TOTAL_ACCOUNTS).fill(0);
  for (const draft of allDrafts) {
    const signed = draft.type === "credit" ? draft.amountPaise : -draft.amountPaise;
    netEffectByAccount[draft.accountIndex] += signed;
  }

  const showcaseByIndex = new Map(BALANCE_SHOWCASE.map((s) => [s.accountIndex, s]));
  const openingBalanceByAccount = accountPlans.map((account) => {
    const showcase = showcaseByIndex.get(account.index);
    if (showcase) {
      return showcase.targetPaise - netEffectByAccount[account.index];
    }
    return BASELINE_OPENING_BALANCE_PAISE;
  });

  const accounts: AccountRow[] = accountPlans.map((account) => {
    const finalBalancePaise =
      openingBalanceByAccount[account.index] + netEffectByAccount[account.index];

    return {
      account_id: account.accountId,
      entity_id: ENTITY_ID,
      account_number: account.accountNumber,
      program_id: account.programId,
      available_balance: paiseToDecimalString(finalBalancePaise),
      bank_code: account.bankCode,
    };
  });

  const transactions: TransactionRow[] = allDrafts
    .sort((a, b) => a.index - b.index)
    .map((draft) => ({
      transaction_id: draft.transactionId,
      account_id: accountPlans[draft.accountIndex].accountId,
      transaction_date: formatTimestamp(draft.day, draft.hour, draft.minute, draft.second, draft.microseconds),
      transaction_type: draft.type,
      description: draft.description,
      transaction_amount: paiseToDecimalString(draft.amountPaise),
      transaction_reference_id: draft.referenceId,
      utr_number: draft.utrNumber,
    }));

  const openingBalancePaiseByAccountId: Record<string, number> = {};
  accountPlans.forEach((account) => {
    openingBalancePaiseByAccountId[account.accountId] = openingBalanceByAccount[account.index];
  });

  return { banks, accounts, transactions, openingBalancePaiseByAccountId };
}
