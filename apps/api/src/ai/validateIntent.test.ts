import { describe, expect, it } from "vitest";
import {
  isValidCalendarDate,
  isValidDateRange,
  isValidFinanceIntent,
  validateIntent,
  validateIntentParserResult,
} from "./validateIntent.js";
import type { FinanceIntent } from "./types.js";

describe("isValidCalendarDate / isValidDateRange", () => {
  it("accepts a valid between range", () => {
    expect(isValidDateRange({ type: "between", start: "2026-08-01", end: "2026-09-01" })).toBe(true);
  });

  it("rejects an invalid calendar date (2026-02-31)", () => {
    expect(isValidCalendarDate("2026-02-31")).toBe(false);
    expect(isValidDateRange({ type: "between", start: "2026-02-01", end: "2026-02-31" })).toBe(false);
  });

  it("rejects month 13", () => {
    expect(isValidDateRange({ type: "month", year: 2026, month: 13 })).toBe(false);
  });

  it("rejects a between range where end <= start", () => {
    expect(isValidDateRange({ type: "between", start: "2026-08-01", end: "2026-08-01" })).toBe(false);
    expect(isValidDateRange({ type: "between", start: "2026-09-01", end: "2026-08-01" })).toBe(false);
  });

  it("accepts every relative date type", () => {
    for (const type of [
      "today", "yesterday", "this_week", "last_week",
      "this_month", "last_month", "this_quarter", "last_quarter",
    ] as const) {
      expect(isValidDateRange({ type })).toBe(true);
    }
  });

  it("rejects a relative date range carrying extra fields", () => {
    expect(isValidDateRange({ type: "today", year: 2026 })).toBe(false);
  });
});

describe("isValidFinanceIntent - one valid example per approved intent", () => {
  it("transaction_spend_total", () => {
    expect(
      isValidFinanceIntent({
        intent: "transaction_spend_total",
        date_range: { type: "month", year: 2026, month: 8 },
        bank: { code: "HDFC" },
      }),
    ).toBe(true);
  });

  it("transaction_income_total", () => {
    expect(
      isValidFinanceIntent({
        intent: "transaction_income_total",
        program_id: 21,
      }),
    ).toBe(true);
  });

  it("transaction_count", () => {
    expect(
      isValidFinanceIntent({
        intent: "transaction_count",
        transaction_type: "debit",
      }),
    ).toBe(true);
  });

  it("transaction_count with no filters at all (bare 'transactions')", () => {
    expect(isValidFinanceIntent({ intent: "transaction_count" })).toBe(true);
  });

  it("transaction_spend_by_bank", () => {
    expect(
      isValidFinanceIntent({
        intent: "transaction_spend_by_bank",
        date_range: { type: "last_quarter" },
      }),
    ).toBe(true);
  });

  it("transaction_spend_by_program", () => {
    expect(
      isValidFinanceIntent({
        intent: "transaction_spend_by_program",
        date_range: { type: "this_month" },
      }),
    ).toBe(true);
  });

  it("transaction_summary", () => {
    expect(
      isValidFinanceIntent({
        intent: "transaction_summary",
        account: { last4: "9069" },
      }),
    ).toBe(true);
  });

  it("largest_transaction (no transaction_type = either type)", () => {
    expect(
      isValidFinanceIntent({
        intent: "largest_transaction",
        date_range: { type: "this_quarter" },
      }),
    ).toBe(true);
  });

  it("largest_transaction with an explicit transaction_type", () => {
    expect(
      isValidFinanceIntent({
        intent: "largest_transaction",
        transaction_type: "credit",
      }),
    ).toBe(true);
  });

  it("transaction_lookup", () => {
    expect(
      isValidFinanceIntent({
        intent: "transaction_lookup",
        transaction_reference: "TXN-DEMO-000007",
      }),
    ).toBe(true);
  });

  it("account_balance", () => {
    expect(
      isValidFinanceIntent({
        intent: "account_balance",
        account: { last4: "9069" },
      }),
    ).toBe(true);
  });

  it("account_balance with a disambiguating bank", () => {
    expect(
      isValidFinanceIntent({
        intent: "account_balance",
        account: { last4: "9069" },
        bank: { code: "HDFC" },
      }),
    ).toBe(true);
  });

  it("financial_comparison", () => {
    expect(
      isValidFinanceIntent({
        intent: "financial_comparison",
        comparison: {
          metric: "spend",
          primary: { type: "month", year: 2026, month: 8 },
          secondary: { type: "month", year: 2026, month: 7 },
        },
      }),
    ).toBe(true);
  });
});

