/**
 * Mirrors apps/api/src/response/responseFormatter.ts (FormattedFinanceResponse)
 * and the status values produced by apps/api/src/ai/messagePipeline.ts.
 * Kept intentionally loose (optional fields, no strict discriminated
 * union) where the backend itself only guarantees a shape per status/
 * template - the frontend must not assume fields the API doesn't
 * actually promise for a given response.
 */
export type FinanceStatus =
  | "success"
  | "clarification"
  | "unsupported_ai_intent"
  | "unsupported_query_intent"
  | "not_found"
  | "execution_error"
  | "parser_error"
  | "invalid_request";

export interface FinanceSummary {
  amount?: string;
  currency?: string;
  count?: number;
  debitTotal?: string;
  creditTotal?: string;
  net?: string;
  metric?: string;
  primaryValue?: string;
  secondaryValue?: string;
  [key: string]: unknown;
}

export interface PeriodEvidence {
  start: string;
  endExclusive: string;
}

export interface BankEvidence {
  code?: string;
  name?: string;
}

export interface AccountEvidence {
  last4?: string;
}

/** A single ranking row - bank and program fields are both optional so
 * one shape covers transaction_spend_by_bank and _by_program alike. */
export interface SpendRankingRow {
  bankCode?: string;
  bankName?: string;
  programId?: number;
  total?: string;
}

export interface TransactionEvidenceRow {
  transactionDate?: string;
  transactionType?: string;
  amount?: string;
  reference?: string | null;
  description?: string | null;
  bank?: BankEvidence;
  programId?: number;
}

export interface FinanceEvidence {
  template?: string;
  period?: PeriodEvidence;
  bank?: BankEvidence;
  programId?: number;
  account?: AccountEvidence;
  rankings?: SpendRankingRow[];
  amount?: string;
  count?: number;
  transactionType?: string;
  debitTotal?: string;
  creditTotal?: string;
  net?: string;
  transaction?: TransactionEvidenceRow;
  availableBalance?: string;
  primaryPeriod?: PeriodEvidence;
  secondaryPeriod?: PeriodEvidence;
  primaryValue?: string;
  secondaryValue?: string;
  metric?: string;
  intent?: string;
  [key: string]: unknown;
}

/** Normalized shape of whatever /api/chat returned, whatever its status. */
export interface ChatApiResult {
  status: string;
  answer: string;
  summary?: FinanceSummary;
  evidence?: FinanceEvidence;
}

export type MessageRole = "user" | "assistant";

export interface UserChatMessage {
  id: string;
  role: "user";
  text: string;
}

export type AssistantMessageState = "loading" | "resolved" | "error";

export interface AssistantChatMessage {
  id: string;
  role: "assistant";
  state: AssistantMessageState;
  /** Present when state is "resolved". */
  result?: ChatApiResult;
  /** Present when state is "error" (network/parse failure, not a backend status). */
  errorText?: string;
  /** The user message text this reply answers - used to power retry. */
  replyToText: string;
}

export type ChatMessage = UserChatMessage | AssistantChatMessage;
