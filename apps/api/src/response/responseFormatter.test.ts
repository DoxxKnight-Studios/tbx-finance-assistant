import { describe, expect, it } from "vitest";
import { formatFinanceResponse, formatPeriodLabel } from "./responseFormatter.js";
import type { QueryPipelineSuccess } from "../query/queryPipeline.js";
import type { ProcessFinanceMessageResult } from "../ai/messagePipeline.js";

function vendorPayoutTotal(
  overrides: Partial<{
    vendorName: string;
    total: string;
    startDate: string;
    endDateExclusive: string;
    rows: Record<string, unknown>[];
  }> = {},
): QueryPipelineSuccess {
  const rows =
    overrides.rows ??
    (overrides.total !== undefined ? [{ total: overrides.total }] : [{ total: "0.00" }]);

  return {
    status: "success",
    intent: {
      intent: "vendor_payout_total",
      vendor: overrides.vendorName ? { name: overrides.vendorName } : undefined,
      date_range: { type: "month", year: 2026, month: 8 },
    },
    plan: {
      intent: "vendor_payout_total",
      filters: {
        startDate: overrides.startDate ?? "2026-08-01",
        endDateExclusive: overrides.endDateExclusive ?? "2026-09-01",
      },
      aggregation: { function: "sum", field: "amount" },
    },
    template: "vendor_payout_total",
    rows,
  };
}

describe("formatFinanceResponse - vendor_payout_total", () => {
  it("formats the amount as grouped INR currency", () => {
    const result = vendorPayoutTotal({
      vendorName: "Acme Corporation",
      total: "29108400.00",
    });

    const formatted = formatFinanceResponse(result);

    expect(formatted.answer).toBe(
      "You paid Acme Corporation ₹29,108,400.00 in August 2026.",
    );
    expect(formatted.summary).toEqual({
      amount: "29108400.00",
      currency: "INR",
    });
  });

  it("uses the actual DB value rather than a fixed/hardcoded amount", () => {
    const result = vendorPayoutTotal({
      vendorName: "Acme Corporation",
      total: "500.50",
    });

    const formatted = formatFinanceResponse(result);

    expect(formatted.summary?.amount).toBe("500.50");
    expect(formatted.answer).toContain("₹500.50");
  });

  it("takes the vendor name from the intent, not a hardcoded string", () => {
    const result = vendorPayoutTotal({
      vendorName: "Globex Ltd",
      total: "1000.00",
    });

    const formatted = formatFinanceResponse(result);

    expect(formatted.answer).toContain("Globex Ltd");
    expect(formatted.answer).not.toContain("Acme");
  });

  it("displays a full calendar month as 'Month YYYY'", () => {
    expect(formatPeriodLabel("2026-08-01", "2026-09-01")).toBe("August 2026");

    const result = vendorPayoutTotal({
      vendorName: "Acme Corporation",
      total: "1.00",
      startDate: "2026-08-01",
      endDateExclusive: "2026-09-01",
    });
    expect(formatFinanceResponse(result).answer).toContain("in August 2026");
  });

  it("displays an arbitrary range as inclusive short dates", () => {
    expect(formatPeriodLabel("2026-08-05", "2026-08-10")).toBe(
      "Aug 5, 2026 – Aug 9, 2026",
    );
  });

  it("keeps NUMERIC monetary values as strings in summary and evidence", () => {
    const result = vendorPayoutTotal({
      vendorName: "Acme Corporation",
      total: "29108400.00",
    });

    const formatted = formatFinanceResponse(result);

    expect(typeof formatted.summary?.amount).toBe("string");
    const evidenceRows = formatted.evidence?.rows as Record<string, unknown>[];
    expect(typeof evidenceRows[0]?.total).toBe("string");
    expect(evidenceRows[0]?.total).toBe("29108400.00");
  });

  it("returns a clear deterministic answer for a zero-result total, without inventing a value", () => {
    const result = vendorPayoutTotal({
      vendorName: "Acme Corporation",
      total: "0.00",
    });

    const formatted = formatFinanceResponse(result);

    expect(formatted.summary?.amount).toBe("0.00");
    expect(formatted.answer).toBe(
      "You paid Acme Corporation ₹0.00 in August 2026.",
    );
  });

  it("does not invent an amount when no row comes back at all", () => {
    const result = vendorPayoutTotal({
      vendorName: "Acme Corporation",
      rows: [],
    });

    const formatted = formatFinanceResponse(result);

    expect(formatted.summary).toBeUndefined();
    expect(formatted.answer).toContain("couldn't find a payout total");
  });
});

