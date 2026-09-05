import { describe, expect, it, vi } from "vitest";
import { executeFinanceIntent } from "./queryPipeline.js";
import * as queryTemplateRegistry from "./queryTemplateRegistry.js";

function asNumber(value: unknown): number {
  return typeof value === "string" ? Number(value) : Number(value);
}

// Ground truth from the live, deterministically seeded local database
// (seed=20260905) - see query/queryTemplates.test.ts for how these were
// independently confirmed.
const KNOWN_LAST4 = "7622";

describe("executeFinanceIntent - end-to-end against the real seeded database", () => {
  const referenceDate = new Date("2026-09-05T00:00:00Z");

  it("executes transaction_spend_total end-to-end", async () => {
    const result = await executeFinanceIntent(
      { intent: "transaction_spend_total", date_range: { type: "month", year: 2026, month: 8 } },
      referenceDate,
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.template).toBe("transaction_spend_total");
    if (result.plan.intent === "transaction_spend_total") {
      expect(result.plan.filters.dateWindow).toEqual({
        startDate: "2026-08-01",
        endDateExclusive: "2026-09-01",
      });
    }

    expect(result.rows).toHaveLength(1);
    expect(typeof result.rows[0].total).toBe("string");
    expect(Number.isNaN(asNumber(result.rows[0].total))).toBe(false);
  });

  it("executes transaction_spend_by_bank end-to-end and returns it sorted descending", async () => {
    const result = await executeFinanceIntent(
      { intent: "transaction_spend_by_bank" },
      referenceDate,
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.template).toBe("transaction_spend_by_bank");
    expect(result.rows.length).toBeLessThanOrEqual(10);

    for (const row of result.rows) {
      expect(row).toHaveProperty("bank_code");
      expect(row).toHaveProperty("bank_name");
      expect(typeof row.total).toBe("string");
    }

    const totals = result.rows.map((row) => asNumber(row.total));
    expect(totals).toEqual([...totals].sort((a, b) => b - a));
    expect(result.rows[0].bank_code).toBe("HDFC");
  });

  it("executes largest_transaction end-to-end and returns exactly one evidence row", async () => {
    const result = await executeFinanceIntent({ intent: "largest_transaction" }, referenceDate);

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.template).toBe("largest_transaction");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].transaction_amount).toBe("5000000.00");
    expect(Object.keys(result.rows[0])).not.toContain("account_number");
    expect(Object.keys(result.rows[0])).not.toContain("utr_number");
  });

  it("rejects an unrecognized intent name before touching the template registry", async () => {
    const spy = vi.spyOn(queryTemplateRegistry, "getQueryTemplate");

    const result = await executeFinanceIntent(
      { intent: "reconciliation_summary" } as never,
      referenceDate,
    );

    expect(result.status).toBe("unsupported_query_intent");
    if (result.status === "unsupported_query_intent") {
      expect(result.message).toContain("reconciliation_summary");
    }

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns not_found for a bank that doesn't exist", async () => {
    // The real 10-bank dataset has no natural ambiguity to exercise here
    // without mocking the database - the ambiguous-bank path is already
    // covered, with a mocked DB, by bankResolver.test.ts and
    // queryPlanner.test.ts. This end-to-end suite instead confirms the
    // not_found path against the real database.
    const result = await executeFinanceIntent(
      { intent: "transaction_spend_total", bank: { code: "Definitely Not A Real Bank" } },
      referenceDate,
    );

    expect(result.status).toBe("not_found");
  });

  it("returns not_found for an account last4 that doesn't exist", async () => {
    const result = await executeFinanceIntent(
      { intent: "account_balance", account: { last4: "0000" } },
      referenceDate,
    );

    expect(result.status).toBe("not_found");
  });

  it("resolves a known account and returns its real balance", async () => {
    const result = await executeFinanceIntent(
      { intent: "account_balance", account: { last4: KNOWN_LAST4 } },
      referenceDate,
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].last4).toBe(KNOWN_LAST4);
    expect(result.rows[0].bank_code).toBe("CNRB");
  });

  it("threads date filters from the intent through to the built plan and executed rows", async () => {
    const result = await executeFinanceIntent(
      { intent: "transaction_count", date_range: { type: "month", year: 2026, month: 8 } },
      referenceDate,
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    if (result.plan.intent === "transaction_count") {
      expect(result.plan.filters.dateWindow).toEqual({
        startDate: "2026-08-01",
        endDateExclusive: "2026-09-01",
      });
    }
    expect(typeof result.rows[0].count).toBe("string");
  });
});
