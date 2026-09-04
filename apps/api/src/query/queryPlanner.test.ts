import { describe, expect, it } from "vitest";
import { buildQueryPlan } from "./queryPlanner.js";

describe("buildQueryPlan", () => {
  const referenceDate = new Date(
    "2026-09-05T00:00:00Z",
  );

  it("builds a vendor payout total plan", async () => {
    const result = await buildQueryPlan(
      {
        intent: "vendor_payout_total",
        date_range: {
          type: "last_month",
        },
      },
      referenceDate,
    );

    expect(result.status).toBe("success");

    if (result.status === "success") {
      expect(result.plan.intent).toBe(
        "vendor_payout_total",
      );

      expect(result.plan.filters.startDate).toBe(
        "2026-08-01",
      );

      expect(
        result.plan.filters.endDateExclusive,
      ).toBe("2026-09-01");

      expect(
        result.plan.aggregation,
      ).toEqual({
        function: "sum",
        field: "amount",
      });
    }
  });

  it("resolves an exact vendor", async () => {
    const result = await buildQueryPlan(
      {
        intent: "vendor_payout_total",
        vendor: {
          name: "Acme Corporation",
        },
        date_range: {
          type: "last_month",
        },
      },
      referenceDate,
    );

    expect(result.status).toBe("success");

    if (result.status === "success") {
      expect(
        result.plan.filters.vendorId,
      ).toBe(
        "320f8258-34ec-5997-8761-db0a6e0a71a4",
      );
    }
  });

  it("requests clarification for ambiguous vendor", async () => {
    const result = await buildQueryPlan(
      {
        intent: "vendor_payout_total",
        vendor: {
          name: "Acme",
        },
        date_range: {
          type: "last_month",
        },
      },
      referenceDate,
    );

    expect(result.status).toBe(
      "clarification",
    );
  });

  it("returns not_found for an unknown vendor", async () => {
    const result = await buildQueryPlan(
      {
        intent: "vendor_payout_total",
        vendor: {
          name: "Definitely Not A Vendor",
        },
        date_range: {
          type: "last_month",
        },
      },
      referenceDate,
    );

    expect(result.status).toBe(
      "not_found",
    );
  });

  it("builds vendor ranking correctly", async () => {
    const result = await buildQueryPlan(
      {
        intent: "vendor_payout_by_vendor",
        date_range: {
          type: "month",
          year: 2026,
          month: 8,
        },
      },
      referenceDate,
    );

    expect(result.status).toBe("success");

    if (result.status === "success") {
      expect(result.plan.groupBy).toBe(
        "vendor",
      );

      expect(result.plan.sort).toEqual({
        field: "amount",
        direction: "desc",
      });

      expect(result.plan.limit).toBe(10);
    }
  });

  it("builds an unreconciled transaction plan", async () => {
    const result = await buildQueryPlan(
      {
        intent: "unreconciled_transactions",
        date_range: {
          type: "last_month",
        },
      },
      referenceDate,
    );

    expect(result.status).toBe("success");

    if (result.status === "success") {
      expect(
        result.plan.filters.reconciliationStatus,
      ).toBe("UNRECONCILED");

      expect(
        result.plan.filters.startDate,
      ).toBe("2026-08-01");

      expect(
        result.plan.filters.endDateExclusive,
      ).toBe("2026-09-01");
    }
  });
});