describe("formatFinanceResponse - vendor_payout_by_vendor", () => {
  it("produces deterministic ranked evidence from the returned rows", () => {
    const result: QueryPipelineSuccess = {
      status: "success",
      intent: {
        intent: "vendor_payout_by_vendor",
        date_range: { type: "month", year: 2026, month: 8 },
      },
      plan: {
        intent: "vendor_payout_by_vendor",
        filters: {
          startDate: "2026-08-01",
          endDateExclusive: "2026-09-01",
        },
        aggregation: { function: "sum", field: "amount" },
        groupBy: "vendor",
        sort: { field: "amount", direction: "desc" },
        limit: 10,
      },
      template: "vendor_payout_by_vendor",
      rows: [
        { vendor_id: "v1", vendor_code: "ACME", vendor_name: "Acme Corporation", total: "100.00" },
        { vendor_id: "v2", vendor_code: "GLBX", vendor_name: "Globex Ltd", total: "50.00" },
      ],
    };

    const formatted = formatFinanceResponse(result);

    expect(formatted.answer).toBe(
      "Here are the vendors with the highest completed payouts for August 2026.",
    );
    expect(formatted.evidence?.rankings).toEqual([
      { rank: 1, vendorCode: "ACME", vendorName: "Acme Corporation", total: "100.00" },
      { rank: 2, vendorCode: "GLBX", vendorName: "Globex Ltd", total: "50.00" },
    ]);
  });
});

describe("formatFinanceResponse - unreconciled_transactions", () => {
  it("preserves DB evidence rows and derives count from the returned rows", () => {
    const result: QueryPipelineSuccess = {
      status: "success",
      intent: {
        intent: "unreconciled_transactions",
        date_range: { type: "last_month" },
      },
      plan: {
        intent: "unreconciled_transactions",
        filters: {
          reconciliationStatus: "UNRECONCILED",
          startDate: "2026-08-01",
          endDateExclusive: "2026-09-01",
        },
        sort: { field: "amount", direction: "desc" },
        limit: 20,
      },
      template: "unreconciled_transactions",
      rows: [
        {
          transaction_id: "t1",
          transaction_reference: "REF-1",
          transaction_date: "2026-08-12",
          vendor_code: "ACME",
          vendor_name: "Acme Corporation",
          amount: "1234.56",
          category: "SUPPLIES",
          reconciliation_status: "UNRECONCILED",
        },
      ],
    };

    const formatted = formatFinanceResponse(result);

    expect(formatted.summary).toEqual({ count: 1 });
    expect(formatted.answer).toBe("Found 1 unreconciled transaction.");

    const rows = formatted.evidence?.rows as Record<string, unknown>[];
    expect(rows[0]).toEqual({
      transactionId: "t1",
      transactionReference: "REF-1",
      transactionDate: "2026-08-12",
      vendorCode: "ACME",
      vendorName: "Acme Corporation",
      amount: "1234.56",
      category: "SUPPLIES",
      reconciliationStatus: "UNRECONCILED",
    });
    expect(typeof rows[0]?.amount).toBe("string");
  });

  it("gives a deterministic zero-count answer without inventing rows", () => {
    const result: QueryPipelineSuccess = {
      status: "success",
      intent: { intent: "unreconciled_transactions" },
      plan: {
        intent: "unreconciled_transactions",
        filters: { reconciliationStatus: "UNRECONCILED" },
        limit: 20,
      },
      template: "unreconciled_transactions",
      rows: [],
    };

    const formatted = formatFinanceResponse(result);

    expect(formatted.summary).toEqual({ count: 0 });
    expect(formatted.answer).toBe("No unreconciled transactions were found.");
  });
});

describe("formatFinanceResponse - unsupported and non-success statuses", () => {
  it("returns an explicit unsupported response for the not-yet-implemented intents", () => {
    const result: ProcessFinanceMessageResult = {
      status: "unsupported_query_intent",
      intent: { intent: "reconciliation_summary" },
      message: 'The "reconciliation_summary" query is not implemented yet.',
    };

    const formatted = formatFinanceResponse(result);

    expect(formatted.status).toBe("unsupported_query_intent");
    expect(formatted.answer).toBe(
      'The "reconciliation_summary" query is not implemented yet.',
    );
    expect(formatted.evidence).toEqual({ intent: "reconciliation_summary" });
  });

  it("passes through a clarification question as the answer", () => {
    const formatted = formatFinanceResponse({
      status: "clarification",
      question: "Which vendor did you mean?",
    });

    expect(formatted.status).toBe("clarification");
    expect(formatted.answer).toBe("Which vendor did you mean?");
  });

  it("passes through unsupported_ai_intent deterministically", () => {
    const formatted = formatFinanceResponse({
      status: "unsupported_ai_intent",
      message: "Telling jokes is not a supported finance query.",
    });

    expect(formatted.status).toBe("unsupported_ai_intent");
    expect(formatted.answer).toBe(
      "Telling jokes is not a supported finance query.",
    );
  });
});
