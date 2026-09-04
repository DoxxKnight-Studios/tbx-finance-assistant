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

  describe("FinanceIntent Validation", () => {
    it("accepts all 10 supported intents with valid structures", () => {
      const sampleIntents: Record<string, unknown> = {
        vendor_payout_total: { intent: "vendor_payout_total" },
        vendor_payout_by_vendor: { intent: "vendor_payout_by_vendor" },
        vendor_payout_largest: { intent: "vendor_payout_largest" },
        transaction_spend_total: { intent: "transaction_spend_total" },
        transaction_spend_by_vendor: { intent: "transaction_spend_by_vendor" },
        transaction_spend_by_category: { intent: "transaction_spend_by_category" },
        unreconciled_transactions: { intent: "unreconciled_transactions" },
        reconciliation_summary: { intent: "reconciliation_summary" },
        transaction_lookup: {
          intent: "transaction_lookup",
          transaction_reference: "TXN-12345",
        },
        financial_comparison: {
          intent: "financial_comparison",
          comparison: {
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
        isValidFinanceIntent({ intent: "unsupported_crypto_forecast" }),
        false
      );
    });

    it("rejects transaction_lookup without transaction_reference", () => {
      assert.equal(
        isValidFinanceIntent({ intent: "transaction_lookup" }),
        false
      );
    });
  });

  describe("Parser Result Contract Validation", () => {
    it("validates successful intent output", () => {
      const output = {
        status: "success",
        intent: {
          intent: "vendor_payout_total",
          date_range: { type: "last_month" },
        },
      };

      const result = validateIntentParserResult(output);
      assert.equal(result.valid, true);
    });

    it("validates clarification output", () => {
      const output = {
        status: "clarification",
        question: "How much did Acme spend or receive?",
      };

      const result = validateIntentParserResult(output);
      assert.equal(result.valid, true);
    });

    it("validates unsupported output", () => {
      const output = {
        status: "unsupported",
        message: "Revenue forecasting is not supported.",
      };

      const result = validateIntentParserResult(output);
      assert.equal(result.valid, true);
    });
  });
});
