import { env } from "../config/env.js";
import { callGemini } from "./gemini.js";
import { callOllama } from "./ollama.js";
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
      errorType: "AI_ERROR" | "GEMINI_ERROR" | "PARSE_ERROR" | "VALIDATION_ERROR";
      message: string;
      raw?: string;
    };

/**
 * Dispatch prompt to configured AI provider (Ollama or Gemini).
 */
export async function callAIModel(userPrompt: string): Promise<string> {
  if (env.aiProvider === "gemini") {
    console.log(`[AI Dispatch] Provider: Gemini (Model: ${env.geminiModel})`);
    return callGemini(userPrompt);
  }
  console.log(
    `[AI Dispatch] Provider: Ollama (Model: ${env.ollamaModel}, Thinking: ${env.ollamaThinking}, Base: ${env.ollamaBaseUrl})`
  );
  return callOllama(userPrompt);
}

/**
 * Clean and extract JSON string from raw model output, stripping
 * <think> tags and markdown code fences if present.
 */
export function extractJsonFromText(raw: string): string {
  let text = raw.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const codeBlockMatch = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(text);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }

  return text;
}

/**
 * Normalizes minor model formatting variations (such as omitting null fields
 * or converting { type: "all" } / { type: "any" } date ranges to all-time).
 */
export function normalizeModelOutput(input: unknown): unknown {
  if (!input || typeof input !== "object") return input;

  const obj = { ...(input as Record<string, unknown>) };

  if (obj.status === "success" && obj.intent && typeof obj.intent === "object") {
    const intent = { ...(obj.intent as Record<string, unknown>) };

    if (intent.date_range === null || intent.date_range === undefined) {
      delete intent.date_range;
    } else if (
      typeof intent.date_range === "object" &&
      intent.date_range !== null &&
      "type" in intent.date_range &&
      ((intent.date_range as Record<string, unknown>).type === "all" ||
        (intent.date_range as Record<string, unknown>).type === "any")
    ) {
      delete intent.date_range;
    }

    for (const [key, value] of Object.entries(intent)) {
      if (value === null) {
        delete intent[key];
      }
    }

    obj.intent = intent;
  }

  return obj;
}

/**
 * Primary intent parser entrypoint for TBX Finance Assistant.
 * Translates natural language into a validated FinanceIntent result.
 */
export async function parseFinanceIntent(
  message: string,
  previousContext?: ConversationContext | null
): Promise<IntentParserResult> {
  const prompt = buildIntentUserPrompt(message, previousContext);
  const raw = await callAIModel(prompt);
  const cleanJson = extractJsonFromText(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    throw new Error(`Model returned malformed JSON: ${raw}`);
  }

  const normalized = normalizeModelOutput(parsed);
  const validation = validateIntentParserResult(normalized);
  if (!validation.valid) {
    throw new Error(`Validation failed for intent output: ${validation.error}`);
  }

  return validation.data;
}

/**
 * Safe variant providing discriminated errors (AI_ERROR, PARSE_ERROR, VALIDATION_ERROR)
 * for testing and CLI runners without uncaught exceptions.
 */
export async function parseFinanceIntentSafe(
  message: string,
  previousContext?: ConversationContext | null
): Promise<ParserExecutionResult> {
  const prompt = buildIntentUserPrompt(message, previousContext);
  let raw: string;
  try {
    raw = await callAIModel(prompt);
  } catch (err) {
    return {
      success: false,
      errorType: env.aiProvider === "gemini" ? "GEMINI_ERROR" : "AI_ERROR",
      message: err instanceof Error ? err.message : String(err),
    };
  }

  const cleanJson = extractJsonFromText(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJson);
  } catch {
    return {
      success: false,
      errorType: "PARSE_ERROR",
      message: "Model response is not valid JSON",
      raw,
    };
  }

  const normalized = normalizeModelOutput(parsed);
  const validation = validateIntentParserResult(normalized);
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

