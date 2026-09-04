import { describe, expect, it, vi } from "vitest";
import { executeFinanceIntent } from "./queryPipeline.js";
import * as queryTemplateRegistry from "./queryTemplateRegistry.js";

function asNumber(value: unknown): number {
  return typeof value === "string" ? Number(value) : Number(value);
}

describe("executeFinanceIntent", () => {
  const referenceDate = new Date("2026-09-05T00:00:00Z");

  it("executes vendor_payout_total end-to-end against the database", async () => {
    const result = await executeFinanceIntent(
      {
        intent: "vendor_payout_total",
        date_range: { type: "last_month" },
      },
      referenceDate,
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.template).toBe("vendor_payout_total");
    expect(result.plan.filters.startDate).toBe("2026-08-01");
    expect(result.plan.filters.endDateExclusive).toBe("2026-09-01");

    // COALESCE(SUM(...), 0) always yields exactly one row.
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toHaveProperty("total");

    // NUMERIC columns must not be silently coerced to (possibly
    // precision-losing) JS numbers - Neon returns them as strings.
    expect(typeof result.rows[0].total).toBe("string");
    expect(Number.isNaN(asNumber(result.rows[0].total))).toBe(false);
  });

  it("executes vendor_payout_by_vendor end-to-end and returns it sorted descending", async () => {
    const result = await executeFinanceIntent(
      {
        intent: "vendor_payout_by_vendor",
        date_range: { type: "last_month" },
      },
      referenceDate,
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.template).toBe("vendor_payout_by_vendor");
    expect(result.rows.length).toBeLessThanOrEqual(10);

    for (const row of result.rows) {
      expect(row).toHaveProperty("vendor_id");
      expect(row).toHaveProperty("vendor_code");
      expect(row).toHaveProperty("vendor_name");
      expect(typeof row.total).toBe("string");
    }

    const totals = result.rows.map((row) => asNumber(row.total));
    const sorted = [...totals].sort((a, b) => b - a);
    expect(totals).toEqual(sorted);
  });

  it("executes unreconciled_transactions end-to-end and only returns UNRECONCILED rows", async () => {
    const result = await executeFinanceIntent(
      {
        intent: "unreconciled_transactions",
        date_range: { type: "last_month" },
      },
      referenceDate,
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.template).toBe("unreconciled_transactions");
    expect(result.rows.length).toBeLessThanOrEqual(20);

    for (const row of result.rows) {
      expect(row.reconciliation_status).toBe("UNRECONCILED");
      expect(row).toHaveProperty("transaction_id");
      expect(row).toHaveProperty("transaction_reference");
      expect(row).toHaveProperty("transaction_date");
      expect(row).toHaveProperty("amount");
      expect(row).toHaveProperty("category");
    }

    const amounts = result.rows.map((row) => asNumber(row.amount));
    const sorted = [...amounts].sort((a, b) => b - a);
    expect(amounts).toEqual(sorted);
  });

  it("rejects an unsupported intent before touching the template registry", async () => {
    const spy = vi.spyOn(queryTemplateRegistry, "getQueryTemplate");

    const result = await executeFinanceIntent(
      {
        intent: "reconciliation_summary",
        date_range: { type: "last_month" },
      },
      referenceDate,
    );

    expect(result.status).toBe("unsupported_query_intent");
    if (result.status === "unsupported_query_intent") {
      expect(result.message).toContain("reconciliation_summary");
    }

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("requests clarification for an ambiguous vendor", async () => {
    const result = await executeFinanceIntent(
      {
        intent: "vendor_payout_total",
        vendor: { name: "Acme" },
        date_range: { type: "last_month" },
      },
      referenceDate,
    );

    expect(result.status).toBe("clarification");
  });

  it("returns not_found for a vendor that does not exist", async () => {
    const result = await executeFinanceIntent(
      {
        intent: "vendor_payout_total",
        vendor: { name: "Definitely Not A Vendor" },
        date_range: { type: "last_month" },
      },
      referenceDate,
    );

    expect(result.status).toBe("not_found");
  });

  it("threads date filters from the intent through to the built plan", async () => {
    const result = await executeFinanceIntent(
      {
        intent: "unreconciled_transactions",
        date_range: { type: "month", year: 2026, month: 8 },
      },
      referenceDate,
    );

    expect(result.status).toBe("success");
    if (result.status !== "success") return;

    expect(result.plan.filters.startDate).toBe("2026-08-01");
    expect(result.plan.filters.endDateExclusive).toBe("2026-09-01");
    expect(result.plan.filters.reconciliationStatus).toBe("UNRECONCILED");
  });
});