describe("isValidFinanceIntent - invalid examples", () => {
  it("rejects an unknown intent", () => {
    expect(isValidFinanceIntent({ intent: "vendor_payout_total" })).toBe(false);
  });

  it("rejects an invalid transaction_type", () => {
    expect(
      isValidFinanceIntent({ intent: "transaction_count", transaction_type: "refund" }),
    ).toBe(false);
  });

  it("rejects an invalid program_id (not one of the 5 known programs)", () => {
    expect(
      isValidFinanceIntent({ intent: "transaction_spend_by_program", program_id: 99 }),
    ).toBe(false);
  });

  it("rejects an invalid month", () => {
    expect(
      isValidFinanceIntent({
        intent: "transaction_spend_total",
        date_range: { type: "month", year: 2026, month: 0 },
      }),
    ).toBe(false);
  });

  it("rejects an invalid calendar date in a between range", () => {
    expect(
      isValidFinanceIntent({
        intent: "transaction_spend_total",
        date_range: { type: "between", start: "2026-02-30", end: "2026-03-01" },
      }),
    ).toBe(false);
  });

  it("rejects transaction_lookup without transaction_reference", () => {
    expect(isValidFinanceIntent({ intent: "transaction_lookup" })).toBe(false);
  });

  it("rejects account_balance without account", () => {
    expect(isValidFinanceIntent({ intent: "account_balance" })).toBe(false);
  });

  it("rejects account_balance with a malformed last4", () => {
    expect(
      isValidFinanceIntent({ intent: "account_balance", account: { last4: "90" } }),
    ).toBe(false);
    expect(
      isValidFinanceIntent({ intent: "account_balance", account: { last4: "abcd" } }),
    ).toBe(false);
  });

  it("rejects financial_comparison missing both periods", () => {
    expect(
      isValidFinanceIntent({ intent: "financial_comparison", comparison: { metric: "spend" } }),
    ).toBe(false);
  });

  it("rejects financial_comparison with an invalid metric", () => {
    expect(
      isValidFinanceIntent({
        intent: "financial_comparison",
        comparison: {
          metric: "profit",
          primary: { type: "this_month" },
          secondary: { type: "last_month" },
        },
      }),
    ).toBe(false);
  });

  it("rejects financial_comparison missing comparison entirely", () => {
    expect(isValidFinanceIntent({ intent: "financial_comparison" })).toBe(false);
  });

  it("rejects a forbidden vendor field", () => {
    expect(
      isValidFinanceIntent({
        intent: "transaction_spend_total",
        vendor: { name: "Acme Corporation" },
      }),
    ).toBe(false);
  });

  it("rejects a forbidden category field", () => {
    expect(
      isValidFinanceIntent({ intent: "transaction_count", category: "utilities" }),
    ).toBe(false);
  });

  it("rejects a forbidden reconciliation field", () => {
    expect(
      isValidFinanceIntent({
        intent: "transaction_count",
        reconciliationStatus: "UNRECONCILED",
      }),
    ).toBe(false);
  });

  it("rejects a raw account_number field", () => {
    expect(
      isValidFinanceIntent({
        intent: "account_balance",
        account: { last4: "9069", account_number: "40000000000012349069" },
      }),
    ).toBe(false);
  });

  it("rejects a utr_number field", () => {
    expect(
      isValidFinanceIntent({ intent: "transaction_lookup", transaction_reference: "TXN-1", utr_number: "X" }),
    ).toBe(false);
  });
});

