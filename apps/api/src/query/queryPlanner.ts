import type { FinanceIntent } from "../ai/types.js";
import { resolveDateRange } from "./dateResolver.js";
import { resolveVendor } from "./entityResolver.js";
import type { QueryPlan } from "./queryTypes.js";

export type QueryPlanningResult =
  | {
      status: "success";
      plan: QueryPlan;
    }
  | {
      status: "clarification";
      question: string;
    }
  | {
      status: "not_found";
      message: string;
    };

type PlannerSupportedIntent =
  | "vendor_payout_total"
  | "vendor_payout_by_vendor"
  | "transaction_amount_filter"
  | "unreconciled_transactions";

function isSupportedIntent(
  intent: FinanceIntent["intent"],
): intent is PlannerSupportedIntent {
  return (
    intent === "vendor_payout_total" ||
    intent === "vendor_payout_by_vendor" ||
    intent === "transaction_amount_filter" ||
    intent === "unreconciled_transactions"
  );
}

export async function buildQueryPlan(
  intent: FinanceIntent,
  referenceDate: Date,
): Promise<QueryPlanningResult> {
  if (!isSupportedIntent(intent.intent)) {
    return {
      status: "not_found",
      message: `Intent "${intent.intent}" is not implemented yet.`,
    };
  }

  let vendorId: string | undefined;

  if (intent.vendor?.code) {
    const vendorResult = await resolveVendor(
      intent.vendor.code,
    );

    if (vendorResult.status === "not_found") {
      return {
        status: "not_found",
        message: `I couldn't find a vendor matching "${intent.vendor.code}".`,
      };
    }

    if (vendorResult.status === "ambiguous") {
      return {
        status: "clarification",
        question: `I found multiple vendors matching "${intent.vendor.code}". Please specify the exact vendor.`,
      };
    }

    vendorId = vendorResult.vendor.id;
  } else if (intent.vendor?.name) {
    const vendorResult = await resolveVendor(
      intent.vendor.name,
    );

    if (vendorResult.status === "not_found") {
      return {
        status: "not_found",
        message: `I couldn't find a vendor matching "${intent.vendor.name}".`,
      };
    }

    if (vendorResult.status === "ambiguous") {
      const candidateNames = vendorResult.candidates
        .slice(0, 5)
        .map((candidate) => candidate.name)
        .join(", ");

      return {
        status: "clarification",
        question:
          `I found multiple vendors matching "${intent.vendor.name}": ` +
          `${candidateNames}. Which one do you mean?`,
      };
    }

    vendorId = vendorResult.vendor.id;
  }

  let dateFilters: {
    startDate?: string;
    endDateExclusive?: string;
  } = {};

  if (intent.date_range) {
    const resolved = resolveDateRange(
      intent.date_range,
      referenceDate,
    );

    dateFilters = {
      startDate: resolved.start,
      endDateExclusive: resolved.endExclusive,
    };
  }

  switch (intent.intent) {
    case "vendor_payout_total":
      return {
        status: "success",
        plan: {
          intent: "vendor_payout_total",

          filters: {
            vendorId,
            ...dateFilters,
          },

          aggregation: {
            function: "sum",
            field: "amount",
          },
        },
      };

    case "vendor_payout_by_vendor":
      return {
        status: "success",
        plan: {
          intent: "vendor_payout_by_vendor",

          filters: {
            ...dateFilters,
          },

          aggregation: {
            function: "sum",
            field: "amount",
          },

          groupBy: "vendor",

          sort: {
            field: "amount",
            direction: "desc",
          },

          limit: Math.min(intent.limit ?? 10, 100),
        },
      };

    case "unreconciled_transactions":
      return {
        status: "success",
        plan: {
          intent: "unreconciled_transactions",

          filters: {
            vendorId,
            reconciliationStatus:
              "UNRECONCILED",
            ...dateFilters,
          },

          sort: {
            field: "amount",
            direction: "desc",
          },

          limit: Math.min(intent.limit ?? 20, 100),
        },
      };

    case "transaction_amount_filter":
      return {
        status: "success",
        plan: {
          intent: "transaction_amount_filter",
          filters: {
            vendorId,
            category: intent.category,
            amountLessThan: intent.amount_less_than,
            ...dateFilters,
          },
          aggregation: {
            function: "count",
          },
        },
      };

    default: {
      const exhaustiveCheck: never = intent.intent;
      throw new Error(`Unsupported intent: ${exhaustiveCheck}`);
    }
  }
}