import { Router, type Request, type Response } from "express";
import type { FinanceIntent } from "../ai/types.js";
import {
  processFinanceMessage,
  type FinanceIntentParser,
  type ProcessFinanceMessageResult,
} from "../ai/messagePipeline.js";

interface ChatRequestBody {
  message?: unknown;
  conversationContext?: unknown;
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

    const result = await processFinanceMessage(
      body.message,
      parseFinanceIntent,
      {
        previousContext: normalizePreviousContext(
          body.conversationContext,
        ),
      },
    );

    res.status(statusCodeFor(result.status)).json(result);
  });

  return router;
}
