import type { QueryPlan } from "./queryTypes.js";

export interface QueryTemplate {
  name: string;

  build(plan: QueryPlan): {
    text: string;
    params: unknown[];
  };
}

export const vendorPayoutTotalTemplate: QueryTemplate = {
  name: "vendor_payout_total",

  build(plan) {
    const params: unknown[] = [];
    const conditions: string[] = [];

    if (plan.filters.vendorId) {
      params.push(plan.filters.vendorId);
      conditions.push(`t.vendor_id = $${params.length}`);
    }

    if (plan.filters.startDate) {
      params.push(plan.filters.startDate);
      conditions.push(`t.transaction_date >= $${params.length}`);
    }

    if (plan.filters.endDateExclusive) {
      params.push(plan.filters.endDateExclusive);
      conditions.push(`t.transaction_date < $${params.length}`);
    }

    params.push("VENDOR_PAYOUT");
    conditions.push(`t.transaction_type = $${params.length}`);

    return {
      text: `
        SELECT
          COALESCE(SUM(t.amount), 0) AS total
        FROM transactions t
        WHERE ${conditions.join("\nAND ")}
      `.trim(),

      params,
    };
  },
};