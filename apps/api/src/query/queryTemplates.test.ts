import { describe, expect, it } from "vitest";
import { vendorPayoutTotalTemplate } from "./queryTemplates.js";

describe("vendorPayoutTotalTemplate", () => {
  it("builds a parameterized query", () => {
    const result = vendorPayoutTotalTemplate.build({
      intent: "vendor_payout_total",

      filters: {
        vendorId: "vendor-123",
        startDate: "2026-08-01",
        endDateExclusive: "2026-09-01",
      },

      aggregation: {
        function: "sum",
        field: "amount",
      },
    });

    expect(result.params).toEqual([
      "vendor-123",
      "2026-08-01",
      "2026-09-01",
      "VENDOR_PAYOUT",
    ]);

    expect(result.text).toContain("SUM(t.amount)");
    expect(result.text).toContain("t.vendor_id = $1");
    expect(result.text).toContain("t.transaction_date >= $2");
    expect(result.text).toContain("t.transaction_date < $3");
    expect(result.text).toContain("t.transaction_type = $4");
  });
});