import type {
  AccountFilter,
  BankFilter,
  ComparisonMetric,
  DateRange,
  FinanceIntent,
  IntentName,
  ProgramId,
  TransactionType,
} from "./types.js";

/**
 * Previously-established semantic facts that MAY be relevant to
 * interpreting the next user message - deliberately NOT a
 * Partial<FinanceIntent>. Because FinanceIntent is a discriminated
 * union, Partial<FinanceIntent> only keeps keys common to every branch
 * (effectively just `intent`), which can't represent "the previous turn
 * was a transaction_spend_total scoped to August and HDFC." This type
 * instead flattens every field that appears on ANY intent into one bag
 * of optional facts, each still fully typed (never `any` or
 * Record<string, unknown>).
 *
 * A ConversationContext is NOT required to be reconstructable into a
 * valid FinanceIntent on its own - it is raw material, not a request.
 * Deciding which of these facts still apply to a NEW message (fact
 * inheritance) versus which must be dropped (e.g. a stale date on an
 * account_balance follow-up) is Gemini's job, guided by
 * prompts/intent.ts - this type only carries the facts forward
 * losslessly and type-safely; it performs no relevance judgment itself.
 */
export interface ConversationContext {
  intent?: IntentName;
  date_range?: DateRange;
  transaction_type?: TransactionType;
  bank?: BankFilter;
  program_id?: ProgramId;
  account?: AccountFilter;
  transaction_reference?: string;
  comparison?: {
    metric: ComparisonMetric;
    primary: DateRange;
    secondary: DateRange;
  };
}

/**
 * Mechanically extracts every carryable field a completed FinanceIntent
 * happens to have into a ConversationContext - a plain "here is
 * everything we knew as of last turn" snapshot. Deliberately does NOT
 * decide what's still relevant for the next turn; that judgment belongs
 * to the parser/prompt, not this function.
 */
export function toConversationContext(intent: FinanceIntent): ConversationContext {
  const context: ConversationContext = { intent: intent.intent };

  if ("date_range" in intent && intent.date_range !== undefined) {
    context.date_range = intent.date_range;
  }
  if ("transaction_type" in intent && intent.transaction_type !== undefined) {
    context.transaction_type = intent.transaction_type;
  }
  if ("bank" in intent && intent.bank !== undefined) {
    context.bank = intent.bank;
  }
  if ("program_id" in intent && intent.program_id !== undefined) {
    context.program_id = intent.program_id;
  }
  if ("account" in intent && intent.account !== undefined) {
    context.account = intent.account;
  }
  if ("transaction_reference" in intent && intent.transaction_reference !== undefined) {
    context.transaction_reference = intent.transaction_reference;
  }
  if ("comparison" in intent && intent.comparison !== undefined) {
    context.comparison = intent.comparison;
  }

  return context;
}
