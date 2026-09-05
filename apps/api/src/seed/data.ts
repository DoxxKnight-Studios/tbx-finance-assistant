import { deterministicUuid } from "./ids.js";

/**
 * Single deterministic seed constant. Every random draw in the generator
 * flows from an Rng created from this value (directly, or via a
 * label-derived variant) - changing it produces a different but still
 * fully reproducible dataset.
 */
export const SEED = 20260905;

export const COMPANY_NAME = "Northstar Technologies Pvt. Ltd.";

/**
 * The dataset represents exactly one company. There is no entity table
 * (per the official schema), so every account shares this single
 * deterministic entity_id.
 */
export const ENTITY_ID = deterministicUuid(`northstar-entity:${SEED}`);

export interface BankSeed {
  code: string;
  name: string;
  accountCount: number;
  /** Relative per-account transaction-volume weight (1.0 = baseline). */
  activityWeight: number;
}

/**
 * Account counts sum to exactly 100. HDFC's activityWeight is boosted
 * so that, combined with already having the most accounts (18), its
 * total debit spend deterministically leads all other banks by a
 * plausible (not absurd) margin - see generator.ts.
 */
export const BANKS: readonly BankSeed[] = [
  { code: "HDFC", name: "HDFC BANK LIMITED", accountCount: 18, activityWeight: 1.15 },
  { code: "ICIC", name: "ICICI BANK LIMITED", accountCount: 15, activityWeight: 1.0 },
  { code: "SBIN", name: "STATE BANK OF INDIA", accountCount: 13, activityWeight: 1.0 },
  { code: "UTIB", name: "AXIS BANK LIMITED", accountCount: 12, activityWeight: 1.0 },
  { code: "KKBK", name: "KOTAK MAHINDRA BANK LIMITED", accountCount: 10, activityWeight: 1.0 },
  { code: "CNRB", name: "CANARA BANK", accountCount: 9, activityWeight: 1.0 },
  { code: "UBIN", name: "UNION BANK OF INDIA", accountCount: 8, activityWeight: 1.0 },
  { code: "AUBL", name: "AU SMALL FINANCE BANK LIMITED", accountCount: 6, activityWeight: 1.0 },
  { code: "TMBL", name: "TAMILNAD MERCANTILE BANK LIMITED", accountCount: 5, activityWeight: 1.0 },
  { code: "RATN", name: "RBL BANK LIMITED", accountCount: 4, activityWeight: 1.0 },
] as const;

export interface ProgramSeed {
  id: number;
  accountCount: number;
  activityWeight: number;
}

/**
 * Account counts sum to exactly 100. Program 21's activityWeight is
 * boosted the same way HDFC's is, so it deterministically leads all
 * other programs in debit spend.
 */
export const PROGRAMS: readonly ProgramSeed[] = [
  { id: 21, accountCount: 28, activityWeight: 1.15 },
  { id: 4, accountCount: 24, activityWeight: 1.0 },
  { id: 46, accountCount: 20, activityWeight: 1.0 },
  { id: 33, accountCount: 16, activityWeight: 1.0 },
  { id: 58, accountCount: 12, activityWeight: 1.0 },
] as const;

export const DATASET_START = { year: 2025, month: 1, day: 1 } as const;
export const DATASET_END = { year: 2026, month: 8, day: 31 } as const;

export const TOTAL_ACCOUNTS = 100;
export const TOTAL_TRANSACTIONS = 50_000;
export const TOTAL_DEBITS = 35_000;
export const TOTAL_CREDITS = 15_000;
export const DEMO_REFERENCE_COUNT = 20;

/** Midpoint of the approved "roughly 20-30% higher" August-vs-July target. */
export const AUGUST_SPIKE_TARGET_RATIO = 1.25;

export const DEBIT_DESCRIPTIONS = [
  "NEFT - OFFICE RENT",
  "NEFT - SALARY DISBURSEMENT",
  "UPI - BUSINESS TRAVEL",
  "IMPS - UTILITY PAYMENT",
  "NEFT - SOFTWARE SUBSCRIPTION",
  "CARD PAYMENT - OFFICE EXPENSE",
  "NEFT - TAX PAYMENT",
  "UPI - BUSINESS SERVICES",
  "NEFT - INSURANCE PREMIUM",
  "ATM CASH WITHDRAWAL",
  "BANK CHARGES",
  "CHEQUE PAYMENT",
] as const;