describe("validateIntentParserResult - top-level envelope", () => {
  it("accepts a success envelope with a valid intent", () => {
    const result = validateIntentParserResult({
      status: "success",
      intent: { intent: "transaction_spend_total", date_range: { type: "last_month" } },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects a success envelope with an invalid intent", () => {
    const result = validateIntentParserResult({
      status: "success",
      intent: { intent: "vendor_payout_total" },
    });
    expect(result.valid).toBe(false);
  });

  it("accepts a clarification envelope", () => {
    const result = validateIntentParserResult({
      status: "clarification",
      question: "Which account would you like me to check?",
    });
    expect(result.valid).toBe(true);
  });

  it("accepts an unsupported envelope", () => {
    const result = validateIntentParserResult({
      status: "unsupported",
      message: "Vendor and payee analysis is not supported.",
    });
    expect(result.valid).toBe(true);
  });

  it("rejects the old incompatible shape", () => {
    const result = validateIntentParserResult({ intent: null, reason: "unsupported" });
    expect(result.valid).toBe(false);
  });
});

/**
 * validateIntent() is the real runtime boundary messagePipeline.ts calls -
 * `intent: FinanceIntent` is a compile-time hint, not proof, since the
 * type is erased at runtime. Every case here force-casts an object that
 * TypeScript would normally reject at the call site (`as unknown as
 * FinanceIntent`), simulating what a misbehaving parser, a stale mock, or
 * genuinely malformed Gemini output could hand this function. If
 * validateIntent() ever regressed back to a bare pass-through, every one
 * of these would start returning valid:true.
 */
describe("validateIntent - real runtime boundary against untrusted data", () => {
  it("accepts a genuinely well-formed intent", () => {
    const intent: FinanceIntent = {
      intent: "transaction_spend_total",
      date_range: { type: "last_month" },
    };
    expect(validateIntent(intent).valid).toBe(true);
  });

  it("rejects an unknown intent name", () => {
    const forged = { intent: "vendor_payout_total" } as unknown as FinanceIntent;
    expect(validateIntent(forged).valid).toBe(false);
  });

  it("rejects an invalid program_id", () => {
    const forged = {
      intent: "transaction_spend_by_program",
      program_id: 999,
    } as unknown as FinanceIntent;
    expect(validateIntent(forged).valid).toBe(false);
  });

  it("rejects a malformed bank shape", () => {
    const forged = {
      intent: "transaction_spend_total",
      bank: "HDFC",
    } as unknown as FinanceIntent;
    expect(validateIntent(forged).valid).toBe(false);
  });

  it("rejects an invalid account.last4", () => {
    const forged = {
      intent: "account_balance",
      account: { last4: "90" },
    } as unknown as FinanceIntent;
    expect(validateIntent(forged).valid).toBe(false);
  });

  it("rejects an invalid transaction_type", () => {
    const forged = {
      intent: "transaction_count",
      transaction_type: "refund",
    } as unknown as FinanceIntent;
    expect(validateIntent(forged).valid).toBe(false);
  });

  it("rejects a malformed date_range", () => {
    const forged = {
      intent: "transaction_spend_total",
      date_range: { type: "month", year: 2026, month: 14 },
    } as unknown as FinanceIntent;
    expect(validateIntent(forged).valid).toBe(false);
  });

  it("rejects transaction_lookup missing its reference", () => {
    const forged = { intent: "transaction_lookup" } as unknown as FinanceIntent;
    expect(validateIntent(forged).valid).toBe(false);
  });

  it("rejects a malformed financial_comparison", () => {
    const forged = {
      intent: "financial_comparison",
      comparison: { metric: "profit", primary: { type: "this_month" } },
    } as unknown as FinanceIntent;
    expect(validateIntent(forged).valid).toBe(false);
  });

  it("rejects a forbidden field even when force-cast as FinanceIntent", () => {
    const forged = {
      intent: "transaction_spend_total",
      vendor: { name: "Acme Corporation" },
    } as unknown as FinanceIntent;
    expect(validateIntent(forged).valid).toBe(false);
  });
});
