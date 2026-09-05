/**
 * Mirrors apps/api/src/response/responseFormatter.ts (FormattedFinanceResponse)
 * and the status values produced by apps/api/src/ai/messagePipeline.ts.
 * Kept intentionally loose (Record<string, unknown>) where the backend
 * itself types evidence loosely - the frontend must not assume shapes the
 * API doesn't actually guarantee.
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
  [key: string]: unknown;
}

export interface PeriodEvidence {
  start: string;
  endExclusive: string;
}

export interface VendorEvidence {
  name?: string;
  code?: string;
}

export interface VendorRankingRow {
  rank: number;
  vendorCode?: string;
  vendorName?: string;
  total?: string;
}

export interface UnreconciledRow {
  transactionId?: string;
  transactionReference?: string;
  transactionDate?: string;
  vendorCode?: string;
  vendorName?: string;
  amount?: string;
  category?: string;
  reconciliationStatus?: string;
}

export interface FinanceEvidence {
  template?: string;
  amountLessThan?: number;
  rows?: unknown[];
  rankings?: VendorRankingRow[];
  period?: PeriodEvidence;
  vendor?: VendorEvidence;
  intent?: string;
  [key: string]: unknown;
}

/** Normalized shape of whatever /api/chat returned, whatever its status. */
export interface ChatApiResult {
  status: string;
  answer: string;
  summary?: FinanceSummary;
  evidence?: FinanceEvidence;
  conversationContext?: Record<string, unknown>;
  originalMessage?: string;
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
