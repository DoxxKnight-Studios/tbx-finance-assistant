import { Router, type Request, type Response } from "express";
import type { FinanceIntent } from "../ai/types.js";
import {
  processFinanceMessage,
  type FinanceIntentParser,
  type ProcessFinanceMessageResult,
} from "../ai/messagePipeline.js";
import { formatFinanceResponse } from "../response/responseFormatter.js";
import {
  answerGeneralMessage,
} from "../ai/generalAssistant.js";

interface ChatRequestBody {
  message?: unknown;
  conversationContext?: unknown;
  personalSearch?: unknown;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * conversationContext is untrusted HTTP input. It only ever flows into
 * the parser's prompt as loose prior-turn context (never into SQL, never
 * interpreted as an intent itself), so this only checks it's a plain
 * object rather than fully validating it as a Partial<FinanceIntent>.
 */
function normalizePreviousContext(
  value: unknown,
): Partial<FinanceIntent> | undefined {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Partial<FinanceIntent>;
  }

  return undefined;
}

function statusCodeFor(
  status: ProcessFinanceMessageResult["status"],
): number {
  switch (status) {
    case "success":
    case "clarification":
    case "unsupported_ai_intent":
    case "unsupported_query_intent":
    case "not_found":
      return 200;

    case "execution_error":
    case "parser_error":
      return 500;
  }
}

export function createChatRouter(
  parseFinanceIntent: FinanceIntentParser,
): Router {
  const router = Router();

  router.post("/chat", async (req: Request, res: Response) => {
    const body = req.body as ChatRequestBody;

    if (!isNonEmptyString(body?.message)) {
      res.status(400).json({
        status: "invalid_request",
        message: 'Request body must include a non-empty "message" string.',
      });
      return;
    }

    const previousContext = normalizePreviousContext(body.conversationContext);

    try {
      if (body.personalSearch === false) {
        const generalResult = await answerGeneralMessage(
          body.message,
          previousContext,
        );

        if (generalResult.status === "answer") {
          res.status(200).json({ status: "success", answer: generalResult.answer });
          return;
        }

        res.status(200).json({
          status: generalResult.status,
          answer: generalResult.question,
          originalMessage: generalResult.originalMessage,
          conversationContext: generalResult.conversationContext,
        });
        return;
      }

      const result = await processFinanceMessage(
        body.message,
        parseFinanceIntent,
        { previousContext },
      );

      if (result.status === "unsupported_ai_intent") {
        res.status(200).json({
          status: "general_query_confirmation",
          answer: `${result.message} This looks like a general query. Would you like to disable Personal search and continue?`,
          originalMessage: body.message,
          conversationContext: previousContext,
        });
        return;
      }

      res
        .status(statusCodeFor(result.status))
        .json(formatFinanceResponse(result));
    } catch (error) {
      res.status(500).json({
        status: "general_error",
        answer:
          error instanceof Error ? error.message : "Assistant request failed.",
      });
    }
  });

  return router;
}
