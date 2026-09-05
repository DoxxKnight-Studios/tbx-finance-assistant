import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import type { FinanceIntent } from "./types.js";

export type GeneralAssistantResult =
  | { status: "answer"; answer: string }
  | {
      status: "personal_data_confirmation";
      question: string;
      originalMessage: string;
      conversationContext?: Partial<FinanceIntent>;
    };

const GENERAL_SYSTEM_PROMPT = `
You are the general assistant for TBX Finance.

Return JSON only in one of these forms:
{"status":"answer","answer":"..."}
{"status":"personal_data_confirmation","question":"..."}

Use personal_data_confirmation when the user asks about their company's
transactions, vendors, payouts, spending, reconciliation, or any other data
that must come from the connected finance database. Do not answer those
questions from assumptions. Ask: "This question needs your personal finance
data. Would you like to enable Personal search?"

For all other questions, answer helpfully and briefly. Do not claim to have
access to private data. Never generate SQL or fabricate company figures.
`;

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: env.geminiApiKey });
  return client;
}

export async function answerGeneralMessage(
  message: string,
  previousContext?: Partial<FinanceIntent> | null,
): Promise<GeneralAssistantResult> {
  const context = previousContext
    ? `\nPrevious context: ${JSON.stringify(previousContext)}`
    : "";
  const response = await getClient().models.generateContent({
    model: env.generalAiModel,
    contents: `User message: "${message}"${context}`,
    config: {
      systemInstruction: GENERAL_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      temperature: 0.2,
    },
  });

  const raw = response.text;
  if (!raw) throw new Error("General assistant returned an empty response.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("General assistant returned malformed JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("General assistant returned an invalid response.");
  }

  const result = parsed as Record<string, unknown>;
  if (result.status === "answer" && typeof result.answer === "string") {
    return { status: "answer", answer: result.answer };
  }

  if (
    result.status === "personal_data_confirmation" &&
    typeof result.question === "string"
  ) {
    return {
      status: "personal_data_confirmation",
      question: result.question,
      originalMessage: message,
      conversationContext: previousContext ?? undefined,
    };
  }

  throw new Error("General assistant returned an invalid response shape.");
}
