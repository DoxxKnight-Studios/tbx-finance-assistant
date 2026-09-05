import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validateIntentParserResult,
  isValidDateRange,
  isValidFinanceIntent,
  isValidCalendarDate,
} from "../src/ai/validateIntent.js";

describe("Runtime Intent Validator (TBX Finance Assistant)", () => {
  describe("DateRange Validation - Calendar & Between", () => {
    it("accepts valid between date range: 2026-08-01 -> 2026-09-01", () => {
      assert.equal(
        isValidDateRange({
          type: "between",
          start: "2026-08-01",
          end: "2026-09-01",
        }),
        true
      );
    });

    it("rejects invalid calendar date: 2026-02-31", () => {
      assert.equal(isValidCalendarDate("2026-02-31"), false);
      assert.equal(
        isValidDateRange({
          type: "between",
          start: "2026-02-01",
          end: "2026-02-31",
        }),
        false
      );
    });

    it("rejects invalid month 13 (e.g. 2026-13-01)", () => {
      assert.equal(isValidCalendarDate("2026-13-01"), false);
      assert.equal(
        isValidDateRange({
          type: "between",
          start: "2026-12-01",
          end: "2026-13-01",
        }),
        false
      );
    });

    it("rejects between date range when end is equal to start", () => {
      assert.equal(
        isValidDateRange({
          type: "between",
          start: "2026-08-01",
          end: "2026-08-01",
        }),
        false
      );
    });

    it("rejects between date range when end is before start", () => {
      assert.equal(
        isValidDateRange({
          type: "between",
          start: "2026-09-01",
          end: "2026-08-01",
        }),
        false
      );
    });
  });

  describe("DateRange Validation - Relative and Month", () => {
    it("accepts valid relative date types", () => {
      const relatives = [
        "today",
        "yesterday",
        "this_week",
        "last_week",
        "this_month",
        "last_month",
        "this_quarter",
        "last_quarter",
      ] as const;

      for (const type of relatives) {
        assert.equal(isValidDateRange({ type }), true);
      }
    });

    it("accepts valid month date types", () => {
      assert.equal(
        isValidDateRange({ type: "month", year: 2026, month: 8 }),
        true
      );
    });

    it("rejects invalid month numbers (< 1 or > 12)", () => {
      assert.equal(
        isValidDateRange({ type: "month", year: 2026, month: 0 }),
        false
      );
      assert.equal(
        isValidDateRange({ type: "month", year: 2026, month: 13 }),
        false
      );
    });
  });

  describe("FinanceIntent Validation - official TBX contract", () => {
    it("accepts one valid example of all 10 supported intents", () => {
      const sampleIntents: Record<string, unknown> = {
        transaction_spend_total: { intent: "transaction_spend_total" },
        transaction_income_total: { intent: "transaction_income_total" },
        transaction_count: { intent: "transaction_count", transaction_type: "debit" },
        transaction_spend_by_bank: { intent: "transaction_spend_by_bank" },
        transaction_spend_by_program: { intent: "transaction_spend_by_program", program_id: 21 },
        transaction_summary: { intent: "transaction_summary" },
        largest_transaction: { intent: "largest_transaction" },
        transaction_lookup: {
          intent: "transaction_lookup",
          transaction_reference: "TXN-DEMO-000007",
        },
        account_balance: {
          intent: "account_balance",
          account: { last4: "9069" },
        },
        financial_comparison: {
          intent: "financial_comparison",
          comparison: {
            metric: "spend",
            primary: { type: "month", year: 2026, month: 8 },
            secondary: { type: "month", year: 2026, month: 7 },
          },
        },
      };

      for (const [name, obj] of Object.entries(sampleIntents)) {
        assert.equal(isValidFinanceIntent(obj), true, `Failed for intent: ${name}`);
      }
    });

    it("rejects unsupported intent names", () => {
      assert.equal(
        isValidFinanceIntent({ intent: "vendor_payout_total" }),
        false
      );
    });

    it("rejects transaction_lookup without transaction_reference", () => {
      assert.equal(
        isValidFinanceIntent({ intent: "transaction_lookup" }),
        false
      );
    });

    it("rejects account_balance without account.last4", () => {
      assert.equal(
        isValidFinanceIntent({ intent: "account_balance" }),
        false
      );
    });

    it("rejects an invalid program_id", () => {
      assert.equal(
        isValidFinanceIntent({ intent: "transaction_spend_by_program", program_id: 7 }),
        false
      );
    });

    it("rejects an invalid transaction_type", () => {
      assert.equal(
        isValidFinanceIntent({ intent: "transaction_count", transaction_type: "refund" }),
        false
      );
    });

    it("rejects financial_comparison missing a period", () => {
      assert.equal(
        isValidFinanceIntent({
          intent: "financial_comparison",
          comparison: { metric: "spend", primary: { type: "this_month" } },
        }),
        false
      );
    });

    it("rejects forbidden vendor/category/reconciliation fields", () => {
      assert.equal(
        isValidFinanceIntent({ intent: "transaction_spend_total", vendor: { name: "Acme" } }),
        false
      );
      assert.equal(
        isValidFinanceIntent({ intent: "transaction_count", category: "utilities" }),
        false
      );
      assert.equal(
        isValidFinanceIntent({ intent: "transaction_count", reconciliationStatus: "UNRECONCILED" }),
        false
      );
    });
  });

  describe("Parser Result Contract Validation", () => {
    it("validates successful intent output", () => {
      const output = {
        status: "success",
        intent: {
          intent: "transaction_spend_total",
          date_range: { type: "last_month" },
        },
      };

      const result = validateIntentParserResult(output);
      assert.equal(result.valid, true);
    });

    it("validates clarification output", () => {
      const output = {
        status: "clarification",
        question: "Which account would you like me to check?",
      };

      const result = validateIntentParserResult(output);
      assert.equal(result.valid, true);
    });

    it("validates unsupported output", () => {
      const output = {
        status: "unsupported",
        message: "Vendor and payee analysis is not supported.",
      };

      const result = validateIntentParserResult(output);
      assert.equal(result.valid, true);
    });

    it("rejects the old incompatible shape", () => {
      const result = validateIntentParserResult({ intent: null, reason: "unsupported" });
      assert.equal(result.valid, false);
    });
  });
});
