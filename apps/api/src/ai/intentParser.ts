import { callGemini } from "./gemini.js";
import { buildIntentUserPrompt } from "./prompts/intent.js";
import { validateIntentParserResult } from "./validateIntent.js";
import type { IntentParserResult } from "./types.js";
import type { ConversationContext } from "./conversationContext.js";

export type ParserExecutionResult =
  | {
      success: true;
      data: IntentParserResult;
      raw: string;
    }
  | {
      success: false;
      errorType: "GEMINI_ERROR" | "PARSE_ERROR" | "VALIDATION_ERROR";
      message: string;
      raw?: string;
    };

/**
 * Primary intent parser entrypoint for TBX Finance Assistant.
 * Translates natural language into a validated FinanceIntent result.
 */
export async function parseFinanceIntent(
  message: string,
  previousContext?: ConversationContext | null
): Promise<IntentParserResult> {
  const prompt = buildIntentUserPrompt(message, previousContext);
  const raw = await callGemini(prompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Model returned malformed JSON: ${raw}`);
  }

  const validation = validateIntentParserResult(parsed);
  if (!validation.valid) {
    throw new Error(`Validation failed for intent output: ${validation.error}`);
  }

  return validation.data;
}

/**
 * Safe variant providing discriminated errors (GEMINI_ERROR, PARSE_ERROR, VALIDATION_ERROR)
 * for testing and CLI runners without uncaught exceptions.
 */
export async function parseFinanceIntentSafe(
  message: string,
  previousContext?: ConversationContext | null
): Promise<ParserExecutionResult> {
  const prompt = buildIntentUserPrompt(message, previousContext);
  let raw: string;
  try {
    raw = await callGemini(prompt);
  } catch (err) {
    return {
      success: false,
      errorType: "GEMINI_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      success: false,
      errorType: "PARSE_ERROR",
      message: "Model response is not valid JSON",
      raw,
    };
  }

  const validation = validateIntentParserResult(parsed);
  if (!validation.valid) {
    return {
      success: false,
      errorType: "VALIDATION_ERROR",
      message: validation.error,
      raw,
    };
  }

  return {
    success: true,
    data: validation.data,
    raw,
  };
}
