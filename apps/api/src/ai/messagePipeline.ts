import type { FinanceIntent } from "./types.js";
import {
  toConversationContext,
  type ConversationContext,
} from "./conversationContext.js";
import { validateIntent } from "./validateIntent.js";
import {
  executeFinanceIntent,
  type QueryPipelineResult,
} from "../query/queryPipeline.js";

/**
 * Parser output contract. Mirrors IntentParserResult from
 * apps/api/src/ai/intentParser.ts / types.ts on the teammate's
 * Gemini-integration branch (not yet merged into this branch) - verified
 * by inspecting that branch directly rather than assumed. Declared
 * locally (not imported) purely because that file doesn't exist here
 * yet; the shape is identical, so its parseFinanceIntent /
 * parseFinanceIntentSafe already satisfy FinanceIntentParser structurally
 * once merged, with no changes needed in this module.
 */
export type IntentParserResult =
  | {
      status: "success";
      intent: FinanceIntent;
    }
  | {
      status: "clarification";
      question: string;
      conversationContext?: ConversationContext;
      partialIntent?: ConversationContext;
    }
  | {
      status: "unsupported";
      message: string;
    };

export type FinanceIntentParser = (
  message: string,
  previousContext?: ConversationContext | null,
) => Promise<IntentParserResult>;

export type ProcessFinanceMessageResult =
  | QueryPipelineResult
  | {
      status: "unsupported_ai_intent";
      message: string;
    }
  | {
      status: "parser_error";
      message: string;
    };

export interface ProcessFinanceMessageOptions {
  previousContext?: ConversationContext | null;
  referenceDate?: Date;
}

/**
 * Bridges a raw natural-language message to the deterministic query
 * pipeline: parse -> validate -> plan -> template -> execute. The
 * supplied parser is the only piece allowed to call an LLM; everything
 * downstream of it is deterministic.
 *
 * The real parser (apps/api/src/ai/intentParser.ts on the teammate's
 * branch) throws on Gemini/JSON/validation failures rather than
 * returning a discriminated error - it also exposes a
 * parseFinanceIntentSafe() variant for callers that want that
 * discriminated separately. Either can be passed in here: this wraps the
 * call so a thrown error becomes a "parser_error" result instead of an
 * unhandled rejection, regardless of which variant is injected.
 */
export async function processFinanceMessage(
  message: string,
  parseFinanceIntent: FinanceIntentParser,
  options: ProcessFinanceMessageOptions = {},
): Promise<ProcessFinanceMessageResult> {
  let parsed: IntentParserResult;

  try {
    parsed = await parseFinanceIntent(
      message,
      options.previousContext,
    );
  } catch (error) {
    return {
      status: "parser_error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to parse the message.",
    };
  }

  if (parsed.status === "unsupported") {
    return {
      status: "unsupported_ai_intent",
      message: parsed.message,
    };
  }

  if (parsed.status === "clarification") {
    return {
      status: "clarification",
      question: parsed.question,
      conversationContext: parsed.partialIntent,
    };
  }

  const validation = validateIntent(parsed.intent);

  if (!validation.valid) {
    if (validation.clarification) {
      return {
        status: "clarification",
        question: validation.clarification,
        conversationContext: { intent: parsed.intent.intent },
      };
    }

    return {
      status: "unsupported_ai_intent",
      message: `Could not process this request: ${validation.reason}`,
    };
  }

  const result = await executeFinanceIntent(
    validation.intent,
    options.referenceDate ?? new Date(),
  );

  if (result.status === "success") {
    return {
      ...result,
      conversationContext: toConversationContext(result.intent),
    };
  }

  return result;
}
