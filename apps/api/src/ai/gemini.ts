import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";
import { INTENT_SYSTEM_PROMPT } from "./prompts/intent.js";

let clientInstance: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!clientInstance) {
    clientInstance = new GoogleGenAI({ apiKey: env.geminiApiKey });
  }
  return clientInstance;
}

const CANDIDATE_MODELS = [
  env.geminiModel,
  "gemini-3.1-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
];

export async function callGemini(userPrompt: string): Promise<string> {
  const client = getClient();

  const modelsToTry = Array.from(new Set(CANDIDATE_MODELS.filter(Boolean)));
  let lastError: unknown = null;

  for (const model of modelsToTry) {
    try {
      const response = await client.models.generateContent({
        model,
        contents: userPrompt,
        config: {
          systemInstruction: INTENT_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          temperature: 0,
        },
      });

      const text = response.text;
      if (text) {
        return text;
      }
    } catch (err: unknown) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isNotFound = msg.includes("NOT_FOUND") || msg.includes("404");
      if (!isNotFound) {
        throw err;
      }
    }
  }

  throw lastError || new Error("All Gemini candidate models failed");
}
