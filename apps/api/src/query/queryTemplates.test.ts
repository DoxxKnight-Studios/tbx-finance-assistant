import { describe, expect, it } from "vitest";
import {
  financialComparisonTemplate,
  reconciliationSummaryTemplate,
  transactionLookupTemplate,
  transactionSpendByCategoryTemplate,
  transactionSpendByVendorTemplate,
  transactionSpendTotalTemplate,
  transactionAmountFilterTemplate,
  unreconciledTransactionsTemplate,
  vendorPayoutByVendorTemplate,
  vendorPayoutLargestTemplate,
  vendorPayoutTotalTemplate,
} from "./queryTemplates.js";

describe("new finance intent templates", () => {
  it("builds parameterized spend and lookup queries", () => {
    const total = transactionSpendTotalTemplate.build({
      intent: "transaction_spend_total",
      filters: { category: "SOFTWARE", startDate: "2026-08-01", endDateExclusive: "2026-09-01" },
    });
    expect(total.text).toContain("SUM(t.amount)");
    expect(total.params).toContain("SOFTWARE");
    expect(total.text).not.toContain("SOFTWARE");

    const lookup = transactionLookupTemplate.build({
      intent: "transaction_lookup",
      filters: { transactionReference: "TXN-123" },
    });
    expect(lookup.text).toContain("t.transaction_reference = $1");
    expect(lookup.params).toEqual(["TXN-123"]);
  });

  it("builds grouped, largest, reconciliation, and comparison queries", () => {
    expect(transactionSpendByVendorTemplate.build({ intent: "transaction_spend_by_vendor", filters: {} }).text).toContain("GROUP BY v.id");
    expect(transactionSpendByCategoryTemplate.build({ intent: "transaction_spend_by_category", filters: {} }).text).toContain("GROUP BY t.category");
    expect(vendorPayoutLargestTemplate.build({ intent: "vendor_payout_largest", filters: {} }).text).toContain("ORDER BY t.amount DESC");
    expect(reconciliationSummaryTemplate.build({ intent: "reconciliation_summary", filters: {} }).text).toContain("GROUP BY r.status");
    expect(financialComparisonTemplate.build({
      intent: "financial_comparison",
      filters: {},
      comparison: {
        primary: { startDate: "2026-08-01", endDateExclusive: "2026-09-01" },
        secondary: { startDate: "2026-07-01", endDateExclusive: "2026-08-01" },
      },
    }).text).toContain("primary_total");
  });
});

describe("transactionAmountFilterTemplate", () => {
  it("counts transactions below a threshold with parameterized filters", () => {
    const result = transactionAmountFilterTemplate.build({
      intent: "transaction_amount_filter",
      filters: {
        amountLessThan: 5000,
        startDate: "2026-08-01",
        endDateExclusive: "2026-09-01",
      },
      aggregation: { function: "count" },
    });

    expect(result.params).toEqual([5000, "2026-08-01", "2026-09-01"]);
    expect(result.text).toContain("SELECT COUNT(*) AS count");
    expect(result.text).toContain("t.amount < $1");
    expect(result.text).toContain("t.transaction_date >= $2");
    expect(result.text).not.toContain("5000");
  });
});

describe("vendorPayoutTotalTemplate", () => {
  it("builds a parameterized query without a vendor filter", () => {
    const result = vendorPayoutTotalTemplate.build({
      intent: "vendor_payout_total",

      filters: {
        startDate: "2026-08-01",
        endDateExclusive: "2026-09-01",
      },

      aggregation: {
        function: "sum",
        field: "amount",
      },
    });

    expect(result.params).toEqual([
      "VENDOR_PAYOUT",
      "COMPLETED",
      "2026-08-01",
      "2026-09-01",
    ]);

    expect(result.text).toContain(
      "COALESCE(SUM(t.amount), 0)",
    );

    expect(result.text).toContain(
      "t.transaction_type = $1",
    );

    expect(result.text).toContain(
      "t.status = $2",
    );

    expect(result.text).toContain(
      "t.transaction_date >= $3",
    );

    expect(result.text).toContain(
      "t.transaction_date < $4",
    );
  });

  it("adds vendor filtering as a parameter", () => {
    const result = vendorPayoutTotalTemplate.build({
      intent: "vendor_payout_total",

      filters: {
        vendorId: "vendor-uuid",
        startDate: "2026-08-01",
        endDateExclusive: "2026-09-01",
      },
    });

    expect(result.params).toEqual([
      "VENDOR_PAYOUT",
      "COMPLETED",
      "vendor-uuid",
      "2026-08-01",
      "2026-09-01",
    ]);

    expect(result.text).toContain(
      "t.vendor_id = $3",
    );
  });

  it("only counts COMPLETED transactions even with no other filters", () => {
    const result = vendorPayoutTotalTemplate.build({
      intent: "vendor_payout_total",
      filters: {},
    });

    expect(result.params).toEqual([
      "VENDOR_PAYOUT",
      "COMPLETED",
    ]);
  });

  it("never interpolates filter values directly into the SQL text", () => {
    const result = vendorPayoutTotalTemplate.build({
      intent: "vendor_payout_total",

      filters: {
        vendorId: "'; DROP TABLE transactions; --",
      },
    });

    expect(result.text).not.toContain("DROP TABLE");
    expect(result.params).toContain(
      "'; DROP TABLE transactions; --",
    );
  });
});

