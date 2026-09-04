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
}export const SUPPORTED_INTENTS = [
  "vendor_payout_total",
  "vendor_payout_by_vendor",
  "vendor_payout_largest",
  "transaction_spend_total",
  "transaction_spend_by_vendor",
  "transaction_spend_by_category",
  "unreconciled_transactions",
  "reconciliation_summary",
  "transaction_lookup",
  "financial_comparison",
] as const;

export type IntentName = (typeof SUPPORTED_INTENTS)[number];

export const RELATIVE_DATE_TYPES = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "this_quarter",
  "last_quarter",
] as const;

export type RelativeDateType = (typeof RELATIVE_DATE_TYPES)[number];

export type DateRange =
  | {
      type: RelativeDateType;
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

export interface VendorEntity {
  name?: string;
  code?: string;
}

export interface ComparisonPeriod {
  primary: DateRange;
  secondary: DateRange;
}

export interface FinanceIntent {
  intent: IntentName;
  vendor?: VendorEntity;
  category?: string;
  transaction_reference?: string;
  date_range?: DateRange;
  comparison?: ComparisonPeriod;
  limit?: number;
}

export type IntentParserResult =
  | {
      status: "success";
      intent: FinanceIntent;
    }
  | {
      status: "clarification";
      question: string;
      partialIntent?: Partial<FinanceIntent>;
    }
  | {
      status: "unsupported";
      message: string;
    };
