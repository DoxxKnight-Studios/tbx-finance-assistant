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

export type QuerySortField =
  | "amount"
  | "count";

export interface QueryFilters {
  vendorId?: string;
  category?: string;
  transactionType?: string;
  transactionStatus?: string;
  reconciliationStatus?: string;
  transactionReference?: string;
  amountLessThan?: number;
  startDate?: string;
  endDateExclusive?: string;
}

export interface QueryAggregationSpec {
  function: QueryAggregation;
  field?: "amount";
}

export interface QuerySort {
  field: QuerySortField;
  direction: "asc" | "desc";
}

export interface QueryPlan {
  intent: IntentName;
  filters: QueryFilters;
  comparison?: {
    primary: QueryFilters;
    secondary: QueryFilters;
  };
  aggregation?: QueryAggregationSpec;
  groupBy?: QueryGroupBy;
  sort?: QuerySort;
  limit?: number;
}