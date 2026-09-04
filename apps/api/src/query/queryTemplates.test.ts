import { describe, expect, it } from "vitest";
import { vendorPayoutTotalTemplate } from "./queryTemplates.js";

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
      "t.transaction_date >= $2",
    );

    expect(result.text).toContain(
      "t.transaction_date < $3",
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
      "vendor-uuid",
      "2026-08-01",
      "2026-09-01",
    ]);

    expect(result.text).toContain(
      "t.vendor_id = $2",
    );
  });
});