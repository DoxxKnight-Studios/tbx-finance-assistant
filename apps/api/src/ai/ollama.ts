import { env } from "../config/env.js";
import { INTENT_SYSTEM_PROMPT } from "./prompts/intent.js";

interface OllamaChatMessage {
  role: string;
  content: string;
  thinking?: string;
}

interface OllamaChatResponse {
  model: string;
  message?: OllamaChatMessage;
  done?: boolean;
}

export async function callOllama(userPrompt: string): Promise<string> {
  const model = env.ollamaModel;
  const baseUrl = env.ollamaBaseUrl.replace(/\/+$/, "");
  const endpoint = `${baseUrl}/api/chat`;

  const payload = {
    model,
    messages: [
      { role: "system", content: INTENT_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    format: "json",
    think: env.ollamaThinking,
    stream: false,
    options: {
      temperature: 0,
    },
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama returned status ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const content = data.message?.content;

    if (!content || content.trim().length === 0) {
      throw new Error(`Ollama model "${model}" returned an empty response.`);
    }

    return content;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Ollama request failed using model "${model}" at ${endpoint}: ${message}`
    );
  }
}