export const CREDIT_DESCRIPTIONS = [
  "NEFT - CUSTOMER RECEIPT",
  "RTGS - CLIENT PAYMENT",
  "IMPS - REFUND",
  "NEFT - BUSINESS RECEIPT",
  "UPI - CUSTOMER COLLECTION",
  "INTEREST CREDIT",
  "REFUND - CARD TRANSACTION",
  "CHEQUE DEPOSIT",
] as const;

export interface AmountTier {
  weight: number;
  minPaise: number;
  maxPaise: number;
}

/**
 * Ordinary (non-reserved) amount tiers. The top tier's maxPaise is
 * deliberately capped just under RESERVED_MAX_TRANSACTION_PAISE so no
 * randomly-drawn amount can ever equal or exceed the one deliberately
 * reserved largest-transaction-in-the-dataset value.
 */
export const RESERVED_MAX_TRANSACTION_PAISE = 500_000_000; // Rs 50,00,000.00
const ORDINARY_TIER_CAP_PAISE = RESERVED_MAX_TRANSACTION_PAISE - 100; // Rs 49,99,999.00

export const DEBIT_AMOUNT_TIERS: readonly AmountTier[] = [
  { weight: 0.45, minPaise: 10_000, maxPaise: 500_000 }, // Rs 100 - Rs 5,000
  { weight: 0.40, minPaise: 500_100, maxPaise: 5_000_000 }, // Rs 5,001 - Rs 50,000
  { weight: 0.13, minPaise: 5_000_100, maxPaise: 50_000_000 }, // Rs 50,001 - Rs 5,00,000
  { weight: 0.02, minPaise: 50_000_100, maxPaise: ORDINARY_TIER_CAP_PAISE }, // Rs 5,00,001 - ~Rs 49,99,999
] as const;

export const CREDIT_AMOUNT_TIERS: readonly AmountTier[] = [
  { weight: 0.20, minPaise: 50_000, maxPaise: 1_000_000 }, // Rs 500 - Rs 10,000
  { weight: 0.45, minPaise: 1_000_100, maxPaise: 10_000_000 }, // Rs 10,001 - Rs 1,00,000
  { weight: 0.30, minPaise: 10_000_100, maxPaise: 100_000_000 }, // Rs 1,00,001 - Rs 10,00,000
  { weight: 0.05, minPaise: 100_000_100, maxPaise: ORDINARY_TIER_CAP_PAISE }, // Rs 10,00,001 - ~Rs 49,99,999
] as const;

/**
 * Five accounts whose opening balance is deliberately back-solved (see
 * generator.ts) so the final available_balance lands on these exact
 * targets, guaranteeing the required balance-bucket variety rather than
 * leaving it to chance. Indices are spread across five different banks.
 */
export interface BalanceShowcase {
  accountIndex: number;
  label: string;
  targetPaise: number;
}

export const BALANCE_SHOWCASE: readonly BalanceShowcase[] = [
  { accountIndex: 0, label: "strong_positive", targetPaise: 850_000_000 }, // Rs 85,00,000.00 (HDFC)
  { accountIndex: 25, label: "moderate_positive", targetPaise: 35_000_000 }, // Rs 3,50,000.00 (ICIC)
  { accountIndex: 50, label: "near_zero", targetPaise: 125_000 }, // Rs 1,250.00 (UTIB)
  { accountIndex: 75, label: "negative", targetPaise: -27_500_000 }, // -Rs 2,75,000.00 (CNRB)
  { accountIndex: 99, label: "strongly_negative", targetPaise: -420_000_000 }, // -Rs 42,00,000.00 (RATN)
] as const;

/** Flat baseline opening balance for the other 95 (non-showcase) accounts. */
export const BASELINE_OPENING_BALANCE_PAISE = 100_000_000; // Rs 10,00,000.00
