import type { IntentName } from "../ai/types.js";

export type QueryAggregation =
  | "sum"
  | "count"
  | "max"
  | "min"
  | "avg";

export type QueryGroupBy =
  | "vendor"
  | "category"
  | "status";

export type QuerySortDirection = "asc" | "desc";

export interface QueryFilters {
  vendorId?: string;
  category?: string;
  transactionType?: string;
  transactionStatus?: string;
  reconciliationStatus?: string;
  transactionReference?: string;
  startDate?: string;
  endDateExclusive?: string;
}

export interface QueryAggregationSpec {
  function: QueryAggregation;
  field?: "amount";
}

export interface QuerySort {
  field: "amount" | "count";
  direction: QuerySortDirection;
}

export interface QueryPlan {
  intent: IntentName;

  filters: QueryFilters;

  aggregation?: QueryAggregationSpec;

  groupBy?: QueryGroupBy;

  sort?: QuerySort;

  limit?: number;
}