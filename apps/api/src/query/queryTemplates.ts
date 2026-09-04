import type { QueryPlan } from "./queryTypes.js";

export interface BuiltQuery {
  text: string;
  params: unknown[];
}

export interface QueryTemplate {
  name: string;
  build(plan: QueryPlan): BuiltQuery;
}

function addCondition(
  conditions: string[],
  params: unknown[],
  conditionSql: string,
  value: unknown,
): void {
  params.push(value);

  const placeholder = `$${params.length}`;

  conditions.push(
    conditionSql.replace("?", placeholder),
  );
}

export const vendorPayoutTotalTemplate: QueryTemplate = {
  name: "vendor_payout_total",

  build(plan) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    addCondition(
      conditions,
      params,
      "t.transaction_type = ?",
      "VENDOR_PAYOUT",
    );

    if (plan.filters.vendorId) {
      addCondition(
        conditions,
        params,
        "t.vendor_id = ?",
        plan.filters.vendorId,
      );
    }

    if (plan.filters.startDate) {
      addCondition(
        conditions,
        params,
        "t.transaction_date >= ?",
        plan.filters.startDate,
      );
    }

    if (plan.filters.endDateExclusive) {
      addCondition(
        conditions,
        params,
        "t.transaction_date < ?",
        plan.filters.endDateExclusive,
      );
    }

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