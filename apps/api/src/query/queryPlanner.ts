import type { DateRange, FinanceIntent } from "../ai/types.js";
import { resolveDateRange } from "./dateResolver.js";
import { resolveBank } from "./bankResolver.js";
import { resolveAccountByLast4 } from "./accountResolver.js";
import type { FullScopeFilters, QueryDateWindow, QueryPlan } from "./queryTypes.js";

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

const BANK_RANKING_LIMIT = 10;
const PROGRAM_RANKING_LIMIT = 10;

type BankResolutionResult =
  | { status: "resolved"; bankCode: string }
  | { status: "clarification"; question: string }
  | { status: "not_found"; message: string };

type AccountResolutionResult =
  | { status: "resolved"; accountId: string }
  | { status: "clarification"; question: string }
  | { status: "not_found"; message: string };

/**
 * Overloaded so a caller with a required DateRange (financial_comparison's
 * primary/secondary, which are never optional) gets a non-optional
 * QueryDateWindow back, rather than needing a non-null assertion to work
 * around a return type that only has to account for every other intent's
 * optional date_range.
 */
function resolveDateWindow(dateRange: DateRange, referenceDate: Date): QueryDateWindow;
function resolveDateWindow(
  dateRange: DateRange | undefined,
  referenceDate: Date,
): QueryDateWindow | undefined;
function resolveDateWindow(
  dateRange: DateRange | undefined,
  referenceDate: Date,
): QueryDateWindow | undefined {
  if (!dateRange) return undefined;
  const resolved = resolveDateRange(dateRange, referenceDate);
  return { startDate: resolved.start, endDateExclusive: resolved.endExclusive };
}

/**
 * Resolves a bank code/name reference against the bank table. Its three
 * failure-shaped outcomes ("clarification"/"not_found") are the exact
 * QueryPlanningResult variants, so a caller can `return` them directly
 * without any conversion step.
 */
async function resolveBankFilter(codeOrName: string): Promise<BankResolutionResult> {
  const result = await resolveBank(codeOrName);

  if (result.status === "resolved") {
    return { status: "resolved", bankCode: result.bank.code };
  }

  if (result.status === "not_found") {
    return {
      status: "not_found",
      message: `I couldn't find a bank matching "${codeOrName}".`,
    };
  }

  const candidateNames = result.candidates
    .slice(0, 5)
    .map((candidate) => `${candidate.name} (${candidate.code})`)
    .join(", ");

  return {
    status: "clarification",
    question: `I found multiple banks matching "${codeOrName}": ${candidateNames}. Which one do you mean?`,
  };
}

/**
 * Resolves an account by last4. `bankCodeHint` (an already-resolved bank
 * code, not a raw filter) narrows an ambiguous match in-memory over the
 * candidates accountResolver already returns - it never triggers a
 * second database query.
 */
async function resolveAccountFilter(
  last4: string,
  bankCodeHint: string | undefined,
): Promise<AccountResolutionResult> {
  const result = await resolveAccountByLast4(last4);

  if (result.status === "resolved") {
    return { status: "resolved", accountId: result.account.accountId };
  }

  if (result.status === "not_found") {
    return {
      status: "not_found",
      message: `I couldn't find an account ending in ${last4}.`,
    };
  }

  let candidates = result.candidates;

  if (bankCodeHint) {
    const narrowed = candidates.filter((candidate) => candidate.bankCode === bankCodeHint);
    if (narrowed.length > 0) {
      candidates = narrowed;
    }
  }

  if (candidates.length === 1) {
    return { status: "resolved", accountId: candidates[0].accountId };
  }

  return {
    status: "clarification",
    question: `I found multiple accounts ending in ${last4}. Please specify the bank to narrow it down.`,
  };
}

/**
 * Translates a validated FinanceIntent into a deterministic QueryPlan:
 * resolves symbolic dates (dateResolver) and semantic entities
 * (bankResolver/accountResolver) where the intent calls for them, then
 * assembles the plan. Never builds or executes SQL, never calls Gemini,
 * never performs a financial calculation - the query template/execution
 * layer (Phase 7) owns all of that.
 */
