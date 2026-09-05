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

export async function callGemini(userPrompt: string): Promise<string> {
  const client = getClient();
  const model = env.personalSearchModel;

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
    if (!text) {
      throw new Error(`Gemini model "${model}" returned an empty response.`);
    }

    return text;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Gemini request failed using configured model "${model}": ${message}`
    );
  }
}