describe("vendorPayoutByVendorTemplate", () => {
  it("builds a grouped, ordered query with the default limit", () => {
    const result = vendorPayoutByVendorTemplate.build({
      intent: "vendor_payout_by_vendor",

      filters: {
        startDate: "2026-08-01",
        endDateExclusive: "2026-09-01",
      },

      groupBy: "vendor",

      sort: {
        field: "amount",
        direction: "desc",
      },
    });

    expect(result.params).toEqual([
      "VENDOR_PAYOUT",
      "COMPLETED",
      "2026-08-01",
      "2026-09-01",
      10,
    ]);

    expect(result.text).toContain("JOIN vendors v ON v.id = t.vendor_id");
    expect(result.text).toContain("GROUP BY v.id, v.vendor_code, v.name");
    expect(result.text).toContain("ORDER BY total DESC");
    expect(result.text).toContain("LIMIT $5");
    expect(result.text).toContain("t.transaction_type = $1");
    expect(result.text).toContain("t.status = $2");
    expect(result.text).toContain("t.transaction_date >= $3");
    expect(result.text).toContain("t.transaction_date < $4");
  });

  it("honors an explicit, server-clamped limit", () => {
    const result = vendorPayoutByVendorTemplate.build({
      intent: "vendor_payout_by_vendor",
      filters: {},
      limit: 5,
    });

    expect(result.params.at(-1)).toBe(5);
    expect(result.text).toContain(
      `LIMIT $${result.params.length}`,
    );
  });

  it("adds an optional vendor filter as a parameter", () => {
    const result = vendorPayoutByVendorTemplate.build({
      intent: "vendor_payout_by_vendor",

      filters: {
        vendorId: "vendor-uuid",
      },
    });

    expect(result.params).toEqual([
      "VENDOR_PAYOUT",
      "COMPLETED",
      "vendor-uuid",
      10,
    ]);

    expect(result.text).toContain("t.vendor_id = $3");
  });
});

describe("unreconciledTransactionsTemplate", () => {
  it("builds a query filtered to UNRECONCILED with the default limit", () => {
    const result = unreconciledTransactionsTemplate.build({
      intent: "unreconciled_transactions",

      filters: {
        startDate: "2026-08-01",
        endDateExclusive: "2026-09-01",
      },

      sort: {
        field: "amount",
        direction: "desc",
      },
    });

    expect(result.params).toEqual([
      "UNRECONCILED",
      "2026-08-01",
      "2026-09-01",
      20,
    ]);

    expect(result.text).toContain(
      "JOIN reconciliations r ON r.transaction_id = t.id",
    );
    expect(result.text).toContain(
      "LEFT JOIN vendors v ON v.id = t.vendor_id",
    );
    expect(result.text).toContain("r.status = $1");
    expect(result.text).toContain("t.transaction_date >= $2");
    expect(result.text).toContain("t.transaction_date < $3");
    expect(result.text).toContain("ORDER BY t.amount DESC");
    expect(result.text).toContain(`LIMIT $${result.params.length}`);
  });

  it("respects ascending sort direction", () => {
    const result = unreconciledTransactionsTemplate.build({
      intent: "unreconciled_transactions",
      filters: {},
      sort: {
        field: "amount",
        direction: "asc",
      },
    });

    expect(result.text).toContain("ORDER BY t.amount ASC");
  });

  it("adds optional vendor and category filters as parameters", () => {
    const result = unreconciledTransactionsTemplate.build({
      intent: "unreconciled_transactions",

      filters: {
        vendorId: "vendor-uuid",
        category: "Travel",
      },
    });

    expect(result.params).toEqual([
      "UNRECONCILED",
      "vendor-uuid",
      "Travel",
      20,
    ]);

    expect(result.text).toContain("t.vendor_id = $2");
    expect(result.text).toContain("t.category = $3");
  });

  it("honors an explicit limit", () => {
    const result = unreconciledTransactionsTemplate.build({
      intent: "unreconciled_transactions",
      filters: {},
      limit: 3,
    });

    expect(result.params.at(-1)).toBe(3);
  });

  it("never interpolates filter values directly into the SQL text", () => {
    const result = unreconciledTransactionsTemplate.build({
      intent: "unreconciled_transactions",

      filters: {
        category: "'; DROP TABLE transactions; --",
      },
    });

    expect(result.text).not.toContain("DROP TABLE");
    expect(result.params).toContain(
      "'; DROP TABLE transactions; --",
    );
  });
});
