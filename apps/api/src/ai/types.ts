export type IntentName =
  | "vendor_payout_total"
  | "vendor_payout_by_vendor"
  | "vendor_payout_largest"
  | "transaction_spend_total"
  | "transaction_spend_by_vendor"
  | "transaction_spend_by_category"
  | "unreconciled_transactions"
  | "reconciliation_summary"
  | "transaction_lookup"
  | "financial_comparison";

export type DateRange =
  | {
      type:
        | "today"
        | "yesterday"
        | "this_week"
        | "last_week"
        | "this_month"
        | "last_month"
        | "this_quarter"
        | "last_quarter";
    }
  | {
      type: "month";
      year: number;
      month: number;
    }
  | {
      type: "between";
      start: string;
      end: string;
    };

export interface FinanceIntent {
  intent: IntentName;

  vendor?: {
    name?: string;
    code?: string;
  };

  category?: string;

  transaction_reference?: string;

  date_range?: DateRange;

  comparison?: {
    primary: DateRange;
    secondary: DateRange;
  };

  limit?: number;
}