export async function buildQueryPlan(
  intent: FinanceIntent,
  referenceDate: Date,
): Promise<QueryPlanningResult> {
  switch (intent.intent) {
    case "transaction_spend_total":
    case "transaction_income_total":
    case "transaction_count":
    case "transaction_summary":
    case "largest_transaction": {
      let bankCode: string | undefined;
      if (intent.bank) {
        const bankResult = await resolveBankFilter(intent.bank.code);
        if (bankResult.status !== "resolved") return bankResult;
        bankCode = bankResult.bankCode;
      }

      let accountId: string | undefined;
      if (intent.account) {
        const accountResult = await resolveAccountFilter(intent.account.last4, bankCode);
        if (accountResult.status !== "resolved") return accountResult;
        accountId = accountResult.accountId;
      }

      const filters: FullScopeFilters = {
        dateWindow: resolveDateWindow(intent.date_range, referenceDate),
        bankCode,
        programId: intent.program_id,
        accountId,
      };

      switch (intent.intent) {
        case "transaction_spend_total":
          return {
            status: "success",
            plan: {
              intent: "transaction_spend_total",
              transactionType: "debit",
              filters: {
                ...filters,
                descriptionQuery: intent.description_query,
              },
              aggregation: { function: "sum" },
            },
          };

        case "transaction_income_total":
          return {
            status: "success",
            plan: {
              intent: "transaction_income_total",
              transactionType: "credit",
              filters,
              aggregation: { function: "sum" },
            },
          };

        case "transaction_count":
          return {
            status: "success",
            plan: {
              intent: "transaction_count",
              transactionType: intent.transaction_type,
              filters,
              aggregation: { function: "count" },
            },
          };

        case "transaction_summary":
          return {
            status: "success",
            plan: {
              intent: "transaction_summary",
              filters,
            },
          };

        case "largest_transaction":
          return {
            status: "success",
            plan: {
              intent: "largest_transaction",
              transactionType: intent.transaction_type,
              filters,
              sort: { direction: "desc" },
              limit: 1,
            },
          };

        default: {
          const exhaustiveCheck: never = intent;
          throw new Error(`Unreachable intent: ${JSON.stringify(exhaustiveCheck)}`);
        }
      }
    }

    case "transaction_spend_by_bank": {
      let bankCode: string | undefined;
      if (intent.bank) {
        const bankResult = await resolveBankFilter(intent.bank.code);
        if (bankResult.status !== "resolved") return bankResult;
        bankCode = bankResult.bankCode;
      }

      return {
        status: "success",
        plan: {
          intent: "transaction_spend_by_bank",
          transactionType: "debit",
          filters: {
            dateWindow: resolveDateWindow(intent.date_range, referenceDate),
            bankCode,
          },
          aggregation: { function: "sum" },
          groupBy: "bank",
          sort: { direction: "desc" },
          limit: BANK_RANKING_LIMIT,
        },
      };
    }

    case "transaction_spend_by_program":
      return {
        status: "success",
        plan: {
          intent: "transaction_spend_by_program",
          transactionType: "debit",
          filters: {
            dateWindow: resolveDateWindow(intent.date_range, referenceDate),
            programId: intent.program_id,
          },
          aggregation: { function: "sum" },
          groupBy: "program",
          sort: { direction: "desc" },
          limit: PROGRAM_RANKING_LIMIT,
        },
      };

    case "transaction_lookup":
      return {
        status: "success",
        plan: {
          intent: "transaction_lookup",
          transactionReference: intent.transaction_reference,
          limit: 1,
        },
      };

    case "account_balance": {
      // AccountBalanceIntent has no date_range field at all - there is
      // nothing to accidentally inherit here. account_balance is always
      // the current available_balance, never a historical figure.
      let bankCode: string | undefined;
      if (intent.bank) {
        const bankResult = await resolveBankFilter(intent.bank.code);
        if (bankResult.status !== "resolved") return bankResult;
        bankCode = bankResult.bankCode;
      }

      const accountResult = await resolveAccountFilter(intent.account.last4, bankCode);
      if (accountResult.status !== "resolved") return accountResult;

      return {
        status: "success",
        plan: {
          intent: "account_balance",
          accountId: accountResult.accountId,
        },
      };
    }

    case "account_count":
      return {
        status: "success",
        plan: { intent: "account_count" },
      };

    case "financial_comparison":
      return {
        status: "success",
        plan: {
          intent: "financial_comparison",
          metric: intent.comparison.metric,
          primary: resolveDateWindow(intent.comparison.primary, referenceDate),
          secondary: resolveDateWindow(intent.comparison.secondary, referenceDate),
        },
      };

    default: {
      const exhaustiveCheck: never = intent;
      throw new Error(`Unsupported intent: ${JSON.stringify(exhaustiveCheck)}`);
    }
  }
}
